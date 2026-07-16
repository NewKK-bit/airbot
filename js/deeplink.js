// deeplink.js — 검색 조건을 각 항공권 사이트의 검색 결과 URL로 변환
// 정적 사이트라 직접 데이터를 수집하지 않고, 여러 사이트로 "동시 검색"을 날리는 방식.

/**
 * @typedef {Object} SearchQuery
 * @property {string} origin       출발 공항코드 (예: "ICN")
 * @property {string} destination  도착 공항코드 (예: "NRT")
 * @property {string} departDate   가는날 "YYYY-MM-DD"
 * @property {string} [returnDate] 오는날 "YYYY-MM-DD" (왕복일 때)
 * @property {"round"|"oneway"} tripType
 * @property {number} passengers   성인 인원수
 * @property {boolean} direct       직항만
 */

// 날짜 포맷 헬퍼
const pad = (n) => String(n).padStart(2, "0");
function fmt(dateStr, style) {
  // dateStr: "2026-09-10"
  const [y, m, d] = dateStr.split("-");
  switch (style) {
    case "yymmdd":   return y.slice(2) + m + d;        // 260910
    case "yyyymmdd": return y + m + d;                 // 20260910
    case "dash":     return `${y}-${m}-${d}`;          // 2026-09-10
    default:         return dateStr;
  }
}

/** Skyscanner 딥링크 */
function skyscanner(q) {
  const o = q.origin.toLowerCase();
  const d = q.destination.toLowerCase();
  const dep = fmt(q.departDate, "yymmdd");
  let path = `${o}/${d}/${dep}/`;
  if (q.tripType === "round" && q.returnDate) {
    path += `${fmt(q.returnDate, "yymmdd")}/`;
  }
  const params = new URLSearchParams({ adults: String(q.passengers || 1) });
  if (q.direct) params.set("preferdirects", "true");
  return `https://www.skyscanner.co.kr/transport/flights/${path}?${params.toString()}`;
}

/** Google Flights 딥링크 (자연어 쿼리 방식 — 가장 안정적) */
function googleFlights(q) {
  let text = `Flights from ${q.origin} to ${q.destination} on ${q.departDate}`;
  if (q.tripType === "round" && q.returnDate) text += ` returning ${q.returnDate}`;
  if (q.passengers > 1) text += ` for ${q.passengers} adults`;
  if (q.direct) text += ` nonstop`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(text)}`;
}

/** 네이버항공권 딥링크 */
function naver(q) {
  const O = q.origin.toUpperCase();
  const D = q.destination.toUpperCase();
  const dep = fmt(q.departDate, "yyyymmdd");
  let path = `${O}-${D}-${dep}`;
  if (q.tripType === "round" && q.returnDate) {
    path += `/${D}-${O}-${fmt(q.returnDate, "yyyymmdd")}`;
  }
  const kind = q.tripType === "round" ? "round" : "oneway";
  const params = new URLSearchParams({ adult: String(q.passengers || 1) });
  return `https://flight.naver.com/flights/international/${path}?${params.toString()}&fareType=Y&trip=${kind}`;
}

/** 카약(Kayak) 딥링크 */
function kayak(q) {
  const O = q.origin.toUpperCase();
  const D = q.destination.toUpperCase();
  let path = `${O}-${D}/${fmt(q.departDate, "dash")}`;
  if (q.tripType === "round" && q.returnDate) path += `/${fmt(q.returnDate, "dash")}`;
  const params = new URLSearchParams({ sort: "price_a" });
  if (q.direct) params.set("fs", "stops=0");
  const adults = q.passengers > 1 ? `/${q.passengers}adults` : "";
  return `https://www.kayak.co.kr/flights/${path}${adults}?${params.toString()}`;
}

// 사이트 레지스트리 — UI에서 반복 렌더링
const PROVIDERS = [
  { id: "skyscanner", label: "Skyscanner", color: "#0770e3", build: skyscanner },
  { id: "google",     label: "Google Flights", color: "#4285f4", build: googleFlights },
  { id: "naver",      label: "네이버항공권", color: "#03c75a", build: naver },
  { id: "kayak",      label: "카약", color: "#ff690f", build: kayak },
];

/** 특정 노선(route 객체)을 SearchQuery로 변환 */
function routeToQuery(route) {
  return {
    origin: route.origin,
    destination: route.destination,
    departDate: route.departDate,
    returnDate: route.returnDate,
    tripType: route.tripType || (route.returnDate ? "round" : "oneway"),
    passengers: route.passengers || 1,
    direct: !!route.direct,
  };
}

// 브라우저 전역으로 노출
window.DeepLink = { PROVIDERS, routeToQuery, build: { skyscanner, googleFlights, naver, kayak } };
