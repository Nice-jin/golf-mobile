/* ============================================================
 * screen_stats.js - 통계/목표
 *   종합 · 동반자 · 분포 · 비용 · 목표  (기간 필터 공통 적용)
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});
  const GRADE_BG = { "잘함": ["#00E676", "#064"], "보통": ["#eef1f4", "#444"], "아쉬움": ["#BA68C8", "#fff"], "노력": ["#FF5252", "#fff"], "-": ["#f1f2f4", "#999"] };
  const r1 = (v) => v == null ? "-" : String(Math.round(v * 10) / 10);
  const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
  const yearStart = () => `${new Date().getFullYear()}-01-01`;

  Screens.stats = function (container) {
    const A = window.App;
    A.setAppbar("통계 분석", "");

    let tab = "종합";
    let dateFrom = yearStart();
    let dateTo   = todayStr();
    let showDatePicker = false;

    const TABS = ["종합", "동반자", "분포", "비용", "목표"];

    // ── 탭 네비 ────────────────────────────────────────────────
    const tabEls = TABS.map((t) => {
      const el = A.el("div", { class: "stat-tab" + (t === tab ? " stat-tab-on" : ""), onclick: () => { tab = t; paint(); } }, t);
      return el;
    });
    const navBar = A.el("div", { class: "stat-tabbar" }, tabEls);

    // ── 기간 필터 바 (탭과 동일 높이) ────────────────────────
    const periodLbl = A.el("span", { class: "stat-period-lbl" });
    const periodBtn = A.el("button", { class: "stat-period-btn", onclick: () => { showDatePicker = !showDatePicker; renderDatePicker(); } }, "설정");
    const filterBar = A.el("div", { class: "stat-filter-bar" }, [periodLbl, periodBtn]);
    const pickerWrap = A.el("div");

    const content = A.el("div");
    container.append(navBar, filterBar, pickerWrap, content);

    function updatePeriodLabel() {
      periodLbl.textContent = `📅 ${dateFrom}  ~  ${dateTo}`;
    }
    updatePeriodLabel();

    function renderDatePicker() {
      pickerWrap.innerHTML = "";
      if (!showDatePicker) return;
      const fromInp = A.el("input", { type: "date", value: dateFrom, style: { flex: "1", fontSize: "13px", padding: "6px", border: "1px solid var(--line)", borderRadius: "6px" } });
      const toInp   = A.el("input", { type: "date", value: dateTo,   style: { flex: "1", fontSize: "13px", padding: "6px", border: "1px solid var(--line)", borderRadius: "6px" } });
      const applyBtn = A.el("button", { class: "btn btn-primary", style: { marginTop: "8px", width: "100%" },
        onclick: () => {
          dateFrom = fromInp.value || yearStart();
          dateTo   = toInp.value   || todayStr();
          showDatePicker = false;
          updatePeriodLabel();
          renderDatePicker();
          paint();
        } }, "적용");
      const shortcuts = A.el("div", { style: { display: "flex", gap: "6px", marginBottom: "6px" } }, [
        shortBtn("올해", () => { dateFrom = yearStart(); dateTo = todayStr(); }),
        shortBtn("전체", () => { dateFrom = "2000-01-01"; dateTo = todayStr(); }),
        shortBtn("최근3개월", () => { const d = new Date(); d.setMonth(d.getMonth()-3); dateFrom = d.toISOString().slice(0,10); dateTo = todayStr(); }),
        shortBtn("최근6개월", () => { const d = new Date(); d.setMonth(d.getMonth()-6); dateFrom = d.toISOString().slice(0,10); dateTo = todayStr(); }),
      ]);
      function shortBtn(label, fn) {
        return A.el("button", { class: "btn btn-ghost", style: { flex: "1", fontSize: "11px", padding: "4px 2px" },
          onclick: () => { fn(); fromInp.value = dateFrom; toInp.value = dateTo; } }, label);
      }
      pickerWrap.append(A.el("div", { class: "card", style: { marginBottom: "8px" } }, [
        shortcuts,
        A.el("div", { style: { display: "flex", gap: "8px", alignItems: "center" } }, [
          A.el("span", { style: { fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" } }, "시작"),
          fromInp,
          A.el("span", { style: { fontSize: "12px", color: "var(--text-2)", whiteSpace: "nowrap" } }, "종료"),
          toInp,
        ]),
        applyBtn,
      ]));
    }

    function paint() {
      // 탭 활성화 표시
      TABS.forEach((t, i) => {
        tabEls[i].className = "stat-tab" + (t === tab ? " stat-tab-on" : "");
      });
      content.innerHTML = "";
      const hasDf = dateFrom, hasDt = dateTo;
      const whereDate = `round_date BETWEEN '${hasDf}' AND '${hasDt}'`;
      const whereScore = `total_score > 0 AND ${whereDate}`;

      if (tab !== "목표") {
        const n = (DB.get(`SELECT COUNT(*) AS n FROM rounds WHERE ${whereScore}`) || {}).n || 0;
        if (n === 0) { content.append(A.el("div", { class: "empty" }, "해당 기간에 라운드가 없어요")); return; }
      }

      if (tab === "종합")    renderSummary(whereScore);
      else if (tab === "동반자") renderPlayers(whereScore);
      else if (tab === "분포")  renderDist(whereDate);
      else if (tab === "비용")  renderCost(whereDate);
      else                   renderGoal();
    }
    paint();

    // ===== 종합 =====
    function renderSummary(where) {
      const s = DB.get(`SELECT COUNT(*) AS n, AVG(total_score) AS avg_s, MIN(total_score) AS min_s,
        AVG(good_tee_count) AS gt, AVG(tee_out_count) AS to_, AVG(birdie_on_total) AS bo,
        AVG(putts_total) AS pt, AVG(mulligan_total) AS m, AVG(lost_ball_total) AS lb,
        AVG(birdie_count) AS bd, AVG(par_count) AS par_c, AVG(bogey_count) AS bg,
        AVG(triple_count) AS tp, AVG(three_putt_count) AS tputt
        FROM rounds WHERE ${where}`) || {};

      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, `종합 평균 (${s.n || 0}회)`)]);
      const rows = [
        ["평균 스코어", s.avg_s, "score"], ["굿티샷", s.gt, "good_tee"], ["티샷아웃", s.to_, "tee_out"],
        ["버디온", s.bo, "birdie_on"], ["퍼트", s.pt, "putts"], ["멀리건", s.m, "mulligan"], ["로스트볼", s.lb, "lost_ball"],
      ];
      rows.forEach(([label, val, field]) => {
        const grade = val != null ? Calc.gradeFor(field, val) : "-";
        const [bg, fg] = GRADE_BG[grade] || GRADE_BG["-"];
        card.append(A.el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid var(--line)" } }, [
          A.el("div", { style: { fontSize: "14px", color: "var(--text-2)" } }, label),
          A.el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            A.el("div", { style: { fontSize: "16px", fontWeight: "600" } }, r1(val)),
            A.el("div", { style: { background: bg, color: fg, fontSize: "12px", fontWeight: "600", padding: "2px 10px", borderRadius: "12px", minWidth: "44px", textAlign: "center" } }, grade),
          ]),
        ]));
      });
      card.lastChild.style.borderBottom = "none";
      content.append(card);

      const chips = A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" } }, [
        miniChip("평균 버디", r1(s.bd)), miniChip("평균 파", r1(s.par_c)), miniChip("평균 보기", r1(s.bg)),
        miniChip("평균 트리플+", r1(s.tp)), miniChip("평균 3퍼트", r1(s.tputt)), miniChip("Best", s.min_s != null ? s.min_s : "-"),
      ]);
      content.append(A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "라운드당 평균"), chips]));
    }

    // ===== 동반자 =====
    function renderPlayers(where) {
      const ps = DB.query(`
        SELECT p.name, COUNT(*) AS n, AVG(r.total_score) AS avg_my,
               AVG(p.score) AS avg_player, MIN(r.total_score) AS best_my
        FROM players p JOIN rounds r ON r.id=p.round_id
        WHERE r.${where} AND p.name IS NOT NULL AND p.name!=''
        GROUP BY p.name HAVING COUNT(*)>=1 ORDER BY n DESC, avg_my ASC`);
      if (!ps.length) { content.append(A.el("div", { class: "empty" }, "동반자 기록이 없습니다")); return; }
      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "동반자별 통계")]);
      ps.forEach((p) => {
        const diff = (p.avg_my != null && p.avg_player != null) ? p.avg_my - p.avg_player : null;
        card.append(A.el("div", { style: { padding: "10px 2px", borderBottom: "1px solid var(--line)" } }, [
          A.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
            A.el("div", { style: { fontSize: "15px", fontWeight: "500" } }, `${p.name} (${p.n}회)`),
            diff != null ? A.el("div", { style: { fontSize: "12px", fontWeight: "600", color: diff < 0 ? "#0a8f4d" : "#d63333" } },
              diff < 0 ? `평균 ${r1(-diff)} 앞섬` : `평균 ${r1(diff)} 뒤짐`) : null,
          ]),
          A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } },
            `내 평균 ${r1(p.avg_my)} · 상대 ${r1(p.avg_player)} · 내 Best ${p.best_my != null ? p.best_my : "-"}`),
        ]));
      });
      card.lastChild.style.borderBottom = "none";
      content.append(card);
    }

    // ===== 분포 =====
    function renderDist(where) {
      // ── 스코어 분포 (전체 홀 집계) ──────────────────────────
      const sc = DB.get(`
        SELECT
          SUM(CASE WHEN h.score - h.par <= -2 THEN 1 ELSE 0 END) AS eagle_plus,
          SUM(CASE WHEN h.score - h.par = -1  THEN 1 ELSE 0 END) AS birdie,
          SUM(CASE WHEN h.score - h.par = 0   THEN 1 ELSE 0 END) AS par_cnt,
          SUM(CASE WHEN h.score - h.par = 1   THEN 1 ELSE 0 END) AS bogey,
          SUM(CASE WHEN h.score - h.par = 2   THEN 1 ELSE 0 END) AS double_b,
          SUM(CASE WHEN h.score - h.par = 3   THEN 1 ELSE 0 END) AS triple_b,
          SUM(CASE WHEN h.score - h.par = 4   THEN 1 ELSE 0 END) AS quad,
          SUM(CASE WHEN h.score - h.par >= 5  THEN 1 ELSE 0 END) AS five_plus,
          COUNT(*) AS total
        FROM holes h JOIN rounds r ON r.id=h.round_id
        WHERE h.score IS NOT NULL AND h.par IS NOT NULL AND r.${where}`);

      if (!sc || !sc.total) { content.append(A.el("div", { class: "empty" }, "홀 데이터가 없습니다")); return; }

      const scoreCols = [
        ["-2 이글",   sc.eagle_plus, "#1565C0", "#fff"],
        ["-1 버디",   sc.birdie,     "#00E676", "#064"],
        ["0 파",      sc.par_cnt,    "#eef1f4", "#333"],
        ["+1 보기",   sc.bogey,      "#FFF59D", "#333"],
        ["+2 더블",   sc.double_b,   "#BA68C8", "#fff"],
        ["+3 트리플", sc.triple_b,   "#FF5252", "#fff"],
        ["+4",        sc.quad,       "#b71c1c", "#fff"],
        ["+5이상",    sc.five_plus,  "#4a0000", "#fff"],
      ];
      const scoreCard = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "홀별 스코어 분포 (PAR 대비)")]);
      scoreCard.append(distTable(scoreCols, sc.total));
      content.append(scoreCard);

      // ── 퍼트 분포 (전체 홀 집계) ────────────────────────────
      const pt = DB.get(`
        SELECT
          SUM(CASE WHEN h.putts = 0  THEN 1 ELSE 0 END) AS p0,
          SUM(CASE WHEN h.putts = 1  THEN 1 ELSE 0 END) AS p1,
          SUM(CASE WHEN h.putts = 2  THEN 1 ELSE 0 END) AS p2,
          SUM(CASE WHEN h.putts = 3  THEN 1 ELSE 0 END) AS p3,
          SUM(CASE WHEN h.putts >= 4 THEN 1 ELSE 0 END) AS p4plus,
          COUNT(*) AS total
        FROM holes h JOIN rounds r ON r.id=h.round_id
        WHERE h.putts IS NOT NULL AND r.${where}`);

      if (pt && pt.total) {
        const puttCols = [
          ["0 퍼트",    pt.p0,     "#1565C0", "#fff"],
          ["1 퍼트",    pt.p1,     "#00E676", "#064"],
          ["2 퍼트",    pt.p2,     "#eef1f4", "#333"],
          ["3 퍼트",    pt.p3,     "#FFF59D", "#333"],
          ["4퍼트이상", pt.p4plus, "#FF5252", "#fff"],
        ];
        const puttCard = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "홀별 퍼트 분포")]);
        puttCard.append(distTable(puttCols, pt.total));
        content.append(puttCard);
      }

      function distTable(cols, total) {
        const pct = (v) => total > 0 ? (Math.round((v / total) * 1000) / 10).toFixed(1) + "%" : "0%";
        const thStyle = (bg, fg) => ({
          padding: "7px 8px", textAlign: "center", fontSize: "11px", fontWeight: "700",
          background: bg, color: fg, whiteSpace: "nowrap",
          border: bg === "#eef1f4" || bg === "#FFF59D" ? "1px solid #bbb" : "none",
        });
        const tdStyle = { padding: "7px 8px", textAlign: "center", fontSize: "12px", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" };
        const labelStyle = { padding: "7px 10px", fontSize: "12px", fontWeight: "600", color: "var(--text-2)", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" };
        const thead = A.el("thead", null, [
          A.el("tr", null, [
            A.el("th", { style: { padding: "7px 10px", background: "#f0f7f3", whiteSpace: "nowrap" } }, ""),
            ...cols.map(([label,, bg, fg]) => A.el("th", { style: thStyle(bg, fg) }, label)),
          ]),
        ]);
        const tbody = A.el("tbody", null, [
          A.el("tr", null, [
            A.el("td", { style: labelStyle }, "홀 수"),
            ...cols.map(([, v]) => A.el("td", { style: tdStyle }, String(v ?? 0))),
          ]),
          A.el("tr", null, [
            A.el("td", { style: { ...labelStyle, borderBottom: "none" } }, "비중(%)"),
            ...cols.map(([, v]) => A.el("td", { style: { ...tdStyle, borderBottom: "none", fontWeight: "600" } }, pct(v ?? 0))),
          ]),
        ]);
        return A.el("div", { style: { overflowX: "auto" } }, [
          A.el("table", { style: { borderCollapse: "collapse", tableLayout: "auto" } }, [thead, tbody]),
        ]);
      }
    }

    // ===== 비용 =====
    function renderCost(where) {
      const s = DB.get(`
        SELECT COUNT(*) AS n,
          SUM(c.green_fee) AS total_green, AVG(c.green_fee) AS avg_green,
          SUM(c.cart_fee)  AS total_cart,  AVG(c.cart_fee)  AS avg_cart,
          SUM(c.caddie_fee) AS total_cad,  AVG(c.caddie_fee) AS avg_cad,
          SUM(c.etc_cost)  AS total_etc,   AVG(c.etc_cost)  AS avg_etc,
          SUM(c.event_cost) AS total_evt,  AVG(c.event_cost) AS avg_evt,
          SUM(c.total_cost) AS grand_total, AVG(c.total_cost) AS avg_total
        FROM costs c JOIN rounds r ON r.id=c.round_id
        WHERE r.${where}`) || {};
      const fw = (v) => v != null ? (Math.round(v * 10) / 10) + "만" : "-";
      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, `비용 통계 (${s.n || 0}회)`)]);
      const rows = [
        ["그린피",  s.total_green, s.avg_green],
        ["카트비",  s.total_cart,  s.avg_cart],
        ["캐디피",  s.total_cad,   s.avg_cad],
        ["기타",    s.total_etc,   s.avg_etc],
        ["이벤트",  s.total_evt,   s.avg_evt],
      ];
      rows.forEach(([label, total, avg]) => {
        card.append(A.el("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 2px", borderBottom: "1px solid var(--line)", fontSize: "14px" } }, [
          A.el("div", { style: { color: "var(--text-2)" } }, label),
          A.el("div", { style: { display: "flex", gap: "16px" } }, [
            A.el("div", { style: { color: "var(--text-3)", fontSize: "12px" } }, `합계 ${fw(total)}`),
            A.el("div", { style: { fontWeight: "600" } }, `평균 ${fw(avg)}`),
          ]),
        ]));
      });
      card.append(A.el("div", { style: { display: "flex", justifyContent: "space-between", padding: "11px 2px", borderTop: "2px solid var(--green)", marginTop: "2px" } }, [
        A.el("div", { style: { fontWeight: "700", fontSize: "15px" } }, "총합계"),
        A.el("div", { style: { display: "flex", gap: "16px" } }, [
          A.el("div", { style: { color: "var(--text-3)", fontSize: "12px" } }, `합계 ${fw(s.grand_total)}`),
          A.el("div", { style: { fontWeight: "700", fontSize: "15px", color: "var(--green)" } }, `평균 ${fw(s.avg_total)}`),
        ]),
      ]));
      content.append(card);
    }

    // ===== 목표 =====
    function renderGoal() {
      const year = new Date().getFullYear();
      const saved = DB.getGoal(year);
      const def = Calc.YEARLY_GOAL[year] || Calc.YEARLY_GOAL[2026];
      const goal = saved || Object.assign({ year }, def);
      const act = DB.get(`SELECT AVG(total_score) avg_s, AVG(good_tee_count) gt, AVG(lost_ball_total) lb,
        AVG(birdie_on_total) bo, AVG(birdie_count) bd, AVG(putts_total) pt,
        AVG(three_putt_count) tputt, AVG(triple_count) tp, COUNT(*) n
        FROM rounds WHERE total_score>0 AND strftime('%Y',round_date)=?`, [String(year)]) || {};
      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, `${year}년 목표 vs 실제 (올해 ${act.n || 0}회)`)]);
      const line = (label, goalVal, actVal, pass) => A.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 2px", borderBottom: "1px solid var(--line)" } }, [
        A.el("div", { style: { fontSize: "14px", color: "var(--text-2)" } }, label),
        A.el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, [
          A.el("div", { style: { fontSize: "13px", color: "var(--text-3)" } }, `목표 ${goalVal}`),
          A.el("div", { style: { fontSize: "15px", fontWeight: "600" } }, r1(actVal)),
          A.el("div", { style: { fontSize: "14px", color: pass ? "#0a8f4d" : "#d63333", fontWeight: "700", width: "18px", textAlign: "center" } }, actVal == null ? "·" : (pass ? "✓" : "✕")),
        ]),
      ]);
      const rows = [
        ["평균 스코어", goal.avg_score, act.avg_s, act.avg_s != null && act.avg_s <= goal.avg_score],
        ["굿티샷(이상)", goal.good_tee_min, act.gt, act.gt != null && act.gt >= goal.good_tee_min],
        ["로스트볼(이하)", goal.lost_ball_max, act.lb, act.lb != null && act.lb <= goal.lost_ball_max],
        ["버디온(이상)", goal.birdie_on_min, act.bo, act.bo != null && act.bo >= goal.birdie_on_min],
        ["버디(이상)", goal.birdie_min, act.bd, act.bd != null && act.bd >= goal.birdie_min],
        ["퍼트(이하)", goal.putts_max, act.pt, act.pt != null && act.pt <= goal.putts_max],
        ["3퍼트(이하)", goal.three_putt_max, act.tputt, act.tputt != null && act.tputt <= goal.three_putt_max],
        ["트리플+(이하)", goal.triple_max, act.tp, act.tp != null && act.tp <= goal.triple_max],
      ];
      rows.forEach((r) => card.append(line(r[0], r[1], r[2], r[3])));
      card.lastChild.style.borderBottom = "none";
      content.append(card);
      const formWrap = A.el("div");
      let editing = false;
      const editBtn = A.el("button", { class: "btn btn-ghost", onclick: () => { editing = !editing; renderForm(); } }, "목표 수정");
      content.append(editBtn, formWrap);
      function renderForm() {
        formWrap.innerHTML = "";
        if (!editing) return;
        const f = {};
        const flds = [
          ["avg_score", "평균 스코어"], ["good_tee_min", "굿티샷(이상)"], ["lost_ball_max", "로스트볼(이하)"],
          ["birdie_on_min", "버디온(이상)"], ["birdie_min", "버디(이상)"], ["putts_max", "퍼트(이하)"],
          ["three_putt_max", "3퍼트(이하)"], ["triple_max", "트리플+(이하)"],
        ];
        const grid = A.el("div", { class: "grid2" });
        flds.forEach(([k, label]) => {
          const inp = A.el("input", { type: "number", inputmode: "numeric", value: goal[k] != null ? goal[k] : "" });
          f[k] = inp;
          grid.append(A.el("div", { class: "field" }, [A.el("label", null, label), inp]));
        });
        const save = A.el("button", { class: "btn btn-primary", onclick: () => {
          DB.setGoal({ year, avg_score: +f.avg_score.value || null, good_tee_min: +f.good_tee_min.value || null,
            lost_ball_max: +f.lost_ball_max.value || null, birdie_on_min: +f.birdie_on_min.value || null,
            birdie_min: +f.birdie_min.value || null, putts_max: +f.putts_max.value || null,
            three_putt_max: +f.three_putt_max.value || null, triple_max: +f.triple_max.value || null });
          A.toast("목표 저장됨"); editing = false; paint();
        } }, "저장");
        formWrap.append(A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, `${year}년 목표 설정`), grid, save]));
      }
    }

    function miniChip(label, value) {
      return A.el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 4px", background: "#f6f7f9", borderRadius: "8px" } }, [
        A.el("div", { style: { fontSize: "11px", color: "var(--text-2)" } }, label),
        A.el("div", { style: { fontSize: "16px", fontWeight: "600", color: "var(--green)" } }, String(value)),
      ]);
    }
  };
})();
 [
        A.el("div", { style: { fontSize: "11px", color: "var(--text-2)" } }, label),
        A.el("div", { style: { fontSize: "16px", fontWeight: "600", color: "var(--green)" } }, String(value)),
      ]);
    }
  };
})();
