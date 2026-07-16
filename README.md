# ✈️ AirBot — 항공권 검색 & 가격 모니터링

관심 노선을 등록해두고, 한 번의 검색으로 여러 항공권 사이트를 동시에 열며,
Notion에 기록한 가격 추이를 차트로 지켜보는 **개인용 항공권 대시보드**입니다.

순수 HTML/CSS/JS로 만들어 **GitHub Pages**에 무료 배포되며, 외부 프레임워크나 빌드 과정이 없습니다.

---

## ✨ 주요 기능

- **스마트 검색기** — 출발/도착(공항 자동완성), 날짜, 인원, **출발 시간대**, 직항 여부를 입력하면
  Skyscanner · Google Flights · 네이버항공권 · 카약을 **백그라운드 탭에서 동시 검색**(딥링크)
  → 검색해도 AirBot 화면에 머물고 결과는 뒤 탭에서 열립니다.
- **가격 모니터링 대시보드** — 관심 노선의 현재가·최저가·목표가 진행도를 카드로,
  마음에 들면 **예약하기** 버튼으로 대표 예약 사이트로 바로 이동
- **가격 추이 시각화** — 외부 라이브러리 없는 순수 SVG 라인차트 + "지금 살 때인가" 신호
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
| `departTime` | `any`/`dawn`/`morning`/`afternoon`/`evening` |
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
│  ├─ deeplink.js      사이트별 검색 URL 생성기
│  ├─ data.js          prices.json 로드 & 통계
│  ├─ chart.js         순수 SVG 차트
│  └─ app.js           공통 UI (헤더/테마/자동완성/토스트)
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
