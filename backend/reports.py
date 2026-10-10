"""GreenRE evidence PDF from aggregated zone consumption."""

from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ems_service import zone_consumption


def build_greenre_pdf(db) -> bytes:
    summary = zone_consumption(db)
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title="GreenRE Continuous Compliance Evidence",
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("GreenRE Continuous Compliance Evidence Pack", styles["Title"]),
        Paragraph("The Light City Penang · EcoPulse EMS", styles["Normal"]),
        Spacer(1, 8),
        Paragraph(
            f"Generated (UTC): {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
            styles["Normal"],
        ),
        Paragraph(
            f"Aggregation window: {summary.window_hours:.1f} h · "
            f"Building EEI: {summary.building_eei_kwh_m2_yr:.1f} kWh/m²·yr · "
            f"Status: {summary.building_compliance_status}",
            styles["Normal"],
        ),
        Spacer(1, 10),
        Paragraph("Zone aggregated electricity", styles["Heading2"]),
    ]

    table_data = [
        ["Zone", "Floors", "kWh", "EEI", "Baseline", "Excess", "Status"]
    ]
    for zone in summary.zones:
        table_data.append(
            [
                zone.name,
                zone.floors_label,
                f"{zone.energy_kwh:.1f}",
                f"{zone.eei_kwh_m2_yr:.1f}",
                f"{zone.eei_baseline_kwh_m2_yr:.0f}",
                f"{zone.excess_kwh:.1f}",
                zone.compliance_status,
            ]
        )

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 12))
    story.append(Paragraph("Excess consumption & recommendations", styles["Heading2"]))

    warnings = [z for z in summary.zones if z.compliance_status == "warning"]
    if not warnings:
        story.append(
            Paragraph(
                "No zone exceeds its GreenRE EEI baseline in the current window.",
                styles["Normal"],
            )
        )
    else:
        for zone in warnings:
            story.append(
                Paragraph(
                    f"<b>{zone.name}</b> — {zone.recommendation or 'Reduce HVAC and lighting loads.'}",
                    styles["Normal"],
                )
            )
            story.append(Spacer(1, 6))

    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "EEI = (zone energy kWh / zone GFA m²) × (8760 / window hours). "
            "Floor-to-zone mapping is stored in PostgreSQL (zones.zone_id on floors) "
            "so reallocating L13 does not require algorithm changes.",
            styles["Italic"],
        )
    )

    doc.build(story)
    return buffer.getvalue()
