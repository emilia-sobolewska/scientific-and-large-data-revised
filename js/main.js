import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { state, subscribe, setState } from "./state.js?v=3";
import { initMap, renderMap, setStateGetter } from "./map.js?v=3";
import { initLineChart, renderLineChart, COUNTRY_NAMES } from "./linechart.js?v=3";
import { initControls, renderStats, renderRegime, renderFormula } from "./controls.js?v=3";
import { initSparkGrid, renderSparkGrid } from "./sparkgrid.js?v=3";

// ─── Load data ────────────────────────────────────────────────────────────────
const [csvRows, topoJson] = await Promise.all([
  d3.csv("data/demo_gind_tidy.csv", d3.autoType),
  d3.json("data/europe.topojson"),
]);

// ─── Build index: geo → indicator → year → value ─────────────────────────────
const dataIndex = new Map();
for (const row of csvRows) {
  if (!dataIndex.has(row.geo)) dataIndex.set(row.geo, new Map());
  const indMap = dataIndex.get(row.geo);
  if (!indMap.has(row.indic_code)) indMap.set(row.indic_code, new Map());
  indMap.get(row.indic_code).set(row.year, row.value);
}

// ─── Populate country name lookup from TopoJSON ───────────────────────────────
const TOPO_OBJECT = "CNTR_RG_20M_2024_4326";
const features = topojson.feature(topoJson, topoJson.objects[TOPO_OBJECT]).features;
for (const f of features) {
  const id = f.properties.CNTR_ID;
  if (id) COUNTRY_NAMES[id] = f.properties.NAME_ENGL || id;
}

// ─── Data sanity check: Net Migration Rate (CNMIGRATRT) ──────────────────────
// The values are Eurostat's published crude rates (already per 1 000 inhab.),
// so "raw" == "computed" — we do NOT re-divide by population. This log lets us
// confirm there is no PL/IS code swap and no double normalisation.
(function verifyNetMigration() {
  const CONTROL_YEARS = [2010, 2015, 2022];
  console.log("── Net Migration Rate (CNMIGRATRT) sanity check — per 1 000 inhab. ──");
  for (const geo of ["PL", "IS"]) {
    const yrMap = dataIndex.get(geo)?.get("CNMIGRATRT");
    const cells = CONTROL_YEARS.map(y => {
      const raw = yrMap?.get(y);
      // No recomputation: we use Eurostat's published crude rate directly.
      return `${y}: raw=${raw} computed=${raw}`;
    });
    console.log(`  ${geo} (${COUNTRY_NAMES[geo] || "?"}):  ${cells.join("   ")}`);
  }
  console.log("  Expectation: PL ≈ 0 (near-zero/slightly negative), IS strongly positive.");
})();

// ─── Set a default selected country ──────────────────────────────────────────
state.selectedCountry = "PL";

// Names for data countries that have no GISCO geometry (so no map name).
const MANUAL_NAMES = { XK: "Kosovo" };
Object.assign(COUNTRY_NAMES, MANUAL_NAMES);

// ─── Init components ─────────────────────────────────────────────────────────
// Search should only offer countries we actually have data for.
const searchableNames = {};
for (const geo of dataIndex.keys()) {
  if (COUNTRY_NAMES[geo]) searchableNames[geo] = COUNTRY_NAMES[geo];
}

initMap(topoJson, dataIndex);
setStateGetter(() => state);
initLineChart(dataIndex);
initSparkGrid(dataIndex, COUNTRY_NAMES);
initControls(searchableNames);

// ─── Orchestrate updates ──────────────────────────────────────────────────────
function update(s) {
  renderMap(s);
  renderLineChart(s);
  renderSparkGrid(s);
  renderStats(s, dataIndex);
  renderRegime(s, dataIndex);
  renderFormula(s, COUNTRY_NAMES);
}

subscribe(update);

// Initial render — defer one frame so SVG containers have real pixel sizes
requestAnimationFrame(() => update(state));
