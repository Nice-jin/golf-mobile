/* ============================================================
 * screen_settings.js - 데이터 백업/복원(병합) · 앱 정보
 *   내보내기: 현재 DB를 .db 파일로 저장 → PC로 전달
 *   가져오기: PC(또는 다른 폰)의 .db 를 골라 신규/변경분만 병합
 * ============================================================ */
(function () {
  "use strict";
  const Screens = (window.Screens = window.Screens || {});

  function today() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

  Screens.settings = function (container) {
    const A = window.App;
    const back = A.el("button", { class: "ab-btn", onclick: () => A.go("home") }, "← 홈");
    A.setAppbar("데이터 · 설정", "", back);

    // ---- 백업/복원 ----
    const exportBtn = A.el("button", { class: "btn btn-primary", onclick: doExport }, "📤 내보내기 (.db 저장)");
    const fileInput = A.el("input", { type: "file", accept: ".db,.sqlite,.sqlite3,application/octet-stream,application/x-sqlite3", style: { display: "none" } });
    fileInput.addEventListener("change", doImport);
    const importBtn = A.el("button", { class: "btn btn-ghost", onclick: () => fileInput.click() }, "📥 가져오기 (병합)");

    container.append(A.el("div", { class: "card" }, [
      A.el("div", { class: "sec-title" }, "데이터 백업 / 복원"),
      A.el("div", { style: { fontSize: "13px", color: "var(--text-2)", marginBottom: "12px", lineHeight: "1.6" } },
        "내보내기로 저장한 .db 파일을 PC 프로그램의 폴더에 두고 병합 스크립트를 돌리면, 신규 라운드만 골라 합쳐집니다. 반대로 PC에서 받은 .db를 가져오면 폰에 신규/변경분만 병합됩니다."),
      exportBtn,
      A.el("div", { style: { height: "10px" } }),
      importBtn, fileInput,
    ]));

    // ---- 현황 ----
    const n = DB.count("rounds");
    container.append(A.el("div", { class: "card" }, [
      A.el("div", { class: "sec-title" }, "현황"),
      A.el("div", { style: { fontSize: "14px" } }, `저장된 라운드: ${n}개`),
    ]));

    // ---- 앱 정보 ----
    container.append(A.el("div", { class: "card" }, [
      A.el("div", { class: "sec-title" }, "앱 정보"),
      A.el("div", { style: { fontSize: "13px", color: "var(--text-2)", lineHeight: "1.7" } },
        ["골프 라운딩 관리 (모바일) v1.0", "오프라인 동작 · 데이터는 이 기기에 저장됩니다", "© 2026"].map((t) => A.el("div", null, t))),
    ]));

    // ---- 동작 ----
    function doExport() {
      try {
        const bytes = DB.exportBytes();
        const blob = new Blob([bytes], { type: "application/x-sqlite3" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `golf_rounds_${today()}.db`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        A.toast("내보내기 완료");
      } catch (e) { A.toast("내보내기 실패: " + e.message); }
    }

    function doImport(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const res = DB.importMerge(new Uint8Array(reader.result));
          A.toast(`병합: 추가 ${res.added} · 갱신 ${res.updated} · 중복 ${res.skipped}`);
          Screens.settings(clearAndGet());   // 현황 갱신
        } catch (e) { A.toast("가져오기 실패: " + e.message); }
      };
      reader.onerror = () => A.toast("파일 읽기 실패");
      reader.readAsArrayBuffer(file);
      ev.target.value = "";
    }
    function clearAndGet() { const c = window.App.$("#screen"); c.innerHTML = ""; return c; }
  };
})();
