// proxy/worker.js — AirBot 실시간 검색용 Cloudflare Worker (무료)
//
// 역할: 브라우저 ←→ SerpApi 사이의 안전한 다리.
//  - SerpApi는 브라우저 직접 호출(CORS)을 차단하고, 키를 클라이언트에 두면 유출됨.
//  - 이 워커가 키를 서버측 Secret으로 보관하고, 허용된 출처(내 사이트)에만 응답한다.
//  - 같은 검색은 10분간 캐시해 무료 쿼터(월 250건)를 아낀다.
//
// 배포 (5분):
//  1. https://dash.cloudflare.com 가입/로그인 → Workers & Pages → Create → Worker
//  2. 이 파일 내용을 통째로 붙여넣고 Deploy
//  3. Worker → Settings → Variables and Secrets → Add →
//       Type: Secret / Name: SERPAPI_KEY / Value: (SerpApi 키)
//  4. 배포된 URL(https://xxx.workers.dev)을 AirBot 검색 페이지의 ⚙️ 실시간 검색 설정에 붙여넣기

const ALLOWED_ORIGINS = [
  "https://newkk-bit.github.io",   // GitHub Pages 배포 주소
];

// SerpApi로 전달을 허용하는 파라미터 화이트리스트 (키 오남용 방지)
const ALLOWED_PARAMS = new Set([
  "departure_id", "arrival_id", "outbound_date", "return_date", "type",
  "adults", "stops", "outbound_times", "return_times",
]);

function isAllowed(origin) {
  return ALLOWED_ORIGINS.includes(origin)
    || origin.startsWith("http://localhost")
    || origin.startsWith("http://127.0.0.1");
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowed(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return json({ error: "GET only" }, 405, cors);
    // 쿼터 도용 방지: 허용된 출처(내 사이트)에서 온 요청만 처리
    if (!isAllowed(origin)) return json({ error: "허용되지 않은 출처입니다" }, 403, cors);
    if (!env.SERPAPI_KEY) return json({ error: "SERPAPI_KEY secret이 설정되지 않았어요" }, 500, cors);

    // 파라미터 구성 (engine/지역화는 서버가 고정)
    const p = new URLSearchParams({ engine: "google_flights", currency: "KRW", hl: "ko", gl: "kr" });
    for (const [k, v] of new URL(request.url).searchParams) {
      if (ALLOWED_PARAMS.has(k)) p.set(k, v.slice(0, 40));
    }
    if (!p.get("departure_id") || !p.get("arrival_id") || !p.get("outbound_date")) {
      return json({ error: "필수 파라미터 누락 (departure_id, arrival_id, outbound_date)" }, 400, cors);
    }

    // 동일 검색 10분 캐시 → 쿼터 절약
    const cache = caches.default;
    const cacheKey = new Request("https://airbot-cache.internal/?" + p.toString());
    let res = await cache.match(cacheKey);

    if (!res) {
      p.set("api_key", env.SERPAPI_KEY);
      const upstream = await fetch("https://serpapi.com/search.json?" + p.toString());
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
      });
      if (upstream.ok) await cache.put(cacheKey, res.clone());
    }

    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
