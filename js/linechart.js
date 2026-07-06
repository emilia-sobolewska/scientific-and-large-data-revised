import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { INDICATORS } from "./scales.js?v=3";

const MARGIN = { top: 18, right: 18, bottom: 36, left: 48 };

let svg, chartG, xScale, yScale, xAxis, yAxis;
let initialized = false;
let dataIndex; // same reference from main

export function initLineChart(dataIdx) {
  dataIndex = dataIdx;
  svg = d3.select("#line-svg");
  chartG = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  // Grid
  chartG.append("g").attr("class", "grid grid-y");
  // Axes
  chartG.append("g").attr("class", "axis axis-x");
  chartG.append("g").attr("class", "axis axis-y");
  // Path group
  chartG.append("g").attr("class", "lines");
  // Year cursor
  chartG.append("line").attr("class", "year-line")
    .attr("stroke", "#888").attr("stroke-dasharray", "4 3").attr("stroke-width", 1);

  initialized = true;
}

export function renderLineChart(state) {
  if (!initialized) return;

  const { indicator, year, selectedCountry } = state;
  const meta = INDICATORS.find(d => d.code === indicator);

  const W = svg.node().clientWidth  || svg.node().parentElement?.clientWidth  || 400;
  const H = svg.node().clientHeight || svg.node().parentElement?.clientHeight || 300;
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  // Build series (country only — no EU average)
  const series = buildSeries(selectedCountry, indicator);
  const countryPts = series[0]?.points.filter(p => p.v != null) ?? [];
  const allVals = countryPts.map(p => p.v);
  const ext = d3.extent(allVals);

  // X domain starts where data actually begins for this country/indicator
  const xMin = countryPts.length ? countryPts[0].y : 1960;
  const xMax = 2024;
  xScale = d3.scaleLinear([xMin, xMax], [0, innerW]);

  yScale = d3.scaleLinear(
    ext[0] == null ? [0,1] : [Math.min(ext[0], 0) * 1.05, ext[1] * 1.05],
    [innerH, 0]
  );

  // X axis — generate ticks dynamically based on actual data range
  const tickStep = (xMax - xMin) > 40 ? 15 : 10;
  const firstTick = Math.ceil(xMin / tickStep) * tickStep;
  const tickValsX = d3.range(firstTick, xMax + 1, tickStep);
  chartG.select(".axis-x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale)
      .tickValues(tickValsX)
      .tickFormat(d3.format("d")));

  // Y axis
  chartG.select(".axis-y")
    .call(d3.axisLeft(yScale).ticks(6));

  // Y grid
  chartG.select(".grid-y")
    .call(d3.axisLeft(yScale).ticks(6)
      .tickSize(-innerW).tickFormat(""))
    .call(g => g.select(".domain").remove());

  // Zero line for diverging
  chartG.selectAll(".zero-line").remove();
  if (meta?.type === "diverging") {
    chartG.append("line")
      .attr("class", "zero-line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0)).attr("y2", yScale(0))
      .attr("stroke", "#bbb").attr("stroke-width", 1);
  }

  // curveLinear: draw real segments so genuine demographic jumps (e.g. 2022)
  // are not smoothed away by spline interpolation.
  const lineGen = d3.line()
    .defined(p => p.v != null)
    .x(p => xScale(p.y))
    .y(p => yScale(p.v))
    .curve(d3.curveLinear);

  const areaGen = d3.area()
    .defined(p => p.v != null)
    .x(p => xScale(p.y))
    .y0(yScale(0))
    .y1(p => yScale(p.v))
    .curve(d3.curveLinear);

  // Clip paths to split the country area into above-zero / below-zero halves
  const zeroY = Math.max(0, Math.min(innerH, yScale(0)));
  let defs = svg.select("defs.chart-defs");
  if (defs.empty()) defs = svg.append("defs").attr("class", "chart-defs");
  defs.selectAll("*").remove();
  defs.append("clipPath").attr("id", "clip-pos").append("rect")
    .attr("x", 0).attr("y", 0).attr("width", innerW).attr("height", zeroY);
  defs.append("clipPath").attr("id", "clip-neg").append("rect")
    .attr("x", 0).attr("y", zeroY).attr("width", innerW).attr("height", innerH - zeroY);

  const colors = fillColors(indicator);
  const lines = chartG.select(".lines");
  lines.selectAll("*").remove();

  // ─── Country area (first series) ───
  const country = series[0];
  if (country) {
    const d = areaGen(country.points);
    // positive half
    lines.append("path")
      .attr("class", "area-fill")
      .attr("d", d)
      .attr("clip-path", "url(#clip-pos)")
      .attr("fill", colors.pos)
      .attr("fill-opacity", 0.35);
    // negative half
    lines.append("path")
      .attr("class", "area-fill")
      .attr("d", d)
      .attr("clip-path", "url(#clip-neg)")
      .attr("fill", colors.neg)
      .attr("fill-opacity", 0.35);
    // outline on top for definition
    lines.append("path")
      .attr("class", "line-path")
      .attr("d", lineGen(country.points))
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 1.5)
      .attr("fill", "none");
  }

  // ─── 5-year centred moving average for the selected country ───
  if (country) {
    const maPoints = movingAvg(country.points, 5);
    lines.append("path")
      .attr("class", "line-path ma-line")
      .attr("d", lineGen(maPoints))
      .attr("stroke", "#7c3aed")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("opacity", 0.75);
  }

  // Year cursor
  const cx = xScale(year);
  chartG.select(".year-line")
    .attr("x1", cx).attr("x2", cx)
    .attr("y1", 0).attr("y2", innerH);

  // Title / subtitle — derived DIRECTLY from state.selectedCountry (single
  // source of truth) so it can never drift from the map highlight.
  svg.selectAll(".chart-title").remove();
  const countryName = selectedCountry
    ? (COUNTRY_NAMES[selectedCountry] || selectedCountry)
    : null;
  svg.append("text").attr("class", "chart-title")
    .attr("x", MARGIN.left)
    .attr("y", 12)
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .attr("fill", "#333")
    .text(countryName ? `${countryName}` : "Select a country on the map");

  svg.append("text").attr("class", "chart-title")
    .attr("x", MARGIN.left)
    .attr("y", 24)
    .attr("font-size", 10)
    .attr("fill", "#888")
    .text(meta ? `${meta.label} (${meta.unit})` : "");
}

// Area fill colours per indicator, matching the map's scale logic:
//   NATGROWRT  → green (growth) / red (decline)
//   CNMIGRATRT → blue (inflow)  / orange (outflow)
//   sequential → single blue tone
function fillColors(indicator) {
  if (indicator === "NATGROWRT")  return { pos: "#16a34a", neg: "#dc2626" };
  if (indicator === "CNMIGRATRT") return { pos: "#2563eb", neg: "#e67e22" };
  return { pos: "#2563eb", neg: "#2563eb" };
}

function buildSeries(country, indicator) {
  const series = [];
  if (!country || !dataIndex?.get(country)) return series;

  const countryYears = dataIndex.get(country)?.get(indicator);
  if (!countryYears) return series;

  const points = Array.from(countryYears, ([yr, v]) => ({ y: yr, v })).sort((a, b) => a.y - b.y);
  series.push({ key: country, label: COUNTRY_NAMES[country] || country, points });

  // European average line
  const avgPoints = buildAvgSeries(indicator);
  if (avgPoints.length) {
    series.push({ key: "__avg", label: "EU avg", points: avgPoints });
  }
  return series;
}

function buildAvgSeries(indicator) {
  const byYear = new Map();
  for (const [, indMap] of dataIndex) {
    const yrMap = indMap.get(indicator);
    if (!yrMap) continue;
    for (const [yr, v] of yrMap) {
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr).push(v);
    }
  }
  return Array.from(byYear, ([yr, vals]) => ({
    y: yr,
    v: d3.mean(vals),
  })).sort((a, b) => a.y - b.y);
}

// Centred rolling mean of window k. Requires at least 3 non-null neighbours.
function movingAvg(points, k = 5) {
  const half = Math.floor(k / 2);
  return points.map((p, idx) => {
    if (p.v == null) return { y: p.y, v: null };
    const slice = points.slice(Math.max(0, idx - half), Math.min(points.length, idx + half + 1));
    const vals = slice.filter(x => x.v != null).map(x => x.v);
    return { y: p.y, v: vals.length >= 3 ? d3.mean(vals) : null };
  });
}

// Quick lookup for display names (populated from TopoJSON on init)
export const COUNTRY_NAMES = {};
