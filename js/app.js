/* ============================================================
 * app.js - 앱 부트 · 라우터 · 공용 UI 헬퍼
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});

  // ---------- DOM 헬퍼 ----------
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) { if (c == null) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
    }
    return e;
  }
  const $ = (sel) => document.querySelector(sel);

  // ---------- 앱바 ----------
  function setAppbar(title, sub, right) {
    const bar = $("#appbar");
    bar.innerHTML = "";
    bar.className = "appbar";
    const left = el("div", null, [
      el("div", { class: "title" }, title),
      sub ? el("div", { class: "sub" }, sub) : null,
    ]);
    bar.append(left);
    if (right) bar.append(right);
  }

  // ---------- 토스트 ----------
  let _toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }

  // ---------- 세그먼트 선택 버튼 ----------
  // options: [{v,label}] 또는 [string].  selClass(v) → 선택 시 클래스(기본 'on')
  function segmented(options, value, onChange, selClass) {
    const wrap = el("div", { class: "seg" });
    const opts = options.map((o) => (typeof o === "object" ? o : { v: o, label: String(o) }));
    function paint() {
      [...wrap.children].forEach((btn, i) => {
        const o = opts[i];
        btn.className = "seg-btn-base";
        btn.classList.remove("on", "on-fluor", "on-red", "on-blue", "on-gray");
        if (o.v === value) btn.classList.add(...((selClass ? selClass(o.v) : "on").split(" ")));
      });
    }
    opts.forEach((o) => {
      const btn = el("button", { type: "button", onclick: () => { value = (value === o.v ? o.v : o.v); value = o.v; onChange(o.v); paint(); } }, o.label);
      wrap.append(btn);
    });
    paint();
    wrap._set = (v) => { value = v; paint(); };
    return wrap;
  }

  // ---------- 스테퍼 ----------
  function stepper(value, onChange, opts) {
    opts = opts || {};
    const min = opts.min != null ? opts.min : 0;
    const max = opts.max != null ? opts.max : 20;
    const valEl = el("div", { class: "val" }, String(value == null ? 0 : value));
    function set(v) {
      v = Math.max(min, Math.min(max, v));
      value = v; valEl.textContent = String(v); onChange(v);
    }
    const wrap = el("div", { class: "stepper" }, [
      el("button", { type: "button", onclick: () => set((value || 0) - 1) }, "−"),
      valEl,
      el("button", { type: "button", onclick: () => set((value || 0) + 1) }, "+"),
    ]);
    wrap._set = (v) => { value = v; valEl.textContent = String(v == null ? 0 : v); };
    return wrap;
  }

  // ---------- 초성 자동완성 ----------
  function autocomplete(inputEl, itemsFn) {
    const wrap = el("div", { class: "ac-wrap" });
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.append(inputEl);
    let list = null;
    function close() { if (list) { list.remove(); list = null; } }
    function open(matches) {
      close();
      if (!matches.length) return;
      list = el("div", { class: "ac-list" });
      matches.slice(0, 20).forEach((m) => {
        list.append(el("div", { onmousedown: (e) => { e.preventDefault(); inputEl.value = m; close(); inputEl.dispatchEvent(new Event("change")); } }, m));
      });
      wrap.append(list);
    }
    inputEl.addEventListener("input", () => {
      const q = inputEl.value.trim();
      const items = itemsFn() || [];
      if (!q) { close(); return; }
      open(items.filter((it) => Calc.chosungMatch(q, it)));
    });
    inputEl.addEventListener("blur", () => setTimeout(close, 150));
    return wrap;
  }

  // ---------- 라우터 ----------
  let _current = "home";
  const TABS = [
    { key: "home", label: "홈", icon: "M3 11l9-8 9 8M5 9v11h14V9" },
    { key: "input", label: "입력", icon: "M4 20h16M6 16l9-9 3 3-9 9H6z" },
    { key: "list", label: "목록", icon: "M4 6h16M4 12h16M4 18h16" },
    { key: "stats", label: "통계", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  ];
  function renderTabs() {
    const bar = $("#tabbar");
    bar.innerHTML = "";
    TABS.forEach((t) => {
      const svg = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg>`;
      const btn = el("button", { type: "button", onclick: () => go(t.key) }, [
        el("span", { html: svg }), el("span", null, t.label),
      ]);
      if (t.key === _current) btn.classList.add("active");
      bar.append(btn);
    });
  }
  function go(name, params) {
    _current = name;
    renderTabs();
    const cont = $("#screen");
    cont.innerHTML = "";
    const fn = Screens[name];
    if (typeof fn === "function") {
      try { fn(cont, params || {}); }
      catch (e) { cont.append(el("div", { class: "empty" }, "화면 오류: " + e.message)); console.error(e); }
    } else {
      cont.append(el("div", { class: "empty" }, "준비 중인 화면입니다."));
    }
    window.scrollTo(0, 0);
  }

  // ---------- 부트 ----------
  async function boot() {
    try {
      await DB.init();
    } catch (e) {
      $("#screen").innerHTML = '<div class="loading">DB 초기화 실패: ' + e.message + "</div>";
      console.error(e);
      return;
    }
    renderTabs();
    go("home");
  }

  window.App = { el, $, setAppbar, toast, segmented, stepper, autocomplete, go };
  document.addEventListener("DOMContentLoaded", boot);
})();
