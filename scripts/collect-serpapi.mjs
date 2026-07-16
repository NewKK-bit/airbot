// collect-serpapi.mjs — SerpApi(Google Flights)로 관심 노선의 실가격을 수집해 data/prices.json 갱신
// GitHub Actions에서 매일 실행. 키는 Secrets(SERPAPI_KEY)에만 저장 → 클라이언트에 노출 안 됨.
//
// 필요한 환경변수:
//   SERPAPI_KEY   SerpApi API 키 (https://serpapi.com — 무료 월 250건)
//
// 동작:
//   1) data/routes.json 의 노선 목록을 읽고
//   2) 각 노선을 SerpApi Google Flights로 조회해 최저가 + 추천 항공편 + 가격 인사이트를 얻고
//   3) 기존 prices.json 의 가격 히스토리에 오늘자 최저가를 누적(같은 날짜는 갱신)해서 다시 씀.
//
// Node 20+ (내장 fetch). 외부 의존성 없음.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const KEY = process.env.SERPAPI_KEY;
const ROUTES_FILE = "data/routes.json";
const OUT = "data/prices.json";
const ENDPOINT = "https://serpapi.com/search.json";

// KST(UTC+9) 기준 관측일
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf-8")); }
  catch { return fallback; }
}

// SerpApi 파라미터 구성
function buildUrl(route) {
  const p = new URLSearchParams({
    engine: "google_flights",
    departure_id: route.origin,
    arrival_id: route.destination,
    outbound_date: route.departDate,
    currency: route.currency || "KRW",
    hl: "ko",
    gl: "kr",
    adults: String(route.passengers || 1),
    api_key: KEY,
  });
  if (route.tripType === "oneway") {
    p.set("type", "2");
  } else {
    p.set("type", "1");
    if (route.returnDate) p.set("return_date", route.returnDate);
  }
  if (route.direct) p.set("stops", "1"); // 1 = 직항만
  return `${ENDPOINT}?${p.toString()}`;
}

// SerpApi 응답 → 요약 { cheapest, offers[], insights }
function summarize(json) {
  const all = [...(json.best_flights || []), ...(json.other_flights || [])];
  const offers = all.map((f) => {
    const segs = f.flights || [];
    const first = segs[0], last = segs[segs.length - 1];
    return {
      price: f.price,
      airline: first?.airline || f.airline || "",
      departTime: first?.departure_airport?.time || "",
      arriveTime: last?.arrival_airport?.time || "",
      duration: f.total_duration ?? null,      // 분
      stops: (f.layovers || []).length,
    };
  }).filter((o) => typeof o.price === "number");
  offers.sort((a, b) => a.price - b.price);

  const pi = json.price_insights || {};
  const cheapest = offers[0]?.price ?? (typeof pi.lowest_price === "number" ? pi.lowest_price : null);
  const insights = (pi.lowest_price != null || pi.price_level) ? {
    lowest: pi.lowest_price ?? null,
    level: pi.price_level ?? null,           // "low" | "typical" | "high"
    typicalLow: Array.isArray(pi.typical_price_range) ? pi.typical_price_range[0] : null,
    typicalHigh: Array.isArray(pi.typical_price_range) ? pi.typical_price_range[1] : null,
  } : null;

  return { cheapest, offers: offers.slice(0, 4), insights };
}

// 오늘자 가격을 히스토리에 병합(같은 날짜면 교체)
function mergePrice(history, date, price) {
  const out = (history || []).filter((h) => h.date !== date);
  out.push({ date, price, source: "Google Flights" });
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function main() {
  if (!KEY) { console.error("환경변수 SERPAPI_KEY 가 필요합니다."); process.exit(1); }

  const cfg = await readJson(ROUTES_FILE, { routes: [] });
  const prev = await readJson(OUT, { routes: [] });
  const prevById = new Map((prev.routes || []).map((r) => [r.id, r]));
  const today = kstToday();

  const routes = [];
  let ok = 0, fail = 0;

  for (const c of cfg.routes || []) {
    const base = prevById.get(c.id) || {};
    // config가 노선 정의의 원천 — 설정값은 config로 덮고, 히스토리/인사이트는 기존 것 유지
    const route = {
      ...c,
      prices: base.prices || [],
      insights: base.insights || null,
      bestFlights: base.bestFlights || [],
    };

    try {
      const res = await fetch(buildUrl(c));
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      const { cheapest, offers, insights } = summarize(json);
      // SerpApi(구글플라이트)는 인원수 총액을 반환 → 1인당으로 정규화
      const pax = c.passengers || 1;
      const perPerson = (v) => (v == null ? null : Math.round(v / pax));
      const cheapestPP = perPerson(cheapest);
      offers.forEach((o) => { o.price = perPerson(o.price); });
      if (insights) {
        insights.lowest = perPerson(insights.lowest);
        insights.typicalLow = perPerson(insights.typicalLow);
        insights.typicalHigh = perPerson(insights.typicalHigh);
      }
      if (cheapestPP != null) {
        route.prices = mergePrice(route.prices, today, cheapestPP);
        route.insights = insights;
        route.bestFlights = offers;
        ok++;
        console.log(`✓ ${c.name} (${c.origin}→${c.destination}): 1인당 ${cheapestPP.toLocaleString()}원(총 ${cheapest.toLocaleString()}/${pax}인), 추천 ${offers.length}편`);
      } else {
        console.warn(`⚠ ${c.name}: 가격 결과 없음, 기존 데이터 유지`);
        fail++;
      }
    } catch (e) {
      console.warn(`✗ ${c.name}: 수집 실패(${e.message}), 기존 데이터 유지`);
      fail++;
    }

    routes.push(route);
    await new Promise((r) => setTimeout(r, 1200)); // 레이트리밋 여유
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "SerpApi Google Flights",
    currency: "KRW",
    priceBasis: "per-person",
    routes,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(`\n완료: 성공 ${ok} / 실패 ${fail} / 전체 ${routes.length} → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
