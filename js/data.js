// data.js — prices.json 로드 및 통계 계산 (읽기 전용). 원본은 Notion.

const DATA_URL = "data/prices.json";

async function loadData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("데이터 로드 실패:", e);
    return { routes: [], generatedAt: null, source: "error" };
  }
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

// "지금 살 때인가" 판정 문구
function buySignal(stats, route) {
  if (stats.current == null) return { text: "데이터 없음", tone: "neutral" };
  if (stats.hitTarget) return { text: "🎯 목표가 도달! 예매 추천", tone: "down" };
  if (stats.vsMinPct <= 3) return { text: "👍 역대 최저가 근접", tone: "down" };
  if (stats.deltaFromAvg < 0) return { text: "평균보다 저렴", tone: "down" };
  if (stats.deltaFromPrev > 0) return { text: "가격 상승 중, 관망", tone: "up" };
  return { text: "평균 수준", tone: "neutral" };
}

function getRouteById(data, id) {
  return (data.routes || []).find((r) => r.id === id) || null;
}

window.FlightData = { loadData, won, shortDate, routeStats, buySignal, getRouteById };
