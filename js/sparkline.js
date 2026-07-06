import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";


export function drawSparkline(svgSel, points, opts = {}) {
  const {
    width = 120, height = 40,
    stroke = "#fff", zero = true, zeroColor = "rgba(255,255,255,.35)",
    highlightYear = null, dotColor = "#fde047",
    yDomain = null, pad = 3,
  } = opts;

  svgSel
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width).attr("height", height)
    .attr("preserveAspectRatio", "none");
  svgSel.selectAll("*").remove();

  const defined = points.filter(p => p.v != null);
  if (defined.length < 2) return;

  const xExtent = d3.extent(points, p => p.y);
  const x = d3.scaleLinear(xExtent, [pad, width - pad]);

  let dom = yDomain ? [...yDomain] : d3.extent(defined, p => p.v);
  if (dom[0] === dom[1]) dom = [dom[0] - 1, dom[1] + 1];
  const y = d3.scaleLinear(dom, [height - pad, pad]);

  if (zero && dom[0] < 0 && dom[1] > 0) {
    svgSel.append("line")
      .attr("x1", pad).attr("x2", width - pad)
      .attr("y1", y(0)).attr("y2", y(0))
      .style("stroke", zeroColor).style("stroke-width", 1);
  }

  const line = d3.line()
    .defined(p => p.v != null)
    .x(p => x(p.y))
    .y(p => y(p.v))
    .curve(d3.curveLinear);

  svgSel.append("path")
    .attr("d", line(points))
    .style("fill", "none")
    .style("stroke", stroke)
    .style("stroke-width", 1.5);

  if (highlightYear != null) {
    const hp = defined.find(p => p.y === highlightYear);
    if (hp) {
      svgSel.append("circle")
        .attr("cx", x(hp.y)).attr("cy", y(hp.v)).attr("r", 2.5)
        .style("fill", dotColor);
    }
  }
}
