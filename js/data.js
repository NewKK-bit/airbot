// data.js — prices.json 로드 및 통계 계산 (읽기 전용). 원본은 Notion.

const DATA_URL = "data/prices.json";

// 실시간 갱신 결과(로컬 저장)를 노선에 병합 — 오늘자 가격 교체 + 추천편/인사이트 갱신
function applyLive(route, live) {
  if (!live || live.cheapest == null) return;
  route.prices = [...(route.prices || []).filter((p) => p.date !== live.date),
    { date: live.date, price: live.cheapest, source: "실시간" }]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (live.insights) route.insights = live.insights;
  if (live.offers?.length) route.bestFlights = live.offers;
  route._liveTs = live.ts;
}

async function loadData() {
  let data;
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.error("데이터 로드 실패:", e);
    data = { routes: [], generatedAt: null, source: "error" };
  }
  data.routes = data.routes || [];

  // 사용자가 이 브라우저에서 직접 추가한 노선 병합 (가격 히스토리는 로컬 저장)
  for (const r of getMyRoutes()) {
    data.routes.push({ ...r, _local: true, prices: getHist(r.id), insights: null, bestFlights: [] });
  }

  // 실시간 갱신값 + 목표가 등 사용자 수정(override) 반영
  const genTs = data.generatedAt ? Date.parse(data.generatedAt) : 0;
  const ov = getOverrides();
  for (const r of data.routes) {
    try {
      const live = JSON.parse(localStorage.getItem("airbot.live." + r.id));
      // 로컬 노선은 항상, 수집 노선은 수집본보다 새로울 때만 적용
      if (live && (r._local || live.ts > genTs)) applyLive(r, live);
    } catch { /* 무시 */ }
    if (ov[r.id] && ov[r.id].targetPrice != null) r.targetPrice = ov[r.id].targetPrice;
  }
  return data;
}

// 모니터링에서 숨긴(삭제한) 수집 노선 관리
function getHidden() {
  try { return new Set(JSON.parse(localStorage.getItem("airbot.hidden") || "[]")); }
  catch { return new Set(); }
}
function setHidden(set) { localStorage.setItem("airbot.hidden", JSON.stringify([...set])); }

// 내가 추가한 로컬 노선
function getMyRoutes() { try { return JSON.parse(localStorage.getItem("airbot.myRoutes") || "[]"); } catch { return []; } }
function saveMyRoutes(a) { localStorage.setItem("airbot.myRoutes", JSON.stringify(a)); }
function upsertMyRoute(cfg) {
  const a = getMyRoutes(); const i = a.findIndex((r) => r.id === cfg.id);
  if (i >= 0) a[i] = cfg; else a.push(cfg);
  saveMyRoutes(a);
}
function removeMyRoute(id) {
  saveMyRoutes(getMyRoutes().filter((r) => r.id !== id));
  localStorage.removeItem("airbot.hist." + id);
  localStorage.removeItem("airbot.live." + id);
}

// 로컬 노선 가격 히스토리
function getHist(id) { try { return JSON.parse(localStorage.getItem("airbot.hist." + id) || "[]"); } catch { return []; } }
function addHist(id, date, price) {
  const h = getHist(id).filter((p) => p.date !== date);
  h.push({ date, price, source: "실시간" });
  h.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem("airbot.hist." + id, JSON.stringify(h));
  return h;
}

// 목표가 등 사용자 수정 override (수집 노선에도 적용)
function getOverrides() { try { return JSON.parse(localStorage.getItem("airbot.overrides") || "{}"); } catch { return {}; } }
function setOverride(id, patch) {
  const o = getOverrides(); o[id] = { ...o[id], ...patch };
  localStorage.setItem("airbot.overrides", JSON.stringify(o));
}

// 통화 포맷
function won(n) {
  if (n == null || isNaN(n)) return "-";
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function shortDate(d) {
  if (!d) return "-";
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

// 노선별 파생 통계 계산
function routeStats(route) {
  const prices = [...(route.prices || [])].sort((a, b) => a.date.localeCompare(b.date));
  if (!prices.length) {
    return { current: null, min: null, max: null, avg: null, first: null,
             deltaFromPrev: 0, deltaFromAvg: 0, hitTarget: false, prices,
             vsMinPct: 0, progress: 0 };
  }
  const vals = prices.map((p) => p.price);
  const current = vals[vals.length - 1];
  const prev = vals.length > 1 ? vals[vals.length - 2] : current;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const deltaFromPrev = current - prev;
  const deltaFromAvg = current - avg;
  const hitTarget = route.targetPrice != null && current <= route.targetPrice;
  const vsMinPct = min > 0 ? ((current - min) / min) * 100 : 0;

  // 목표가 달성 진행도: 최고가→목표가 구간에서 현재 위치 (0~100%)
  let progress = 0;
  if (route.targetPrice != null) {
    const span = Math.max(max - route.targetPrice, 1);
    progress = Math.min(100, Math.max(0, ((max - current) / span) * 100));
  }
  return { current, min, max, avg, first: vals[0], deltaFromPrev, deltaFromAvg,
           hitTarget, prices, vsMinPct, progress };
}

// Google Price Insights 레벨 → 배지
function priceLevel(route) {
  const lvl = route.insights?.level;
  if (lvl === "low") return { text: "구글: 저렴한 편", tone: "down", badge: "badge-hit" };
  if (lvl === "high") return { text: "구글: 비싼 편", tone: "up", badge: "badge-off" };
  if (lvl === "typical") return { text: "구글: 보통 수준", tone: "neutral", badge: "badge-active" };
  return null;
}

// "지금 살 때인가" 판정 문구 — 구글 인사이트가 있으면 우선 반영
function buySignal(stats, route) {
  if (stats.current == null) return { text: "데이터 없음", tone: "neutral" };
  if (stats.hitTarget) return { text: "🎯 목표가 도달! 예매 추천", tone: "down" };
  const lvl = route.insights?.level;
  if (lvl === "low") return { text: "👍 구글 기준 저렴한 시기", tone: "down" };
  if (lvl === "high") return { text: "가격이 비싼 편, 관망", tone: "up" };
  if (stats.vsMinPct <= 3) return { text: "👍 역대 최저가 근접", tone: "down" };
  if (stats.deltaFromAvg < 0) return { text: "평균보다 저렴", tone: "down" };
  if (stats.deltaFromPrev > 0) return { text: "가격 상승 중, 관망", tone: "up" };
  return { text: "평균 수준", tone: "neutral" };
}

// 소요시간(분) → "2시간 30분"
function fmtDuration(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return `${h ? h + "시간 " : ""}${m}분`;
}

function getRouteById(data, id) {
  return (data.routes || []).find((r) => r.id === id) || null;
}

window.FlightData = { loadData, won, shortDate, routeStats, buySignal, priceLevel, fmtDuration,
                      getRouteById, applyLive, getHidden, setHidden,
                      getMyRoutes, saveMyRoutes, upsertMyRoute, removeMyRoute,
                      getHist, addHist, getOverrides, setOverride };
