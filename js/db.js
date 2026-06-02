/* ============================================================
 * db.js - SQLite(sql.js) 데이터 계층
 *   - PC golf_rounds.db 와 동일한 스키마 (rounds/holes/players/costs/yearly_goals)
 *   - 브라우저 IndexedDB 에 .db 바이트 영속화 (오프라인)
 *   - CRUD · 자동완성/PAR 조회 · 통계 쿼리 · 내보내기 · 병합 가져오기
 *   의존: js/calc.js (window.Calc), sql.js (initSqlJs, CDN)
 * ============================================================ */
(function (global) {
  "use strict";

  // sql.js wasm 위치: 앱에 내장된 vendor 폴더 (오프라인 동작)
  const SQLJS_CDN = "vendor";

  // PC schema.sql 과 동일 (구역 의미만 P/O 로 사용)
  const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_date DATE NOT NULL, cc_name TEXT, course1 TEXT, course2 TEXT,
    weather TEXT, temp_high INTEGER, temp_low INTEGER,
    time_part INTEGER, time_text TEXT, play_type TEXT,
    event_note TEXT, green_status TEXT, cart_status TEXT, caddie_status TEXT, etc_note TEXT,
    total_score INTEGER, front_score INTEGER, back_score INTEGER, total_par INTEGER DEFAULT 72,
    review TEXT,
    good_tee_count INTEGER DEFAULT 0, tee_out_count INTEGER DEFAULT 0,
    mulligan_total INTEGER DEFAULT 0, lost_ball_total INTEGER DEFAULT 0,
    birdie_on_total INTEGER DEFAULT 0, putts_total INTEGER DEFAULT 0,
    triple_count INTEGER DEFAULT 0, three_putt_count INTEGER DEFAULT 0,
    birdie_count INTEGER DEFAULT 0, par_count INTEGER DEFAULT 0, bogey_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS holes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL,
    hole_no INTEGER NOT NULL, par INTEGER, score INTEGER,
    teeshot TEXT, direction TEXT, zone TEXT,
    mulligan INTEGER DEFAULT 0, lost_ball INTEGER DEFAULT 0,
    green_on INTEGER DEFAULT 0, putts INTEGER, memo TEXT,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    UNIQUE(round_id, hole_no)
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL,
    seq INTEGER NOT NULL, name TEXT, score INTEGER, note TEXT,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER NOT NULL UNIQUE,
    green_fee REAL DEFAULT 0, cart_fee REAL DEFAULT 0, caddie_fee REAL DEFAULT 0,
    etc_cost REAL DEFAULT 0, event_cost REAL DEFAULT 0, total_cost REAL DEFAULT 0,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS yearly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, year INTEGER NOT NULL UNIQUE,
    avg_score REAL, good_tee_min INTEGER, lost_ball_max INTEGER, birdie_on_min INTEGER,
    birdie_min INTEGER, putts_max INTEGER, three_putt_max INTEGER, triple_max INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_rounds_date ON rounds(round_date);
  CREATE INDEX IF NOT EXISTS idx_rounds_cc ON rounds(cc_name);
  CREATE INDEX IF NOT EXISTS idx_holes_round ON holes(round_id);
  CREATE INDEX IF NOT EXISTS idx_players_round ON players(round_id);
  `;

  // rounds INSERT 컬럼 순서
  const ROUND_COLS = [
    "round_date","cc_name","course1","course2","weather","temp_high","temp_low",
    "time_part","time_text","play_type","event_note","green_status","cart_status",
    "caddie_status","etc_note","total_score","front_score","back_score","total_par","review",
    "good_tee_count","tee_out_count","mulligan_total","lost_ball_total","birdie_on_total",
    "putts_total","triple_count","three_putt_count","birdie_count","par_count","bogey_count",
  ];

  let _db = null;       // sql.js Database
  let _SQL = null;      // sql.js module
  let _saveTimer = null;

  // ---------- IndexedDB 영속화 ----------
  const IDB_NAME = "golf_mobile", IDB_STORE = "kv", IDB_KEY = "dbfile";
  function idbOpen() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  async function idbGet() {
    const idb = await idbOpen();
    return new Promise((res, rej) => {
      const tx = idb.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
      tx.onsuccess = () => res(tx.result || null);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbPut(bytes) {
    const idb = await idbOpen();
    return new Promise((res, rej) => {
      const tx = idb.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.onsuccess = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  function persist(immediate) {
    if (!_db) return;
    const doSave = async () => {
      try { await idbPut(_db.export()); }
      catch (e) { console.error("[db] persist error", e); }
    };
    if (immediate) return doSave();
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(doSave, 300);
  }

  // ---------- 쿼리 헬퍼 ----------
  function clean(arr) { return arr.map((v) => (v === undefined ? null : v)); }
  function query(sql, params) {
    const stmt = _db.prepare(sql);
    if (params && params.length) stmt.bind(clean(params));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  function get(sql, params) { const r = query(sql, params); return r[0] || null; }
  function run(sql, params) { _db.run(sql, params ? clean(params) : []); }
  function lastId() { return get("SELECT last_insert_rowid() AS id").id; }
  function count(table) { return get(`SELECT COUNT(*) AS n FROM ${table}`).n; }

  // ---------- 초기화 ----------
  async function init() {
    if (_db) return _db;
    _SQL = await initSqlJs({ locateFile: (f) => `${SQLJS_CDN}/${f}` });
    const saved = await idbGet();
    _db = saved ? new _SQL.Database(new Uint8Array(saved)) : new _SQL.Database();
    _db.run("PRAGMA foreign_keys = ON;");
    _db.run(SCHEMA);
    if (!saved) await persist(true);
    return _db;
  }

  // ---------- 저장 (신규/수정) ----------
  function _roundValues(r, agg) {
    return [
      r.round_date, r.cc_name || "", r.course1 || "", r.course2 || "", r.weather || "",
      Calc.num(r.temp_high), Calc.num(r.temp_low), Calc.num(r.time_part), r.time_text || "",
      r.play_type || "", r.event_note || "", r.green_status || "", r.cart_status || "",
      r.caddie_status || "", r.etc_note || "",
      agg.total_score, agg.front_score, agg.back_score, agg.total_par, r.review || "",
      agg.good_tee_count, agg.tee_out_count, agg.mulligan_total, agg.lost_ball_total,
      agg.birdie_on_total, agg.putts_total, agg.triple_count, agg.three_putt_count,
      agg.birdie_count, agg.par_count, agg.bogey_count,
    ];
  }

  function _insertChildren(rid, bundle) {
    for (const h of bundle.holes || []) {
      run(`INSERT INTO holes (round_id,hole_no,par,score,teeshot,direction,zone,mulligan,lost_ball,green_on,putts,memo)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [rid, h.hole_no, Calc.num(h.par), Calc.num(h.score), h.teeshot || "", h.direction || "",
         h.zone || "", Calc.num(h.mulligan) || 0, Calc.num(h.lost_ball) || 0,
         Calc.num(h.green_on) || 0, Calc.num(h.putts), h.memo || ""]);
    }
    for (const p of bundle.players || []) {
      if (!p.name) continue;
      run(`INSERT INTO players (round_id,seq,name,score,note) VALUES (?,?,?,?,?)`,
        [rid, p.seq, p.name, Calc.num(p.score), p.note || ""]);
    }
    const c = bundle.cost || {};
    const total = (Calc.num(c.green_fee) || 0) + (Calc.num(c.cart_fee) || 0) + (Calc.num(c.caddie_fee) || 0)
      + (Calc.num(c.etc_cost) || 0) + (Calc.num(c.event_cost) || 0);
    run(`INSERT INTO costs (round_id,green_fee,cart_fee,caddie_fee,etc_cost,event_cost,total_cost)
         VALUES (?,?,?,?,?,?,?)`,
      [rid, Calc.num(c.green_fee) || 0, Calc.num(c.cart_fee) || 0, Calc.num(c.caddie_fee) || 0,
       Calc.num(c.etc_cost) || 0, Calc.num(c.event_cost) || 0, Math.round(total * 100) / 100]);
  }

  function saveRound(bundle) {
    const agg = Calc.aggregate(bundle.holes || []);
    const ph = ROUND_COLS.map(() => "?").join(",");
    run(`INSERT INTO rounds (${ROUND_COLS.join(",")}) VALUES (${ph})`, _roundValues(bundle.round, agg));
    const rid = lastId();
    _insertChildren(rid, bundle);
    persist();
    return rid;
  }

  function updateRound(id, bundle) {
    // 라운드 행은 UPDATE(id·created_at 유지), 자식은 명시적 삭제 후 재삽입
    const agg = Calc.aggregate(bundle.holes || []);
    const setClause = ROUND_COLS.map((c) => `${c}=?`).join(",");
    run(`UPDATE rounds SET ${setClause}, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [..._roundValues(bundle.round, agg), id]);
    run("DELETE FROM holes WHERE round_id=?", [id]);
    run("DELETE FROM players WHERE round_id=?", [id]);
    run("DELETE FROM costs WHERE round_id=?", [id]);
    _insertChildren(id, bundle);
    persist();
    return id;
  }

  function deleteRound(id) {
    run("DELETE FROM holes WHERE round_id=?", [id]);
    run("DELETE FROM players WHERE round_id=?", [id]);
    run("DELETE FROM costs WHERE round_id=?", [id]);
    run("DELETE FROM rounds WHERE id=?", [id]);
    persist();
  }

  // ---------- 조회 ----------
  function getRound(id) { return get("SELECT * FROM rounds WHERE id=?", [id]); }
  function getRoundFull(id) {
    return {
      round: getRound(id),
      holes: query("SELECT * FROM holes WHERE round_id=? ORDER BY hole_no", [id]),
      players: query("SELECT * FROM players WHERE round_id=? ORDER BY seq", [id]),
      cost: get("SELECT * FROM costs WHERE round_id=?", [id]),
    };
  }
  function listRounds(limit) {
    const sql = "SELECT r.*, c.total_cost FROM rounds r LEFT JOIN costs c ON c.round_id=r.id "
      + "ORDER BY r.round_date DESC, r.id DESC" + (limit ? ` LIMIT ${parseInt(limit, 10)}` : "");
    return query(sql);
  }

  // ---------- 자동완성 / PAR 조회 ----------
  function distinct(col, table) {
    return query(`SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`)
      .map((r) => r.v);
  }
  function ccList() { return distinct("cc_name", "rounds"); }
  function courseList() {
    const a = distinct("course1", "rounds"), b = distinct("course2", "rounds");
    return [...new Set([...a, ...b])].sort();
  }
  function playerNames() { return distinct("name", "players"); }
  function parMapForCourse(cc, c1, c2) {
    if (!cc || !c1 || !c2) return null;
    const rows = query(
      `SELECT h.hole_no, h.par FROM holes h JOIN rounds r ON h.round_id=r.id
       WHERE r.cc_name=? AND r.course1=? AND r.course2=? AND h.par IS NOT NULL
       ORDER BY r.round_date DESC, h.hole_no ASC`, [cc, c1, c2]);
    if (!rows.length) return null;
    const map = {};
    for (const r of rows) if (!(r.hole_no in map)) map[r.hole_no] = r.par;
    return map;
  }

  // ---------- 통계 ----------
  function homeKpi(year) {
    const yr = String(year || new Date().getFullYear());
    const yRow = get("SELECT AVG(total_score) AS a, COUNT(*) AS n FROM rounds WHERE total_score>0 AND strftime('%Y',round_date)=?", [yr]);
    const recent = query("SELECT total_score FROM rounds WHERE total_score>0 ORDER BY round_date DESC LIMIT 10");
    const recentAvg = recent.length ? recent.reduce((s, r) => s + r.total_score, 0) / recent.length : null;
    const goalRow = get("SELECT avg_score FROM yearly_goals WHERE year=?", [parseInt(yr, 10)]);
    const goal = goalRow ? goalRow.avg_score : (Calc.YEARLY_GOAL[yr] ? Calc.YEARLY_GOAL[yr].avg_score : 85);
    const best = get("SELECT MIN(total_score) AS m FROM rounds WHERE total_score>0");
    return {
      yearAvg: yRow && yRow.a ? yRow.a : null,
      yearCount: yRow ? yRow.n : 0,
      recentAvg: recentAvg,
      recentCount: recent.length,
      goal: goal,
      goalRate: yRow && yRow.a ? Math.min(100, (goal / yRow.a) * 100) : null,
      best: best ? best.m : null,
      total: count("rounds"),
    };
  }
  function scoreTrend(limit) {
    const rows = query("SELECT round_date, total_score FROM rounds WHERE total_score>0 ORDER BY round_date DESC LIMIT ?", [limit || 20]);
    return rows.reverse().map((r) => ({ date: String(r.round_date).slice(0, 10), score: r.total_score }));
  }
  function holeWeakness() {
    const rows = query(`
      SELECT hole_no, COUNT(*) AS n, AVG(score-par) AS avg_diff, AVG(par) AS avg_par,
             SUM(CASE WHEN UPPER(zone) IN ('P','O') THEN 1 ELSE 0 END) AS ob_count,
             SUM(CASE WHEN putts>=3 THEN 1 ELSE 0 END) AS three_putt
      FROM holes WHERE par IS NOT NULL AND score IS NOT NULL
      GROUP BY hole_no ORDER BY hole_no`);
    return rows.map((r) => ({
      hole: r.hole_no, n: r.n, avg_diff: r.avg_diff || 0, avg_par: r.avg_par || 0,
      ob_rate: r.n ? (r.ob_count / r.n) * 100 : 0,
      three_putt_rate: r.n ? (r.three_putt / r.n) * 100 : 0,
    }));
  }
  function byPlayer(minRounds) {
    return query(`
      SELECT p.name AS name, COUNT(*) AS n, AVG(r.total_score) AS avg_my,
             AVG(p.score) AS avg_player, MIN(r.total_score) AS best_my
      FROM players p JOIN rounds r ON r.id=p.round_id
      WHERE r.total_score>0 AND p.name IS NOT NULL AND p.name!=''
      GROUP BY p.name HAVING COUNT(*)>=? ORDER BY n DESC, avg_my ASC`, [minRounds || 1]);
  }
  function roundSummary() {
    return get(`SELECT COUNT(*) AS n, AVG(total_score) AS avg_s, MIN(total_score) AS min_s, MAX(total_score) AS max_s,
                AVG(good_tee_count) AS gt, AVG(tee_out_count) AS to_, AVG(birdie_on_total) AS bo,
                AVG(putts_total) AS pt, AVG(mulligan_total) AS m, AVG(lost_ball_total) AS lb,
                AVG(birdie_count) AS bd, AVG(par_count) AS par_c, AVG(bogey_count) AS bg,
                AVG(triple_count) AS tp, AVG(three_putt_count) AS tputt
                FROM rounds WHERE total_score>0`);
  }

  // ---------- 연도별 목표 ----------
  function getGoal(year) { return get("SELECT * FROM yearly_goals WHERE year=?", [year]); }
  function setGoal(g) {
    run(`INSERT INTO yearly_goals (year,avg_score,good_tee_min,lost_ball_max,birdie_on_min,birdie_min,putts_max,three_putt_max,triple_max)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(year) DO UPDATE SET avg_score=excluded.avg_score, good_tee_min=excluded.good_tee_min,
           lost_ball_max=excluded.lost_ball_max, birdie_on_min=excluded.birdie_on_min, birdie_min=excluded.birdie_min,
           putts_max=excluded.putts_max, three_putt_max=excluded.three_putt_max, triple_max=excluded.triple_max`,
      [g.year, g.avg_score, g.good_tee_min, g.lost_ball_max, g.birdie_on_min, g.birdie_min, g.putts_max, g.three_putt_max, g.triple_max]);
    persist();
  }

  // ---------- 내보내기 / 가져오기(병합) ----------
  function exportBytes() { return _db.export(); }          // → .db 파일 (Uint8Array)

  function signature(r) {
    return [String(r.round_date).slice(0, 10), r.cc_name || "", r.time_part || "", r.time_text || ""].join("|");
  }
  function existingSignatures() {
    const map = {};
    for (const r of query("SELECT id, round_date, cc_name, time_part, time_text, updated_at FROM rounds"))
      map[signature(r)] = { id: r.id, updated_at: r.updated_at || "" };
    return map;
  }

  // 다른 .db 바이트를 병합: 신규 추가 + (updated_at 더 최신이면) 갱신
  function importMerge(bytes) {
    const other = new _SQL.Database(new Uint8Array(bytes));
    const readAll = (db, sql, p) => {
      const st = db.prepare(sql); if (p) st.bind(p);
      const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out;
    };
    const sigs = existingSignatures();
    let added = 0, updated = 0, skipped = 0;
    const rounds = readAll(other, "SELECT * FROM rounds");
    for (const r of rounds) {
      const sig = signature(r);
      const ex = sigs[sig];
      const bundle = {
        round: r,
        holes: readAll(other, "SELECT * FROM holes WHERE round_id=? ORDER BY hole_no", [r.id]),
        players: readAll(other, "SELECT * FROM players WHERE round_id=? ORDER BY seq", [r.id]),
        cost: readAll(other, "SELECT * FROM costs WHERE round_id=?", [r.id])[0] || {},
      };
      if (!ex) { saveRound(bundle); added++; }
      else if ((r.updated_at || "") > (ex.updated_at || "")) { updateRound(ex.id, bundle); updated++; }
      else { skipped++; }
    }
    other.close();
    persist(true);
    return { added, updated, skipped, total: rounds.length };
  }

  global.DB = {
    init, saveRound, updateRound, deleteRound,
    getRound, getRoundFull, listRounds, count,
    ccList, courseList, playerNames, parMapForCourse,
    homeKpi, scoreTrend, holeWeakness, byPlayer, roundSummary,
    getGoal, setGoal, exportBytes, importMerge, persist,
    query, get, run,
  };
})(typeof window !== "undefined" ? window : this);
