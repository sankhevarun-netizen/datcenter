// lib/nexus/schema.js
//
// Shape documentation for every collection imported from
// nexus_demo_dataset.xlsx into data/nexus/*.json. Field names are the
// workbook's own column names, unchanged. Units are in the field suffix
// (_kw, _m, _inr_lakh, _pct, _lpm ...). Dates are the workbook's strings:
// 'YYYY-MM-DD', 'YYYY-MM' or 'YYYY-MM-DD HH:mm' (facility local time).
//
// REQUIRED_FIELDS is enforced by lib/nexus/data.test.mjs — every record in a
// collection must have a non-null value for each listed field.

/**
 * @typedef {Object} Facility            01_facilities
 * @property {string} facility_id        e.g. 'MUM-1'
 * @property {string} name
 * @property {string} city
 * @property {string} state
 * @property {number} lat
 * @property {number} lon
 * @property {string} tier
 * @property {string} commissioned       'YYYY-MM-DD'
 * @property {string} status
 * @property {number} design_it_kw
 * @property {number} used_it_kw
 * @property {number} utilisation_pct
 * @property {number} halls
 * @property {number} racks
 * @property {number} pue
 * @property {number} wue_l_per_kwh
 * @property {number} tariff_inr_kwh
 * @property {number} renewable_pct
 * @property {string} demo_role
 */

/**
 * @typedef {Object} Hall                02_halls
 * @property {string} hall_id            e.g. 'MUM-1-H1'
 * @property {string} facility_id
 * @property {string} name
 * @property {number} row_count
 * @property {number} rack_count
 * @property {number} power_circuit_kw
 * @property {number} cooling_capacity_kw
 * @property {number} used_kw
 * @property {number} max_density_kw
 * @property {string} cooling_type
 * @property {string|null} note
 */

/**
 * @typedef {Object} Row                 03_rows — row_id is unique within a facility only
 * @property {string} facility_id
 * @property {string} hall_id
 * @property {string} row_id             'A'..'X'
 * @property {number} rack_count
 * @property {number} usable_positions
 * @property {number} racks_occupied
 * @property {number} racks_free
 * @property {number} used_kw
 * @property {number} power_circuit_kw
 * @property {number} cooling_capacity_kw
 * @property {number} max_density_kw
 * @property {number} design_space_kw    workbook-derived; engines recompute, never read
 * @property {number} deployable_kw      workbook-derived; engines recompute, never read
 * @property {number} headroom_kw        workbook-derived; engines recompute, never read
 * @property {number} stranded_kw        workbook-derived; engines recompute, never read
 * @property {'balanced'|'space'|'cooling'} binding_constraint  workbook-derived
 * @property {null|'structural'|'planned headroom'} stranded_classification
 * @property {number} thermal_margin_c
 * @property {string|null} note
 */

/**
 * @typedef {Object} Rack                04_racks — metres, X across, Y up, Z depth
 * @property {string} rack_id            e.g. 'MUM-1-A-01'
 * @property {string} facility_id
 * @property {string} hall_id
 * @property {string} row_id
 * @property {number} position_in_row
 * @property {number} x_m
 * @property {number} y_m
 * @property {number} z_m
 * @property {number} width_m
 * @property {number} depth_m
 * @property {number} height_m
 * @property {number} u_height
 * @property {number} capacity_kw
 * @property {number} used_kw
 * @property {'occupied'|'free'|'blocked'} status
 * @property {string|null} tenant_id
 * @property {string} fed_by_pdu         component_id of the PDU feeding it
 * @property {string} cooled_by_crah     component_id of the CRAH cooling it
 * @property {string|null} note
 */

/**
 * @typedef {Object} Component           04_components (+ position from 04b, attached by data.js)
 * @property {string} component_id       e.g. 'UPS-1', 'PDU-G1', 'ROW-G'
 * @property {string} facility_id
 * @property {'utility_feed'|'transformer'|'generator'|'switchgear'|'ups'|'rpp'|'busway'|'pdu'|'cooling_tower'|'chiller'|'chw_loop'|'crah'|'rack_row'} component_type
 * @property {string} label
 * @property {'electrical'|'thermal'|'load'} chain
 * @property {number} capacity
 * @property {'kW'|'kVA'|'TR'|'LPM'} unit
 * @property {number} derate_factor
 * @property {number} derated_capacity
 * @property {number} current_load
 * @property {number} utilisation_pct
 * @property {'N'|'N+1'|'2N'} redundancy
 * @property {string|null} redundant_peers   raw workbook string
 * @property {string[]} redundantPeers      normalised by data.js
 * @property {number} replacement_cost_inr_lakh
 * @property {number} lead_time_weeks
 * @property {string|null} note
 * @property {{x:number,y:number,z:number}} position   attached by data.js from 04b
 * @property {string} zone                              attached by data.js from 04b
 */

/**
 * @typedef {Object} ComponentPosition   04b_component_positions
 * @property {string} component_id
 * @property {string} facility_id
 * @property {number} x_m
 * @property {number} y_m
 * @property {number} z_m
 * @property {string} zone
 * @property {string|null} note
 */

/**
 * @typedef {Object} Dependency          05_dependencies — directed edges (220: 120 electrical, 100 thermal).
 *   Verified against the edges themselves (the workbook's footnote describes the
 *   thermal direction differently — the edges are authoritative):
 *   electrical: supply -> load      feed -> TX -> SWGR -> UPS -> RPP -> busway -> PDU -> rack_row
 *                                   generator -> SWGR (backup path)
 *   thermal:    rack_row -> CRAH    (heat into the CRAH — the only edge pointing away from the load)
 *               tower -> chiller -> chw_loop -> CRAH   (plant supplies the CRAH)
 *   Every rack_row has two PDU parents and two CRAH targets.
 * @property {string} source_component_id
 * @property {string} target_component_id
 * @property {'electrical'|'thermal'} chain
 */

/**
 * @typedef {Object} UpgradeOption       06_upgrade_options
 * @property {string} component_id
 * @property {string} description
 * @property {number} new_capacity
 * @property {number} cost_inr_lakh
 * @property {number} lead_time_weeks
 * @property {string} blocks_what
 */

/** @typedef {{tenant_id:string,name:string,facility_id:string,contracted_kw:number,racks:number,workload_type:string,contract_start:string}} Tenant  09_tenants */
/** @typedef {{contract_id:string,tenant_id:string,tenant_name:string,facility_id:string,sla_uptime_pct:number,penalty_threshold_hours:number,penalty_inr_lakh:number,penalty_per_hour_inr_lakh:number,notification_clause:string,review_cycle:string}} Contract  10_contracts */
/** @typedef {{incident_id:string,facility_id:string,component_id:string,severity:string,detected_at:string,resolved_at:string,description:string,root_cause:string,duration_min:number,tenants_affected:number,cost_inr_lakh:number,note:string|null}} Incident  11_incidents */
/** @typedef {{timestamp:string,facility_id:string,component_id:string,subsystem:string,string_voltage_v:number,cell_temp_c:number,internal_resistance_mohm:number,state_of_health_pct:number,state:string,flag:string|null}} TelemetryReading  12_telemetry_replay */
/** @typedef {{facility_id:string,month:string,total_kwh:number,renewable_kwh:number,grid_kwh:number,tariff_inr_kwh:number,cost_inr_lakh:number,measured_pue:number,grid_carbon_kg_per_kwh:number,emissions_tco2:number,energy_reused_kwh:number}} EnergyMonth  13_energy */
/** @typedef {{facility_id:string,month:string,total_litres:number,measured_wue_l_per_kwh:number,treated_litres:number,freshwater_litres:number,source:string,local_water_stress:string,stress_index:number,peak_demand_lpm:number}} WaterMonth  14_water */
/** @typedef {{facility_id:string,utility:string,voltage_kv:number,sanctioned_load_kw:number,current_draw_kw:number,headroom_kw:number,feed_count:number,connection_status:string,queue_position:number,note:string}} GridConnection  15_grid */
/** @typedef {{jurisdiction:string,policy:string,effective_from:string,reporting_obligation:string,incentives:string,detail:string,applies_to:string,status:string}} StatePolicy  16_state_policy */
/** @typedef {{maintenance_id:string,component_id:string,facility_id:string,service_date:string,next_due:string,service_type:string,performed_by:string,findings:string,outcome:string,cost_inr_lakh:number}} MaintenanceRecord  19_maintenance */
/** @typedef {{alert_id:string,facility_id:string,component_id:string,severity:string,category:string,message:string,raised_at:string,status:string,owner_team:string,note:string|null}} ActiveAlert  20_active_alerts */
/** @typedef {{metric:string,cohort:string,p10:number,p25:number,p50_median:number,p75:number,p90:number,direction:string,basis:string}} Benchmark  21_benchmarks */
/** @typedef {{facility_id:string,month:string,it_load_kw:number,facility_load_kw:number,pue:number,wue_l_per_kwh:number,utilisation_pct:number,uptime_pct:number,flag:string|null}} TimeseriesMonth  22_timeseries */
/** @typedef {{runbook_id:string,component_type:string,failure_mode:string,impact:'outage'|'capacity'|'compliance'|'efficiency',match_terms:string,step:number,action:string,owner_team:string,within_min:number}} RunbookStep  23_runbooks — match_terms is pipe-separated */
/** @typedef {{facility_id:string,seismic_zone:string,flood_exposure:number,cyclone_exposure:number,heat_exposure:number,grid_trips_12m:number|null,avg_trip_min:number|null,reference_event:string}} SiteRisk  24_site_risk — exposures 1 (low) to 5 (severe); trips null where not energised */
/** @typedef {{component_type:string,vendor:string,origin_country:string,single_source:'yes'|'no',lead_time_weeks:number,spares_on_site:number,disruption_note:string}} SupplyLine  25_supply_chain */
/** @typedef {{sensor_id:string,facility_id:string,hall_id:string,row_id:string,component_id:string,location:string,reading_c:number,setpoint_c:number|null,limit_c:number,read_at:string}} ThermalSensor  26_thermal_sensors */

export const REQUIRED_FIELDS = {
  facilities: ['facility_id', 'name', 'design_it_kw', 'used_it_kw', 'pue', 'wue_l_per_kwh', 'tariff_inr_kwh'],
  halls: ['hall_id', 'facility_id', 'power_circuit_kw', 'cooling_capacity_kw', 'used_kw', 'max_density_kw'],
  rows: ['facility_id', 'hall_id', 'row_id', 'rack_count', 'usable_positions', 'used_kw', 'power_circuit_kw', 'cooling_capacity_kw', 'max_density_kw'],
  racks: ['rack_id', 'facility_id', 'hall_id', 'row_id', 'x_m', 'y_m', 'z_m', 'width_m', 'depth_m', 'height_m', 'capacity_kw', 'used_kw', 'status', 'fed_by_pdu', 'cooled_by_crah'],
  components: ['component_id', 'facility_id', 'component_type', 'label', 'chain', 'capacity', 'unit', 'derate_factor', 'current_load', 'redundancy'],
  componentPositions: ['component_id', 'facility_id', 'x_m', 'y_m', 'z_m', 'zone'],
  dependencies: ['source_component_id', 'target_component_id', 'chain'],
  upgradeOptions: ['component_id', 'description', 'new_capacity', 'cost_inr_lakh', 'lead_time_weeks'],
  tenants: ['tenant_id', 'name', 'facility_id'],
  contracts: ['contract_id', 'tenant_id', 'facility_id', 'sla_uptime_pct'],
  incidents: ['incident_id', 'facility_id', 'component_id', 'detected_at'],
  telemetryReplay: ['timestamp', 'facility_id', 'component_id'],
  energy: ['facility_id', 'month', 'total_kwh', 'energy_reused_kwh'],
  water: ['facility_id', 'month', 'total_litres'],
  grid: ['facility_id', 'sanctioned_load_kw', 'current_draw_kw'],
  statePolicy: ['jurisdiction', 'policy'],
  maintenance: ['maintenance_id', 'component_id', 'facility_id', 'service_date'],
  activeAlerts: ['alert_id', 'facility_id', 'component_id', 'severity'],
  benchmarks: ['metric', 'cohort', 'p50_median'],
  timeseries: ['facility_id', 'month', 'it_load_kw', 'pue'],
  runbooks: ['runbook_id', 'component_type', 'failure_mode', 'impact', 'match_terms', 'step', 'action', 'owner_team', 'within_min'],
  siteRisk: ['facility_id', 'seismic_zone', 'flood_exposure', 'cyclone_exposure', 'heat_exposure', 'reference_event'],
  supplyChain: ['component_type', 'vendor', 'origin_country', 'single_source', 'lead_time_weeks'],
  thermalSensors: ['sensor_id', 'facility_id', 'row_id', 'component_id', 'location', 'reading_c', 'limit_c', 'read_at'],
};
