/* ============================================================
 * screen_stats.js - 통계/목표
 *   종합(등급표) · 홀별 약점 · 동반자별 · 연도별 목표
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});
  const GRADE_BG = { "잘함": ["#00E676", "#064"], "보통": ["#eef1f4", "#444"], "아쉬움": ["#BA68C8", "#fff"], "노력": ["#FF5252", "#fff"], "-": ["#f1f2f4", "#999"] };
  const r1 = (v) => v == null ? "-" : String(Math.round(v * 10) / 10);

  Screens.stats = function (container) {
    const A = window.App;
    A.setAppbar("통계 분석", "");
    let tab = "종합";
    const content = A.el("div");
    const nav = A.segmented(["종합", "홀별", "동반자", "목표"], tab, (v) => { tab = v; paint(); });
    container.append(A.el("div", { style: { marginBottom: "12px" } }, [nav]), content);
    paint();

    function paint() {
      content.innerHTML = "";
      if (DB.count("rounds") === 0 && tab !== "목표") { content.append(A.el("div", { class: "empty" }, "통계를 보려면 먼저 라운드를 입력하세요")); return; }
      if (tab === "종합") renderSummary();
      else if (tab === "홀별") renderHoles();
      else if (tab === "동반자") renderPlayers();
      else renderGoal();
    }

    // ===== 종합 등급표 =====
    function renderSummary() {
      const s = DB.roundSummary() || {};
      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, `종합 평균 (총 ${s.n || 0}회)`)]);
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

      // 누적 횟수 칩
      const chips = A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" } }, [
        miniChip("평균 버디", r1(s.bd)), miniChip("평균 파", r1(s.par_c)), miniChip("평균 보기", r1(s.bg)),
        miniChip("평균 트리플+", r1(s.tp)), miniChip("평균 3퍼트", r1(s.tputt)), miniChip("Best", s.min_s != null ? s.min_s : "-"),
      ]);
      content.append(A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "라운드당 평균"), chips]));
    }

    // ===== 홀별 약점 =====
    function renderHoles() {
      const hw = DB.holeWeakness();
      if (!hw.length) { content.append(A.el("div", { class: "empty" }, "홀 데이터가 없습니다")); return; }
      // 약점 TOP (avg_diff 큰 순)
      const sorted = [...hw].sort((a, b) => b.avg_diff - a.avg_diff);
      const topCard = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "약점 홀 TOP 5 (PAR 대비)")]);
      sorted.slice(0, 5).forEach((h) => {
        topCard.append(A.el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid var(--line)" } }, [
          A.el("div", { style: { fontSize: "14px" } }, `${h.hole}번 홀`),
          A.el("div", { style: { fontSize: "12px", color: "var(--text-2)" } }, `OB ${Math.round(h.ob_rate)}% · 3퍼트 ${Math.round(h.three_putt_rate)}% · ${h.n}회`),
          A.el("div", { style: { fontSize: "15px", fontWeight: "700", color: h.avg_diff >= 1 ? "#d63333" : (h.avg_diff <= 0 ? "#0a8f4d" : "#b06a00") } }, (h.avg_diff >= 0 ? "+" : "") + (Math.round(h.avg_diff * 10) / 10)),
        ]));
      });
      topCard.lastChild.style.borderBottom = "none";
      content.append(topCard);

      // 18홀 스트립 (avg_diff 색)
      const map = {}; hw.forEach((h) => map[h.hole] = h);
      const cell = (no) => { const h = map[no]; const d = h ? h.avg_diff : null;
        let bg = "#fff", col = "#333";
        if (d != null) { if (d >= 1) { bg = "#FF5252"; col = "#fff"; } else if (d >= 0.4) { bg = "#FFF59D"; } else if (d <= -0.2) { bg = "#00E676"; } else { bg = "#eef7f1"; } }
        return A.el("div", { style: { width: "100%", aspectRatio: "1/1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "5px", border: "1px solid var(--line)", background: bg, color: col } }, [
          A.el("div", { style: { fontSize: "10px", opacity: ".8" } }, String(no)),
          A.el("div", { style: { fontSize: "11px", fontWeight: "600" } }, h ? ((d >= 0 ? "+" : "") + (Math.round(d * 10) / 10)) : "·"),
        ]);
      };
      const grid = (from, to) => { const a = []; for (let i = from; i <= to; i++) a.push(cell(i)); return A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: "3px" } }, a); };
      content.append(A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "홀별 평균 (PAR 대비)"),
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "0 0 4px" } }, "전반"), grid(1, 9),
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "6px 0 4px" } }, "후반"), grid(10, 18)]));
    }

    // ===== 동반자별 =====
    function renderPlayers() {
      const ps = DB.byPlayer(1);
      if (!ps.length) { content.append(A.el("div", { class: "empty" }, "동반자 기록이 없습니다")); return; }
      const card = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "동반자별 통계")]);
      ps.forEach((p) => {
        const diff = (p.avg_my != null && p.avg_player != null) ? p.avg_my - p.avg_player : null;
        card.append(A.el("div", { style: { padding: "10px 2px", borderBottom: "1px solid var(--line)" } }, [
          A.el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
            A.el("div", { style: { fontSize: "15px", fontWeight: "500" } }, `${p.name} (${p.n}회)`),
            diff != null ? A.el("div", { style: { fontSize: "12px", fontWeight: "600", color: diff < 0 ? "#0a8f4d" : "#d63333" } }, diff < 0 ? `평균 ${r1(-diff)} 앞섬` : `평균 ${r1(diff)} 뒤짐`) : null,
          ]),
          A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", marginTop: "2px" } }, `내 평균 ${r1(p.avg_my)} · 상대 ${r1(p.avg_player)} · 내 Best ${p.best_my != null ? p.best_my : "-"}`),
        ]));
      });
      card.lastChild.style.borderBottom = "none";
      content.append(card);
    }

    // ===== 연도별 목표 =====
    function renderGoal() {
      const year = new Date().getFullYear();
      const saved = DB.getGoal(year);
      const def = Calc.YEARLY_GOAL[year] || Calc.YEARLY_GOAL[2026];
      const goal = saved || Object.assign({ year }, def);
      const act = DB.get("SELECT AVG(total_score) avg_s, AVG(good_tee_count) gt, AVG(lost_ball_total) lb, AVG(birdie_on_total) bo, AVG(birdie_count) bd, AVG(putts_total) pt, AVG(three_putt_count) tputt, AVG(triple_count) tp, COUNT(*) n FROM rounds WHERE total_score>0 AND strftime('%Y',round_date)=?", [String(year)]) || {};

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

      // 목표 수정 폼 (토글)
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
