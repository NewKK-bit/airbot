// sync-notion.mjs — Notion 두 DB(관심노선 / 가격기록)를 읽어 data/prices.json 생성
// GitHub Actions에서 실행. 토큰은 절대 클라이언트에 노출되지 않음(Secrets 사용).
//
// 필요한 환경변수:
//   NOTION_TOKEN       Notion 내부 통합(integration) 시크릿
//   NOTION_ROUTES_DB   관심노선 데이터베이스 ID
//   NOTION_PRICES_DB   가격기록 데이터베이스 ID
//
// Node 20+ (내장 fetch 사용). 외부 의존성 없음.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const TOKEN = process.env.NOTION_TOKEN;
const ROUTES_DB = process.env.NOTION_ROUTES_DB;
const PRICES_DB = process.env.NOTION_PRICES_DB;
const OUT = "data/prices.json";
const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

// ---- Notion 속성 읽기 헬퍼 (타입별) ----
const P = {
  title: (p) => p?.title?.map((t) => t.plain_text).join("") ?? "",
  text: (p) => p?.rich_text?.map((t) => t.plain_text).join("") ?? "",
  number: (p) => (typeof p?.number === "number" ? p.number : null),
  date: (p) => p?.date?.start ?? null,
  select: (p) => p?.select?.name ?? null,
  multi: (p) => p?.multi_select?.map((s) => s.name) ?? [],
  check: (p) => !!p?.checkbox,
  relation: (p) => p?.relation?.map((r) => r.id) ?? [],
};

async function queryAll(dbId) {
  const results = [];
  let cursor;
  do {
    const res = await fetch(`${API}/databases/${dbId}/query`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });
    if (!res.ok) throw new Error(`Notion query 실패 (${dbId}): ${res.status} ${await res.text()}`);
    const json = await res.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : null;
  } while (cursor);
  return results;
}

function parseRoute(page) {
  const p = page.properties;
  return {
    _pageId: page.id,
    id: (P.text(p["노선ID"]) || page.id.replace(/-/g, "")).slice(0, 40),
    name: P.title(p["노선명"]) || "이름 없는 노선",
    origin: (P.text(p["출발"]) || "").toUpperCase().slice(0, 3),
    destination: (P.text(p["도착"]) || "").toUpperCase().slice(0, 3),
    departDate: P.date(p["가는날"]),
    returnDate: P.date(p["오는날"]),
    tripType: (P.select(p["여정"]) === "편도" ? "oneway" : "round"),
    passengers: P.number(p["인원"]) || 1,
    direct: P.check(p["직항"]),
    airlines: P.multi(p["항공사"]),
    targetPrice: P.number(p["목표가"]),
    currency: P.select(p["통화"]) || "KRW",
    active: p["활성"] ? P.check(p["활성"]) : true,
    memo: P.text(p["메모"]),
    prices: [],
  };
}

function parsePrice(page) {
  const p = page.properties;
  return {
    routeIds: P.relation(p["노선"]),
    date: P.date(p["관측일"]),
    price: P.number(p["가격"]),
    source: P.select(p["출처"]) || "",
  };
}

async function main() {
  if (!TOKEN || !ROUTES_DB || !PRICES_DB) {
    console.error("환경변수 NOTION_TOKEN / NOTION_ROUTES_DB / NOTION_PRICES_DB 가 필요합니다.");
    process.exit(1);
  }

  console.log("Notion에서 관심노선/가격기록을 가져오는 중...");
  const [routePages, pricePages] = await Promise.all([queryAll(ROUTES_DB), queryAll(PRICES_DB)]);

  const routes = routePages.map(parseRoute);
  const byPageId = new Map(routes.map((r) => [r._pageId, r]));

  let attached = 0;
  for (const page of pricePages) {
    const rec = parsePrice(page);
    if (rec.date == null || rec.price == null) continue;
    for (const rid of rec.routeIds) {
      const route = byPageId.get(rid);
      if (route) {
        route.prices.push({ date: rec.date, price: rec.price, source: rec.source });
        attached++;
      }
    }
  }

  // 날짜순 정렬 + 내부 필드 제거
  for (const r of routes) {
    r.prices.sort((a, b) => a.date.localeCompare(b.date));
    delete r._pageId;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "Notion",
    currency: "KRW",
    routes,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(`완료: ${routes.length}개 노선, ${attached}개 가격 기록 → ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
