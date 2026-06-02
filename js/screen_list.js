/* ============================================================
 * screen_list.js - 라운드 목록 (검색 · 펼침 상세 · 수정/삭제)
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
    let filter = "";
    let expanded = null;
    let confirmDel = null;

    A.setAppbar("라운드 목록", "");

    const search = A.el("input", { type: "text", placeholder: "CC·코스 검색 (초성 가능)" });
    search.addEventListener("input", () => { filter = search.value.trim(); paint(); });
    const searchCard = A.el("div", { style: { marginBottom: "12px" } }, [search]);

    const listWrap = A.el("div");
    container.append(searchCard, listWrap);
    paint();

    function paint() {
      const all = DB.listRounds();
      const rows = filter
        ? all.filter((r) => Calc.chosungMatch(filter, (r.cc_name || "") + " " + (r.course1 || "") + " " + (r.course2 || "")))
        : all;
      window.App.setAppbar("라운드 목록", `총 ${all.length}개` + (filter ? ` · 검색 ${rows.length}` : ""));
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
        A.el("div", { style: { background: bg, color: fg, fontSize: "16px", fontWeight: "600", padding: "4px 14px", borderRadius: "8px", minWidth: "46px", textAlign: "center" } }, r.total_score != null ? String(r.total_score) : "-"),
      ]);

      const card = A.el("div", { class: "card", style: { padding: "0", overflow: "hidden" } }, [head]);
      card._round = r;
      if (expanded === r.id) card.append(detailEl(r.id));
      return card;
    }

    // 펼침 후 일부 카드만 다시 그리도록 전체 repaint (단순/안전)
    function paint2() { paint(); }

    function chip(label, value, color) {
      return window.App.el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 4px", background: "#f6f7f9", borderRadius: "8px" } }, [
        window.App.el("div", { style: { fontSize: "11px", color: "var(--text-2)" } }, label),
        window.App.el("div", { style: { fontSize: "15px", fontWeight: "600", color: color || "var(--text)" } }, String(value)),
      ]);
    }

    function detailEl(id) {
      const A = window.App;
      const full = DB.getRoundFull(id);
      const r = full.round;
      const wrap = A.el("div", { style: { borderTop: "1px solid var(--line)", padding: "12px 14px", background: "#fcfcfd" } });

      // 메타
      const meta = [];
      if (r.time_part) meta.push(`${r.time_part}부`);
      if (r.time_text) meta.push(r.time_text);
      if (r.weather) meta.push(r.weather);
      if (r.temp_high != null || r.temp_low != null) meta.push(`${r.temp_high ?? "-"}/${r.temp_low ?? "-"}℃`);
      if (r.play_type) meta.push(r.play_type);
      if (meta.length) wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", marginBottom: "10px" } }, meta.join(" · ")));

      // 스코어 요약
      wrap.append(A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "8px" } }, [
        chip("총", r.total_score ?? "-", "#217346"), chip("전반", r.front_score ?? "-"), chip("후반", r.back_score ?? "-"),
        chip("PAR대비", r.total_score != null && r.total_par ? (r.total_score - r.total_par >= 0 ? "+" : "") + (r.total_score - r.total_par) : "-"),
      ]));
      // 집계
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

      // 홀별 스코어 스트립
      if (full.holes.some((h) => h.score != null)) wrap.append(holeStrip(full.holes));

      // 참석자
      if (full.players.length) {
        wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", margin: "8px 0 4px" } }, "동반자"));
        wrap.append(A.el("div", { style: { fontSize: "13px" } }, full.players.map((p) => p.name + (p.score ? ` ${p.score}타` : "") + (p.note ? ` (${p.note})` : "")).join(", ")));
      }
      // 총평
      if (r.review) {
        wrap.append(A.el("div", { style: { fontSize: "12px", color: "var(--text-2)", margin: "8px 0 4px" } }, "총평"));
        wrap.append(A.el("div", { style: { fontSize: "13px", whiteSpace: "pre-wrap" } }, r.review));
      }

      // 버튼
      const delArea = A.el("div", { style: { flex: "1" } });
      function paintDel() {
        delArea.innerHTML = "";
        if (confirmDel === id) {
          delArea.append(A.el("div", { class: "btn-row" }, [
            A.el("button", { class: "btn btn-line", onclick: () => { confirmDel = null; paintDel(); } }, "취소"),
            A.el("button", { class: "btn", style: { background: "#FF5252", color: "#fff" }, onclick: () => { DB.deleteRound(id); A.toast("삭제됨"); expanded = null; confirmDel = null; paint(); } }, "삭제 확정"),
          ]));
        } else {
          delArea.append(A.el("button", { class: "btn", style: { background: "#fff", color: "#FF5252", border: "1px solid #FF5252" }, onclick: () => { confirmDel = id; paintDel(); } }, "삭제"));
        }
      }
      paintDel();
      wrap.append(A.el("div", { class: "btn-row", style: { marginTop: "12px" } }, [
        A.el("button", { class: "btn btn-primary", onclick: () => A.go("input", { editId: id }) }, "수정"),
        delArea,
      ]));
      return wrap;
    }

    function holeStrip(holes) {
      const A = window.App;
      const cell = (h) => {
        const has = h.score != null && h.par != null;
        const color = has ? Calc.scoreDiffColor(h.score - h.par) : null;
        const dark = color && color !== "#FFFFFF" && color !== "#FFF59D";
        return A.el("div", { style: {
          width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "600", borderRadius: "5px", border: "1px solid var(--line)",
          background: color || "#fff", color: dark ? "#fff" : "#333",
        } }, has ? String(h.score) : "·");
      };
      const grid = (arr) => A.el("div", { style: { display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: "3px" } }, arr.map(cell));
      return A.el("div", { style: { margin: "4px 0 8px" } }, [
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "2px 0" } }, "전반"), grid(holes.slice(0, 9)),
        A.el("div", { style: { fontSize: "11px", color: "var(--text-3)", margin: "4px 0 2px" } }, "후반"), grid(holes.slice(9, 18)),
      ]);
    }
  };
})();
