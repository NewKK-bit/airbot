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

정적 사이트라 Notion 토큰을 브라우저에 넣으면 유출되므로, 아래 구조로 안전하게 처리합니다.

```
[Notion DB 2개]  ──(GitHub Actions, 6시간마다)──▶  data/prices.json (커밋)  ──▶  웹앱이 fetch해 시각화
  가격 직접 입력        토큰은 GitHub Secrets에만                 읽기 전용, 완전 정적
```

가격은 **Notion에서 직접 입력**하고, 웹앱은 읽기 전용입니다.

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

## 🔗 Notion 연동 (실데이터, 선택)

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
│  ├─ prices.json      가격 데이터 (Actions가 생성, 초기값은 샘플)
│  └─ airports.json    공항 자동완성용
├─ scripts/sync-notion.mjs        Notion → JSON 동기화
└─ .github/workflows/sync-notion.yml
```

## 📝 참고

AirBot은 항공권을 직접 판매하지 않으며, 검색은 각 항공권 사이트로 연결됩니다.
가격은 사용자가 Notion에 기록한 관측값이며 실시간 시세가 아닙니다.
