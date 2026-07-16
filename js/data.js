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
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // 이 브라우저에서 '재검색'으로 받아둔 실시간 값이 수집본보다 새로우면 반영
    const genTs = data.generatedAt ? Date.parse(data.generatedAt) : 0;
    for (const r of data.routes || []) {
      try {
        const live = JSON.parse(localStorage.getItem("airbot.live." + r.id));
        if (live && live.ts > genTs) applyLive(r, live);
      } catch { /* 무시 */ }
    }
    return data;
  } catch (e) {
    console.error("데이터 로드 실패:", e);
    return { routes: [], generatedAt: null, source: "error" };
  }
}

// 모니터링에서 숨긴(삭제한) 노선 관리
function getHidden() {
  try { return new Set(JSON.parse(localStorage.getItem("airbot.hidden") || "[]")); }
  catch { return new Set(); }
}
function setHidden(set) { localStorage.setItem("airbot.hidden", JSON.stringify([...set])); }

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
                      getRouteById, applyLive, getHidden, setHidden };
