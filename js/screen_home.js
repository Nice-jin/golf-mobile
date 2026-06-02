/* ============================================================
 * screen_home.js - 홈 대시보드
 *   KPI 4카드 + 스코어 추이(미니 차트) + 최근 라운드 + 빠른 시작
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});

  function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }

  // 스코어 등급 → 배지 색
  function scoreBadge(score) {
    const g = Calc.gradeFor("score", score);
    const map = { "잘함": ["#00E676", "#064"], "보통": ["#eef1f4", "#333"], "아쉬움": ["#BA68C8", "#fff"], "노력": ["#FF5252", "#fff"] };
    return map[g] || ["#eef1f4", "#333"];
  }

  Screens.home = function (container) {
    const A = window.App;
    const sum = DB.roundSummary() || {};
    const subParts = [];
    if (sum.n) subParts.push(`총 ${sum.n}회`);
    if (sum.avg_s) subParts.push(`평균 ${round1(sum.avg_s)}`);
    if (sum.min_s) subParts.push(`Best ${sum.min_s}`);
    const dataBtn = A.el("button", { class: "ab-btn", onclick: () => A.go("settings") }, "데이터");
    A.setAppbar([svg("M3 11l9-8 9 8M5 9v11h14V9"), " 골프 라운딩"], subParts.join(" · ") || "라운드를 입력해보세요", dataBtn);

    const kpi = DB.homeKpi();

    // ---- KPI 4카드 ----
    const card = (label, value, hint, color) => A.el("div", {
      style: { background: "#fff", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px 14px" },
    }, [
      A.el("div", { style: { fontSize: "12px", color: "var(--text-2)" } }, label),
      A.el("div", { style: { fontSize: "24px", fontWeight: "700", color: color, lineHeight: "1.2", marginTop: "2px" } }, value),
      hint ? A.el("div", { style: { fontSize: "11px", color: "var(--text-3)" } }, hint) : null,
    ]);
    const kpiGrid = A.el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" } }, [
      card("올해 평균", kpi.yearAvg ? String(round1(kpi.yearAvg)) : "—", kpi.yearCount ? `올해 ${kpi.yearCount}회` : "기록 없음", "#217346"),
      card("최근 10회", kpi.recentAvg ? String(round1(kpi.recentAvg)) : "—", kpi.recentCount ? `최근 ${kpi.recentCount}회` : "", "#185FA5"),
      card("목표 달성률", kpi.goalRate != null ? Math.round(kpi.goalRate) + "%" : "—", `목표 ${kpi.goal}타`, "#b06a00"),
      card("총 라운드", String(kpi.total), kpi.best ? `Best ${kpi.best}` : "", "#6a3fb0"),
    ]);
    container.append(kpiGrid);

    // ---- 스코어 추이 ----
    const trend = DB.scoreTrend(20);
    const chartCard = A.el("div", { class: "card" }, [
      A.el("div", { class: "sec-title" }, "최근 스코어 추이"),
      trend.length ? trendSvg(trend) : A.el("div", { class: "empty", style: { padding: "20px" } }, "데이터 없음"),
    ]);
    container.append(chartCard);

    // ---- 최근 라운드 ----
    const recent = DB.listRounds(5);
    const recCard = A.el("div", { class: "card" }, [A.el("div", { class: "sec-title" }, "최근 라운드")]);
    if (!recent.length) {
      recCard.append(A.el("div", { class: "empty", style: { padding: "16px" } }, "아직 입력된 라운드가 없어요"));
    } else {
      recent.forEach((r) => {
        const [bg, fg] = scoreBadge(r.total_score);
        const row = A.el("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "1px solid var(--line)" },
          onclick: () => A.go("input", { editId: r.id }),
        }, [
          A.el("div", null, [
            A.el("div", { style: { fontSize: "14px" } }, r.cc_name || "-"),
            A.el("div", { style: { fontSize: "11px", color: "var(--text-3)" } }, String(r.round_date).slice(0, 10)),
          ]),
          A.el("div", { style: { background: bg, color: fg, fontSize: "15px", fontWeight: "600", padding: "3px 12px", borderRadius: "8px", minWidth: "44px", textAlign: "center" } }, r.total_score != null ? String(r.total_score) : "-"),
        ]);
        recCard.append(row);
      });
      recCard.lastChild.style.borderBottom = "none";
    }
    container.append(recCard);

    // ---- 빠른 시작 ----
    container.append(A.el("div", { class: "btn-row" }, [
      A.el("button", { class: "btn btn-primary", onclick: () => A.go("input") }, "✏ 새 라운드"),
      A.el("button", { class: "btn btn-ghost", onclick: () => A.go("list") }, "📋 목록"),
      A.el("button", { class: "btn btn-ghost", onclick: () => A.go("stats") }, "📊 통계"),
    ]));
  };

  // ---- 미니 추이 차트 (SVG) ----
  function trendSvg(trend) {
    const A = window.App;
    const W = 300, H = 96, pad = 6;
    const scores = trend.map((t) => t.score);
    const min = Math.min(...scores), max = Math.max(...scores);
    const span = max - min || 1;
    const n = scores.length;
    const x = (i) => n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1);
    const y = (s) => pad + (H - pad * 2) * (1 - (s - min) / span);
    const avg = scores.reduce((a, b) => a + b, 0) / n;
    const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
    const dots = scores.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(s).toFixed(1)}" r="2.6" fill="#217346"/>`).join("");
    const ay = y(avg).toFixed(1);
    const html = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:110px;overflow:visible">
      <line x1="${pad}" y1="${ay}" x2="${W - pad}" y2="${ay}" stroke="#bbb" stroke-width="1" stroke-dasharray="4 3"/>
      <polyline points="${pts}" fill="none" stroke="#217346" stroke-width="2"/>${dots}
      <text x="${W - pad}" y="${(+ay - 4)}" text-anchor="end" font-size="10" fill="#999">평균 ${Math.round(avg * 10) / 10}</text>
    </svg>`;
    const labels = A.el("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-3)", marginTop: "2px" } }, [
      A.el("span", null, trend[0].date.slice(5)),
      A.el("span", null, trend[trend.length - 1].date.slice(5)),
    ]);
    return A.el("div", null, [A.el("div", { html }), labels]);
  }

  function svg(path) {
    const s = document.createElement("span");
    s.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="${path}"/></svg>`;
    return s;
  }
})();
