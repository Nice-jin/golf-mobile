/* ============================================================
 * screen_list.js - 라운드 목록 + 동반자 목록
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});

  function scoreBadge(score) {
    const g = Calc.gradeFor("score", score);
    const map = { "잘함": ["#00E676", "#064"], "보통": ["#eef1f4", "#333"], "아쉬움": ["#BA68C8", "#fff"], "노력": ["#FF5252", "#fff"] };
    return map[g] || ["#eef1f4", "#333"];
  }

  Screens.list = function (container) {
    const A = window.App;
    let activeTab = "round"; // "round" | "companion"
    let companionDetail = null; // 선택된 동반자 이름

    // ── 탭 바 ────────────────────────────────────────────────
    const tabRound = A.el("div", { class: "list-tab" + (activeTab === "round" ? " list-tab-on" : ""),
      onclick: () => { if (activeTab !== "round") { activeTab = "round"; companionDetail = null; switchTab(); } } }, "📋 라운드");
    const tabComp  = A.el("div", { class: "list-tab" + (activeTab === "companion" ? " list-tab-on" : ""),
      onclick: () => { if (activeTab !== "companion") { activeTab = "companion"; companionDetail = null; switchTab(); } } }, "👥 동반자");
    const tabBar   = A.el("div", { class: "list-tabbar" }, [tabRound, tabComp]);

    const body = A.el("div");
    container.append(tabBar, body);

    function switchTab() {
      tabRound.className = "list-tab" + (activeTab === "round" ? " list-tab-on" : "");
      tabComp.className  = "list-tab" + (activeTab === "companion" ? " list-tab-on" : "");
      body.innerHTML = "";
      if (activeTab === "round") renderRound();
      else renderCompanion();
    }

    switchTab();

    // ══════════════════════════════════════════════════════════
    // 라운드 목록
    // ══════════════════════════════════════════════════════════
    function renderRound() {
      let filter = "";
      let expanded = null;
      let confirmDel = null;

      A.setAppbar("라운드 목록", "");
      const search = A.el("input", { type: "text", placeholder: "CC·코스 검색 (초성 가능)" });
      search.addEventListener("input", () => { filter = search.value.trim(); paint(); });
      const listWrap = A.el("div");
      body.append(A.el("div", { style: { marginBottom: "12px" } }, [search]), listWrap);
      paint();

      function paint() {
        const all = DB.listRounds();
        const rows = filter
          ? all.filter((r) => Calc.chosungMatch(filter, (r.cc_name || "") + " " + (r.course1 || "") + " " + (r.course2 || "")))
          : all;
        A.setAppbar("라운드 목록", `총 ${all.length}개` + (filter ? ` · 검색 ${rows.length}` : ""));
        listWrap.innerHTML = "";
        if (!rows.length) { listWrap.append(A.el("div", { class: "empty" }, filter ? "검색 결과 없음" : "아직 입력된 라운드가 없어요")); return; }
        rows.forEach((r) => listWrap.append(rowEl(r)));
      }

      function rowEl(r) {
        const [bg, fg] = scoreBadge(r.total_score);
        const head = A.el("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" },
          onclick: () => { expanded = (expanded === r.id ? null : r.id); confirmDel = null; paint2(); },
        }, [
          A.el("div", null, [
            A.el("div", { style: { fontSize: "15px", fontWeight: "500" } }, r.cc_name || "-"),
            A.el("div", { style: { fontSize: "11px", color: "var(--text-3)" } }, [
              String(r.round_date).slice(0, 10),
              (r.course1 || r.course2) ? ` · ${r.course1 || ""}${r.course2 ? "/" + r.course2 : ""}` : "",
            ].join("")),
          ]),
          A.el("div", { style: { background: bg, color: fg, fontSize: "16px", fontWeight: "600", padding: "4px 14px", borderRadius: "8px", minWidth: "46px", textAlign: "center" } },
            r.total_score != null ? String(r.total_score) : "-"),
        ]);
        const card = A.el("div", { class: "card", style: { padding: "0", overflow: "hidden" } }, [head]);
        if (expanded === r.id) card.append(detailEl(r.id, () => { expanded = null; confirmDel = null; paint(); }));
        return card;
      }

      function paint2() { paint(); }

      function detailEl(id, onDelete) {
        const full = DB.getRoundFull(id);
        const r = full.round;
        const wrap = A.el("div", { style: { borderTop: "1px solid var(--line)", padding: "12px 14px", background: "#fcfcfd" } });

        const meta = [];
        if (r.time_part) meta.push(`${r.time_part}부`);
        if (r.time_text) meta.push(r.time_text);
        if (r.weather) meta.push(r.weather);
        if (r.temp_high != null || r.temp_low != null) meta.push(`${r.temp_high ?? "-"}/${r.temp_low ?? "-"}℃`);
        if (r.play_type) meta.push(r.play_type);
        if (meta.length) wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", marginBottom: "10px" } }, meta.join(" · ")));

        const chip = (label, value, color) => A.el("div", {
          style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px", background: "#f6f7f9", borderRadius: "8px" },
        }, [
          A.el("div", { style: { fontSize: "11px", color: "var(--text-2)" } }, label),
          A.el("div", { style: { fontSize: "15px", fontWeight: "600", color: color || "var(--text)" } }, String(value ?? "-")),
        ]);

        wrap.append(A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "8px" } }, [
          chip("총", r.total_score ?? "-", "#217346"), chip("전반", r.front_score ?? "-"), chip("후반", r.back_score ?? "-"),
          chip("PAR대비", r.total_score != null && r.total_par ? (r.total_score - r.total_par >= 0 ? "+" : "") + (r.total_score - r.total_par) : "-"),
        ]));
        wrap.append(A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "8px" } }, [
          chip("굿티샷", r.good_tee_count ?? 0, Calc.gradeColorText("good_tee", r.good_tee_count)),
          chip("티샷아웃", r.tee_out_count ?? 0), chip("버디온", r.birdie_on_total ?? 0), chip("퍼트", r.putts_total ?? 0),
        ]));
        wrap.append(A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "8px" } }, [
          chip("버디", r.birdie_count ?? 0), chip("파", r.par_count ?? 0), chip("보기", r.bogey_count ?? 0), chip("트리플+", r.triple_count ?? 0),
        ]));
        wrap.append(A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "10px" } }, [
          chip("멀리건", r.mulligan_total ?? 0), chip("LB", r.lost_ball_total ?? 0), chip("3퍼트", r.three_putt_count ?? 0),
          chip("비용", full.cost && full.cost.total_cost ? full.cost.total_cost : "-"),
        ]));

        if (full.holes.some((h) => h.score != null)) wrap.append(holeStrip(full.holes));

        if (full.players.length) {
          wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", margin: "8px 0 4px" } }, "동반자"));
          wrap.append(A.el("div", { style: { fontSize: "13px" } },
            full.players.map((p) => p.name + (p.score ? ` ${p.score}타` : "") + (p.note ? ` (${p.note})` : "")).join(", ")));
        }
        if (r.review) {
          wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", margin: "8px 0 4px" } }, "총평"));
          wrap.append(A.el("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap" } }, r.review));
        }

        const delArea = A.el("div", { style: { flex: "1" } });
        let confirmDel2 = false;
        function paintDel() {
          delArea.innerHTML = "";
          if (confirmDel2) {
            delArea.append(A.el("div", { class: "btn-row" }, [
              A.el("button", { class: "btn btn-line", onclick: () => { confirmDel2 = false; paintDel(); } }, "취소"),
              A.el("button", { class: "btn", style: { background: "#FF5252", color: "#fff" },
                onclick: () => { DB.deleteRound(id); A.toast("삭제됨"); onDelete && onDelete(); } }, "삭제 확정"),
            ]));
          } else {
            delArea.append(A.el("button", { class: "btn", style: { background: "#fff", color: "#FF5252", border: "1px solid #FF5252" },
              onclick: () => { confirmDel2 = true; paintDel(); } }, "삭제"));
          }
        }
        paintDel();
        wrap.append(A.el("div", { class: "btn-row", style: { marginTop: "12px" } }, [
          A.el("button", { class: "btn btn-primary", onclick: () => A.go("input", { editId: id }) }, "수정"),
          delArea,
        ]));
        return wrap;
      }
    }

    // ══════════════════════════════════════════════════════════
    // 동반자 목록
    // ══════════════════════════════════════════════════════════
    function renderCompanion() {
      A.setAppbar("동반자 목록", "");
      body.innerHTML = "";

      if (companionDetail) {
        renderCompanionRounds(companionDetail);
        return;
      }

      let filter = "";
      const search = A.el("input", { type: "text", placeholder: "이름 검색 (초성 가능)" });
      search.addEventListener("input", () => { filter = search.value.trim(); paintList(); });
      const listWrap = A.el("div");
      body.append(A.el("div", { style: { marginBottom: "12px" } }, [search]), listWrap);
      paintList();

      function paintList() {
        const all = DB.companionList();
        const rows = filter
          ? all.filter((c) => Calc.chosungMatch(filter, c.name || ""))
          : all;
        A.setAppbar("동반자 목록", `총 ${all.length}명`);
        listWrap.innerHTML = "";
        if (!rows.length) {
          listWrap.append(A.el("div", { class: "empty" }, filter ? "검색 결과 없음" : "동반자 데이터가 없어요"));
          return;
        }
        rows.forEach((c) => listWrap.append(compRow(c)));
      }

      function compRow(c) {
        return A.el("div", { class: "card", style: { padding: "0", overflow: "hidden" } }, [
          A.el("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", cursor: "pointer" },
            onclick: () => { companionDetail = c.name; renderCompanion(); },
          }, [
            A.el("div", null, [
              A.el("div", { style: { fontSize: "15px", fontWeight: "500" } }, c.name || "-"),
              c.note ? A.el("div", { style: { fontSize: "11px", color: "var(--text-3)" } }, c.note) : null,
            ]),
            A.el("div", { style: { background: "#e8f5e9", color: "#217346", borderRadius: "8px", padding: "4px 12px", fontSize: "13px", fontWeight: "600" } },
              `${c.n}회 동반`),
          ]),
        ]);
      }
    }

    function renderCompanionRounds(name) {
      const A = window.App;
      const backBtn = A.el("button", { class: "ab-btn", onclick: () => { companionDetail = null; body.innerHTML = ""; renderCompanion(); } }, "← 목록");
      A.setAppbar(`${name} 동반 라운드`, "", backBtn);
      body.innerHTML = "";

      const rows = DB.roundsByCompanion(name);
      if (!rows.length) {
        body.append(A.el("div", { class: "empty" }, "라운드 데이터 없음"));
        return;
      }
      rows.forEach((r) => {
        const [bg, fg] = scoreBadge(r.total_score);
        body.append(A.el("div", { class: "card", style: { padding: "0", overflow: "hidden" } }, [
          A.el("div", {
            style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" },
            onclick: () => A.go("input", { editId: r.id }),
          }, [
            A.el("div", null, [
              A.el("div", { style: { fontSize: "15px", fontWeight: "500" } }, r.cc_name || "-"),
              A.el("div", { style: { fontSize: "11px", color: "var(--text-3)" } }, [
                String(r.round_date).slice(0, 10),
                (r.course1 || r.course2) ? ` · ${r.course1 || ""}${r.course2 ? "/" + r.course2 : ""}` : "",
              ].join("")),
            ]),
            A.el("div", { style: { background: bg, color: fg, fontSize: "16px", fontWeight: "600", padding: "4px 14px", borderRadius: "8px", minWidth: "46px", textAlign: "center" } },
              r.total_score != null ? String(r.total_score) : "-"),
          ]),
        ]));
      });
    }

    // ── 홀 스트립 ─────────────────────────────────────────────
    function holeStrip(holes) {
      const A = window.App;
      const cell = (h) => {
        const has = h.score != null && h.par != null;
        const color = has ? Calc.scoreDiffColor(h.score - h.par) : null;
        const dark = color && color !== "#eef1f4" && color !== "#FFF59D";
        return A.el("div", { style: {
          width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "600", borderRadius: "5px", border: "1px solid var(--line)",
          background: color || "#fff", color: dark ? "#fff" : "#333",
        } }, has ? String(h.score - h.par) : "·");
      };
      const grid = (arr) => A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: "3px" } }, arr.map(cell));
      return A.el("div", { style: { margin: "4px 0 8px" } }, [
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "2px 0" } }, "전반"), grid(holes.slice(0, 9)),
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "4px 0 2px" } }, "후반"), grid(holes.slice(9, 18)),
      ]);
    }
  };
})();
})();
