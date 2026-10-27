import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { GOOGLE_DC_MASTER, DC_STATS } from '@/data/googleDCMasterData';
import { mockThermalData } from '@/data/mock/thermal';

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export async function GET() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Global Stats ──────────────────────────────────────────────────
  const statsRows = [
    { Metric: 'Total Data Centers', Value: DC_STATS.total },
    { Metric: 'Active', Value: DC_STATS.active },
    { Metric: 'Under Construction', Value: DC_STATS.underConstruction },
    { Metric: 'At Risk (High + Medium)', Value: DC_STATS.atRisk },
    { Metric: 'High Risk', Value: DC_STATS.highRisk },
    { Metric: 'Countries', Value: DC_STATS.countries },
    { Metric: 'Total IT Capacity (MW)', Value: DC_STATS.totalMW },
    { Metric: 'Total Racks', Value: DC_STATS.totalRacks },
    { Metric: 'Total Servers', Value: DC_STATS.totalServers },
    { Metric: 'Total GPUs', Value: DC_STATS.totalGPUs },
    { Metric: 'Total Carbon Emissions (MT/yr)', Value: DC_STATS.totalCarbonMt },
    { Metric: 'Average PUE', Value: DC_STATS.avgPUE },
    { Metric: 'Average Renewable (%)', Value: DC_STATS.avgRenewable },
    { Metric: 'Critical Alarms (total)', Value: DC_STATS.totalAlarmCritical },
    { Metric: 'High Alarms (total)', Value: DC_STATS.totalAlarmHigh },
    { Metric: 'Medium Alarms (total)', Value: DC_STATS.totalAlarmMedium },
    { Metric: 'Low Alarms (total)', Value: DC_STATS.totalAlarmLow },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statsRows), 'Global Stats');

  // ── Sheet 2: DC Master (all 94 campuses, sorted by region → country → name) ─
  const dcMap = Object.fromEntries(GOOGLE_DC_MASTER.map(d => [d.id, d]));
  const masterRows = [...GOOGLE_DC_MASTER]
    .sort((a, b) =>
      a.region.localeCompare(b.region) ||
      a.country.localeCompare(b.country) ||
      a.name.localeCompare(b.name)
    )
    .map(dc => ({
      'DC ID': dc.id,
      Name: dc.name,
      Region: dc.region,
      Country: dc.country,
      Market: dc.market,
      Address: dc.address,
      Status: dc.status,
      'Risk Flag': dc.risk_flag,
      Tier: `Tier ${dc.tier}`,
      'IT Capacity (MW)': dc.capacity_mw,
      'Utilization (%)': dc.utilization_pct,
      PUE: dc.pue,
      'Renewable Energy (%)': dc.renewable_pct,
      'Carbon Emissions (MT/yr)': dc.carbon_mt,
      'Carbon Intensity (MT/MW)': Math.round((dc.carbon_mt / (dc.capacity_mw || 1)) * 100) / 100,
      Racks: dc.asset_racks,
      Servers: dc.asset_servers,
      GPUs: dc.asset_gpus,
      'Critical Alarms': dc.alarm_critical,
      'High Alarms': dc.alarm_high,
      'Medium Alarms': dc.alarm_medium,
      'Low Alarms': dc.alarm_low,
      Latitude: dc.lat,
      Longitude: dc.lng,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterRows), 'DC Master');

  // ── Sheet 3: Regional Summary ──────────────────────────────────────────────
  const regionBuckets = {};
  GOOGLE_DC_MASTER.forEach(dc => {
    if (!regionBuckets[dc.region]) {
      regionBuckets[dc.region] = {
        Region: dc.region, Total: 0, Active: 0, 'Under Construction': 0,
        Countries: new Set(), 'Total Capacity (MW)': 0,
        _utils: [], _pues: [], _renewable: [], 'Total Carbon (MT)': 0,
        Racks: 0, Servers: 0, GPUs: 0,
        'Critical Alarms': 0, 'High Alarms': 0, 'Medium Alarms': 0, 'Low Alarms': 0,
        'High Risk': 0, 'Medium Risk': 0, 'Low Risk': 0,
      };
    }
    const r = regionBuckets[dc.region];
    r.Total++;
    if (dc.status === 'Active') r.Active++;
    if (dc.status === 'Under Construction') r['Under Construction']++;
    r.Countries.add(dc.country);
    r['Total Capacity (MW)'] += dc.capacity_mw;
    r._utils.push(dc.utilization_pct);
    r._pues.push(dc.pue);
    r._renewable.push(dc.renewable_pct);
    r['Total Carbon (MT)'] += dc.carbon_mt;
    r.Racks += dc.asset_racks;
    r.Servers += dc.asset_servers;
    r.GPUs += dc.asset_gpus;
    r['Critical Alarms'] += dc.alarm_critical;
    r['High Alarms'] += dc.alarm_high;
    r['Medium Alarms'] += dc.alarm_medium;
    r['Low Alarms'] += dc.alarm_low;
    if (dc.risk_flag === 'High') r['High Risk']++;
    else if (dc.risk_flag === 'Medium') r['Medium Risk']++;
    else r['Low Risk']++;
  });
  const regionRows = Object.values(regionBuckets).map(r => ({
    Region: r.Region,
    'Total DCs': r.Total,
    Active: r.Active,
    'Under Construction': r['Under Construction'],
    Countries: r.Countries.size,
    'Total Capacity (MW)': r['Total Capacity (MW)'],
    'Avg Utilization (%)': Math.round(avg(r._utils)),
    'Avg PUE': Math.round(avg(r._pues) * 100) / 100,
    'Avg Renewable (%)': Math.round(avg(r._renewable)),
    'Total Carbon (MT/yr)': Math.round(r['Total Carbon (MT)'] * 10) / 10,
    'Total Racks': r.Racks,
    'Total Servers': r.Servers,
    'Total GPUs': r.GPUs,
    'Critical Alarms': r['Critical Alarms'],
    'High Alarms': r['High Alarms'],
    'Medium Alarms': r['Medium Alarms'],
    'Low Alarms': r['Low Alarms'],
    'High Risk DCs': r['High Risk'],
    'Medium Risk DCs': r['Medium Risk'],
    'Low Risk DCs': r['Low Risk'],
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(regionRows), 'Regional Summary');

  // ── Sheet 4: Country Summary ───────────────────────────────────────────────
  const countryBuckets = {};
  GOOGLE_DC_MASTER.forEach(dc => {
    if (!countryBuckets[dc.country]) {
      countryBuckets[dc.country] = {
        Country: dc.country, Region: dc.region, Total: 0, Active: 0, 'Under Construction': 0,
        'Total Capacity (MW)': 0, _utils: [], _pues: [], _renewable: [],
        'Total Carbon (MT)': 0, Racks: 0, Servers: 0, GPUs: 0,
      };
    }
    const c = countryBuckets[dc.country];
    c.Total++;
    if (dc.status === 'Active') c.Active++;
    if (dc.status === 'Under Construction') c['Under Construction']++;
    c['Total Capacity (MW)'] += dc.capacity_mw;
    c._utils.push(dc.utilization_pct);
    c._pues.push(dc.pue);
    c._renewable.push(dc.renewable_pct);
    c['Total Carbon (MT)'] += dc.carbon_mt;
    c.Racks += dc.asset_racks;
    c.Servers += dc.asset_servers;
    c.GPUs += dc.asset_gpus;
  });
  const countryRows = Object.values(countryBuckets)
    .sort((a, b) => a.Region.localeCompare(b.Region) || a.Country.localeCompare(b.Country))
    .map(c => ({
      Country: c.Country,
      Region: c.Region,
      'Total DCs': c.Total,
      Active: c.Active,
      'Under Construction': c['Under Construction'],
      'Total Capacity (MW)': c['Total Capacity (MW)'],
      'Avg Utilization (%)': Math.round(avg(c._utils)),
      'Avg PUE': Math.round(avg(c._pues) * 100) / 100,
      'Avg Renewable (%)': Math.round(avg(c._renewable)),
      'Total Carbon (MT/yr)': Math.round(c['Total Carbon (MT)'] * 10) / 10,
      'Total Racks': c.Racks,
      'Total Servers': c.Servers,
      'Total GPUs': c.GPUs,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(countryRows), 'Country Summary');

  // ── Sheet 5: Thermal Heatmap (one row per tile, Active DCs only) ───────────
  const thermalRows = [];
  Object.entries(mockThermalData).forEach(([dcId, data]) => {
    const dc = dcMap[dcId];
    if (!dc) return;
    (data.tiles || []).forEach(tile => {
      thermalRows.push({
        'DC ID': dcId,
        'DC Name': dc.name,
        Region: dc.region,
        Country: dc.country,
        'Avg Floor Temp (°C)': data.avgTempC,
        'Target Temp (°C)': data.targetTempC,
        'CRAH Units Total': data.crahUnits,
        'CRAH Online': data.crahOnline,
        'Airflow Direction': data.airflowDirection,
        Column: tile.col,
        Row: tile.row,
        'Tile Temp (°C)': tile.tempC,
        'Hot Aisle': tile.isHotAisle ? 'Yes' : 'No',
        'Cold Aisle': tile.isColdAisle ? 'Yes' : 'No',
        'CRAH Position': tile.isCrah ? 'Yes' : 'No',
        'Hot Spot': tile.isHotSpot ? 'Yes' : 'No',
      });
    });
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(thermalRows.length ? thermalRows : [{ Note: 'No thermal data available' }]),
    'Thermal Heatmap'
  );

  // ── Sheet 6: Hotspot Alerts ────────────────────────────────────────────────
  const hotspotRows = [];
  Object.entries(mockThermalData).forEach(([dcId, data]) => {
    const dc = dcMap[dcId];
    (data.hotspotAlerts || []).forEach(alert => {
      hotspotRows.push({
        'DC ID': dcId,
        'DC Name': dc ? dc.name : dcId,
        Region: dc ? dc.region : '—',
        Country: dc ? dc.country : '—',
        'Utilization (%)': dc ? dc.utilization_pct : '—',
        'Risk Flag': dc ? dc.risk_flag : '—',
        Column: alert.col,
        Row: alert.row,
        Message: alert.message,
      });
    });
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(hotspotRows.length ? hotspotRows : [{ Note: 'No active hotspot alerts' }]),
    'Hotspot Alerts'
  );

  // ── Write workbook ─────────────────────────────────────────────────────────
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="google-dc-global-cockpit-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
