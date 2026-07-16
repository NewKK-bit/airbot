// app.js — 공통 UI: 헤더/네비 주입, 테마 토글, 토스트, 공항 자동완성, 아이콘

/* ---------- SVG 아이콘 (인라인, CDN 없음) ---------- */
const ICONS = {
  plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
};
window.ICONS = ICONS;

/* ---------- 헤더 / 네비 주입 ---------- */
function injectHeader(active) {
  const pages = [
    { href: "index.html", label: "검색", key: "search" },
    { href: "watchlist.html", label: "모니터링", key: "watch" },
  ];
  const nav = pages.map((p) =>
    `<a href="${p.href}" class="${p.key === active ? "active" : ""}">${p.label}</a>`).join("");
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="container">
      <a href="index.html" class="brand">
        <span class="logo">${ICONS.plane}</span> AirBot
      </a>
      <nav class="nav">${nav}</nav>
      <span class="header-spacer"></span>
      <button class="icon-btn" id="themeToggle" title="테마 전환" aria-label="테마 전환"></button>
    </div>`;
  document.body.prepend(header);
  setupTheme();
}

/* ---------- 테마 ---------- */
function setupTheme() {
  const saved = localStorage.getItem("airbot-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  const render = () => { btn.innerHTML = document.documentElement.getAttribute("data-theme") === "dark" ? ICONS.sun : ICONS.moon; };
  render();
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("airbot-theme", next);
    render();
  });
}

/* ---------- 토스트 ---------- */
function toast(msg, ms = 2600) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.append(wrap); }
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span>${msg}</span>`;
  wrap.append(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, ms);
}
window.toast = toast;

/* ---------- 탭 열기 (백그라운드 지원) ----------
   window.open 반복은 새 탭이 앞으로 튀어나오고 팝업 차단에 걸리기 쉬움.
   합성 Ctrl/⌘+클릭으로 링크를 열면 브라우저가 "백그라운드 새 탭"으로 처리해
   사용자는 AirBot 화면에 그대로 머문다. */
function openTab(url, background = true) {
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  if (background) {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");
    a.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, view: window,
      ctrlKey: !isMac, metaKey: isMac,
    }));
  } else {
    a.click();
  }
  a.remove();
}
// 한 번의 사용자 클릭 안에서 동기적으로 열어야 팝업 차단·포커스 이동을 피함
function openLinks(urls, { background = true } = {}) {
  urls.forEach((u) => openTab(u, background));
}
window.openTab = openTab;
window.openLinks = openLinks;

/* ---------- 공항 자동완성 ---------- */
let AIRPORTS = [];
async function loadAirports() {
  if (AIRPORTS.length) return AIRPORTS;
  try {
    const res = await fetch("data/airports.json");
    AIRPORTS = await res.json();
  } catch { AIRPORTS = []; }
  return AIRPORTS;
}
window.loadAirports = loadAirports;
window.airportLabel = (code) => {
  const a = AIRPORTS.find((x) => x.code === code);
  return a ? `${a.city}(${a.code})` : code;
};

/**
 * input에 공항 자동완성을 붙인다. 선택 시 input.dataset.code 에 공항코드 저장.
 * @param {HTMLInputElement} input
 */
function attachAutocomplete(input) {
  const list = document.createElement("div");
  list.className = "ac-list";
  input.parentElement.append(list);
  let activeIdx = -1, matches = [];

  const close = () => { list.classList.remove("open"); activeIdx = -1; };
  const search = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return AIRPORTS.filter((a) =>
      a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)
    ).slice(0, 8);
  };
  const render = () => {
    list.innerHTML = matches.map((a, i) =>
      `<div class="ac-item ${i === activeIdx ? "active" : ""}" data-code="${a.code}">
        <span class="code">${a.code}</span>
        <span class="meta"><span class="city">${a.city}</span><span class="apt">${a.name} · ${a.country}</span></span>
      </div>`).join("");
    list.classList.toggle("open", matches.length > 0);
  };
  const pick = (a) => {
    input.value = `${a.city}(${a.code})`;
    input.dataset.code = a.code;
    close();
  };

  input.addEventListener("input", () => {
    input.dataset.code = "";
    matches = search(input.value);
    activeIdx = -1; render();
  });
  input.addEventListener("keydown", (e) => {
    if (!list.classList.contains("open")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, matches.length - 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); render(); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(matches[activeIdx]); }
    else if (e.key === "Escape") close();
  });
  list.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".ac-item");
    if (item) pick(AIRPORTS.find((a) => a.code === item.dataset.code));
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}
window.attachAutocomplete = attachAutocomplete;
