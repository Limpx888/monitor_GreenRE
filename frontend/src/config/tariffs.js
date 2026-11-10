/**
 * =========================================================================
 * PENANG COMMERCIAL TARIFF CONFIGURATION (2026 Production Context)
 * Based on Tenaga Nasional Berhad (TNB) and PBAPP Penang Commercial Tariffs
 * =========================================================================
 */
export const TARIFF_CONFIG = {
  // Electricity: TNB Commercial Tariff B (>200 kWh) base rate RM 0.509 / kWh
  ELECTRICITY_BASE_RATE_KWH: 0.509,

  // ICPT Surcharge: Government Imbalance Cost Pass-Through (Commercial +RM 0.170 / kWh)
  ICPT_SURCHARGE_KWH: 0.170,

  // All-in Effective Commercial Tariff: RM 0.509 + RM 0.170 = RM 0.679 / kWh
  get ELECTRICITY_EFFECTIVE_RATE_KWH() {
    return +(this.ELECTRICITY_BASE_RATE_KWH + this.ICPT_SURCHARGE_KWH).toFixed(3);
  },

  // Active calculation rate (standard TNB baseline RM 0.509)
  ELECTRICITY_RATE_KWH: 0.509,

  // Water: PBAPP Penang Non-Domestic (Commercial) Tariff (>35 m³) = RM 2.27 / m³
  WATER_RATE_M3: 2.27,

  // Maintenance Labor Cost: Skilled BMS facility engineer / HVAC technician in Penang
  // (RM 400/day standard fully loaded rate = RM 50.00 / hour)
  LABOR_RATE_PER_HOUR: 50.00,

  // Carbon Emission Conversion Factor: Peninsular Malaysia Grid Baseline (kg CO2e per kWh)
  CARBON_FACTOR: 0.584,

  // Biophilic Tree Absorption Equivalent: Average tropical mature tree absorbs ~21 kg CO2e / year
  TREE_ABSORPTION_KG_YEAR: 21.0,

  // Consulting Cost Avoidance: External GreenRE / ESG compliance auditing consultant retainer
  CONSULTING_COST_AVOIDANCE_ANNUAL_MYR: 45000.0,
};

