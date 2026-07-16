# ✈️ AirBot — 항공권 검색 & 가격 모니터링

관심 노선을 등록해두고, 한 번의 검색으로 여러 항공권 사이트를 동시에 열며,
Notion에 기록한 가격 추이를 차트로 지켜보는 **개인용 항공권 대시보드**입니다.

순수 HTML/CSS/JS로 만들어 **GitHub Pages**에 무료 배포되며, 외부 프레임워크나 빌드 과정이 없습니다.

---

## ✨ 주요 기능

- **앱 내 검색** — 출발/도착(자동완성), 날짜, 인원, **가는 편·오는 편 시간대**, 직항 여부를 입력하면
  **AirBot 화면 안에서 추천 항공편을 가격순으로 나열**합니다(Google Flights 실데이터).
  각 결과의 **예약하기** 버튼은 네이버항공권으로 연결됩니다.
- **가격 모니터링 대시보드** — 관심 노선의 현재가·최저가·목표가 진행도 카드,
  **재검색 = 페이지 이동 없이 정보만 최신화**, **삭제 버튼**으로 목록 관리
- **외부 사이트 바로가기** — 네이버·Google Flights·Skyscanner·카약을 설정한 일정으로
  개별 버튼 한 번에 열어 직접 확인 가능
- **가격 추이 시각화** — 순수 SVG 라인차트 + 구글 가격 인사이트 기반 "지금 살 때인가" 신호
- **다크/라이트 모드**, 반응형(모바일 우선)

## 🗂 데이터 흐름

정적 사이트라 API 키를 브라우저에 넣으면 유출되므로, 아래 구조로 안전하게 처리합니다.

```
[data/routes.json]  ──(GitHub Actions, 매일)──▶  SerpApi(Google Flights) 조회  ──▶  data/prices.json (커밋)  ──▶  웹앱이 fetch해 시각화
  감시할 노선 정의        SERPAPI_KEY는 GitHub Secrets에만            실가격·추천편·가격추이 수집              읽기 전용, 완전 정적
```

- **감시 노선**은 `data/routes.json` 에서 정의합니다(이 파일만 편집).
- 가격은 **SerpApi가 Google Flights에서 자동 수집** → 수동 입력 불필요.
- 웹앱은 `prices.json` 만 읽어 **가격 추이 + 구글 추천편 + "지금 살 때인가" 신호**를 보여줍니다.

> 💡 저비용항공사(LCC)를 포함해 실제 최저가·시간·항공사를 얻기 위해 Google Flights 데이터를
> 합법적으로 중개하는 **SerpApi**(무료 월 250건)를 사용합니다. 네이버·스카이스캐너는 공개 API가
> 없어 데이터 수집엔 못 쓰고, **예약 딥링크 대상**으로만 연결합니다.

---

## 🚀 로컬에서 실행

정적 파일이라 서버만 있으면 됩니다. `fetch`가 동작하도록 `file://`가 아닌 로컬 서버로 여세요.

```bash
# 아무거나 하나
python -m http.server 8000
npx serve .
```

→ 브라우저에서 `http://localhost:8000` 접속. 기본은 `data/prices.json`의 **샘플 데이터**로 동작합니다.

---

## 🔑 SerpApi 연동 (실데이터 자동 수집)

### 1) SerpApi 가입 & 키 발급
1. https://serpapi.com 가입 (무료, 신용카드 불필요 · 월 250건)
2. 대시보드에서 **API Key** 복사

### 2) GitHub Secret 등록
저장소 → Settings → Secrets and variables → Actions → New repository secret:
- `SERPAPI_KEY` — 발급받은 키

### 3) 감시할 노선 편집
`data/routes.json` 의 `routes` 배열을 수정합니다. 항목 필드:

| 필드 | 설명 |
|---|---|
| `id` | 고유 식별자 (영문·숫자·하이픈) |
| `name` | 표시 이름 (예: 서울 → 도쿄) |
| `origin` / `destination` | 공항코드 (ICN, NRT …) |
| `departDate` / `returnDate` | `YYYY-MM-DD` (편도면 returnDate 생략) |
| `tripType` | `round` 또는 `oneway` |
| `passengers` | 성인 인원 |
| `direct` | `true`면 직항만 |
| `departTime` | 가는 편 시간대: `any`/`dawn`/`morning`/`afternoon`/`evening` |
| `returnTime` | 오는 편 시간대(왕복): 값은 `departTime`과 동일 |
| `targetPrice` | 목표가(원) |
| `active` | 모니터링 활성화 |
| `memo` | 메모 |

### 4) 수집 실행
- 자동: 매일 KST 06:00 (`.github/workflows/collect-prices.yml`)
- 수동: 저장소 **Actions** 탭 → *Collect prices (SerpApi)* → **Run workflow**
- 로컬 테스트:
  ```bash
  SERPAPI_KEY=... node scripts/collect-serpapi.mjs
  ```

> 무료 250건/월 안에서 쓰려면 감시 노선을 몇 개로 유지하세요(노선 3개 × 매일 1회 ≈ 월 90건).

---

## ⚡ 실시간 검색 프록시 (선택, 5분)

**모니터링 중인 노선**은 매일 수집된 데이터로 프록시 없이 검색됩니다.
**임의의 노선을 실시간으로** 검색하거나 카드의 **재검색(즉시 갱신)**을 쓰려면 개인 프록시가 필요합니다.
(SerpApi는 브라우저 직접 호출을 차단하고, 키를 클라이언트에 두면 유출되기 때문)

1. https://dash.cloudflare.com 가입/로그인 → **Workers & Pages → Create Worker**
2. `proxy/worker.js` 내용을 통째로 붙여넣고 **Deploy**
3. Worker → Settings → **Variables and Secrets** → Secret 추가: `SERPAPI_KEY` = SerpApi 키
4. `proxy/worker.js`의 `ALLOWED_ORIGINS`에 본인 Pages 주소가 맞는지 확인
5. 배포된 `https://….workers.dev` 주소를 **AirBot 검색 페이지 → ⚙️ 실시간 검색 설정**에 붙여넣기

- 프록시는 무료(하루 10만 요청)이며, 같은 검색은 10분 캐시되어 SerpApi 쿼터를 아낍니다.
- 프록시 URL은 브라우저 localStorage에만 저장됩니다.

---

## 🔗 Notion 연동 (대안, 선택)

> 가격을 자동 수집(SerpApi) 대신 **직접 입력**하고 싶을 때만 쓰는 대안입니다.
> `sync-notion.yml` 은 충돌 방지를 위해 **수동 실행 전용**으로 설정돼 있습니다.

### 1) Notion 데이터베이스 2개 만들기

**① 관심노선** — 속성(정확한 이름 중요):

| 속성명 | 타입 | 설명 |
|---|---|---|
| `노선명` | 제목(Title) | 예: 서울 → 도쿄 |
| `출발` | 텍스트 | 공항코드 예: ICN |
| `도착` | 텍스트 | 공항코드 예: NRT |
| `가는날` | 날짜 | |
| `오는날` | 날짜 | 편도면 비움 |
| `여정` | 선택(Select) | `왕복` 또는 `편도` |
| `인원` | 숫자 | |
| `직항` | 체크박스 | |
| `출발시간대` | 선택(Select) | `상관없음`/`새벽`/`오전`/`오후`/`저녁` (Google Flights 검색에 반영) |
| `항공사` | 다중선택 | |
| `목표가` | 숫자 | 원 단위 |
| `통화` | 선택 | 기본 KRW |
| `활성` | 체크박스 | 체크 시 모니터링 |
| `메모` | 텍스트 | |

**② 가격기록** — 속성:

| 속성명 | 타입 | 설명 |
|---|---|---|
| `관측` | 제목 | 아무 값 (예: 날짜) |
| `노선` | 관계(Relation) | → **관심노선** DB 연결 |
| `관측일` | 날짜 | |
| `가격` | 숫자 | 원 단위 |
| `출처` | 선택 | 예: Skyscanner |

> 가격이 바뀔 때마다 **가격기록**에 한 행씩 추가하면 추이 그래프가 그려집니다.

### 2) Notion 통합(Integration) 만들고 DB 공유

1. https://www.notion.so/my-integrations → **New integration** → 시크릿 토큰 복사
2. 위 두 DB 페이지에서 `...` → **연결(Connections)** → 방금 만든 통합 추가
3. 각 DB의 ID 확인 (DB URL의 `notion.so/…/`**`이_32자`**`?v=…` 부분)

### 3) GitHub Secrets 등록

저장소 → Settings → Secrets and variables → Actions → New repository secret:

- `NOTION_TOKEN` — 통합 시크릿
- `NOTION_ROUTES_DB` — 관심노선 DB ID
- `NOTION_PRICES_DB` — 가격기록 DB ID

### 4) 동기화

- 자동: 6시간마다 실행 (`.github/workflows/sync-notion.yml`)
- 수동: 저장소 **Actions** 탭 → *Sync Notion → prices.json* → **Run workflow**
- 로컬 테스트:
  ```bash
  NOTION_TOKEN=... NOTION_ROUTES_DB=... NOTION_PRICES_DB=... node scripts/sync-notion.mjs
  ```

---

## 📁 파일 구조

```
├─ index.html          검색 페이지
├─ watchlist.html      모니터링 대시보드
├─ detail.html         노선 상세 (차트)
├─ css/style.css       디자인 시스템 (다크모드 포함)
├─ js/
│  ├─ deeplink.js      사이트별 예약/확인 URL 생성기
│  ├─ api.js           앱 내 실시간 검색 (프록시 경유)
│  ├─ data.js          prices.json 로드 & 통계 & 실시간 병합
│  ├─ chart.js         순수 SVG 차트
│  └─ app.js           공통 UI (헤더/테마/자동완성/토스트)
├─ proxy/worker.js     Cloudflare Worker 프록시 (실시간 검색용, 붙여넣기 배포)
├─ data/
│  ├─ routes.json      감시할 노선 정의 (여기만 편집)
│  ├─ prices.json      가격 데이터 (Actions가 생성, 초기값은 샘플)
│  └─ airports.json    공항 자동완성용
├─ scripts/
│  ├─ collect-serpapi.mjs   SerpApi(Google Flights) 가격 수집 [기본]
│  └─ sync-notion.mjs       Notion → JSON 동기화 [대안]
└─ .github/workflows/
   ├─ collect-prices.yml     SerpApi 수집 (매일 자동) [기본]
   └─ sync-notion.yml        Notion 동기화 (수동) [대안]
```

## 📝 참고

AirBot은 항공권을 직접 판매하지 않으며, 검색은 각 항공권 사이트로 연결됩니다.
가격은 사용자가 Notion에 기록한 관측값이며 실시간 시세가 아닙니다.
