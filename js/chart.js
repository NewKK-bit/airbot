// chart.js — 외부 라이브러리 없는 순수 SVG 차트 (라인차트 + 스파크라인)

const SVGNS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

/**
 * 카드용 미니 스파크라인.
 * @param {number[]} values
 * @param {{w?:number,h?:number,color?:string}} opts
 * @returns {SVGElement}
 */
function sparkline(values, opts = {}) {
  const w = opts.w || 260, h = opts.h || 46, pad = 4;
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, class: "spark", preserveAspectRatio: "none" });
  if (!values || values.length < 2) return svg;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`);
  const color = opts.color || "var(--blue-500)";

  const grad = el("linearGradient", { id: "sg" + Math.round(x(1) * 97 % 9999), x1: "0", y1: "0", x2: "0", y2: "1" });
  const gid = grad.getAttribute("id");
  grad.append(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": ".25" }),
              el("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
  svg.append(grad);

  const area = el("path", {
    d: `M ${x(0)},${h - pad} L ${pts.join(" L ")} L ${x(values.length - 1)},${h - pad} Z`,
    fill: `url(#${gid})`,
  });
  const line = el("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": "2",
                                "stroke-linejoin": "round", "stroke-linecap": "round" });
  svg.append(area, line);
  // 마지막 점
  const last = values.length - 1;
  svg.append(el("circle", { cx: x(last), cy: y(values[last]), r: "3", fill: color }));
  return svg;
}

/**
 * 상세 페이지용 라인차트 (축, 그리드, 목표선, 툴팁).
 * @param {Array<{date:string,price:number,source?:string}>} series
 * @param {{target?:number, avg?:number, fmt?:function}} opts
 * @returns {SVGElement}
 */
function lineChart(series, opts = {}) {
  const W = 720, H = 320;
  const m = { top: 20, right: 20, bottom: 40, left: 64 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const fmt = opts.fmt || ((v) => v);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", preserveAspectRatio: "xMidYMid meet" });

  if (!series || !series.length) return svg;

  const vals = series.map((d) => d.price);
  const extra = [opts.target, opts.avg].filter((v) => v != null);
  let min = Math.min(...vals, ...extra);
  let max = Math.max(...vals, ...extra);
  const padY = (max - min) * 0.15 || max * 0.1 || 1;
  min = Math.max(0, min - padY); max = max + padY;
  const span = max - min || 1;

  const x = (i) => m.left + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = (v) => m.top + ih - ((v - min) / span) * ih;

  // Y 그리드 + 라벨
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const val = min + (span * t) / ticks;
    const gy = y(val);
    svg.append(el("line", { x1: m.left, y1: gy, x2: W - m.right, y2: gy,
      stroke: "var(--border)", "stroke-width": "1", "stroke-dasharray": t === 0 ? "0" : "3 4" }));
    const lbl = el("text", { x: m.left - 10, y: gy + 4, "text-anchor": "end",
      "font-size": "11", fill: "var(--text-3)" });
    lbl.textContent = fmt(val);
    svg.append(lbl);
  }

  // X 라벨
  const step = Math.ceil(series.length / 6);
  series.forEach((d, i) => {
    if (i % step !== 0 && i !== series.length - 1) return;
    const t = el("text", { x: x(i), y: H - 14, "text-anchor": "middle", "font-size": "11", fill: "var(--text-3)" });
    const [, mo, da] = d.date.split("-");
    t.textContent = `${Number(mo)}/${Number(da)}`;
    svg.append(t);
  });

  // 목표선
  if (opts.target != null) {
    const ty = y(opts.target);
    svg.append(el("line", { x1: m.left, y1: ty, x2: W - m.right, y2: ty,
      stroke: "var(--accent)", "stroke-width": "1.5", "stroke-dasharray": "6 4" }));
    const t = el("text", { x: W - m.right, y: ty - 6, "text-anchor": "end", "font-size": "11",
      fill: "var(--accent)", "font-weight": "700" });
    t.textContent = "목표 " + fmt(opts.target);
    svg.append(t);
  }

  // 영역 + 라인
  const pts = series.map((d, i) => `${x(i)},${y(d.price)}`);
  const grad = el("linearGradient", { id: "lg", x1: "0", y1: "0", x2: "0", y2: "1" });
  grad.append(el("stop", { offset: "0%", "stop-color": "var(--blue-500)", "stop-opacity": ".28" }),
              el("stop", { offset: "100%", "stop-color": "var(--blue-500)", "stop-opacity": "0" }));
  svg.append(grad);
  svg.append(el("path", { d: `M ${x(0)},${m.top + ih} L ${pts.join(" L ")} L ${x(series.length - 1)},${m.top + ih} Z`,
    fill: "url(#lg)" }));
  svg.append(el("polyline", { points: pts.join(" "), fill: "none", stroke: "var(--blue-500)",
    "stroke-width": "2.5", "stroke-linejoin": "round", "stroke-linecap": "round" }));

  // 데이터 포인트 + 인터랙션
  const tip = el("g", { style: "pointer-events:none; opacity:0", class: "chart-tip" });
  const tipRect = el("rect", { rx: "8", fill: "var(--blue-900)", width: "120", height: "44" });
  const tipT1 = el("text", { "font-size": "12", fill: "#fff", "font-weight": "700", x: "10", y: "18" });
  const tipT2 = el("text", { "font-size": "11", fill: "rgba(255,255,255,.75)", x: "10", y: "34" });
  tip.append(tipRect, tipT1, tipT2);

  series.forEach((d, i) => {
    const cx = x(i), cy = y(d.price);
    const dot = el("circle", { cx, cy, r: "4", fill: "var(--surface)", stroke: "var(--blue-500)", "stroke-width": "2.5" });
    const hit = el("circle", { cx, cy, r: "14", fill: "transparent", style: "cursor:pointer" });
    hit.addEventListener("mouseenter", () => {
      dot.setAttribute("r", "6");
      tipT1.textContent = fmt(d.price);
      const [, mo, da] = d.date.split("-");
      tipT2.textContent = `${Number(mo)}/${Number(da)} · ${d.source || ""}`;
      const tw = Math.max(tipT1.getComputedTextLength?.() || 60, tipT2.getComputedTextLength?.() || 60) + 20;
      tipRect.setAttribute("width", tw);
      let tx = cx - tw / 2; tx = Math.max(m.left, Math.min(tx, W - m.right - tw));
      const ty = cy - 56 < 0 ? cy + 14 : cy - 56;
      tip.setAttribute("transform", `translate(${tx},${ty})`);
      tip.setAttribute("style", "pointer-events:none; opacity:1; transition:opacity .15s");
    });
    hit.addEventListener("mouseleave", () => { dot.setAttribute("r", "4");
      tip.setAttribute("style", "pointer-events:none; opacity:0; transition:opacity .15s"); });
    svg.append(dot, hit);
  });
  svg.append(tip);
  return svg;
}

window.Chart = { sparkline, lineChart };
