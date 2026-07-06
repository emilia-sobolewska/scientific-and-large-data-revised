import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { drawSparkline } from "./sparkline.js?v=3";
import { INDICATORS } from "./scales.js?v=3";
import { setState } from "./state.js?v=3";

// Sparkline comparison grid: the selected country plus its regional neighbours,
// all showing the active indicator on a SHARED Y scale for comparability.
// Clicking a row changes selectedCountry.

// Regional grouping of the demo_gind countries (Eurostat codes).
const REGIONS = {
  Nordics:        ["IS", "NO", "SE", "FI", "DK"],
  Baltics:        ["EE", "LV", "LT"],
  "Western Europe": ["DE", "FR", "NL", "BE", "LU", "AT", "CH", "IE", "UK", "LI"],
  "Southern Europe": ["ES", "PT", "IT", "EL", "MT", "CY", "AD", "MC", "SM"],
  "Central Europe": ["PL", "CZ", "SK", "HU", "SI"],
  Balkans:        ["HR", "RS", "BA", "ME", "MK", "AL", "XK", "BG", "RO"],
  "Eastern Europe": ["UA", "BY", "MD", "RU"],
  Caucasus:       ["GE", "AM", "AZ"],
  Other:          ["TR"],
};

let dataIndex, names, initialized = false;

export function initSparkGrid(dataIdx, countryNames) {
  dataIndex = dataIdx;
  names = countryNames;
  initialized = true;
}

function regionOf(geo) {
  for (const [region, members] of Object.entries(REGIONS)) {
    if (members.includes(geo)) return { region, members };
  }
  return null;
}

function fullSeries(geo, indicator) {
  const yrMap = dataIndex?.get(geo)?.get(indicator);
  if (!yrMap) return null;
  const pts = [];
  for (let y = 1960; y <= 2024; y++) pts.push({ y, v: yrMap.get(y) ?? null });
  return pts;
}

export function renderSparkGrid(state) {
  if (!initialized) return;
  const { selectedCountry, indicator, year } = state;
  const grid = document.getElementById("sparkline-grid");
  const labelEl = document.querySelector("#sparkline-section .ctrl-label");
  if (!grid) return;

  if (!selectedCountry) {
    grid.innerHTML = `<span style="font-size:11px;color:var(--muted)">Select a country to compare with its region.</span>`;
    return;
  }

  const info = regionOf(selectedCountry);
  if (!info) { grid.innerHTML = ""; return; }
  if (labelEl) labelEl.textContent = `Compare · ${info.region}`;

  // Members with data for this indicator; selected first, then up to 4 others.
  const withData = info.members.filter(g => dataIndex?.get(g)?.get(indicator)?.size);
  const others = withData.filter(g => g !== selectedCountry);
  const shown = [selectedCountry, ...others].filter((g, i, a) => a.indexOf(g) === i).slice(0, 5);

  // Shared Y domain across shown countries for comparability
  const allVals = [];
  const seriesByGeo = {};
  for (const g of shown) {
    const s = fullSeries(g, indicator);
    seriesByGeo[g] = s;
    if (s) for (const p of s) if (p.v != null) allVals.push(p.v);
  }
  const yDomain = allVals.length ? d3.extent(allVals) : null;
  const meta = INDICATORS.find(d => d.code === indicator);

  grid.innerHTML = "";
  for (const g of shown) {
    const s = seriesByGeo[g];
    if (!s) continue;
    const cur = dataIndex?.get(g)?.get(indicator)?.get(year);

    const cell = document.createElement("div");
    cell.className = "spark-cell" + (g === selectedCountry ? " active" : "");
    cell.title = names[g] || g;

    const nameSpan = document.createElement("span");
    nameSpan.className = "spark-name";
    nameSpan.textContent = names[g] || g;

    const svgWrap = document.createElement("span");
    svgWrap.style.flex = "1";

    const valSpan = document.createElement("span");
    valSpan.className = "spark-val";
    valSpan.textContent = cur != null ? cur.toFixed(1) : "—";

    cell.append(nameSpan, svgWrap, valSpan);
    cell.addEventListener("click", () => setState({ selectedCountry: g }));
    grid.appendChild(cell);

    // Diverging indicators get a red/green stroke by sign-at-year; else accent.
    let stroke = "#2563eb";
    if (meta?.type === "diverging") stroke = (cur ?? 0) >= 0 ? "#16a34a" : "#dc2626";

    const svgSel = d3.select(svgWrap).append("svg");
    drawSparkline(svgSel, s, {
      width: 110, height: 26, stroke,
      zero: meta?.type === "diverging",
      zeroColor: "#ccc",
      highlightYear: year, dotColor: "#111",
      yDomain,
    });
  }
}
