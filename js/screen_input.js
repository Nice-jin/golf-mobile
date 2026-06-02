/* ============================================================
 * screen_input.js - 라운드 입력 (1단계 기본정보+비용+총평 / 2단계 홀별 현장입력)
 *   PC 라운드 입력 화면의 모든 항목 포함. 구역은 P/O 만.
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function emptyHole() {
    return { par: null, teeshot: "", direction: "", zone: "", mulligan: 0, lost_ball: 0,
             green_on: 0, putts: 0, score: null, manual: null };
  }
  function recalc(h) {
    const a = Calc.autoScore(h.par, h.green_on, h.putts);
    h.score = h.manual != null ? h.manual : a.score;
  }

  Screens.input = function (container, params) {
    const A = window.App;
    const editId = params.editId || null;

    const st = {
      editId,
      basic: { round_date: today(), time_part: "", time_text: "", weather: "",
               temp_high: "", temp_low: "", cc_name: "", course1: "", course2: "", play_type: "",
               p1: "", p2: "", p3: "" },
      cost: { green_fee: "", cart_fee: 2.5, caddie_fee: 3.5, etc_cost: "", event_cost: "" },
      review: "",
      holes: Array.from({ length: 18 }, emptyHole),
      step: 1, cur: 0,
    };

    if (editId) loadForEdit(editId, st);

    render();

    // ---------------- 편집 로드 ----------------
    function loadForEdit(id, st) {
      const full = DB.getRoundFull(id);
      if (!full || !full.round) return;
      const r = full.round;
      st.basic = {
        round_date: String(r.round_date).slice(0, 10),
        time_part: r.time_part || "", time_text: r.time_text || "", weather: r.weather || "",
        temp_high: r.temp_high != null ? r.temp_high : "", temp_low: r.temp_low != null ? r.temp_low : "",
        cc_name: r.cc_name || "", course1: r.course1 || "", course2: r.course2 || "", play_type: r.play_type || "",
        p1: "", p2: "", p3: "",
      };
      full.players.forEach((p) => {
        let t = p.name || ""; if (p.score) t += " " + p.score + "타"; if (p.note) t += " " + p.note;
        if (p.seq === 1) st.basic.p1 = t; else if (p.seq === 2) st.basic.p2 = t; else if (p.seq === 3) st.basic.p3 = t;
      });
      if (full.cost) st.cost = { green_fee: full.cost.green_fee || "", cart_fee: full.cost.cart_fee || 0,
        caddie_fee: full.cost.caddie_fee || 0, etc_cost: full.cost.etc_cost || "", event_cost: full.cost.event_cost || "" };
      st.review = r.review || "";
      full.holes.forEach((h) => {
        const i = h.hole_no - 1;
        if (i < 0 || i > 17) return;
        st.holes[i] = { par: h.par, teeshot: h.teeshot || "", direction: h.direction || "", zone: h.zone || "",
          mulligan: h.mulligan || 0, lost_ball: h.lost_ball || 0, green_on: h.green_on || 0,
          putts: h.putts != null ? h.putts : 0, score: h.score, manual: null };
      });
    }

    // ---------------- 렌더 ----------------
    function render() { st.step === 1 ? renderStep1() : renderStep2(); }

    // ===== 1단계: 기본정보 + 비용 + 총평 =====
    function renderStep1() {
      A.setAppbar([icon("edit"), " 라운드 ", editId ? "수정" : "입력"], "1 / 2 기본정보");
      container.innerHTML = "";
      const b = st.basic;

      const field = (label, inputEl, hint) => A.el("div", { class: "field" },
        [A.el("label", null, hint ? [label, A.el("span", { class: "hint" }, "  " + hint)] : label), inputEl]);

      const txt = (key, ph) => { const e = A.el("input", { type: "text", value: b[key] || "", placeholder: ph || "" });
        e.addEventListener("input", () => b[key] = e.value); e.addEventListener("change", () => b[key] = e.value); return e; };
      const numf = (obj, key, ph) => { const e = A.el("input", { type: "number", inputmode: "decimal", value: obj[key] === "" ? "" : obj[key], placeholder: ph || "" });
        e.addEventListener("input", () => obj[key] = e.value); return e; };

      // 기본 정보
      const dateE = A.el("input", { type: "date", value: b.round_date });
      dateE.addEventListener("change", () => b.round_date = dateE.value);
      const partE = sel(["", "1부", "2부", "3부"], partLabel(b.time_part), (v) => b.time_part = v ? parseInt(v) : "");
      const playE = sel(["", "조인", "모임"], b.play_type, (v) => b.play_type = v);

      const ccE = txt("cc_name", "골프장 이름 (초성 가능)");
      const c1E = txt("course1", "전반 코스");
      const c2E = txt("course2", "후반 코스");
      const p1E = txt("p1", "참석자1 (이름 88타 비고)");
      const p2E = txt("p2", "참석자2");
      const p3E = txt("p3", "참석자3");

      const basicCard = A.el("div", { class: "card" }, [
        A.el("div", { class: "sec-title" }, [icon("pin"), " 기본 정보"]),
        A.el("div", { class: "row" }, [field("날짜", dateE), field("부", partE)]),
        A.el("div", { class: "row" }, [field("시간", txt("time_text", "예: 18시08분")), field("날씨", txt("weather", "예: 맑음"))]),
        A.el("div", { class: "row" }, [field("최고기온(℃)", numf(b, "temp_high", "28")), field("최저기온(℃)", numf(b, "temp_low", "18"))]),
        field("CC", ccE, "초성 자동완성"),
        A.el("div", { class: "row" }, [field("전반 코스", c1E), field("후반 코스", c2E)]),
        field("형식", playE),
        field("참석자", p1E, "이름 88타 비고 · 초성"),
        p2E, p3E,
      ]);

      // 비용
      const totalLbl = A.el("div", { class: "score-tag", style: { color: "var(--green)", fontWeight: 600, fontSize: "13px" } }, "합계: 0.0 만원");
      const upTotal = () => { const c = st.cost; const t = (+c.green_fee || 0) + (+c.cart_fee || 0) + (+c.caddie_fee || 0) + (+c.etc_cost || 0) + (+c.event_cost || 0); totalLbl.textContent = "합계: " + (Math.round(t * 10) / 10) + " 만원"; };
      const costInput = (key, ph) => { const e = numf(st.cost, key, ph); e.addEventListener("input", upTotal); return e; };
      const costCard = A.el("div", { class: "card" }, [
        A.el("div", { class: "sec-title" }, [icon("coin"), " 비용 (만원)"]),
        A.el("div", { class: "grid3" }, [field("그린피", costInput("green_fee", "0")), field("카트", costInput("cart_fee", "2.5")), field("캐디", costInput("caddie_fee", "3.5"))]),
        A.el("div", { class: "grid3" }, [field("기타", costInput("etc_cost", "0")), field("이벤트", costInput("event_cost", "0")), A.el("div", { class: "field", style: { display: "flex", alignItems: "flex-end" } }, totalLbl)]),
      ]);
      upTotal();

      // 총평
      const revE = A.el("textarea", { placeholder: "라운드 총평을 자유롭게 입력…" }, st.review);
      revE.addEventListener("input", () => st.review = revE.value);
      const revCard = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, [icon("note"), " 총평 메모"]), revE]);

      const goHoles = A.el("button", { class: "btn btn-primary", onclick: () => {
        if (!b.cc_name.trim()) { A.toast("CC명을 입력해주세요"); return; }
        st.step = 2; render();
      } }, ["홀 입력 시작  ▶"]);

      container.append(basicCard, costCard, revCard, goHoles);

      // 자동완성 연결
      A.autocomplete(ccE, () => DB.ccList());
      A.autocomplete(c1E, () => DB.courseList());
      A.autocomplete(c2E, () => DB.courseList());
      [p1E, p2E, p3E].forEach((e) => A.autocomplete(e, () => DB.playerNames()));
      // CC+코스 입력 완료 시 PAR 자동 채움
      const tryFillPar = () => {
        const m = DB.parMapForCourse(b.cc_name.trim(), b.course1.trim(), b.course2.trim());
        if (m) { for (let i = 0; i < 18; i++) { const p = m[i + 1]; if (p && st.holes[i].par == null) { st.holes[i].par = p; recalc(st.holes[i]); } } A.toast("지난 기록의 PAR을 채웠어요"); }
      };
      [ccE, c1E, c2E].forEach((e) => e.addEventListener("change", tryFillPar));
    }

    // ===== 2단계: 홀별 입력 =====
    function renderStep2() {
      const h = st.holes[st.cur];
      const back = A.el("button", { class: "ab-btn", onclick: () => { st.step = 1; render(); } }, "기본정보");
      A.setAppbar([icon("flag"), " ", st.basic.cc_name || "라운드"], `2 / 2 · ${st.cur + 1} / 18홀`, back);
      container.innerHTML = "";

      // 점수 표시
      recalc(h);
      const scoreBig = A.el("div", { class: "score-big" }, h.score == null ? "–" : String(h.score));
      const scoreTag = A.el("div", { class: "score-tag" }, "");
      paintScore(h, scoreBig, scoreTag);
      const head = A.el("div", { class: "hole-head" }, [
        A.el("div", null, [A.el("div", { class: "hno" }, `${st.cur + 1}번 홀`), A.el("div", { class: "auto" }, "자동 스코어 (버디온+퍼트)")]),
        A.el("div", { class: "score-box" }, [scoreBig, scoreTag]),
      ]);

      // 홀 점프 dots
      const dots = A.el("div", { class: "hole-dots" });
      st.holes.forEach((hh, i) => {
        const btn = A.el("button", { onclick: () => { st.cur = i; render(); } }, String(i + 1));
        if (i === st.cur) btn.classList.add("cur"); else if (hh.score != null) btn.classList.add("done");
        dots.append(btn);
      });

      const refresh = () => { recalc(h); paintScore(h, scoreBig, scoreTag); refreshDots(); refreshSummary(); };
      function refreshDots() { [...dots.children].forEach((btn, i) => { btn.className = ""; if (i === st.cur) btn.classList.add("cur"); else if (st.holes[i].score != null) btn.classList.add("done"); }); }

      // PAR
      const parSeg = A.segmented([3, 4, 5], h.par, (v) => { h.par = v; h.manual = null; refresh(); });
      // 티샷 (색상: G/F 형광, X 빨강)
      const teeSeg = A.segmented(Calc.TEESHOT_OPTIONS, h.teeshot, (v) => { h.teeshot = (h.teeshot === v ? "" : v); teeSeg._set(h.teeshot); },
        (v) => (v === "G" || v === "F") ? "on-fluor" : (v === "X" ? "on-red" : "on"));
      // 방향
      const dirSeg = A.segmented(Calc.DIRECTION_OPTIONS, h.direction, (v) => { h.direction = (h.direction === v ? "" : v); dirSeg._set(h.direction); });
      // 구역 (− / P / O), O 빨강
      const zoneSeg = A.segmented([{ v: "", label: "−" }, { v: "P", label: "P" }, { v: "O", label: "O" }], h.zone,
        (v) => { h.zone = v; }, (v) => v === "O" ? "on-red" : (v === "" ? "on-gray" : "on"));

      // 스테퍼들
      const greenSt = A.stepper(h.green_on, (v) => { h.green_on = v; h.manual = null; refresh(); }, { min: 0, max: 20 });
      const puttSt = A.stepper(h.putts, (v) => { h.putts = v; h.manual = null; refresh(); }, { min: 0, max: 15 });
      const mulSt = A.stepper(h.mulligan, (v) => { h.mulligan = v; refreshSummary(); }, { min: 0, max: 10 });
      const lbSt = A.stepper(h.lost_ball, (v) => { h.lost_ball = v; refresh(); }, { min: 0, max: 10 });
      // 스코어 직접 조정
      const manualSt = A.stepper(h.score == null ? (h.par || 4) : h.score, (v) => { h.manual = v; h.score = v; paintScore(h, scoreBig, scoreTag); refreshDots(); refreshSummary(); }, { min: 1, max: 15 });

      const lblStep = (label, st2) => A.el("div", { class: "field" }, [A.el("div", { class: "field-lbl", style: { textAlign: "center" } }, label), st2]);

      const holeCard = A.el("div", { class: "card" }, [
        head, dots,
        A.el("div", { class: "field-lbl" }, "PAR"), parSeg,
        A.el("div", { class: "field-lbl" }, "티샷"), teeSeg,
        A.el("div", { class: "row" }, [
          A.el("div", null, [A.el("div", { class: "field-lbl" }, "방향"), dirSeg]),
          A.el("div", null, [A.el("div", { class: "field-lbl" }, "구역(P/O)"), zoneSeg]),
        ]),
        A.el("div", { class: "grid2", style: { marginTop: "10px" } }, [lblStep("버디온", greenSt), lblStep("퍼트", puttSt)]),
        A.el("div", { class: "grid2" }, [lblStep("멀리건", mulSt), lblStep("로스트볼", lbSt)]),
        A.el("div", { class: "grid2" }, [lblStep("스코어 직접조정", manualSt), A.el("div")]),
      ]);

      // 이전/다음
      const nav = A.el("div", { class: "btn-row" }, [
        A.el("button", { class: "btn btn-line", onclick: () => { if (st.cur > 0) { st.cur--; render(); } } }, "◀ 이전"),
        A.el("button", { class: "btn btn-primary", onclick: () => { if (st.cur < 17) { st.cur++; render(); } else A.toast("마지막 홀입니다"); } }, "다음 홀 ▶"),
      ]);

      // 실시간 요약
      const summary = A.el("div", { class: "summary" });
      function refreshSummary() {
        const s = Calc.liveSummary(st.holes.map((hh, i) => Object.assign({ hole_no: i + 1 }, hh)));
        summary.innerHTML = "";
        const item = (lbl, val, bold) => A.el("span", null, [bold ? A.el("b", null, `${lbl} ${val}`) : `${lbl} ${val}`]);
        summary.append(item("총", s.total, true), item("전", s.front), item("후", s.back), item("퍼트", s.putts),
          item("버디", s.birdie), item("파", s.par), item("보기", s.bogey), item("트리플+", s.triple));
      }
      refreshSummary();

      const saveBtn = A.el("button", { class: "btn btn-blue", onclick: save }, [icon("save"), " 라운드 저장"]);

      container.append(holeCard, nav, summary, saveBtn);
    }

    function paintScore(h, bigEl, tagEl) {
      if (h.score == null || h.par == null) { bigEl.textContent = h.score == null ? "–" : String(h.score); bigEl.style.background = "#f0f1f3"; bigEl.style.color = "var(--text)"; tagEl.textContent = ""; return; }
      bigEl.textContent = String(h.score);
      const diff = h.score - h.par;
      const color = Calc.scoreDiffColor(diff);
      bigEl.style.background = color || "#f0f1f3";
      bigEl.style.color = (diff === 0 || color === "#FFF59D") ? "#5a4a00" : (color ? "#fff" : "var(--text)");
      const names = { "-2": "이글", "-1": "버디", "0": "파", "1": "보기", "2": "더블", "3": "트리플+" };
      const d = Math.max(-2, Math.min(3, diff));
      tagEl.textContent = (names[String(d)] || "") + (diff > 0 ? " +" + diff : (diff < 0 ? " " + diff : ""));
    }

    // ---------------- 저장 ----------------
    function save() {
      const b = st.basic;
      const holes = st.holes.map((h, i) => { recalc(h); return {
        hole_no: i + 1, par: h.par, score: h.score, teeshot: h.teeshot, direction: h.direction, zone: h.zone,
        mulligan: h.mulligan || 0, lost_ball: h.lost_ball || 0, green_on: h.green_on || 0, putts: h.putts }; });
      const players = [b.p1, b.p2, b.p3].map((t, i) => { const p = Calc.parsePlayer(t); return p ? Object.assign({ seq: i + 1 }, p) : null; }).filter(Boolean);
      const bundle = {
        round: { round_date: b.round_date, cc_name: b.cc_name.trim(), course1: b.course1.trim(), course2: b.course2.trim(),
          weather: b.weather.trim(), temp_high: b.temp_high === "" ? null : parseInt(b.temp_high),
          temp_low: b.temp_low === "" ? null : parseInt(b.temp_low), time_part: b.time_part || null,
          time_text: b.time_text.trim(), play_type: b.play_type, review: st.review.trim() },
        holes, players,
        cost: { green_fee: +st.cost.green_fee || 0, cart_fee: +st.cost.cart_fee || 0, caddie_fee: +st.cost.caddie_fee || 0,
          etc_cost: +st.cost.etc_cost || 0, event_cost: +st.cost.event_cost || 0 },
      };
      try {
        let id;
        if (st.editId) { DB.updateRound(st.editId, bundle); id = st.editId; }
        else { id = DB.saveRound(bundle); }
        A.toast(st.editId ? "수정 완료" : "저장 완료 (총 " + (bundle.holes.reduce((s, h) => s + (h.score || 0), 0)) + "타)");
        A.go("list");
      } catch (e) { A.toast("저장 실패: " + e.message); console.error(e); }
    }

    // ---------------- 작은 헬퍼 ----------------
    function sel(options, value, onChange) {
      const e = window.App.el("select");
      options.forEach((o) => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; e.append(opt); });
      e.value = value == null ? "" : value;
      e.addEventListener("change", () => onChange(e.value));
      return e;
    }
    function partLabel(p) { return p ? p + "부" : ""; }
  };

  function icon(name) {
    const paths = {
      edit: "M4 20h16M6 16l9-9 3 3-9 9H6z", pin: "M12 21s-6-5.7-6-10a6 6 0 1112 0c0 4.3-6 10-6 10z",
      coin: "M12 2a10 10 0 100 20 10 10 0 000-20zM9 9h4a2 2 0 010 4h-3M12 7v10",
      note: "M5 3h14v18l-7-3-7 3z", flag: "M5 3v18M5 4h12l-2 4 2 4H5", save: "M5 3h11l3 3v15H5zM8 3v5h7M8 14h8v7H8z",
    };
    const span = document.createElement("span");
    span.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="${paths[name] || ""}"/></svg>`;
    return span;
  }
})();
