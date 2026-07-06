import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export const INDICATORS = [
  { code: "NATGROWRT",  label: "Natural Change Rate",   unit: "per 1 000 inhab.",  type: "diverging" },
  { code: "GBIRTHRT",   label: "Crude Birth Rate",      unit: "per 1 000 inhab.",  type: "sequential" },
  { code: "GDEATHRT",   label: "Crude Death Rate",      unit: "per 1 000 inhab.",  type: "sequential" },
  { code: "JAN",        label: "Population (Jan 1)",    unit: "persons",            type: "sequential" },
  { code: "LBIRTH",     label: "Live Births",           unit: "persons",            type: "sequential" },
  { code: "DEATH",      label: "Deaths",                unit: "persons",            type: "sequential" },
];

const SEQUENTIAL_SCHEMES = {
  GBIRTHRT:  d3.interpolateBlues,
  GDEATHRT:  d3.interpolateReds,
  JAN:       d3.interpolateGreys,
  LBIRTH:    d3.interpolateBlues,
  DEATH:     d3.interpolateReds,
};

export function makeColorScale(indicatorCode, values) {
  const meta = INDICATORS.find(d => d.code === indicatorCode);
  const vals = values.filter(v => v != null && isFinite(v));
  if (!vals.length) return () => "#ccc";

  if (meta?.type === "diverging") {
    const ext = d3.extent(vals);
    const absMax = Math.max(Math.abs(ext[0]), Math.abs(ext[1]));
    const scheme = indicatorCode === "CNMIGRATRT"
      ? d3.interpolateRdBu
      : d3.interpolateRdYlGn;
    return d3.scaleDiverging([-absMax, 0, absMax], scheme);
  }

  const scheme = SEQUENTIAL_SCHEMES[indicatorCode] ?? d3.interpolateBlues;
  const ext = d3.extent(vals);
  return d3.scaleSequential(ext, scheme);
}

export function noDataColor() { return "#d0d0d0"; }

export const FORMULAS = {
  NATGROWRT: {
    name: "NCR",
    full: "(Births &minus; Deaths) &divide; Mid-year Population &times; 1&thinsp;000",
    note: "Positive &rarr; natural growth &nbsp;&middot;&nbsp; Negative &rarr; natural decline",
  },
  GBIRTHRT: {
    name: "CBR",
    full: "Live Births &divide; Mid-year Population &times; 1&thinsp;000",
    note: "Crude rate &mdash; does not account for age structure",
  },
  GDEATHRT: {
    name: "CDR",
    full: "Deaths &divide; Mid-year Population &times; 1&thinsp;000",
    note: "Crude rate &mdash; does not account for age structure",
  },
  JAN: {
    name: "P",
    full: "Total resident population on 1 January",
    note: "Absolute count &mdash; size of country dominates comparisons",
  },
  LBIRTH: {
    name: "B",
    full: "Total live births during the calendar year",
    note: "Absolute count",
  },
  DEATH: {
    name: "D",
    full: "Total deaths during the calendar year",
    note: "Absolute count",
  },
};
