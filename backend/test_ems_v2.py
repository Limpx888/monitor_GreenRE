"""Integration test suite for EMS v2.0 Architecture.

Validates:
1. Power-quality telemetry ingestion (kW, V, A, PF, kVAR, quality_status)
2. Outlier cleaning & validation rules
3. Threshold-based alarm generation & lifecycle state machine
4. TOU tariff engine (TNB Schedule D peak/off-peak + demand charges)
5. Control adapters (BACnet, Modbus, Stub) + audit trail
"""
import sys
import os
import asyncio
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from schemas import (
    TelemetryReading,
    AlarmAcknowledgeRequest,
    AlarmInvestigateRequest,
    AlarmResolveRequest,
    AlarmCloseRequest,
    HvacSetpointCommand,
    LightingSceneCommand,
)
from ems_service import ingest_readings, zone_consumption, apply_tou_cost
from alarm_service import (
    acknowledge_alarm,
    investigate_alarm,
    resolve_alarm,
    close_alarm,
    list_alarms,
)
from control_adapters import get_dispatcher, log_command, ControlAuditLog
from db_models import Alarm, AlarmState, TouTariffRate


def test_telemetry_and_cleaning():
    print("\n--- Test 1: Telemetry Ingest & Data Quality ---")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Create a mix of normal, low-PF, and invalid readings
        readings = [
            # Normal reading with full electrical parameters
            TelemetryReading(
                timestamp=now,
                floor_id="L4",
                meter_type="electricity",
                reading_kwh=32.5,
                demand_kw=130.0,
                voltage_v=415.0,
                current_a=185.0,
                power_factor=0.92,
                reactive_kvar=55.0,
                quality_status="LIVE",
            ),
            # Low power factor (triggers alarm condition)
            TelemetryReading(
                timestamp=now,
                floor_id="L14",
                meter_type="electricity",
                reading_kwh=48.0,
                demand_kw=192.0,
                voltage_v=412.0,
                current_a=320.0,
                power_factor=0.74,  # Below 0.85 TNB penalty threshold
                reactive_kvar=175.0,
                quality_status="LIVE",
            ),
            # Spike reading (tested by data cleaning outlier rules)
            TelemetryReading(
                timestamp=now,
                floor_id="L5",
                meter_type="electricity",
                reading_kwh=999.0,
                demand_kw=800.0,
                voltage_v=415.0,
                power_factor=0.90,
                quality_status="LIVE",
            ),
        ]

        result = ingest_readings(db, readings)
        print(f"  Ingest summary: inserted={result.get('inserted_count')}, rejected={result.get('rejected_count')}, alarms={result.get('alarm_count')}")
        assert result.get("inserted_count", 0) >= 2, "At least 2 valid readings should be recorded"

        # Check aggregation
        summary = zone_consumption(db)
        print(f"  Aggregated building EEI: {summary.building_eei_kwh_m2_yr:.1f} kWh/m2/yr")
        print(f"  Building compliance status: {summary.building_compliance_status}")
        assert len(summary.zones) > 0, "Zones must be populated"
        print("  Test 1: PASSED")
    finally:
        db.close()


def test_alarm_lifecycle():
    print("\n--- Test 2: Alarm Generation & State Machine Lifecycle ---")
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Ingest low PF reading to trigger alarm generation
        low_pf_reading = TelemetryReading(
            timestamp=now,
            floor_id="L15",
            meter_type="electricity",
            reading_kwh=55.0,
            demand_kw=220.0,
            power_factor=0.71,
            voltage_v=410.0,
        )
        ingest_res = ingest_readings(db, [low_pf_reading])
        print(f"  Ingested low-PF reading: raised {ingest_res.get('alarm_count')} alarms.")
        
        # Fetch an OPEN alarm
        alarm_list = list_alarms(db, state="OPEN")
        assert alarm_list.total > 0, "Expected at least 1 OPEN alarm"
        target_alarm = alarm_list.alarms[0]
        alarm_id = target_alarm.id
        print(f"  Target Alarm #{alarm_id}: [{target_alarm.severity}] {target_alarm.alarm_code} - {target_alarm.description}")
        assert target_alarm.state == "OPEN"

        # 1. Acknowledge: OPEN -> ACKNOWLEDGED
        ack = acknowledge_alarm(db, alarm_id, AlarmAcknowledgeRequest(assigned_to="Engineer_A"))
        print(f"  [ACK] Alarm #{alarm_id} state is now: {ack.state} (assigned to {ack.assigned_to})")
        assert ack.state == AlarmState.ACKNOWLEDGED.value

        # 2. Investigate: ACKNOWLEDGED -> INVESTIGATING
        inv = investigate_alarm(
            db, alarm_id, AlarmInvestigateRequest(notes="Investigating capacitor bank on Hyatt riser")
        )
        print(f"  [INV] Alarm #{alarm_id} state is now: {inv.state} (notes: '{inv.notes}')")
        assert inv.state == AlarmState.INVESTIGATING.value

        # 3. Resolve: INVESTIGATING -> RESOLVED
        res = resolve_alarm(
            db,
            alarm_id,
            AlarmResolveRequest(
                root_cause="Faulty APFC contactor stage 3 replaced",
                notes="Swapped stage 3 capacitor contactor and verified PF > 0.92",
            ),
        )
        print(f"  [RES] Alarm #{alarm_id} state is now: {res.state} (root cause: '{res.root_cause}')")
        assert res.state == AlarmState.RESOLVED.value

        # 4. Close: RESOLVED -> CLOSED
        cls = close_alarm(db, alarm_id, AlarmCloseRequest(notes="Verified stable PF for 30 minutes"))
        print(f"  [CLS] Alarm #{alarm_id} state is now: {cls.state}")
        assert cls.state == AlarmState.CLOSED.value
        print("  Test 2: PASSED")
    finally:
        db.close()


def test_tou_tariff_calculation():
    print("\n--- Test 3: TNB Schedule D TOU Tariff Engine ---")
    db = SessionLocal()
    try:
        # Calculate during peak window (Monday 10:00 to 14:00)
        # 2026-10-12 is a Monday
        peak_start = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)
        peak_end = datetime(2026, 10, 12, 14, 0, tzinfo=timezone.utc)
        peak_cost = apply_tou_cost(
            db=db,
            zone_energy_kwh=400.0,
            peak_demand_kw=180.0,
            window_start=peak_start,
            window_end=peak_end,
        )
        print(f"  Peak Period Window (10:00 - 14:00):")
        print(f"    Energy Cost: RM {peak_cost['energy_cost_myr']:.2f}")
        print(f"    Demand Charge: RM {peak_cost['demand_charge_myr']:.2f}")
        print(f"    Total Cost: RM {peak_cost['total_cost_myr']:.2f}")
        assert peak_cost["energy_cost_myr"] > 0, "Peak energy cost must be > 0"
        assert peak_cost["demand_charge_myr"] > 0, "Peak demand charge must be > 0"

        # Calculate during off-peak window (Monday 00:00 to 04:00)
        offpeak_start = datetime(2026, 10, 12, 0, 0, tzinfo=timezone.utc)
        offpeak_end = datetime(2026, 10, 12, 4, 0, tzinfo=timezone.utc)
        offpeak_cost = apply_tou_cost(
            db=db,
            zone_energy_kwh=400.0,
            peak_demand_kw=0.0,
            window_start=offpeak_start,
            window_end=offpeak_end,
        )
        print(f"  Off-Peak Period Window (00:00 - 04:00):")
        print(f"    Energy Cost: RM {offpeak_cost['energy_cost_myr']:.2f}")
        print(f"    Total Cost: RM {offpeak_cost['total_cost_myr']:.2f}")
        assert offpeak_cost["energy_cost_myr"] > 0, "Off-peak energy cost must be > 0"
        assert peak_cost["energy_cost_myr"] > offpeak_cost["energy_cost_myr"], "Peak energy cost must exceed off-peak"
        print("  Test 3: PASSED")
    finally:
        db.close()


async def _async_test_control():
    db = SessionLocal()
    try:
        dispatcher = get_dispatcher("stub")

        # 1. HVAC Setpoint Command
        cmd1 = HvacSetpointCommand(zone_id=1, setpoint_c=23.5, operator="EMS_Auto")
        res1 = await dispatcher.set_hvac_setpoint(str(cmd1.zone_id), cmd1.setpoint_c)
        log_command(db, res1, target_type="zone", protocol="stub", operator=cmd1.operator)
        print(f"  HVAC Dispatch: success={res1.success} confirmed={res1.confirmed_value} msg='{res1.message}'")
        assert res1.success is True

        # 2. Lighting Scene Command
        cmd2 = LightingSceneCommand(floor_id=4, scene="50pct", operator="Scheduler")
        res2 = await dispatcher.set_lighting_scene(str(cmd2.floor_id), cmd2.scene)
        log_command(db, res2, target_type="floor", protocol="stub", operator=cmd2.operator)
        print(f"  Lighting Dispatch: success={res2.success} confirmed={res2.confirmed_value} msg='{res2.message}'")
        assert res2.success is True

        # 3. Check Control Audit Log
        logs = db.query(ControlAuditLog).order_by(ControlAuditLog.id.desc()).limit(5).all()
        assert len(logs) >= 2, "Audit log must contain dispatched commands"
        print(f"  Control Audit Log verified ({len(logs)} recent entries found):")
        for log in logs[:2]:
            print(f"    [{log.dispatched_at}] {log.command} target={log.target_type}:{log.target_id} req={log.requested_value} conf={log.confirmed_value} op={log.operator}")
        print("  Test 4: PASSED")
    finally:
        db.close()


def test_control_adapters_and_audit():
    print("\n--- Test 4: Control Dispatch & Audit Trail ---")
    asyncio.run(_async_test_control())


if __name__ == "__main__":
    print("==================================================")
    print("EMS v2.0 Architecture Integration Verification")
    print("==================================================")
    test_telemetry_and_cleaning()
    test_alarm_lifecycle()
    test_tou_tariff_calculation()
    test_control_adapters_and_audit()
    print("\nALL EMS v2.0 INTEGRATION TESTS COMPLETED SUCCESSFULLY!")
