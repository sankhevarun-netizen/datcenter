// scripts/import-dataset.mjs
//
// One-off conversion of nexus_demo_dataset.xlsx into data/nexus/*.json.
// Run once with `npm run import:dataset`, commit the JSON, and never read the
// .xlsx from application code. Values are written exactly as they appear in
// the workbook (dates stay as the workbook's own strings) — no derivation.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'nexus_demo_dataset.xlsx');
const OUT = join(root, 'data', 'nexus');
const FIXTURES = join(OUT, 'fixtures');

// Application data — loaded by lib/nexus/data.js.
const SHEETS = {
  '01_facilities': 'facilities',
  '02_halls': 'halls',
  '03_rows': 'rows',
  '04_racks': 'racks',
  '04_components': 'components',
  '04b_component_positions': 'componentPositions',
  '05_dependencies': 'dependencies',
  '06_upgrade_options': 'upgradeOptions',
  '09_tenants': 'tenants',
  '10_contracts': 'contracts',
  '11_incidents': 'incidents',
  '12_telemetry_replay': 'telemetryReplay',
  '13_energy': 'energy',
  '14_water': 'water',
  '15_grid': 'grid',
  '16_state_policy': 'statePolicy',
  '19_maintenance': 'maintenance',
  '20_active_alerts': 'activeAlerts',
  '21_benchmarks': 'benchmarks',
  '22_timeseries': 'timeseries',
  '23_runbooks': 'runbooks',
  '24_site_risk': 'siteRisk',
  '25_supply_chain': 'supplyChain',
  '26_thermal_sensors': 'thermalSensors',
  '27_hourly_generation': 'hourlyGeneration',
  '28_clean_energy_assets': 'cleanEnergyAssets',
  '29_water_reuse_opportunities': 'waterReuse',
  // The runsheet. Its Scene 4 line is the only place the scheduled-swap cost
  // (₹4 lakh) is recorded, so the replay reads it from here.
  '17_demo_script': 'demoScript',
};

// Expected answers — test oracles only. Application code must never import
// these; engines compute their own results and tests compare against them.
const FIXTURE_SHEETS = {
  '07_cascade_result': 'cascadeResult',
  '08_secondary_effects': 'secondaryEffects',
};

// Each sheet ends with free-text note rows: text in the first column, every
// other cell empty. A real record always has at least two populated cells.
function isRecord(row) {
  return Object.values(row).filter((v) => v !== null && v !== '').length >= 2;
}

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet missing from workbook: ${name}`);
  return XLSX.utils.sheet_to_json(ws, { defval: null }).filter(isRecord);
}

// 18_checks uses its first data row as the header row ("check | computed | expected | status").
function readChecks(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['18_checks'], { header: 1, defval: null });
  const headerIndex = rows.findIndex((r) => r[0] === 'check');
  return rows
    .slice(headerIndex + 1)
    .filter((r) => r[0] && r[1] !== null && r[2] !== null)
    .map(([check, computed, expected, status]) => ({ check: String(check).replace(/\s+/g, ' ').trim(), computed, expected, status }));
}

function write(dir, file, data) {
  writeFileSync(join(dir, `${file}.json`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  ${file}.json`.padEnd(32), String(data.length).padStart(4), 'records');
}

const wb = XLSX.readFile(SOURCE);
mkdirSync(FIXTURES, { recursive: true });

console.log(`Importing ${SOURCE}`);
for (const [sheet, file] of Object.entries(SHEETS)) write(OUT, file, readSheet(wb, sheet));
console.log('Fixtures (test oracles, not app data):');
for (const [sheet, file] of Object.entries(FIXTURE_SHEETS)) write(FIXTURES, file, readSheet(wb, sheet));
write(FIXTURES, 'checks', readChecks(wb));
