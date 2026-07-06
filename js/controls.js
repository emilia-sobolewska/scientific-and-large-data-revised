import { INDICATORS, FORMULAS } from "./scales.js?v=3";
import { setState, state } from "./state.js?v=3";

let countryList = []; // [{code, name}]

export function initControls(names) {
  countryList = Object.entries(names)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  buildIndicatorList();
  buildSlider();
  buildSearch();
}

function buildIndicatorList() {
  const list = document.getElementById("indicator-list");
  list.innerHTML = "";

  INDICATORS.forEach(ind => {
    const item = document.createElement("label");
    item.className = "indicator-item" + (ind.code === state.indicator ? " active" : "");
    item.dataset.code = ind.code;
    item.innerHTML = `
      <input type="radio" name="indicator" value="${ind.code}"
             ${ind.code === state.indicator ? "checked" : ""}>
      <span>
        ${ind.label}
        <span class="indicator-unit">${ind.unit}</span>
      </span>`;
    item.addEventListener("change", () => {
      document.querySelectorAll(".indicator-item").forEach(el => el.classList.remove("active"));
      item.classList.add("active");
      setState({ indicator: ind.code });
    });
    list.appendChild(item);
  });
}

function buildSlider() {
  const slider = document.getElementById("year-slider");
  const display = document.getElementById("year-display");

  slider.min = 1960;
  slider.max = 2024;
  slider.value = state.year;
  display.textContent = state.year;

  slider.addEventListener("input", () => {
    const y = +slider.value;
    display.textContent = y;
    setState({ year: y });
  });
}

function buildSearch() {
  const input = document.getElementById("search-input");
  const box   = document.getElementById("search-suggestions");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { hideSuggestions(); return; }
    const matches = countryList.filter(c => c.name.toLowerCase().startsWith(q)).slice(0, 8);
    if (!matches.length) { hideSuggestions(); return; }
    box.innerHTML = matches
      .map(c => `<div class="suggestion" data-code="${c.code}">${c.name}</div>`)
      .join("");
    box.style.display = "block";
  });

  box.addEventListener("click", e => {
    const el = e.target.closest(".suggestion");
    if (!el) return;
    const code = el.dataset.code;
    input.value = countryList.find(c => c.code === code)?.name ?? code;
    hideSuggestions();
    setState({ selectedCountry: code });
  });

  document.addEventListener("click", e => {
    if (!e.target.closest("#search-wrap")) hideSuggestions();
  });
}

function hideSuggestions() {
  document.getElementById("search-suggestions").style.display = "none";
}

// ─── Stats panel ─────────────────────────────────────────────────────────────
import { INDICATORS as INDS } from "./scales.js?v=3";

export function renderStats(state, dataIndex) {
  const box = document.getElementById("stats-box");
  const { indicator, year, selectedCountry } = state;
  if (!selectedCountry) {
    box.innerHTML = `<span style="color:var(--muted)">Click a country on the map to explore.</span>`;
    return;
  }

  const meta = INDS.find(d => d.code === indicator);
  const val = dataIndex?.get(selectedCountry)?.get(indicator)?.get(year);
  const valPrev = dataIndex?.get(selectedCountry)?.get(indicator)?.get(year - 1);

  const countryVals = [];
  for (const [, indMap] of dataIndex) {
    const v = indMap.get(indicator)?.get(year);
    if (v != null) countryVals.push(v);
  }
  countryVals.sort((a, b) => a - b);
  const rank = val != null ? countryVals.findIndex(v => v >= val) + 1 : null;
  const total = countryVals.length;

  const delta = val != null && valPrev != null ? val - valPrev : null;
  const arrow = delta == null ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  box.innerHTML = `
    <div class="stat-item">
      <strong>${val != null ? val.toFixed(2) : "—"} <small style="font-size:10px;font-weight:400">${meta?.unit ?? ""}</small></strong>
      <span>${meta?.label} in ${year}</span>
    </div>
    ${rank ? `<div class="stat-item">
      <strong>#${rank} / ${total}</strong>
      <span>Rank in Europe</span>
    </div>` : ""}
    ${delta != null ? `<div class="stat-item">
      <strong>${arrow} ${Math.abs(delta).toFixed(2)}</strong>
      <span>vs ${year - 1}</span>
    </div>` : ""}
  `;
}

// ─── Regime box ──────────────────────────────────────────────────────────────
export function renderRegime(state, dataIndex) {
  const box = document.getElementById("regime-box");
  const { year, selectedCountry } = state;
  if (!selectedCountry) { box.innerHTML = ""; return; }

  const nat = dataIndex?.get(selectedCountry)?.get("NATGROWRT")?.get(year);
  const mig = dataIndex?.get(selectedCountry)?.get("CNMIGRATRT")?.get(year);

  if (nat == null || mig == null) { box.innerHTML = ""; return; }

  const natTag = nat > 0 ? `<span class="regime-tag pos">Natural ↑</span>` : `<span class="regime-tag neg">Natural ↓</span>`;
  const migTag = mig > 0 ? `<span class="regime-tag pos">Migration ↑</span>` : `<span class="regime-tag neg">Migration ↓</span>`;

  let interpretation = "";
  if (nat > 0 && mig > 0) interpretation = "Strong growth — both drivers positive.";
  else if (nat < 0 && mig > 0) interpretation = "Population sustained by immigration.";
  else if (nat > 0 && mig < 0) interpretation = "Natural growth despite emigration.";
  else interpretation = "Population declining.";

  box.innerHTML = `
    <h4>Demographic regime (${year})</h4>
    ${natTag} ${migTag}
    <p style="margin-top:6px;color:#555">${interpretation}</p>
  `;
}

// ─── Formula + line legend ────────────────────────────────────────────────────
function swatch(stroke, dash = "", opacity = 1) {
  return `<svg width="22" height="10" style="vertical-align:middle;flex-shrink:0">
    <line x1="0" y1="5" x2="22" y2="5" stroke="${stroke}" stroke-width="2"
      ${dash ? `stroke-dasharray="${dash}"` : ""} opacity="${opacity}"/>
  </svg>`;
}

export function renderFormula(state, countryNames) {
  const box = document.getElementById("formula-box");
  if (!box) return;
  const { indicator, selectedCountry } = state;
  const f = FORMULAS[indicator];
  if (!f) { box.innerHTML = ""; return; }
  const name = selectedCountry ? (countryNames?.[selectedCountry] || selectedCountry) : null;

  box.innerHTML = `
    <div class="formula-eq"><b>${f.name}</b> = ${f.full}</div>
    <div class="formula-note">${f.note}</div>
    <div class="legend-row">
      ${name ? `<span class="legend-item">${swatch("#1f2937")} ${name}</span>` : ""}
      ${name ? `<span class="legend-item">${swatch("#7c3aed", "", 0.75)} 5-yr moving avg</span>` : ""}
    </div>
  `;
}
