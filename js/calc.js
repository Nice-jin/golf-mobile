/* ============================================================
 * calc.js - 계산 엔진 (PC config.py + round_input 로직 이식)
 *   - 옵션 상수, 등급기준, 색상
 *   - 자동 스코어 계산, 등급 판정, 셀 색상, 자동 집계
 *   ※ 구역(zone)에서 'B' 제거 → P / O 만 사용
 * ============================================================ */
(function (global) {
  "use strict";

  // ===== 입력 옵션 =====
  const PAR_OPTIONS = [3, 4, 5];
  const TEESHOT_OPTIONS = ["G", "E", "F", "R", "B", "X"]; // Green/Edge/Fairway/Rough/Bunker/X
  const DIRECTION_OPTIONS = ["L", "C", "R", "B"];          // Left/Center/Right/Back
  const ZONE_OPTIONS = ["P", "O"];                          // Penalty / OB  (B 삭제)

  // ===== 등급 기준 (엑셀 성적표 기준 그대로) =====
  const GRADE_LEVELS = ["잘함", "보통", "아쉬움", "노력"];
  const GRADE_CRITERIA = {
    score:     { 잘함: [70, 79], 보통: [80, 85], 아쉬움: [86, 89], 노력: [90, 200] },
    good_tee:  { 잘함: [13, 18], 보통: [10, 12], 아쉬움: [7, 9],  노력: [0, 6] },
    tee_out:   { 잘함: [0, 1],   보통: [2, 2],   아쉬움: [3, 3],  노력: [4, 99] },
    birdie_on: { 잘함: [11, 14], 보통: [8, 10],  아쉬움: [5, 7],  노력: [0, 4] },
    putts:     { 잘함: [25, 31], 보통: [32, 34], 아쉬움: [35, 38], 노력: [39, 99] },
    mulligan:  { 잘함: [0, 0],   보통: [1, 1],   아쉬움: [2, 2],  노력: [3, 99] },
    lost_ball: { 잘함: [0, 1],   보통: [2, 2],   아쉬움: [3, 3],  노력: [4, 99] },
    cost:      { 잘함: [0, 8],   보통: [8, 13],  아쉬움: [13, 18], 노력: [18, 999] },
  };

  // ===== 색상 =====
  const COLORS = {
    잘함: "#00E676", 보통: "#FFFFFF", 아쉬움: "#BA68C8", 노력: "#FF5252",
    best: "#2196F3", header_yellow: "#FFFF00",
  };
  // 스코어 vs PAR 차이별 색상
  const SCORE_DIFF_COLORS = {
    "-2": "#FF9800", "-1": "#2196F3", "0": "#FFFFFF",
    "1": "#FFF59D", "2": "#BA68C8", "3": "#FF5252",
  };
  // 셀 색상 상수
  const CLR_FLUOR = "#00E676", CLR_RED = "#FF5252", CLR_BLUE = "#2196F3", CLR_PURPLE = "#BA68C8";

  // ===== 연도별 목표 (기본값, DB yearly_goals 없을 때 사용) =====
  const YEARLY_GOAL = {
    2025: { avg_score: 78, good_tee_min: 13, lost_ball_max: 2, birdie_on_min: 10,
            birdie_min: 2, putts_max: 31, three_putt_max: 0, triple_max: 0 },
    2026: { avg_score: 85, good_tee_min: 13, lost_ball_max: 2, birdie_on_min: 8,
            birdie_min: 1, putts_max: 34, three_putt_max: 1, triple_max: 0 },
  };

  const TOTAL_PAR = 72, HOLES_PER_ROUND = 18, HOLES_PER_HALF = 9;

  // ===== 숫자 헬퍼 =====
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /* ------------------------------------------------------------
   * 자동 스코어 계산
   *   PC: diff = green_on + putts - par,  score = par + diff = green_on + putts
   *   par·putts·green_on 이 모두 있어야 유효 (PC와 동일 조건)
   *   반환: { score, diff } 또는 { score: null, diff: null }
   * ------------------------------------------------------------ */
  function autoScore(par, greenOn, putts) {
    const p = num(par), g = num(greenOn), pt = num(putts);
    if (!p || !g || !pt) return { score: null, diff: null };
    const score = g + pt;        // 실제 타수
    return { score: score, diff: score - p };
  }

  /* ------------------------------------------------------------
   * 등급 판정 (잘함/보통/아쉬움/노력) - 평균 등 소수값은 반올림 후 비교
   * ------------------------------------------------------------ */
  function gradeFor(field, value) {
    if (value === null || value === undefined) return "-";
    const crit = GRADE_CRITERIA[field];
    if (!crit) return "-";
    const v = Math.round(Number(value));
    for (const g of GRADE_LEVELS) {
      const [lo, hi] = crit[g];
      if (lo <= v && v <= hi) return g;
    }
    return "-";
  }

  // 등급 색상 (0/빈값은 색 없음 → null)
  function gradeColor(field, value) {
    if (value === null || value === undefined || value === 0) return null;
    const crit = GRADE_CRITERIA[field];
    if (!crit) return null;
    for (const g of GRADE_LEVELS) {
      const [lo, hi] = crit[g];
      if (lo <= value && value <= hi) return COLORS[g];
    }
    return null;
  }

  // 등급 → 글자색 (잘함 초록 / 아쉬움 보라 / 노력 빨강, 그 외 기본)
  function gradeColorText(field, value) {
    const g = gradeFor(field, value);
    const map = { "잘함": "#0a8f4d", "아쉬움": "#8e3aa0", "노력": "#d63333" };
    return map[g] || null;
  }

  // 스코어 diff 색상 (-2~3 clamp)
  function scoreDiffColor(diff) {
    if (diff === null || diff === undefined) return null;
    const d = Math.max(-2, Math.min(3, diff));
    return SCORE_DIFF_COLORS[String(d)] || null;
  }

  /* ------------------------------------------------------------
   * 홀 입력 셀 색상 (PC round_input._apply_colors 이식)
   *   반환: { teeshot, zone, lost_ball, green_on, putts, score } (각 hex 또는 null)
   * ------------------------------------------------------------ */
  function holeColors(h) {
    const par = num(h.par), score = num(h.score), putts = num(h.putts), green = num(h.green_on);
    const ts = (h.teeshot || "").toUpperCase();
    const zone = (h.zone || "").toUpperCase();
    const lb = num(h.lost_ball);
    const out = { teeshot: null, zone: null, lost_ball: null, green_on: null, putts: null, score: null };

    // 티샷: F/G = 형광, X = 빨강
    if (ts === "F" || ts === "G") out.teeshot = CLR_FLUOR;
    else if (ts === "X") out.teeshot = CLR_RED;

    // 구역: O = 빨강
    if (zone === "O") out.zone = CLR_RED;

    // LB >= 1 = 빨강
    if (lb && lb >= 1) out.lost_ball = CLR_RED;

    // 버디온: <=par-2 형광, ==par 보라, >par 빨강
    if (green && green > 0 && par) {
      if (green <= par - 2) out.green_on = CLR_FLUOR;
      else if (green === par) out.green_on = CLR_PURPLE;
      else if (green > par) out.green_on = CLR_RED;
    }

    // 퍼트: >=3 빨강, ==0 파랑
    if (putts !== null) {
      if (putts >= 3) out.putts = CLR_RED;
      else if (putts === 0) out.putts = CLR_BLUE;
    }

    // 스코어: diff 색상
    if (par && score !== null) out.score = scoreDiffColor(score - par);

    return out;
  }

  /* ------------------------------------------------------------
   * 라운드 자동 집계 (PC round_input._collect_data 이식)
   *   holes: [{hole_no,par,score,teeshot,direction,zone,mulligan,lost_ball,green_on,putts}]
   *   반환: 집계 dict (rounds 테이블 자동집계 컬럼들)
   * ------------------------------------------------------------ */
  function aggregate(holes) {
    const front = holes.filter((h) => num(h.hole_no) !== null && h.hole_no <= 9);
    const back = holes.filter((h) => h.hole_no >= 10);
    const sumScore = (arr) => arr.reduce((s, h) => s + (num(h.score) || 0), 0);

    const total = sumScore(holes);
    const fSum = sumScore(front);
    const bSum = sumScore(back);
    const totalPar = holes.reduce((s, h) => s + (num(h.par) || 0), 0) || TOTAL_PAR;

    const mulligan = holes.reduce((s, h) => s + (num(h.mulligan) || 0), 0);
    const lostBall = holes.reduce((s, h) => s + (num(h.lost_ball) || 0), 0);
    const putts = holes.reduce((s, h) => s + (num(h.putts) || 0), 0);

    // 버디온 개수: par-2 >= green_on > 0
    const birdieOn = holes.filter((h) => {
      const g = num(h.green_on), p = num(h.par);
      return g && g > 0 && p && g <= p - 2;
    }).length;

    const goodTee = holes.filter((h) => ["G", "F"].includes((h.teeshot || "").toUpperCase())).length;
    const teeOut = holes.filter((h) => ["P", "O"].includes((h.zone || "").toUpperCase())).length;

    let birdie = 0, parC = 0, bogey = 0, triple = 0, threePutt = 0;
    for (const h of holes) {
      const p = num(h.par), s = num(h.score);
      if (p && s) {
        const d = s - p;
        if (d <= -1) birdie++;
        else if (d === 0) parC++;
        else if (d === 1) bogey++;
        else if (d >= 3) triple++;
      }
      if ((num(h.putts) || 0) >= 3) threePutt++;
    }

    return {
      total_score: total || null,
      front_score: fSum || null,
      back_score: bSum || null,
      total_par: totalPar,
      mulligan_total: mulligan,
      lost_ball_total: lostBall,
      birdie_on_total: birdieOn,
      putts_total: putts,
      good_tee_count: goodTee,
      tee_out_count: teeOut,
      birdie_count: birdie,
      par_count: parC,
      bogey_count: bogey,
      triple_count: triple,
      three_putt_count: threePutt,
    };
  }

  // 실시간 요약(입력 중 하단 바) — 저장 전 미리보기용
  function liveSummary(holes) {
    const a = aggregate(holes);
    return {
      total: a.total_score || 0, front: a.front_score || 0, back: a.back_score || 0,
      putts: a.putts_total || 0, birdie: a.birdie_count || 0, par: a.par_count || 0,
      bogey: a.bogey_count || 0, triple: a.triple_count || 0,
    };
  }

  // 참석자 텍스트 파싱: "이름 88타 비고" → {name, score, note}  (PC 정규식 이식)
  function parsePlayer(text) {
    const t = (text || "").trim();
    if (!t) return null;
    const m = t.match(/^(\S+)\s*(\d+)?\s*타?\s*(.*)$/);
    if (m) {
      return { name: m[1], score: m[2] ? parseInt(m[2], 10) : null, note: (m[3] || "").trim() };
    }
    return { name: t, score: null, note: "" };
  }

  // 초성 자동완성 유틸 (PC ChosungCompleter 이식)
  const CHOSUNG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const CHOSET = new Set(CHOSUNG);
  function getChosung(text) {
    let r = "";
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) r += CHOSUNG[Math.floor((code - 0xAC00) / (21 * 28))];
      else r += ch;
    }
    return r;
  }
  function chosungMatch(query, candidate) {
    const q = (query || "").trim();
    if (!q) return true;
    const onlyCho = [...q].every((c) => c.trim() === "" || CHOSET.has(c));
    if (onlyCho) return getChosung(candidate).startsWith(q);
    return candidate.toLowerCase().includes(q.toLowerCase());
  }

  global.Calc = {
    PAR_OPTIONS, TEESHOT_OPTIONS, DIRECTION_OPTIONS, ZONE_OPTIONS,
    GRADE_LEVELS, GRADE_CRITERIA, COLORS, SCORE_DIFF_COLORS, YEARLY_GOAL,
    TOTAL_PAR, HOLES_PER_ROUND, HOLES_PER_HALF,
    num, autoScore, gradeFor, gradeColor, gradeColorText, scoreDiffColor, holeColors,
    aggregate, liveSummary, parsePlayer, getChosung, chosungMatch,
  };
})(typeof window !== "undefined" ? window : this);
