import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { makeColorScale, noDataColor, INDICATORS } from "./scales.js?v=3";
import { setState } from "./state.js?v=3";
import { drawSparkline } from "./sparkline.js?v=3";

let svg, g, projection, path, colorScale;
let geoData, dataIndex, europeanFeatures;
const TOPO_OBJECT = "CNTR_RG_20M_2024_4326";

const tooltip = d3.select("#tooltip");

export function initMap(topoJson, dataIdx) {
  geoData = topoJson;
  dataIndex = dataIdx;

  svg = d3.select("#map-svg");
  g = svg.append("g");

  projection = d3.geoNaturalEarth1()
    .center([18, 54])
    .scale(1)  // will be set in resize
    .translate([0, 0]);

  path = d3.geoPath().projection(projection);

  europeanFeatures = topojson.feature(geoData, geoData.objects[TOPO_OBJECT]).features
    .filter(isEuropean);

  g.selectAll(".country")
    .data(europeanFeatures, d => d.properties.CNTR_ID)
    .join("path")
    .attr("class", "country")
    .attr("data-id", d => d.properties.CNTR_ID)
    .on("mouseenter", onHover)
    .on("mousemove", onHover)
    .on("mouseleave", () => tooltip.style("display", "none"))
    .on("click", (_, d) => setState({ selectedCountry: d.properties.CNTR_ID }));

  // Re-project and redraw whenever the container changes size
  const ro = new ResizeObserver(() => {
    resize();
    const s = getCurrentState();
    if (s) renderMap(s);
  });
  ro.observe(svg.node());
  resize();
}

function isEuropean(f) {
  const id = f.properties.CNTR_ID;
  // Include all Eurostat-coded European countries present in our CSV
  // We filter by a list of known European/CIS codes that appear in demo_gind
  return EUROPEAN_CODES.has(id);
}

const EUROPEAN_CODES = new Set([
  "AT","BE","BG","CH","CY","CZ","DE","DK","EE","EL","ES","FI","FR",
  "HR","HU","IE","IS","IT","LI","LT","LU","LV","MT","NL","NO","PL",
  "PT","RO","SE","SI","SK","UK","AL","AM","AZ","BA","BY","GE","MD",
  "ME","MK","RS","RU","TR","UA","XK","AD","MC","SM","LV","LT",
]);

// Geographic bounding box that frames continental Europe.
// Russia, Turkey, Azerbaijan etc. extend beyond this but get SVG-clipped.
// GeoJSON exterior rings must be counter-clockwise (right-hand rule).
// CCW = SW → NW → NE → SE → SW
const EUROPE_FRAME = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-25, 34], [-25, 72], [50, 72], [50, 34], [-25, 34]
    ]],
  },
};

function resize() {
  // Use the container div's dimensions (more reliable than SVG clientWidth)
  const container = svg.node().parentElement;
  const rect = container?.getBoundingClientRect() ?? {};
  const w = rect.width  || svg.node().clientWidth;
  const h = rect.height || svg.node().clientHeight;
  if (!w || !h || !europeanFeatures) return;

  // Fit to a geographic rectangle covering Europe so that Russia/Turkey
  // don't shrink the scale — they will be partially clipped by the SVG boundary.
  projection.fitExtent([[4, 4], [w - 4, h - 4]], EUROPE_FRAME);
  path = d3.geoPath().projection(projection);
  g.selectAll(".country").attr("d", path);
}

export function renderMap(state) {
  const { indicator, year, selectedCountry } = state;

  // Gather values for scale domain
  const vals = [];
  if (dataIndex) {
    for (const [, indMap] of dataIndex) {
      const v = indMap.get(indicator)?.get(year);
      if (v != null) vals.push(v);
    }
  }
  colorScale = makeColorScale(indicator, vals);

  g.selectAll(".country")
    .attr("fill", d => {
      const v = dataIndex?.get(d.properties.CNTR_ID)?.get(indicator)?.get(year);
      return v != null ? colorScale(v) : noDataColor();
    })
    .classed("selected", d => d.properties.CNTR_ID === selectedCountry)
    .classed("dimmed", d => selectedCountry && d.properties.CNTR_ID !== selectedCountry);

  renderLegend(indicator, colorScale, vals);
}

function onHover(event, d) {
  const id = d.properties.CNTR_ID;
  const name = d.properties.NAME_ENGL || id;
  const { indicator, year } = getCurrentState();
  const v = dataIndex?.get(id)?.get(indicator)?.get(year);
  const meta = INDICATORS.find(i => i.code === indicator);

  const valStr = v != null ? `${v.toFixed(2)} ${meta?.unit ?? ""}` : "no data";
  tooltip
    .style("display", "block")
    .style("left", (event.clientX + 14) + "px")
    .style("top",  (event.clientY - 10) + "px")
    .html(`<b>${name}</b><br>${year}<br>${meta?.label}: ${valStr}`);

  // Mini-sparkline of this country's full 1960–2024 trend for the active indicator
  const yrMap = dataIndex?.get(id)?.get(indicator);
  if (yrMap && yrMap.size > 1) {
    const points = [];
    for (let yy = 1960; yy <= 2024; yy++) points.push({ y: yy, v: yrMap.get(yy) ?? null });
    const sparkSvg = tooltip.append("svg");
    drawSparkline(sparkSvg, points, {
      width: 120, height: 40, stroke: "#fff",
      highlightYear: year,
    });
  }
}

// filled by main.js via a simple closure
let getCurrentState = () => ({ indicator: "NATGROWRT", year: 2020 });
export function setStateGetter(fn) { getCurrentState = fn; }

// ─── Legend ────────────────────────────────────────────────────────────────
function renderLegend(indicatorCode, scale, vals) {
  const svg = d3.select("#legend-svg");
  svg.selectAll("*").remove();
  if (!vals.length) return;

  const W = svg.node().getBoundingClientRect().width || 180;
  const H = 14;
  const steps = 80;
  const barW = W - 40;

  const ext = d3.extent(vals);
  const meta = INDICATORS.find(d => d.code === indicatorCode);

  // Gradient bar
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id", "legend-grad");
  d3.range(steps + 1).forEach(i => {
    const t = i / steps;
    const v = ext[0] + t * (ext[1] - ext[0]);
    grad.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", scale(v));
  });

  svg.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", barW).attr("height", H)
    .style("fill", "url(#legend-grad)");

  // Ticks
  const tScale = d3.scaleLinear(ext, [0, barW]);
  const tickVals = meta?.type === "diverging"
    ? [ext[0], 0, ext[1]]
    : [ext[0], (ext[0]+ext[1])/2, ext[1]];

  tickVals.forEach(v => {
    svg.append("text")
      .attr("x", tScale(v))
      .attr("y", H + 10)
      .attr("text-anchor", v === ext[0] ? "start" : v === ext[1] ? "end" : "middle")
      .attr("font-size", 9)
      .attr("fill", "#666")
      .text(Number.isInteger(v) ? v : v.toFixed(1));
  });

  svg.attr("height", H + 12);
}
