// api.js — 앱 내 실시간 항공권 검색 (개인 프록시 경유)
// SerpApi는 브라우저 직접 호출(CORS)을 차단하므로, 키를 안전하게 보관한
// 개인 프록시(proxy/worker.js, Cloudflare Worker)를 통해 호출한다.
// 프록시 URL은 이 브라우저의 localStorage에만 저장된다.

const LS_PROXY = "airbot.proxyUrl";

// 시간대 밴드 → SerpApi outbound_times/return_times (시작시, 끝시)
const TIME_RANGE = { dawn: "0,6", morning: "6,12", afternoon: "12,18", evening: "18,23" };

const getProxy = () => (localStorage.getItem(LS_PROXY) || "").trim();
function setProxy(url) {
  url = (url || "").trim().replace(/\/+$/, "");
  if (url) localStorage.setItem(LS_PROXY, url);
  else localStorage.removeItem(LS_PROXY);
}
const isConfigured = () => !!getProxy();

// KST(UTC+9) 기준 오늘 날짜
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** SearchQuery → 프록시 요청 파라미터 */
function buildParams(q) {
  const p = new URLSearchParams({
    departure_id: q.origin,
    arrival_id: q.destination,
    outbound_date: q.departDate,
    adults: String(q.passengers || 1),
  });
  if (q.tripType === "oneway") {
    p.set("type", "2");
  } else {
    p.set("type", "1");
    if (q.returnDate) p.set("return_date", q.returnDate);
  }
  if (q.direct) p.set("stops", "1");
  if (TIME_RANGE[q.departTime]) p.set("outbound_times", TIME_RANGE[q.departTime]);
  if (q.tripType !== "oneway" && TIME_RANGE[q.returnTime]) p.set("return_times", TIME_RANGE[q.returnTime]);
  return p;
}

/** SerpApi 응답 → {cheapest, offers[], insights} — 1인당 가격으로 정규화 */
function summarize(json, pax) {
  pax = pax || 1;
  const pp = (v) => (v == null ? null : Math.round(v / pax));
  const all = [...(json.best_flights || []), ...(json.other_flights || [])];
  const offers = all.map((f) => {
    const segs = f.flights || [];
    const first = segs[0], last = segs[segs.length - 1];
    return {
      price: pp(f.price),
      airline: first?.airline || f.airline || "",
      logo: first?.airline_logo || f.airline_logo || "",
      departTime: first?.departure_airport?.time || "",
      arriveTime: last?.arrival_airport?.time || "",
      duration: f.total_duration ?? null,
      stops: (f.layovers || []).length,
    };
  }).filter((o) => typeof o.price === "number");
  offers.sort((a, b) => a.price - b.price);

  const pi = json.price_insights || {};
  const insights = (pi.lowest_price != null || pi.price_level) ? {
    lowest: pp(pi.lowest_price),
    level: pi.price_level ?? null,
    typicalLow: Array.isArray(pi.typical_price_range) ? pp(pi.typical_price_range[0]) : null,
    typicalHigh: Array.isArray(pi.typical_price_range) ? pp(pi.typical_price_range[1]) : null,
  } : null;

  return { cheapest: offers[0]?.price ?? (insights ? insights.lowest : null), offers: offers.slice(0, 8), insights };
}

/** 실시간 검색. 프록시 미설정이면 Error("NO_PROXY") */
async function searchLive(q) {
  const proxy = getProxy();
  if (!proxy) { const e = new Error("NO_PROXY"); e.code = "NO_PROXY"; throw e; }

  let res, json;
  try {
    res = await fetch(proxy + "?" + buildParams(q).toString());
  } catch {
    throw new Error("프록시에 연결할 수 없어요. 설정된 URL을 확인해주세요.");
  }
  try { json = await res.json(); }
  catch { throw new Error("프록시 응답이 올바르지 않아요 (JSON 아님)."); }

  if (json.error) {
    const msg = String(json.error);
    if (/api_key|invalid key/i.test(msg)) throw new Error("SerpApi 키 오류 — 프록시의 SERPAPI_KEY 설정을 확인하세요.");
    if (/run out|exceeded|limit/i.test(msg)) throw new Error("이번 달 SerpApi 무료 쿼터(250건)를 모두 사용했어요.");
    throw new Error(msg);
  }
  if (!res.ok) throw new Error(`검색 실패 (HTTP ${res.status})`);
  return summarize(json, q.passengers || 1);
}

/** 실시간 결과를 로컬에 저장 → data.js가 로드 시 병합 */
function saveLive(routeId, result) {
  try {
    localStorage.setItem("airbot.live." + routeId, JSON.stringify({
      ts: Date.now(), date: kstToday(),
      cheapest: result.cheapest, offers: result.offers, insights: result.insights,
    }));
  } catch { /* storage full 등은 무시 */ }
}
function loadLive(routeId) {
  try { return JSON.parse(localStorage.getItem("airbot.live." + routeId)); }
  catch { return null; }
}

/** 자동 갱신: 오늘 아직 안 받아온 노선을 프록시로 조회해 기록. 갱신된 개수 반환 */
async function autoRefreshRoute(route) {
  if (!isConfigured()) return false;
  const today = kstToday();
  const live = loadLive(route.id);
  if (live && live.date === today) return false; // 오늘 이미 갱신됨
  const q = window.DeepLink.routeToQuery(route);
  const r = await searchLive(q);
  saveLive(route.id, r);
  if (route._local && r.cheapest != null && window.FlightData) window.FlightData.addHist(route.id, today, r.cheapest);
  return true;
}
async function autoRefreshAll(routes) {
  let n = 0;
  for (const route of routes) { try { if (await autoRefreshRoute(route)) n++; } catch { /* 개별 실패 무시 */ } }
  return n;
}

window.AirApi = { isConfigured, getProxy, setProxy, searchLive, saveLive, loadLive,
                  autoRefreshRoute, autoRefreshAll, kstToday, TIME_RANGE };
