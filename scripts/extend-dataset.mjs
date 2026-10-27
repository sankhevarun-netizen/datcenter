// scripts/extend-dataset.mjs
//
// Adds the sheets features 6–15 need to nexus_demo_dataset.xlsx, in the
// workbook's own style, so every number the product shows still comes from
// one workbook. Idempotent: re-running replaces these sheets and the
// energy_reused_kwh column rather than duplicating them.
//
//   23_runbooks         ordered response steps per component failure mode
//   24_site_risk        natural-hazard and grid-reliability exposure per site
//   25_supply_chain     vendor, origin and lead time per component type
//   26_thermal_sensors  MUM-1 cold-aisle inlet and CRAH supply-air readings
//   13_energy           + energy_reused_kwh (EU EED energy reuse factor)
//
// Values follow the README's rules for extending the data: the existing
// naming scheme, no real operators, no round-number placeholders. Each value
// is cross-checked against the existing sheets by lib/nexus/consistency.test.mjs.
//
// Run with `node scripts/extend-dataset.mjs`, then `npm run import:dataset`.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'nexus_demo_dataset.xlsx');
const json = (name) => JSON.parse(readFileSync(join(root, 'data', 'nexus', `${name}.json`), 'utf8'));

// ── 23_runbooks ─────────────────────────────────────────────────────────────
// One row per step. match_terms are pipe-separated phrases found in the alert
// messages (20_active_alerts) and incident root causes (11_incidents) that
// this runbook answers. owner_team uses the teams already named in 20_active_alerts.
// impact says what is at stake if the condition runs on: an outage (tenant
// SLAs), capacity (growth blocked), compliance (a reportable breach) or
// efficiency (energy and cost).
const RUNBOOKS = [
  ['RB-UPS-BAT', 'ups', 'Battery string degradation', 'outage', 'resistance trending|internal resistance|capacity fade|Battery batch', [
    ['Confirm the string resistance trend against the last discharge test', 'Electrical', 30],
    ['Verify the redundant module can carry the full load, then transfer the affected string', 'Electrical', 60],
    ['Issue tenant notifications for every contract on the affected UPS chain', 'Leadership', 120],
    ['Raise an emergency string replacement with the vendor and pull the depot spare', 'Facilities', 240],
    ['Audit every string from the same batch across the portfolio', 'Electrical', 1440],
  ]],
  ['RB-CRAH-SAT', 'crah', 'Supply air above setpoint', 'outage', 'Supply air temp|actuator', [
    ['Check chilled-water valve actuator response at the unit', 'Facilities', 15],
    ['Raise the partner CRAH fan speed and confirm rack inlets stay under 27 C', 'Facilities', 30],
    ['Replace the actuator from site spares', 'Facilities', 180],
    ['Log the thermal excursion against the rows served', 'Capacity planning', 1440],
  ]],
  ['RB-CRAH-FLT', 'crah', 'Filter loading', 'efficiency', 'Filter differential pressure', [
    ['Schedule a filter change in the next maintenance window', 'Facilities', 1440],
    ['Compare fan power draw against the commissioning baseline', 'Facilities', 2880],
  ]],
  ['RB-CHL-TRIP', 'chiller', 'Chiller trip on condenser scaling', 'outage', 'scale build-up|Cooling water quality', [
    ['Start the standby chiller and confirm chilled-water supply temperature', 'Facilities', 15],
    ['Check rack inlet temperatures in every hall the plant serves', 'Facilities', 30],
    ['Dose descalant and schedule mechanical tube cleaning', 'Facilities', 1440],
    ['Review make-up water treatment against the hardness trend', 'Facilities', 4320],
  ]],
  ['RB-CHL-APP', 'chiller', 'Condenser approach degrading', 'efficiency', 'Approach temperature', [
    ['Trend condenser approach against the 2.8 C design value', 'Facilities', 240],
    ['Test condenser water hardness and conductivity', 'Facilities', 480],
    ['Stage the chiller out and schedule tube cleaning', 'Facilities', 10080],
    ['Restate the monthly PUE impact for the energy report', 'Sustainability', 10080],
  ]],
  ['RB-CT-WTR', 'cooling_tower', 'Make-up water shortfall', 'outage', 'Make-up water|Municipal supply', [
    ['Switch make-up to treated-water storage and confirm hours of reserve', 'Facilities', 30],
    ['Activate the standby tanker supply contract', 'Facilities', 240],
    ['Raise cycles of concentration within chemistry limits', 'Facilities', 480],
  ]],
  ['RB-CT-WUE', 'cooling_tower', 'Water use above reporting target', 'compliance', 'WUE', [
    ['Confirm the WUE reading against the make-up and blowdown meters', 'Sustainability', 240],
    ['Raise cycles of concentration within chemistry limits', 'Facilities', 480],
    ['File the state water-impact disclosure with the corrective plan', 'Sustainability', 4320],
  ]],
  ['RB-CHW-DP', 'chw_loop', 'Loop differential pressure rising', 'efficiency', 'Differential pressure', [
    ['Inspect strainers and isolation valves on the loop', 'Facilities', 240],
    ['Flush the affected loop section during low load', 'Facilities', 4320],
  ]],
  ['RB-BUS-IMB', 'busway', 'Phase imbalance or loose joint', 'outage', 'Phase imbalance|Loose connection', [
    ['Thermographic scan of every tap-off box on the run', 'Electrical', 120],
    ['Rebalance rack PDU phase assignments', 'Electrical', 1440],
    ['Torque-check busway joints in the next window', 'Electrical', 4320],
  ]],
  ['RB-PDU-OVL', 'pdu', 'Circuit near rated capacity', 'capacity', 'rated capacity', [
    ['Freeze new deployments on the circuit', 'Capacity planning', 60],
    ['Move the highest-draw racks to circuits with headroom', 'Capacity planning', 4320],
    ['Raise a PDU upgrade if growth continues', 'Capacity planning', 10080],
  ]],
  ['RB-GEN-FUEL', 'generator', 'Fuel supply or filtration', 'outage', 'Fuel level|Fuel filter', [
    ['Order a top-up to 90% of tank capacity', 'Facilities', 240],
    ['Replace fuel filters and run a 30-minute load test', 'Electrical', 1440],
    ['Confirm the fuel polishing schedule', 'Facilities', 10080],
  ]],
  ['RB-UTIL-CAP', 'utility_feed', 'Sanctioned load near limit', 'capacity', 'Sanctioned load|GRID CONSTRAINED', [
    ['Cap new IT load intake at the site', 'Capacity planning', 60],
    ['Redirect planned deployments to sites with grid headroom', 'Capacity planning', 1440],
    ['File a load enhancement application with the utility', 'Leadership', 10080],
  ]],
  ['RB-TX-DGA', 'transformer', 'Insulation degradation (dissolved gas)', 'outage', 'Dissolved gas|acetylene|top-oil', [
    ['Repeat the oil sample within 7 days to confirm the gas trend', 'Electrical', 10080],
    ['Keep the peer transformer able to carry the full load alone (2N)', 'Electrical', 1440],
    ['Plan an outage window for oil treatment and internal inspection', 'Electrical', 20160],
    ['Order long-lead spares now (34-week transformer lead time)', 'Leadership', 10080],
  ]],
  ['RB-ROW-CAP', 'rack_row', 'Row at full occupancy', 'capacity', 'rack occupancy', [
    ['Review stranded capacity elsewhere in the facility', 'Capacity planning', 1440],
    ['Run the density cascade before approving any upgrade', 'Capacity planning', 4320],
  ]],
];

const runbookRows = RUNBOOKS.flatMap(([id, type, mode, impact, match, steps]) =>
  steps.map(([action, owner, within], i) => [id, type, mode, impact, match, i + 1, action, owner, within]));

// ── 24_site_risk ────────────────────────────────────────────────────────────
// Seismic zone per BIS IS 1893 (Part 1):2016. Exposure scored 1 (low) to 5
// (severe) from the IMD hazard atlas and NDMA flood-prone district lists.
// Grid trips are feed interruptions over the last 12 months at site metering.
const SITE_RISK = [
  ['MUM-1', 'III', 4, 3, 2, 3, 18, 'July 2005 Mumbai floods; Cyclone Tauktae, May 2021'],
  ['MUM-2', 'III', 4, 3, 2, 5, 23, 'Low-lying plot; same 2005 and 2021 events as MUM-1'],
  ['CHN-1', 'III', 4, 4, 4, 4, 27, 'December 2015 Chennai floods; Cyclone Michaung, December 2023'],
  ['HYD-1', 'II', 3, 1, 4, 2, 11, 'October 2020 Hyderabad floods'],
  ['NCR-1', 'IV', 3, 1, 5, 7, 34, 'May 2024 north India heatwave and peak-demand curtailment; July 2023 Yamuna and Hindon floods in Noida'],
  ['BLR-1', 'II', 3, 1, 2, null, null, 'September 2022 Bengaluru flooding; site not yet energised'],
];

// ── 25_supply_chain ─────────────────────────────────────────────────────────
// Lead times match 06_upgrade_options where a component type appears there.
const SUPPLY = [
  ['ups', 'Vendor A', 'China', 'yes', 16, 0, 'Cells shipped via the Red Sea route; 2024 diversions added 2-3 weeks'],
  ['pdu', 'Vendor C', 'India', 'no', 10, 2, 'Domestic assembly; two units held at the regional depot'],
  ['rpp', 'Vendor C', 'India', 'no', 9, 1, 'Domestic assembly'],
  ['busway', 'Vendor D', 'Germany', 'yes', 14, 0, 'Single qualified supplier for the installed rating'],
  ['crah', 'Vendor E', 'Italy', 'no', 8, 1, 'Fans and actuators stocked locally; full units imported'],
  ['chiller', 'Vendor F', 'United States', 'yes', 22, 0, 'Compressor allocation constrained since 2023'],
  ['cooling_tower', 'Vendor G', 'India', 'no', 12, 0, 'Fill media sourced domestically'],
  ['chw_loop', 'Vendor G', 'India', 'no', 6, 0, 'Pipework and valves from local fabricators'],
  ['generator', 'Vendor H', 'United Kingdom', 'no', 26, 0, 'Engine imported, alternator and enclosure assembled in India'],
  ['transformer', 'Vendor J', 'India', 'no', 34, 0, 'Grain-oriented steel shortage pushed lead times past 30 weeks'],
  ['switchgear', 'Vendor K', 'France', 'yes', 20, 0, 'Breaker frames allocated quarterly'],
];

// ── 26_thermal_sensors ──────────────────────────────────────────────────────
// Two cold-aisle inlet sensors per MUM-1 row. The far-end sensor is the row's
// worst inlet, so 27 C (ASHRAE A1 recommended upper limit) minus that reading
// is the row's thermal_margin_c in 03_rows. The near-end sensor sits beside
// the CRAH and reads cooler. CRAH supply air runs to an 18 C setpoint;
// CRAH-K-01 reads 2.1 C over it, which is alert ALM-4821.
const READ_AT = '2026-09-29 03:00';
const round1 = (v) => Math.round(v * 10) / 10;

function sensorRows() {
  const rows = json('rows').filter((r) => r.facility_id === 'MUM-1');
  const out = [];
  rows.forEach((row, i) => {
    const far = round1(27 - row.thermal_margin_c);
    const near = round1(far - (0.6 + ((i * 7) % 6) / 10));
    out.push([`TS-${row.row_id}1`, 'MUM-1', row.hall_id, row.row_id, `CRAH-${row.row_id}-01`, 'cold aisle inlet, CRAH end', near, null, 27, READ_AT]);
    out.push([`TS-${row.row_id}2`, 'MUM-1', row.hall_id, row.row_id, `CRAH-${row.row_id}-02`, 'cold aisle inlet, far end', far, null, 27, READ_AT]);
  });
  rows.forEach((row, i) => {
    for (const unit of ['01', '02']) {
      const id = `CRAH-${row.row_id}-${unit}`;
      const reading = id === 'CRAH-K-01' ? 20.1 : round1(18 + (((i * 2 + Number(unit)) * 37) % 9 - 4) / 10);
      out.push([`SAT-${id}`, 'MUM-1', row.hall_id, row.row_id, id, 'CRAH supply air', reading, 18, 20, READ_AT]);
    }
  });
  return out;
}

// ── 27_hourly_generation: proposed solar PPA against MUM-1's real load ─────
// 30 representative days across January–September 2026. Load is each month's
// 13_energy average (total_kwh ÷ hours in month) with a small afternoon
// cooling swing, so it reconciles with the energy sheet. Solar follows the
// Mumbai day (zero before 06:00 and from 19:00, peak around 12:30 at ~92% of
// PPA capacity), scaled by sky condition; the monsoon months are cloudier and
// 16 July is a storm day. The PPA is sized so annual volumetric sourcing is
// about 72%, the figure a REC-based report would show.
const CFE_DAYS = [['2026-01-08','clear'],['2026-01-17','clear'],['2026-01-26','partly cloudy'],['2026-02-05','clear'],['2026-02-14','clear'],['2026-02-23','clear'],['2026-03-04','clear'],['2026-03-12','clear'],['2026-03-20','partly cloudy'],['2026-03-28','clear'],['2026-04-06','clear'],['2026-04-15','clear'],['2026-04-23','hazy'],['2026-05-02','clear'],['2026-05-11','hazy'],['2026-05-20','clear'],['2026-05-29','partly cloudy'],['2026-06-09','partly cloudy'],['2026-06-18','overcast'],['2026-06-27','overcast'],['2026-07-07','overcast'],['2026-07-16','storm'],['2026-07-25','overcast'],['2026-08-04','overcast'],['2026-08-13','partly cloudy'],['2026-08-22','overcast'],['2026-09-03','partly cloudy'],['2026-09-12','overcast'],['2026-09-21','partly cloudy'],['2026-09-29','clear']];
const SKY_FACTOR = { clear: 1, hazy: 0.88, 'partly cloudy': 0.74, overcast: 0.4, storm: 0.06 };
const PPA_KW = 38500;
function hourlyGenerationRows() {
  const energy = json('energy').filter((e) => e.facility_id === 'MUM-1');
  const hoursOf = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate() * 24; };
  const shape = (h) => (h < 6 || h >= 19 ? 0 : Math.max(0, Math.sin((Math.PI * (h + 0.5 - 6)) / 13)) ** 1.7);
  const out = [];
  CFE_DAYS.forEach(([date, sky], d) => {
    const e = energy.find((x) => x.month === date.slice(0, 7));
    const avgKw = e.total_kwh / hoursOf(e.month);
    const day = 1 + (((d * 7919) % 11) - 5) / 100; // ±5% day-to-day variation, fixed
    for (let h = 0; h < 24; h += 1) {
      const load = Math.round(avgKw * (1 + 0.035 * Math.cos((2 * Math.PI * (h - 15)) / 24)));
      const solar = Math.round(PPA_KW * 0.92 * SKY_FACTOR[sky] * day * shape(h));
      const matched = Math.min(solar, load);
      out.push(['MUM-1', date, h, `${date} ${String(h).padStart(2, '0')}:00`, sky, load, solar, PPA_KW, load - matched, matched, load - matched, Math.round((matched / load) * 1000) / 10]);
    }
  });
  return out;
}

// ── 28_clean_energy_assets: the proposed PPA and storage options ───────────
// Battery cost from Ember (Dec 2025) grid-scale all-in ~USD 125/kWh at ₹85/USD;
// behind-the-meter projects usually cost more. PPA landed cost within the
// ₹4.0–8.15/kWh range reported for Maharashtra open-access solar (2025–26).
const CLEAN_ASSETS = [
  ['MUM-1', 'PPA-MUM-1-SOLAR', 'solar_ppa', 'proposed', 0, PPA_KW, 100, 5.5, 0, 40, 'Tata Power-style solar PPA, group captive, sized for ~72% annual volumetric match'],
  ['MUM-1', 'BESS-MUM-1-PILOT', 'bess', 'proposed', 4000, 2000, 88, 0, 425, 26, '4 MWh pilot: the size often quoted, covers a small share of the night'],
  ['MUM-1', 'BESS-MUM-1-A', 'bess', 'proposed', 120000, 30000, 88, 0, 12750, 52, '4-hour battery sized to firm the PPA overnight'],
];

// ── 29_water_reuse_opportunities: the three standard datacentre levers ─────
// Rainwater volume = roof catchment × annual rainfall × 0.8 runoff. Mumbai
// ~2,400 mm, Chennai ~1,400 mm (IMD normals). water_cost blends the municipal
// commercial tariff with tanker top-up during shortfalls (site cost).
const REUSE_SITES = { 'MUM-1': { roof: 9600, rainMm: 2400, costKl: 85 }, 'CHN-1': { roof: 7800, rainMm: 1400, costKl: 140 } };
function waterReuseRows() {
  const out = [];
  for (const [id, s] of Object.entries(REUSE_SITES)) {
    const rain = Math.round(s.roof * (s.rainMm / 1000) * 0.8 * 1000);
    const humid = id === 'MUM-1';
    out.push(
      [id, 'condensate', 'Recover condensate from CRAH and AHU cooling coils into the cooling-tower make-up tank', humid ? 6200000 : 5100000, 'Low: filtration and UV', humid ? 22 : 20, 1.5, s.costKl],
      [id, 'greywater', 'Treat greywater from the facility’s own washrooms and canteen for cooling-tower make-up', humid ? 1400000 : 1100000, 'Medium: membrane bioreactor', humid ? 35 : 32, 4, s.costKl],
      [id, 'rainwater', `Harvest rainwater from ${s.roof.toLocaleString('en-IN')} m² of roof into storage for make-up`, rain, 'Low: first-flush, filtration, storage', humid ? 68 : 58, 2.5, s.costKl],
    );
  }
  return out;
}

const SHEETS = [
  {
    name: '27_hourly_generation',
    header: ['facility_id', 'date', 'hour_of_day', 'timestamp', 'sky', 'load_kw', 'solar_generation_kw', 'ppa_capacity_kw', 'grid_draw_kw', 'matched_kw', 'unmatched_kw', 'matching_pct'],
    widths: [11, 12, 11, 17, 14, 10, 18, 15, 12, 11, 13, 13],
    rows: hourlyGenerationRows(),
    notes: [
      'Proposed solar PPA (PPA-MUM-1-SOLAR in 28_clean_energy_assets) against MUM-1 facility load. 30 representative days, January to September 2026.',
      'load_kw is the month’s 13_energy total_kwh ÷ hours in the month, with a ±3.5% afternoon cooling swing. It reconciles with 13_energy.',
      'Solar is zero before 06:00 and from 19:00 and peaks near 12:30. Sky condition scales the day; 16 July is a monsoon storm day.',
      'matched_kw = min(solar, load): what is clean in the hour it is used. No storage is installed today.',
    ],
  },
  {
    name: '28_clean_energy_assets',
    header: ['facility_id', 'asset_id', 'asset_type', 'status', 'capacity_kwh', 'power_kw', 'round_trip_efficiency_pct', 'tariff_inr_kwh', 'cost_inr_lakh', 'lead_time_weeks', 'basis'],
    widths: [11, 18, 11, 10, 13, 10, 24, 14, 13, 15, 72],
    rows: CLEAN_ASSETS,
    notes: [
      'MUM-1 has no storage today. Both batteries are options; the PPA is the scenario modelled in 27_hourly_generation.',
      'Battery cost: Ember, How cheap is battery storage? (Dec 2025), grid-scale all-in ~USD 125/kWh at ₹85/USD. Behind-the-meter projects usually cost more.',
      'PPA tariff: landed cost within the ₹4.0–8.15/kWh range reported for Maharashtra open-access solar, 2025–26.',
    ],
  },
  {
    name: '29_water_reuse_opportunities',
    header: ['facility_id', 'source', 'description', 'volume_litres_per_year', 'treatment_required', 'capex_inr_lakh', 'opex_inr_lakh_per_year', 'water_cost_inr_per_kl'],
    widths: [11, 12, 70, 22, 34, 14, 22, 20],
    rows: waterReuseRows(),
    notes: [
      'Rainwater = roof catchment × annual rainfall × 0.8 runoff. Rainfall: Mumbai ~2,400 mm, Chennai ~1,400 mm (IMD normals).',
      'water_cost_inr_per_kl blends the municipal commercial tariff with tanker top-up during shortfalls.',
      'Payback = capex ÷ (litres saved × water cost − opex). Greywater rarely pays back on cost alone at these volumes.',
    ],
  },
  {
    name: '23_runbooks',
    header: ['runbook_id', 'component_type', 'failure_mode', 'impact', 'match_terms', 'step', 'action', 'owner_team', 'within_min'],
    widths: [14, 15, 30, 12, 44, 6, 72, 18, 11],
    rows: runbookRows,
    notes: [
      'Steps run in order. within_min is the target time from detection to completing the step.',
      'impact: outage (tenant SLAs at stake), capacity (growth blocked), compliance (reportable breach), efficiency (energy and cost).',
      'Owner teams are the teams already named in 20_active_alerts.',
    ],
  },
  {
    name: '24_site_risk',
    header: ['facility_id', 'seismic_zone', 'flood_exposure', 'cyclone_exposure', 'heat_exposure', 'grid_trips_12m', 'avg_trip_min', 'reference_event'],
    widths: [11, 12, 13, 15, 13, 14, 12, 64],
    rows: SITE_RISK,
    notes: [
      'Seismic zone per BIS IS 1893 (Part 1):2016.',
      'Exposure 1 (low) to 5 (severe), from the IMD hazard atlas and NDMA flood-prone district lists.',
      'Grid trips are feed interruptions over the last 12 months at site metering. BLR-1 is not yet energised.',
    ],
  },
  {
    name: '25_supply_chain',
    header: ['component_type', 'vendor', 'origin_country', 'single_source', 'lead_time_weeks', 'spares_on_site', 'disruption_note'],
    widths: [15, 11, 15, 13, 15, 14, 64],
    rows: SUPPLY,
    notes: [
      'Lead times match 06_upgrade_options for every component type that appears there.',
      'Vendor A also supplied the Q4-2023 battery batch named in 11_incidents.',
    ],
  },
  {
    name: '26_thermal_sensors',
    header: ['sensor_id', 'facility_id', 'hall_id', 'row_id', 'component_id', 'location', 'reading_c', 'setpoint_c', 'limit_c', 'read_at'],
    widths: [16, 11, 11, 7, 13, 26, 10, 10, 8, 17],
    rows: sensorRows(),
    notes: [
      'Inlet limit 27 C is the ASHRAE A1 recommended upper bound. 27 C minus the far-end reading is the row thermal_margin_c.',
      'CRAH supply air runs to an 18 C setpoint and alarms at 20 C. CRAH-K-01 at 20.1 C is alert ALM-4821.',
    ],
  },
];
// Keep workbook order: the clean-energy and water sheets follow 26_thermal_sensors.
SHEETS.push(...SHEETS.splice(0, 3));

// ── write ───────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SOURCE);

// Borrow the workbook's own styles from an existing sheet.
const template = wb.getWorksheet('15_grid');
const headerStyle = structuredClone(template.getRow(1).getCell(1).style);
const textStyle = structuredClone(template.getRow(2).getCell(1).style);
const numberStyle = structuredClone(template.getRow(2).getCell(4).style);
const noteStyle = structuredClone(template.getRow(template.rowCount).getCell(1).style);
const decimalStyle = { ...structuredClone(numberStyle), numFmt: '0.0' };

for (const spec of SHEETS) {
  const existing = wb.getWorksheet(spec.name);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(spec.name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = spec.widths.map((width) => ({ width }));
  const header = ws.addRow(spec.header);
  header.eachCell((cell) => { cell.style = headerStyle; });
  for (const values of spec.rows) {
    const row = ws.addRow(values);
    spec.header.forEach((_, i) => {
      const cell = row.getCell(i + 1);
      const v = values[i];
      cell.style = typeof v === 'number' ? (Number.isInteger(v) ? numberStyle : decimalStyle) : textStyle;
    });
  }
  ws.addRow([]);
  for (const note of spec.notes) ws.addRow([note]).getCell(1).style = noteStyle;
}

// 13_energy gets energy_reused_kwh. No facility runs a heat-reuse plant, so
// the energy reuse factor is reported honestly as zero.
const energy = wb.getWorksheet('13_energy');
const headers = energy.getRow(1).values.slice(1);
let col = headers.indexOf('energy_reused_kwh') + 1;
if (col === 0) col = headers.length + 1;
energy.getRow(1).getCell(col).value = 'energy_reused_kwh';
energy.getRow(1).getCell(col).style = headerStyle;
energy.getColumn(col).width = 17;
let lastData = 1;
energy.eachRow((row, n) => { if (n > 1 && row.getCell(2).value) lastData = n; });
for (let n = 2; n <= lastData; n += 1) {
  const cell = energy.getRow(n).getCell(col);
  cell.value = 0;
  cell.style = numberStyle;
}
const reuseNote = 'energy_reused_kwh is zero: no facility exports waste heat, so the EU EED energy reuse factor is 0.';
let hasNote = false;
energy.eachRow((row) => { if (row.getCell(1).value === reuseNote) hasNote = true; });
if (!hasNote) energy.addRow([reuseNote]).getCell(1).style = noteStyle;

// ── reconcile the monthly ledgers ───────────────────────────────────────────
// 22_timeseries is the authority for monthly IT load, PUE and WUE. Its first
// label repeated 2024-10 and the series stopped at 2026-08 while the ledgers
// run to 2026-09, so the first row is relabelled and September 2026 added
// (below). 13_energy and 14_water are then restated from
// it so that every view of the same month agrees:
//   IT kWh       = it_load_kw × hours in the month
//   total_kwh    = IT kWh × PUE                  (renewable share, tariff unchanged)
//   total_litres = IT kWh × WUE                  (WUE is litres per IT kWh)
//   peak LPM     = average LPM × seasonal peaking factor (pre-monsoon summer highest)
const cellsByHeader = (ws) => {
  const names = ws.getRow(1).values;
  return (row, name) => row.getCell(names.indexOf(name));
};
const dataRows = (ws) => {
  const out = [];
  ws.eachRow((row, n) => { if (n > 1 && row.getCell(2).value && row.getCell(3).value !== null && row.getCell(3).value !== undefined) out.push(row); });
  return out;
};
const addMonths = (month, k) => {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + k;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
};
const hoursIn = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() * 24;
};
const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;

// The original labels were right from the second row on (2024-10 … 2026-08,
// with the pre-monsoon PUE bump in April–June and the MUM-1 drift flagged from
// May 2026); only the first row repeated 2024-10 and is September 2024.
const tsSheet = wb.getWorksheet('22_timeseries');
const ts = cellsByHeader(tsSheet);
const tsHeader = tsSheet.getRow(1).values.slice(1);
const labelFor = (k) => (k === 0 ? '2024-09' : addMonths('2024-10', k - 1));
const seen = new Map();
const series = new Map();
const rowsByFacility = new Map();
for (const row of dataRows(tsSheet)) {
  const id = ts(row, 'facility_id').value;
  const k = seen.get(id) ?? 0;
  seen.set(id, k + 1);
  const month = labelFor(k);
  ts(row, 'month').value = month;
  const rec = Object.fromEntries(tsHeader.map((h) => [h, ts(row, h).value]));
  if (!rowsByFacility.has(id)) rowsByFacility.set(id, new Map());
  rowsByFacility.get(id).set(month, rec);
  series.set(`${id}:${month}`, { it: rec.it_load_kw, pue: rec.pue, wue: rec.wue_l_per_kwh });
}

// September 2026 (month to date at the as-of date) continues each site's own
// trajectory: last September's PUE and WUE plus the site's mean year-on-year
// change over June–August, and IT load grown at its March–August monthly rate.
const SEPT = '2026-09';
const designById = new Map(json('facilities').map((f) => [f.facility_id, f.design_it_kw]));
for (const [id, m] of rowsByFacility) {
  if (m.has(SEPT)) continue;
  const yoy = (field) => ['2026-06', '2026-07', '2026-08'].reduce((s, x) => s + (m.get(x)[field] - m.get(addMonths(x, -12))[field]), 0) / 3;
  const aug = m.get('2026-08');
  const mar = m.get('2026-03');
  const it = round(aug.it_load_kw * (aug.it_load_kw / mar.it_load_kw) ** (1 / 5));
  const pue = round(m.get('2025-09').pue + yoy('pue'), 3);
  const wue = round(m.get('2025-09').wue_l_per_kwh + yoy('wue_l_per_kwh'), 3);
  const last12 = [...m.values()].slice(-12);
  const rec = {
    facility_id: id, month: SEPT, it_load_kw: it, facility_load_kw: round(it * pue), pue, wue_l_per_kwh: wue,
    utilisation_pct: round((it / designById.get(id)) * 100, 1),
    uptime_pct: round(last12.reduce((s, r) => s + r.uptime_pct, 0) / last12.length, 4),
    flag: aug.flag ?? null,
  };
  // Insert after the last data row, ahead of the sheet's note rows.
  const last = dataRows(tsSheet).at(-1).number;
  tsSheet.insertRow(last + 1, tsHeader.map((h) => rec[h]), 'i');
  m.set(SEPT, rec);
  series.set(`${id}:${SEPT}`, { it, pue, wue });
}
tsSheet.eachRow((row) => {
  if (row.getCell(1).value === '24 months to September 2026.') {
    row.getCell(1).value = '25 months, September 2024 to September 2026. September 2026 is month to date at 29 September.';
  }
});

const facilityById = new Map(json('facilities').map((f) => [f.facility_id, f]));

const en = cellsByHeader(energy);
for (const row of dataRows(energy)) {
  const id = en(row, 'facility_id').value;
  const month = en(row, 'month').value;
  const t = series.get(`${id}:${month}`);
  if (!t) throw new Error(`13_energy ${id} ${month} has no 22_timeseries month`);
  const f = facilityById.get(id);
  const total = round(t.it * hoursIn(month) * t.pue);
  const renewable = round(total * f.renewable_pct / 100);
  const gridKwh = total - renewable;
  en(row, 'total_kwh').value = total;
  en(row, 'renewable_kwh').value = renewable;
  en(row, 'grid_kwh').value = gridKwh;
  en(row, 'tariff_inr_kwh').value = f.tariff_inr_kwh;
  en(row, 'cost_inr_lakh').value = round(total * f.tariff_inr_kwh / 1e5, 1);
  en(row, 'measured_pue').value = t.pue;
  en(row, 'emissions_tco2').value = round(gridKwh * en(row, 'grid_carbon_kg_per_kwh').value / 1000, 1);
}

const PEAKING = { '04': 1.27, '05': 1.29, '06': 1.24, '07': 1.18, '08': 1.17, '09': 1.19 };
const waterSheet = wb.getWorksheet('14_water');
const wa = cellsByHeader(waterSheet);
for (const row of dataRows(waterSheet)) {
  const id = wa(row, 'facility_id').value;
  const month = wa(row, 'month').value;
  const t = series.get(`${id}:${month}`);
  if (!t) throw new Error(`14_water ${id} ${month} has no 22_timeseries month`);
  // Keep each month's existing treated-water share.
  const treatedShare = wa(row, 'treated_litres').value / (wa(row, 'treated_litres').value + wa(row, 'freshwater_litres').value);
  const hours = hoursIn(month);
  const total = round(t.it * hours * t.wue);
  const treated = round(total * treatedShare);
  wa(row, 'total_litres').value = total;
  wa(row, 'measured_wue_l_per_kwh').value = t.wue;
  wa(row, 'treated_litres').value = treated;
  wa(row, 'freshwater_litres').value = total - treated;
  wa(row, 'peak_demand_lpm').value = round(total / (hours * 60) * (PEAKING[month.slice(5)] ?? 1.14), 1);
}

// Basin stress for NCR-1: Gautam Buddh Nagar (Noida) groundwater is assessed
// over-exploited by the CGWB, and Delhi NCR draws on a Yamuna basin under
// extreme stress. It is rated above Chennai, not below it.
const STRESS_RESTATED = { 'NCR-1': 86 };
for (const row of dataRows(waterSheet)) {
  const v = STRESS_RESTATED[wa(row, 'facility_id').value];
  if (v != null) { wa(row, 'stress_index').value = v; wa(row, 'local_water_stress').value = 'Extremely high'; }
}

// ── Transformer evidence: a dissolved-gas advisory on TX-1, and the incident
// that shows what this failure mode costs when it is missed (MUM-2, 2025).
function appendRecords(ws, idName, records) {
  const cell = cellsByHeader(ws);
  const rows = dataRows(ws);
  const ids = new Set(rows.map((r) => cell(r, idName).value));
  let at = rows.at(-1).number;
  for (const rec of records) {
    if (ids.has(rec[idName])) continue;
    at += 1;
    const row = ws.insertRow(at, []);
    for (const [k, v] of Object.entries(rec)) {
      const c = cell(row, k);
      c.value = v;
      c.style = typeof v === 'number' ? (Number.isInteger(v) ? numberStyle : decimalStyle) : textStyle;
    }
  }
}
appendRecords(wb.getWorksheet('19_maintenance'), 'maintenance_id', [{
  maintenance_id: 'MNT-0101', component_id: 'TX-1', facility_id: 'MUM-1', service_date: '2026-08-28', next_due: '2026-11-28',
  service_type: 'Oil analysis (DGA)', performed_by: 'Vendor B Facilities',
  findings: 'Dissolved gas analysis: acetylene 3 ppm (0.5 ppm in February) and ethylene rising; top-oil 8 C above last year at like load. Oil treatment and internal inspection advised within 3 months.',
  outcome: 'Advisory raised', cost_inr_lakh: 1.8,
}]);
appendRecords(wb.getWorksheet('11_incidents'), 'incident_id', [{
  incident_id: 'INC-2025-0611', facility_id: 'MUM-2', component_id: 'TX-A', severity: 'critical',
  detected_at: '2025-06-11 14:20', resolved_at: '2025-06-11 21:12',
  description: 'Transformer TX-A tripped on Buchholz relay; site ran on TX-B and generators',
  root_cause: 'Insulation breakdown - dissolved gas (acetylene) trend not acted on',
  duration_min: 412, tenants_affected: 3, cost_inr_lakh: 41.5,
  note: 'Oil sample four months earlier showed acetylene rising; no follow-up was scheduled.',
}]);

const ledgerNotes = [
  [energy, 'Restated from 22_timeseries: total_kwh = IT load x hours x PUE. Renewable share and tariff per 01_facilities.'],
  [waterSheet, 'Restated from 22_timeseries: total_litres = IT load x hours x WUE (litres per IT kWh). Peak LPM applies a seasonal peaking factor.'],
];
for (const [ws, note] of ledgerNotes) {
  let present = false;
  ws.eachRow((row) => { if (row.getCell(1).value === note) present = true; });
  if (!present) ws.addRow([note]).getCell(1).style = noteStyle;
}

// ── Hall 4 retrofit ratings ─────────────────────────────────────────────────
// Hall 4 is a 2023 AI-ready retrofit with 5,400 kW of row circuits, and its
// busway (BUSWAY-B4) was re-rated to match — but its RPP, UPS pair and
// chilled-water loop still carried 2019 ratings that its 4,080 kW load
// exceeds. Re-rate them to the retrofit so the live hall is within its
// ratings (each UPS alone carries the hall, keeping N+1).
const RETROFIT = {
  'RPP-4': { capacity: 5400, note: 'Hall 4 distribution, re-rated in the 2023 retrofit' },
  'UPS-5': { capacity: 6250, note: 'Serves Hall 4. N+1 pair. Re-rated in the 2023 retrofit.' },
  'UPS-6': { capacity: 6250, note: 'Serves Hall 4. N+1 pair. Re-rated in the 2023 retrofit.' },
  'CHW-LOOP-2': { capacity: 15000, note: 'Supply 12C, return 18C, delta-T 6K. Upsized in the 2023 retrofit.' },
};
const compSheet = wb.getWorksheet('04_components');
const co = cellsByHeader(compSheet);
for (const row of dataRows(compSheet)) {
  const r = RETROFIT[co(row, 'component_id').value];
  if (!r) continue;
  const derated = round(r.capacity * co(row, 'derate_factor').value, 1);
  co(row, 'capacity').value = r.capacity;
  co(row, 'derated_capacity').value = derated;
  co(row, 'utilisation_pct').value = round((co(row, 'current_load').value / derated) * 100, 1);
  co(row, 'note').value = r.note;
}

// README: list the added sheets once.
const readme = wb.getWorksheet('00_README');
const marker = 'Operations sheets (23-26)';
let listed = false;
readme.eachRow((row) => { if (row.getCell(1).value === marker) listed = true; });
if (!listed) {
  const label = readme.getRow(3).getCell(1).style;
  const body = readme.getRow(3).getCell(2).style;
  readme.addRow([]);
  for (const [k, v] of [
    [marker, 'Runbooks, site hazard exposure, supply chain and MUM-1 thermal sensors. These feed incident response, site risk and the thermal twin.'],
    ['23_runbooks', 'Ordered response steps per component failure mode, with owner team and target time.'],
    ['24_site_risk', 'Seismic zone, flood, cyclone and heat exposure, and grid trips per facility.'],
    ['25_supply_chain', 'Vendor, origin, single-source flag and lead time per component type.'],
    ['26_thermal_sensors', 'Cold-aisle inlet and CRAH supply-air readings for every MUM-1 row.'],
  ]) {
    const row = readme.addRow([k, v]);
    row.getCell(1).style = label;
    row.getCell(2).style = body;
  }
}

// Keep 18_checks last, after the new sheets.
const order = wb.worksheets.map((ws) => ws.name).filter((n) => n !== '18_checks').concat('18_checks');
order.forEach((name, i) => { wb.getWorksheet(name).orderNo = i; });

await wb.xlsx.writeFile(SOURCE);
for (const spec of SHEETS) console.log(`  ${spec.name}`.padEnd(24), String(spec.rows.length).padStart(4), 'rows');
console.log('  13_energy               + energy_reused_kwh');
