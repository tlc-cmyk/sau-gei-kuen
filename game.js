/* 收機拳 — 原創瀏覽器小遊戲（美術、規則實作、音效皆為原創） */
(function () {
  "use strict";

  const A = window.SauGeiAudio;
  const BEST_KEY = "sau-gei-kuen-best";
  const HINT_KEY = "sau-gei-kuen-hint-v1";
  const RUN_SECONDS = 60;
  const COOLDOWN = 0.72;

  const C = {
    paper: "#f3ead8",
    paperDeep: "#e8dcc6",
    ink: "#2c241c",
    inkSoft: "rgba(44,36,28,0.55)",
    inkFaint: "rgba(44,36,28,0.18)",
    building: "#efe4d2",
    buildingAlt: "#e7d6ba",
    buildingDeep: "#d9c6a8",
    window: "#d7c7aa",
    windowLit: "#efe6d4",
    awningA: "#7a3e32",
    awningB: "#3f5c3d",
    awningC: "#c46a3a",
    pavement: "#e6d9c3",
    pavementLine: "#d0c0a4",
    curb: "#d8cbb3",
    sleeve: "#3f5c3d",
    sleeveDark: "#2c432b",
    cuff: "#f0e6d2",
    cuffStripe: "#c46a3a",
    skin: "#f0c49a",
    skinShadow: "#d9a87a",
    scoreFill: "#f7f1e6",
    watch: "#2c241c",
    watchFace: "#f7f1e6",
  };

  const PHONE_COLORS = ["#f2a3a3", "#8fd3c4", "#f3d37a", "#c5b3e6", "#f7f1e6", "#7ec4e3", "#e8a066", "#9ec27c"];
  const BODY_COLORS = ["#2e2a26", "#5a4d40", "#6a4634", "#3d4a3a", "#4a3d4a", "#7a5a3a", "#4d555c", "#8a6a5a", "#3a3f4a"];
  const BUBBLES = ["喂，聽唔聽到", "而家拍緊", "幾點到", "睇緊直播", "等陣先", "訊號好差", "你喺邊度", "轉車未？", "得，即刻過嚟"];
  const TICKER_LABEL = "股票";

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const el = {
    hud: document.getElementById("hud"),
    title: document.getElementById("screen-title"),
    result: document.getElementById("screen-result"),
    start: document.getElementById("btn-start"),
    retry: document.getElementById("btn-retry"),
    home: document.getElementById("btn-home"),
    muteTitle: document.getElementById("btn-mute-title"),
    mutePlay: document.getElementById("btn-mute-play"),
    muteResult: document.getElementById("btn-mute-result"),
    grade: document.getElementById("result-grade"),
    score: document.getElementById("result-score"),
    best: document.getElementById("result-best"),
    blurb: document.getElementById("result-blurb"),
    rotate: document.getElementById("rotate-hint"),
  };

  let W = 390, H = 844, dpr = 1, safeTop = 0, safeBottom = 0;
  let paper = null, paperW = 0, paperH = 0;
  let mode = "title"; // title | play | result
  let lastT = 0;
  let timeLeft = RUN_SECONDS;
  let score = 0;
  let aimX = 0.5;
  let pointerDown = false;
  let cooldown = 0;
  let fist = null;
  let people = [];
  let flyers = [];
  let puffs = [];
  let floaters = [];
  let shake = 0;
  let spawnT = 0;
  let city = null;
  let stopX = 0.72;
  let ticker = -12;
  let tickerFlash = 0;
  let tickerDelta = 0;
  let hintT = 0;
  let showHint = true;
  let walkersOnTitle = true;
  let endedHold = 0;
  let frozen = false;
  let clock = 0;
  let multiHits = 0;
  let punches = 0;
  let bumps = 0;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function irand(a, b) {
    return (a + Math.floor(Math.random() * (b - a + 1)));
  }
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeIn(t) {
    return t * t * t;
  }
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function getBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; }
    catch (e) { return 0; }
  }
  function setBest(n) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* ignore */ }
  }
  function hintSeen() {
    try { return localStorage.getItem(HINT_KEY) === "1"; } catch (e) { return false; }
  }
  function markHint() {
    try { localStorage.setItem(HINT_KEY, "1"); } catch (e) { /* ignore */ }
  }

  function safeInsets() {
    const probe = document.getElementById("safe-probe");
    const top = probe ? probe.getBoundingClientRect().height : 0;
    const cs = getComputedStyle(document.documentElement);
    const toPx = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    safeTop = Math.max(top, toPx(cs.getPropertyValue("--sat")) , 0);
    const vv = window.visualViewport;
    const app = document.getElementById("app");
    const rect = app.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    if (vv && vv.height) {
      // keep canvas covering the app box
    }
    safeBottom = toPx(getComputedStyle(document.body).paddingBottom) || 0;
    // env safe area via a dummy
    const tmp = document.createElement("div");
    tmp.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
    document.body.appendChild(tmp);
    safeBottom = tmp.getBoundingClientRect().height || 0;
    tmp.remove();
  }

  function resize() {
    safeInsets();
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildPaper();
    buildCity();
    if (!fist) resetFist(true);
    updateRotate();
  }

  function updateRotate() {
    const landscape = W > H * 1.15 && W > 560;
    el.rotate.classList.toggle("hidden", !landscape);
  }

  function buildPaper() {
    if (paper && paperW === W && paperH === H) return;
    paperW = W; paperH = H;
    paper = document.createElement("canvas");
    paper.width = Math.round(W * dpr);
    paper.height = Math.round(H * dpr);
    const g = paper.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, H);
    // grain
    const n = Math.floor(W * H * 0.08);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const a = Math.random() * 0.07;
      g.fillStyle = Math.random() < 0.5 ? "rgba(80,60,40," + a + ")" : "rgba(255,250,240," + a + ")";
      g.fillRect(x, y, 1.2, 1.2);
    }
    // faint fibres
    g.globalAlpha = 0.035;
    g.strokeStyle = C.ink;
    g.lineWidth = 0.6;
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      const y = Math.random() * H;
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + rand(-8, 8), W * 0.7, y + rand(-8, 8), W, y + rand(-6, 6));
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function buildCity() {
    const facade = facadeY();
    const buildings = [];
    let x = -W * 0.04;
    const specs = [
      { w: 0.22, h: 0.50, kind: "tong", awning: "A", sign: "冰室" },
      { w: 0.18, h: 0.68, kind: "tower", awning: null, sign: null },
      { w: 0.26, h: 0.46, kind: "shop", awning: "B", sign: "文具" },
      { w: 0.20, h: 0.58, kind: "tong", awning: "C", sign: "茶記" },
      { w: 0.24, h: 0.42, kind: "low", awning: "A", sign: "花店" },
    ];
    const totalW = specs.reduce((s, b) => s + b.w, 0);
    specs.forEach((s) => {
      const bw = (s.w / totalW) * W * 1.08;
      buildings.push({
        x: x,
        w: bw,
        h: s.h * (facade - safeTop - 36),
        kind: s.kind,
        awning: s.awning,
        sign: s.sign,
        seed: Math.random() * 1000,
      });
      x += bw - 2;
    });
    // bus stop stands on the sidewalk, a little in front of the 茶記
    stopX = buildings[3] ? buildings[3].x + buildings[3].w * 0.15 : W * 0.68;
    city = { buildings, facade };
  }

  function facadeY() {
    return H * 0.628;
  }
  function groundY() {
    return H * 0.818;
  }
  function curbY() {
    return H * 0.858;
  }
  function tickerY() {
    return H - safeBottom - Math.max(28, H * 0.068);
  }
  function unit() {
    return Math.min(W / 390, H / 844);
  }

  function sidewalkDepth() {
    return groundY() - facadeY();
  }

  function laneY(lane) {
    const f = facadeY();
    const d = sidewalkDepth();
    // 0 back (near shops), 2 front (near curb)
    const t = 0.30 + lane * 0.32; // 0.30, 0.62, 0.94
    return f + d * t;
  }

  function laneScale(lane) {
    return 0.88 + lane * 0.08;
  }

  function resetFist(hide) {
    fist = {
      x: aimX * W,
      y: -40,
      state: hide ? "idle" : "idle",
      t: 0,
      drop: 0.20,
      hold: 0.05,
      retract: 0.28,
      hits: 0,
      bumped: new Set(),
    };
  }

  function hairStyles() {
    return ["bun", "short", "ponytail", "cap", "bob", "spiky", "long", "buzz", "twin", "band"];
  }

  function makePerson(fromLeft, onscreen) {
    const u = unit();
    const lane = irand(0, 2);
    const tall = rand(0.82, 1.18);
    if (Math.random() < 0.1) {
      // child
    }
    const isChild = Math.random() < 0.12;
    const scale = laneScale(lane);
    const h = (isChild ? rand(58, 72) : rand(86, 118)) * u * (isChild ? 1 : tall) * scale;
    const dir = fromLeft ? 1 : -1;
    const speed = rand(38, 78) * u * (isChild ? 0.85 : 1) * (0.85 + lane * 0.08);
    const roleRoll = Math.random();
    let role = "phone"; // looking down at phone
    if (roleRoll < 0.16) role = "empty";
    else if (roleRoll < 0.28) role = "talk"; // talking to air / friend, no phone in hand as target? some on call
    else if (roleRoll < 0.40) role = "call"; // phone to ear — still a valid target

    // later in the run, slightly more phones
    if (mode === "play" && timeLeft < 25 && role === "empty" && Math.random() < 0.5) role = "phone";

    const p = {
      id: Math.random().toString(36).slice(2, 8),
      x: onscreen ? rand(W * 0.08, W * 0.92) : (fromLeft ? -40 : W + 40),
      lane,
      feet: laneY(lane),
      h,
      dir,
      speed,
      phase: rand(0, Math.PI * 2),
      pace: rand(5.5, 8.2),
      body: pick(BODY_COLORS),
      hair: pick(hairStyles()),
      hairColor: Math.random() < 0.25 ? "#d8c4a0" : (Math.random() < 0.5 ? "#2c241c" : "#4a3428"),
      role,
      phoneColor: pick(PHONE_COLORS),
      bag: Math.random() < 0.28 ? pick(["tote", "backpack", "none"]) : "none",
      skirt: Math.random() < 0.3,
      flinch: 0,
      lookUp: 0,
      shocked: 0,
      phoneless: false,
      bubble: null,
      bubbleT: 0,
      passedStop: false,
      hit: false,
      bumped: false,
      armSwing: rand(0, Math.PI * 2),
    };
    if (p.role === "talk" && Math.random() < 0.7) {
      p.bubble = pick(BUBBLES);
      p.bubbleT = rand(2.5, 5);
    }
    return p;
  }

  function phoneBox(p) {
    if (p.phoneless || p.hit) return null;
    if (p.role !== "phone" && p.role !== "call") return null;
    const u = unit();
    const facing = p.dir;
    const handY = p.role === "call"
      ? p.feet - p.h * 0.82
      : p.feet - p.h * 0.52;
    const handX = p.role === "call"
      ? p.x + facing * p.h * 0.18
      : p.x + facing * p.h * 0.22;
    const pw = 16 * u;
    const ph = 26 * u;
    return {
      x: handX - pw / 2,
      y: handY - ph / 2,
      w: pw,
      h: ph,
      cx: handX,
      cy: handY,
    };
  }

  function bodyBox(p) {
    return {
      x: p.x - p.h * 0.16,
      y: p.feet - p.h * 0.92,
      w: p.h * 0.32,
      h: p.h * 0.92,
    };
  }

  function fistHandBox() {
    const u = unit();
    const hw = clamp(W * 0.26, 86, 168);
    const hh = hw * 0.88;
    const bottom = fist.y;
    return { x: fist.x - hw * 0.5, y: bottom - hh, w: hw, h: hh, hw, hh };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function seedStreet(n) {
    people = [];
    for (let i = 0; i < n; i++) {
      const p = makePerson(Math.random() < 0.5, true);
      people.push(p);
    }
  }

  function startRun() {
    mode = "play";
    frozen = false;
    timeLeft = RUN_SECONDS;
    score = 0;
    cooldown = 0;
    flyers = [];
    puffs = [];
    floaters = [];
    shake = 0;
    spawnT = 0.2;
    ticker = -12 + rand(-1.5, 1.5);
    tickerFlash = 0;
    tickerDelta = 0;
    endedHold = 0;
    multiHits = 0;
    punches = 0;
    bumps = 0;
    clock = 0;
    showHint = !hintSeen();
    hintT = showHint ? 5.5 : 0;
    resetFist(true);
    fist.x = aimX * W;
    seedStreet(7);
    el.title.classList.add("hidden");
    el.result.classList.add("hidden");
    el.hud.classList.remove("hidden");
    A && A.ensure();
  }

  function ratingFor(n) {
    if (n >= 33) return { name: "一拳傳奇", blurb: "街道瞬間清靜咗，拳頭可以收工。" };
    if (n >= 25) return { name: "名拳", blurb: "準、夠快，連打都收得乾淨。" };
    if (n >= 18) return { name: "收機達人", blurb: "低頭族開始懂得抬頭望路。" };
    if (n >= 12) return { name: "街頭熟手", blurb: "瞄得唔錯，再快一拍就更穩。" };
    if (n >= 6) return { name: "普通一拳", blurb: "有收穫，不過仲有好多支漏網。" };
    if (n >= 1) return { name: "收得太少", blurb: "拳頭有出，手機仲好忙。" };
    return { name: "拳頭放緊假", blurb: "六十秒內一支都未收，試下對準發光嘅螢幕。" };
  }

  function endRun() {
    mode = "result";
    const prev = getBest();
    const isNew = score > prev;
    if (isNew) setBest(score);
    const r = ratingFor(score);
    el.grade.textContent = r.name;
    el.score.textContent = score + " 支";
    if (isNew && score > 0) {
      el.best.textContent = "新紀錄 · 自我最佳 " + score + " 支";
    } else {
      el.best.textContent = "自我最佳 " + Math.max(prev, score) + " 支";
    }
    el.blurb.textContent = r.blurb;
    el.result.classList.remove("hidden");
    el.hud.classList.add("hidden");
    if (A) A.stinger(score >= 12);
  }

  function goTitle() {
    mode = "title";
    seedStreet(6);
    flyers = [];
    puffs = [];
    floaters = [];
    resetFist(true);
    el.title.classList.remove("hidden");
    el.result.classList.add("hidden");
    el.hud.classList.add("hidden");
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x, y, text, color: color || C.ink, t: 0, life: 0.7 });
  }

  function knockPhone(p, box) {
    p.hit = true;
    p.phoneless = true;
    p.role = "empty";
    p.flinch = 1;
    p.lookUp = 1;
    p.shocked = 1;
    p.bubble = null;
    score += 1;
    const dir = (box.cx < fist.x) ? -1 : 1;
    flyers.push({
      x: box.cx,
      y: box.cy,
      vx: dir * rand(90, 180) * unit() + (box.cx - fist.x) * 1.4,
      vy: -rand(340, 520) * unit(),
      spin: rand(-18, 18),
      rot: rand(0, Math.PI),
      color: p.phoneColor,
      w: box.w,
      h: box.h,
      bounces: 0,
      life: 2.4,
    });
    addFloater(box.cx, box.cy - 10, "+1", C.sleeve);
    tickerDelta += rand(0.35, 1.15);
    tickerFlash = 1;
  }

  function tryHits() {
    if (!fist || fist.state !== "drop" && fist.state !== "hold") return;
    const hand = fistHandBox();
    // slightly wider on the way down for fairness
    const pad = 6 * unit();
    const hitbox = { x: hand.x - pad * 0.15, y: hand.y, w: hand.w + pad * 0.3, h: hand.h };

    for (const p of people) {
      const pb = phoneBox(p);
      if (pb && overlaps(hitbox, pb)) {
        knockPhone(p, pb);
        fist.hits += 1;
      } else if ((p.role === "empty" || p.role === "talk" || p.phoneless) && !p.bumped) {
        if (overlaps(hitbox, bodyBox(p))) {
          p.bumped = true;
          p.flinch = Math.max(p.flinch, 0.7);
          p.lookUp = 1;
          bumps += 1;
          fist.bumped.add(p.id);
        }
      }
    }
  }

  function startPunch() {
    if (mode !== "play") return;
    if (cooldown > 0) return;
    if (fist && (fist.state === "drop" || fist.state === "hold" || fist.state === "retract")) return;
    punches += 1;
    fist = {
      x: clamp(aimX * W, 40, W - 40),
      y: -20,
      state: "drop",
      t: 0,
      drop: 0.18,
      hold: 0.06,
      retract: 0.30,
      hits: 0,
      bumped: new Set(),
      startY: -20,
      endY: groundY() + 8 * unit(),
    };
    cooldown = COOLDOWN;
    if (showHint) {
      showHint = false;
      hintT = 0;
      markHint();
    }
    if (A) A.whoosh();
  }

  function onPunchImpact() {
    shake = 10;
    const hand = fistHandBox();
    const dustX = fist.x;
    const dustY = groundY() + 6;
    tryHits();
    const hitCount = fist.hits;
    if (hitCount > 0) {
      if (A) { A.punch(); A.clacks(hitCount); }
      if (hitCount >= 3) addFloater(fist.x, groundY() - 80 * unit(), "三連收！", C.awningA);
      else if (hitCount === 2) addFloater(fist.x, groundY() - 80 * unit(), "雙收！", C.awningC);
      if (tickerDelta > 0 && A) A.recover();
    } else if (fist.bumped.size > 0) {
      if (A) { A.punch(); A.bump(); }
      puffs.push({ x: dustX, y: dustY, t: 0, life: 0.35, scale: 0.7 });
    } else {
      if (A) { A.punch(); A.puff(); }
      puffs.push({ x: dustX, y: dustY, t: 0, life: 0.45, scale: 1 });
    }
    // always a little dust
    puffs.push({ x: dustX, y: dustY, t: 0, life: 0.28, scale: 0.45 });
  }

  function updateFist(dt) {
    if (!fist) return;
    if (fist.state === "idle") {
      fist.x = lerp(fist.x, clamp(aimX * W, 40, W - 40), 1 - Math.pow(0.001, dt));
      fist.y = -40;
      return;
    }
    fist.t += dt;
    if (fist.state === "drop") {
      const u = clamp(fist.t / fist.drop, 0, 1);
      fist.y = lerp(fist.startY, fist.endY, easeIn(u));
      tryHits();
      if (u >= 1) {
        fist.y = fist.endY;
        fist.state = "hold";
        fist.t = 0;
        onPunchImpact();
      }
    } else if (fist.state === "hold") {
      fist.y = fist.endY + Math.sin(fist.t * 40) * 1.2;
      if (fist.t >= fist.hold) {
        fist.state = "retract";
        fist.t = 0;
      }
    } else if (fist.state === "retract") {
      const u = clamp(fist.t / fist.retract, 0, 1);
      fist.y = lerp(fist.endY, -80, easeOut(u));
      if (u >= 1) {
        fist.state = "idle";
        fist.t = 0;
        fist.y = -40;
      }
    }
  }

  function maybeBubble(p) {
    if (p.bubble) return;
    if (p.role === "phone" && !p.passedStop) {
      const sx = stopX;
      if ((p.dir > 0 && p.x > sx && p.x < sx + 40) || (p.dir < 0 && p.x < sx && p.x > sx - 40)) {
        p.passedStop = true;
        if (Math.random() < 0.7) {
          p.bubble = "行過站啦";
          p.bubbleT = 2.2;
        }
      }
    }
    if (!p.bubble && p.role === "call" && Math.random() < 0.002) {
      p.bubble = pick(BUBBLES);
      p.bubbleT = 2.4;
    }
  }

  function updatePeople(dt) {
    const margin = 80;
    for (const p of people) {
      p.x += p.dir * p.speed * dt;
      p.flinch = Math.max(0, p.flinch - dt * 2.2);
      p.shocked = Math.max(0, p.shocked - dt * 1.6);
      if (p.lookUp && p.phoneless) {
        // stay looking up for a while then walk on
        p.lookUp = Math.max(0.25, p.lookUp - dt * 0.25);
      }
      if (p.bubble) {
        p.bubbleT -= dt;
        if (p.bubbleT <= 0) p.bubble = null;
      }
      maybeBubble(p);
    }
    people = people.filter((p) => p.x > -margin && p.x < W + margin);

    if (mode === "play" || mode === "title") {
      spawnT -= dt;
      const want = mode === "title" ? 6 : (timeLeft > 20 ? 8 : 9);
      if (people.length < want && spawnT <= 0) {
        const fromLeft = Math.random() < 0.5;
        // avoid immediate overlap at edge
        const p = makePerson(fromLeft, false);
        const crowded = people.some((o) => o.lane === p.lane && Math.abs(o.x - p.x) < 50);
        if (!crowded) {
          people.push(p);
          spawnT = mode === "title" ? rand(0.7, 1.6) : rand(0.28, 0.85);
        } else {
          spawnT = 0.12;
        }
      }
    }
  }

  function updateFlyers(dt) {
    const g = groundY() + 4;
    const grav = 1800 * unit();
    for (const f of flyers) {
      f.vy += grav * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      f.life -= dt;
      if (f.y > g - f.h * 0.3 && f.vy > 0 && f.bounces < 2) {
        f.y = g - f.h * 0.3;
        f.vy *= -0.38;
        f.vx *= 0.62;
        f.spin *= 0.7;
        f.bounces += 1;
      }
    }
    flyers = flyers.filter((f) => f.life > 0 && f.y < H + 40 && f.x > -60 && f.x < W + 60);
  }

  function updateFX(dt) {
    shake = Math.max(0, shake - dt * 28);
    tickerFlash = Math.max(0, tickerFlash - dt * 2.2);
    if (tickerDelta > 0) {
      const step = Math.min(tickerDelta, dt * 6);
      ticker += step;
      tickerDelta -= step;
    } else if (mode === "play") {
      const phoneZombies = people.some((p) => p.role === "phone" || p.role === "call");
      if (phoneZombies) {
        ticker += (Math.random() - 0.48) * dt * 3.2;
        ticker = clamp(ticker, -24, 8);
      }
    }
    for (const p of puffs) p.t += dt;
    puffs = puffs.filter((p) => p.t < p.life);
    for (const f of floaters) f.t += dt;
    floaters = floaters.filter((f) => f.t < f.life);
    if (hintT > 0) hintT -= dt;
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
  }

  function update(dt) {
    if (frozen) return;
    clock += dt;
    updatePeople(dt);
    updateFlyers(dt);
    updateFist(dt);
    updateFX(dt);
    if (mode === "play") {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        if (fist && (fist.state === "drop" || fist.state === "hold" || fist.state === "retract")) {
          endedHold = 0.05;
        } else {
          endedHold += dt;
          if (endedHold > 0.45) endRun();
        }
      }
    }
  }

  // ---------- drawing ----------

  function rounded(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function strokeFill(g, fill, stroke, lw) {
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    g.lineWidth = lw == null ? 1.6 : lw;
    g.strokeStyle = stroke || C.ink;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.stroke();
  }

  function drawBuildings(g) {
    const ground = facadeY();
    if (!city) buildCity();
    for (const b of city.buildings) {
      const x = b.x, w = b.w, h = b.h;
      const y = ground - h;
      g.fillStyle = b.kind === "tower" ? C.buildingAlt : (b.kind === "low" ? C.buildingDeep : C.building);
      g.strokeStyle = C.ink;
      g.lineWidth = 1.6;
      rounded(g, x, y, w, h, 4);
      g.fill();
      g.stroke();

      // roof bits
      if (b.kind === "tong" || b.kind === "shop" || b.kind === "low") {
        // railing / parapet
        g.beginPath();
        g.moveTo(x + 4, y);
        g.lineTo(x + w - 4, y);
        g.stroke();
        if (b.kind !== "tower") {
          // water tank or antenna
          const tx = x + w * 0.7;
          g.fillStyle = C.buildingDeep;
          rounded(g, tx, y - 16, 16, 16, 3);
          strokeFill(g, C.buildingDeep, C.ink, 1.3);
          g.beginPath();
          g.moveTo(tx + 8, y - 16);
          g.lineTo(tx + 8, y - 28);
          g.stroke();
        }
      } else {
        // antenna
        g.beginPath();
        g.moveTo(x + w * 0.5, y);
        g.lineTo(x + w * 0.5, y - 22);
        g.lineTo(x + w * 0.5 + 8, y - 14);
        g.stroke();
      }

      // windows — irregular groups, not a cloned grid
      const cols = b.kind === "tower" ? 3 : (b.kind === "shop" ? 4 : 3);
      const rows = b.kind === "tower" ? 6 : (b.kind === "low" ? 3 : 4);
      const insetX = 10;
      const topPad = 16;
      const shopCut = b.awning ? 56 * unit() : 18;
      const availH = h - topPad - shopCut;
      const ww = (w - insetX * 2 - (cols - 1) * 8) / cols;
      const hh = Math.min(16, (availH - (rows - 1) * 8) / rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // skip some for irregularity
          const skip = ((r * 3 + c * 5 + (b.seed | 0)) % 7) === 0;
          if (skip && b.kind !== "tower") continue;
          const wx = x + insetX + c * (ww + 8);
          const wy = y + topPad + r * (hh + 8);
          if (wy + hh > ground - shopCut + 4) continue;
          const lit = ((r + c + (b.seed | 0)) % 5) === 0;
          rounded(g, wx, wy, ww, hh, 2.5);
          strokeFill(g, lit ? C.windowLit : C.window, C.ink, 1.2);
          if (b.kind === "tong" && r === rows - 1 && !skip) {
            // tiny flower box
            g.fillStyle = C.awningB;
            g.fillRect(wx + 1, wy + hh, ww - 2, 3);
            g.strokeRect(wx + 1, wy + hh, ww - 2, 3);
          }
        }
      }

      if (b.awning) {
        const ay = ground - 52 * unit();
        const col = b.awning === "A" ? C.awningA : b.awning === "B" ? C.awningB : C.awningC;
        // shop opening
        rounded(g, x + 8, ay, w - 16, 52 * unit() + 2, 3);
        strokeFill(g, C.paper, C.ink, 1.4);
        // striped awning
        const awH = 16 * unit();
        g.save();
        rounded(g, x + 4, ay - awH, w - 8, awH, 3);
        g.clip();
        const stripes = 8;
        for (let i = 0; i < stripes; i++) {
          g.fillStyle = i % 2 === 0 ? col : C.cuff;
          g.fillRect(x + 4 + i * ((w - 8) / stripes), ay - awH, (w - 8) / stripes + 0.5, awH);
        }
        g.restore();
        rounded(g, x + 4, ay - awH, w - 8, awH, 3);
        g.lineWidth = 1.4;
        g.strokeStyle = C.ink;
        g.stroke();
        if (b.sign) {
          const sw = Math.min(54, w * 0.45);
          const sx = x + w * 0.55;
          const sy = ay + 6;
          rounded(g, sx, sy, sw, 18, 3);
          strokeFill(g, C.paper, C.ink, 1.2);
          g.fillStyle = C.ink;
          g.font = "700 10px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(b.sign, sx + sw / 2, sy + 9);
        }
      }
    }

  }


  function drawPavement(g) {
    const fy = facadeY();
    const gy = groundY();
    const cy = curbY();
    const bottom = H;
    g.fillStyle = C.pavement;
    g.fillRect(0, fy, W, bottom - fy);
    // faintly darker strip against the shop fronts
    g.fillStyle = "rgba(44,36,28,0.05)";
    g.fillRect(0, fy, W, 8);
    // walk lines
    g.strokeStyle = C.pavementLine;
    g.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      const y = fy + (cy - fy) * (i / 3.2);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // curb
    g.fillStyle = C.curb;
    g.fillRect(0, cy, W, 11 * unit());
    g.strokeStyle = C.ink;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(0, fy);
    g.lineTo(W, fy);
    g.stroke();
    g.beginPath();
    g.moveTo(0, cy);
    g.lineTo(W, cy);
    g.stroke();
    g.beginPath();
    g.moveTo(0, cy + 11 * unit());
    g.lineTo(W, cy + 11 * unit());
    g.stroke();
    // paving joints below the curb
    g.strokeStyle = "rgba(44,36,28,0.12)";
    g.lineWidth = 1;
    const step = 42 * unit();
    for (let x = 0; x < W; x += step) {
      g.beginPath();
      g.moveTo(x, cy + 11 * unit());
      g.lineTo(x + 8, H);
      g.stroke();
    }
  }

  function drawBusStop(g) {
    const sx = stopX;
    const base = groundY() - sidewalkDepth() * 0.22;
    const u = unit();
    g.fillStyle = "rgba(44,36,28,0.08)";
    g.beginPath();
    g.ellipse(sx + 8, base + 3, 20 * u, 5 * u, 0, 0, Math.PI * 2);
    g.fill();
    const poleTop = base - 178 * u;
    g.strokeStyle = C.ink;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(sx, base);
    g.lineTo(sx, poleTop);
    g.stroke();
    // sign sits on top of the pole, above head height
    const sw = 56 * u, sh = 32 * u;
    rounded(g, sx - sw / 2, poleTop - sh - 2, sw, sh, 7);
    strokeFill(g, C.awningB, C.ink, 1.6);
    g.fillStyle = C.scoreFill;
    g.font = "700 13px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("巴士站", sx, poleTop - sh / 2 - 2);
    // tiny shelter
    g.fillStyle = C.buildingDeep;
    g.strokeStyle = C.ink;
    g.lineWidth = 1.6;
    const shY = base - 100 * u;
    g.beginPath();
    g.moveTo(sx, shY);
    g.lineTo(sx + 36 * u, shY + 8);
    g.lineTo(sx + 36 * u, shY + 18);
    g.lineTo(sx + 4, shY + 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(sx + 36 * u, shY + 18);
    g.lineTo(sx + 36 * u, shY + 30);
    g.stroke();
  }

  function drawBubble(g, x, y, text) {
    g.font = "700 12px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    const padX = 10, padY = 6;
    const tw = g.measureText(text).width;
    const w = tw + padX * 2, h = 22;
    let bx = x - w / 2;
    bx = clamp(bx, 6, W - w - 6);
    const by = y - h - 8;
    rounded(g, bx, by, w, h, 12);
    strokeFill(g, C.scoreFill, C.ink, 1.5);
    // tail
    g.beginPath();
    g.moveTo(x - 5, by + h - 1);
    g.lineTo(x, by + h + 7);
    g.lineTo(x + 5, by + h - 1);
    g.fillStyle = C.scoreFill;
    g.fill();
    g.stroke();
    g.fillStyle = C.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, bx + w / 2, by + h / 2 + 0.5);
  }

  function drawPerson(g, p) {
    const u = unit();
    const walk = Math.sin(clock * p.pace + p.phase);
    const bob = Math.abs(Math.sin(clock * p.pace + p.phase)) * 1.6 * u;
    const feet = p.feet - bob - p.flinch * 5 * u;
    const facing = p.dir;
    const lean = (p.flinch > 0 ? -facing * 0.18 * p.flinch : 0) + walk * 0.03;

    g.save();
    g.translate(p.x, feet);
    g.rotate(lean);

    const h = p.h;
    const sw = 2.2;
    g.lineWidth = sw;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = C.ink;
    g.fillStyle = p.body;

    // shadow
    g.save();
    g.rotate(-lean);
    g.fillStyle = "rgba(44,36,28,0.12)";
    g.beginPath();
    g.ellipse(0, 3, h * 0.18, 4 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    const leg = 0.42 * h;
    const legA = walk * 0.46;
    const legB = -walk * 0.46;
    // legs
    g.beginPath();
    g.moveTo(0, -h * 0.42);
    g.lineTo(Math.sin(legA) * h * 0.16, -2);
    g.moveTo(0, -h * 0.42);
    g.lineTo(Math.sin(legB) * h * 0.16, -2);
    g.stroke();

    if (p.skirt) {
      g.beginPath();
      g.moveTo(-h * 0.12, -h * 0.48);
      g.lineTo(h * 0.12, -h * 0.48);
      g.lineTo(h * 0.16, -h * 0.28);
      g.lineTo(-h * 0.16, -h * 0.28);
      g.closePath();
      strokeFill(g, p.body, C.ink, 1.5);
    }

    // body
    g.beginPath();
    g.moveTo(0, -h * 0.78);
    g.lineTo(0, -h * 0.42);
    g.stroke();
    // thicker torso fill — a rounded capsule
    rounded(g, -h * 0.09, -h * 0.78, h * 0.18, h * 0.38, h * 0.08);
    strokeFill(g, p.body, C.ink, 1.6);

    // bag
    if (p.bag === "backpack") {
      rounded(g, -facing * h * 0.16 - 6 * u, -h * 0.74, 12 * u, 16 * u, 3);
      strokeFill(g, C.buildingDeep, C.ink, 1.3);
    } else if (p.bag === "tote") {
      g.beginPath();
      g.moveTo(facing * h * 0.14, -h * 0.55);
      g.lineTo(facing * h * 0.14 + facing * 4, -h * 0.28);
      g.stroke();
      rounded(g, facing * h * 0.14 + facing * 2 - 6 * u, -h * 0.30, 12 * u, 10 * u, 2);
      strokeFill(g, C.buildingAlt, C.ink, 1.2);
    }

    // arms + phone
    const armY = -h * 0.70;
    const lookDown = p.role === "phone" && !p.phoneless;
    const onCall = p.role === "call" && !p.phoneless;

    function arm(toX, toY) {
      g.beginPath();
      g.moveTo(0, armY);
      g.lineTo(toX, toY);
      g.stroke();
    }

    if (lookDown) {
      const px = facing * h * 0.22;
      const py = -h * 0.52;
      arm(px - facing * 4, py);
      arm(px + facing * 2, py + 4);
      drawPhone(g, px, py, p.phoneColor, 0, 16 * u, 26 * u);
    } else if (onCall) {
      const px = facing * h * 0.18;
      const py = -h * 0.82;
      arm(px, py);
      arm(facing * h * 0.12, -h * 0.5);
      drawPhone(g, px, py, p.phoneColor, facing * 0.4, 15 * u, 24 * u);
    } else {
      // swinging arms, maybe looking up
      const swg = Math.sin(clock * p.pace + p.phase + 0.4);
      arm(facing * h * 0.16 + swg * h * 0.08, -h * 0.48);
      arm(-facing * h * 0.12 - swg * h * 0.08, -h * 0.50);
    }

    // head
    const headR = h * 0.125;
    let headY = -h * 0.88;
    let headTilt = 0;
    if (lookDown) {
      headY = -h * 0.86;
      headTilt = 0.25;
    } else if (p.lookUp > 0 || p.phoneless) {
      headY = -h * 0.90;
      headTilt = -0.2 * (p.lookUp || 0.6);
    }
    g.save();
    g.translate(0, headY);
    g.rotate(headTilt * facing);
    g.beginPath();
    g.arc(0, 0, headR, 0, Math.PI * 2);
    strokeFill(g, p.body, C.ink, 1.6);

    // face
    g.fillStyle = C.scoreFill;
    const eyeY = lookDown ? 2 * u : (p.phoneless ? -1.5 * u : 0);
    if (p.shocked > 0.2) {
      g.beginPath();
      g.arc(-3 * u, eyeY, 1.4 * u, 0, Math.PI * 2);
      g.arc(3 * u, eyeY, 1.4 * u, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(0, 4 * u, 2.2 * u, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = C.scoreFill;
      g.beginPath();
      g.arc(-3 * u, eyeY, 1.15 * u, 0, Math.PI * 2);
      g.arc(3 * u, eyeY, 1.15 * u, 0, Math.PI * 2);
      g.fill();
    }

    // hair
    drawHair(g, p, headR, u);
    g.restore();

    g.restore();

    if (p.bubble) {
      const by = p.feet - p.h - 6 * u - bob;
      drawBubble(g, p.x, by, p.bubble);
    }
  }

  function drawHair(g, p, r, u) {
    g.fillStyle = p.hairColor;
    g.strokeStyle = C.ink;
    g.lineWidth = 1.4;
    const type = p.hair;
    if (type === "bun") {
      g.beginPath();
      g.arc(0, -r - 3 * u, r * 0.45, 0, Math.PI * 2);
      g.fill(); g.stroke();
    } else if (type === "twin") {
      g.beginPath();
      g.arc(-r * 0.7, -r * 0.6, r * 0.38, 0, Math.PI * 2);
      g.arc(r * 0.7, -r * 0.6, r * 0.38, 0, Math.PI * 2);
      g.fill(); g.stroke();
    } else if (type === "ponytail") {
      g.beginPath();
      g.moveTo(-p.dir * r * 0.4, 0);
      g.quadraticCurveTo(-p.dir * r * 1.4, r * 0.6, -p.dir * r * 1.1, r * 1.4);
      g.stroke();
      g.beginPath();
      g.arc(-p.dir * r * 0.55, 0, 3 * u, 0, Math.PI * 2);
      g.fill(); g.stroke();
    } else if (type === "cap") {
      rounded(g, -r * 1.05, -r * 0.7, r * 2.1, r * 0.7, 4);
      strokeFill(g, C.awningC, C.ink, 1.3);
      g.beginPath();
      g.moveTo(p.dir * r * 0.9, -r * 0.15);
      g.lineTo(p.dir * r * 1.5, -r * 0.15);
      g.stroke();
    } else if (type === "bob") {
      g.beginPath();
      g.arc(0, 0, r + 1, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      g.beginPath();
      g.moveTo(-r * 0.95, 0);
      g.lineTo(-r * 0.95, r * 0.7);
      g.moveTo(r * 0.95, 0);
      g.lineTo(r * 0.95, r * 0.7);
      g.stroke();
    } else if (type === "spiky") {
      g.beginPath();
      g.moveTo(-r * 0.7, -r * 0.4);
      g.lineTo(-r * 0.4, -r * 1.35);
      g.lineTo(-0.1 * r, -r * 0.5);
      g.lineTo(0.15 * r, -r * 1.4);
      g.lineTo(0.45 * r, -r * 0.45);
      g.lineTo(0.75 * r, -r * 1.2);
      g.stroke();
    } else if (type === "long") {
      g.beginPath();
      g.moveTo(-r * 0.9, 0);
      g.quadraticCurveTo(-r * 1.1, r * 1.4, -r * 0.4, r * 1.8);
      g.moveTo(r * 0.9, 0);
      g.quadraticCurveTo(r * 1.1, r * 1.4, r * 0.4, r * 1.8);
      g.stroke();
    } else if (type === "band") {
      g.beginPath();
      g.moveTo(-r, -r * 0.2);
      g.lineTo(r, -r * 0.2);
      g.strokeStyle = C.awningB;
      g.lineWidth = 2.2;
      g.stroke();
      g.strokeStyle = C.ink;
      g.lineWidth = 1.4;
    } else if (type === "short") {
      g.beginPath();
      g.arc(0, -2 * u, r, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } // buzz: almost nothing
  }

  function drawPhone(g, x, y, color, rot, w, h) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    rounded(g, -w / 2, -h / 2, w, h, 3);
    strokeFill(g, color, C.ink, 1.3);
    // screen
    rounded(g, -w / 2 + 2, -h / 2 + 3, w - 4, h - 7, 2);
    g.fillStyle = "rgba(255,252,245,0.72)";
    g.fill();
    g.strokeStyle = "rgba(44,36,28,0.2)";
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
  }

  function drawFlyers(g) {
    for (const f of flyers) {
      const a = clamp(f.life / 0.4, 0, 1);
      g.globalAlpha = a;
      drawPhone(g, f.x, f.y, f.color, f.rot, f.w, f.h);
      g.globalAlpha = 1;
    }
  }

  function drawPuffs(g) {
    for (const p of puffs) {
      const u = p.t / p.life;
      const a = (1 - u) * 0.35;
      const r = (8 + u * 26) * unit() * p.scale;
      g.strokeStyle = "rgba(44,36,28," + a + ")";
      g.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI + u;
        g.beginPath();
        g.arc(p.x + Math.cos(ang) * r, p.y - Math.sin(ang) * r * 0.4, 3 + u * 4, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }

  function drawAim(g) {
    if (mode !== "play") return;
    const x = (fist && fist.state !== "idle") ? fist.x : aimX * W;
    const gy = groundY();
    g.save();
    g.strokeStyle = "rgba(44,36,28,0.35)";
    g.lineWidth = 1.4;
    g.setLineDash([5, 6]);
    g.beginPath();
    g.moveTo(x, safeTop + 8);
    g.lineTo(x, gy);
    g.stroke();
    g.setLineDash([]);
    g.restore();
  }

  function drawFist(g) {
    if (mode !== "play") return;
    if (!fist) return;
    if (fist.state === "idle" && fist.y < 0) {
      // hidden, maybe a tiny hint of sleeve at very top when ready? keep clean — hidden
      return;
    }
    const box = fistHandBox();
    const hw = box.hw, hh = box.hh;
    const x = fist.x;
    const bottom = fist.y;
    const top = -40;

    g.save();
    // slight squash at hold
    const squash = fist.state === "hold" ? 0.08 : 0;
    g.translate(x, bottom);
    g.scale(1 + squash, 1 - squash);

    // forearm from above
    const armW = hw * 0.42;
    g.fillStyle = C.sleeve;
    g.strokeStyle = C.ink;
    g.lineWidth = 2;
    const fh = hh * 0.78;
    const wristY = -fh - 2;
    const cuffH = hh * 0.18;
    g.beginPath();
    g.moveTo(-armW * 0.5, wristY - cuffH + 2);
    g.lineTo(-armW * 0.64, top - bottom);
    g.lineTo(armW * 0.64, top - bottom);
    g.lineTo(armW * 0.5, wristY - cuffH + 2);
    g.closePath();
    g.fill();
    g.stroke();

    // sleeve end / cuff (sits just above the fist, must not be hidden)
    rounded(g, -armW * 0.66, wristY - cuffH, armW * 1.32, cuffH + 6, 5);
    strokeFill(g, C.cuff, C.ink, 1.8);
    g.fillStyle = C.cuffStripe;
    g.fillRect(-armW * 0.52, wristY - cuffH * 0.62, armW * 1.04, 3.4);
    g.strokeStyle = C.ink;
    g.lineWidth = 1;
    g.strokeRect(-armW * 0.52, wristY - cuffH * 0.62, armW * 1.04, 3.4);

    // watch on the cuff
    const wx = armW * 0.58;
    const wy = wristY - cuffH * 0.45;
    g.beginPath();
    g.arc(wx, wy, 6 * unit(), 0, Math.PI * 2);
    strokeFill(g, C.watchFace, C.ink, 1.4);
    g.strokeStyle = C.watch;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(wx, wy, 6 * unit(), 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(wx, wy - 3.2 * unit());
    g.moveTo(wx, wy);
    g.lineTo(wx + 2.2 * unit(), wy + 1.2 * unit());
    g.stroke();

    // fist (warm peach, big and funny)
    const fw = hw * 0.92;
    rounded(g, -fw / 2, -fh, fw, fh, fw * 0.28);
    strokeFill(g, C.skin, C.ink, 2);

    // knuckles
    const knY = -fh * 0.18;
    for (let i = 0; i < 4; i++) {
      const kx = -fw * 0.32 + i * (fw * 0.21);
      g.beginPath();
      g.arc(kx, knY, fw * 0.075, Math.PI, 0);
      g.strokeStyle = C.ink;
      g.lineWidth = 1.5;
      g.stroke();
      // crease
      g.beginPath();
      g.moveTo(kx - 3, knY + fh * 0.22);
      g.lineTo(kx + 3, knY + fh * 0.22);
      g.strokeStyle = C.skinShadow;
      g.lineWidth = 1.2;
      g.stroke();
    }

    // thumb on the side
    g.beginPath();
    const thx = fw * 0.52;
    const thy = -fh * 0.55;
    rounded(g, thx - 8 * unit(), thy, 16 * unit(), 22 * unit(), 8);
    strokeFill(g, C.skin, C.ink, 1.8);

    // palm crease
    g.beginPath();
    g.strokeStyle = C.skinShadow;
    g.lineWidth = 1.3;
    g.moveTo(-fw * 0.22, -fh * 0.62);
    g.quadraticCurveTo(0, -fh * 0.50, fw * 0.18, -fh * 0.64);
    g.stroke();

    g.restore();

    // shadow on ground when near
    const gy = groundY();
    const near = clamp(1 - (gy - Math.min(bottom, gy)) / (H * 0.6), 0, 1);
    if (near > 0 && bottom > 0) {
      g.fillStyle = "rgba(44,36,28," + (0.16 * near) + ")";
      g.beginPath();
      g.ellipse(x, gy + 6, hw * 0.35 * near, 5 * unit() * near, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawScoreBadge(g) {
    if (mode !== "play") return;
    const u = unit();
    const r = clamp(32 * u, 28, 40);
    const x = W - 16 - r;
    const y = safeTop + 16 + r;
    const ready = 1 - clamp(cooldown / COOLDOWN, 0, 1);

    // recharge ring
    g.beginPath();
    g.arc(x, y, r + 6, 0, Math.PI * 2);
    g.strokeStyle = "rgba(44,36,28,0.16)";
    g.lineWidth = 4;
    g.stroke();
    g.beginPath();
    g.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2, false);
    g.strokeStyle = C.sleeve;
    g.lineWidth = 4;
    g.lineCap = "round";
    g.stroke();

    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    strokeFill(g, C.scoreFill, C.ink, 2);

    g.fillStyle = C.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 " + Math.round(r * 0.72) + "px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.fillText(String(score), x, y - r * 0.16);
    g.font = "700 " + Math.round(r * 0.32) + "px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    g.fillText("支", x, y + r * 0.38);
  }

  function drawTimer(g) {
    if (mode !== "play") return;
    const t = Math.max(0, Math.ceil(timeLeft));
    const mm = String((t / 60) | 0);
    const ss = String(t % 60).padStart(2, "0");
    g.fillStyle = C.ink;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = "700 15px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    const x = 16;
    const y = safeTop + 26;
    // leave room for mute button which is at top-left in HUD
    g.fillText(mm + ":" + ss, x + 52, y);
    if (timeLeft <= 8) {
      g.fillStyle = C.awningA;
      g.fillText(mm + ":" + ss, x + 52, y);
    }
  }

  function drawTicker(g) {
    if (mode !== "play") return;
    const y = tickerY();
    const textVal = (ticker >= 0 ? "+" : "−") + Math.abs(ticker).toFixed(0) + "%";
    const label = TICKER_LABEL + "  " + textVal;
    g.font = "700 15px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    const tw = g.measureText(label).width;
    const w = Math.max(160, tw + 48);
    const h = 36;
    const x = (W - w) / 2;
    const flash = tickerFlash;
    const bg = flash > 0 ? lerpColor(C.scoreFill, "#dceac8", flash) : C.scoreFill;
    rounded(g, x, y - h, w, h, 18);
    strokeFill(g, bg, C.ink, 1.8);
    g.fillStyle = ticker >= 0 ? C.sleeve : C.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, W / 2, y - h / 2 + 1);
    if (flash > 0 && tickerDelta >= 0) {
      g.font = "700 11px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
      g.fillStyle = C.sleeve;
      g.globalAlpha = flash;
      g.fillText("收復", W / 2 + w * 0.38, y - h / 2 + 1);
      g.globalAlpha = 1;
    }
  }

  function lerpColor(a, b, t) {
    function hex(h) {
      return [
        parseInt(h.slice(1, 3), 16),
        parseInt(h.slice(3, 5), 16),
        parseInt(h.slice(5, 7), 16),
      ];
    }
    const A = hex(a), B = hex(b);
    const m = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return "rgb(" + m.join(",") + ")";
  }

  function drawFloaters(g) {
    for (const f of floaters) {
      const u = f.t / f.life;
      g.globalAlpha = 1 - u;
      g.fillStyle = f.color;
      g.font = "700 18px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(f.text, f.x, f.y - u * 36);
      g.globalAlpha = 1;
    }
  }

  function drawHint(g) {
    if (mode !== "play" || !showHint || hintT <= 0) return;
    const a = hintT > 0.5 ? 1 : hintT / 0.5;
    g.globalAlpha = a;
    const text = "撳螢幕打落拳頭 · 瞄準手機";
    g.font = "700 14px 'PingFang HK','Noto Sans CJK HK','Noto Sans CJK TC','Noto Sans TC',sans-serif";
    const tw = g.measureText(text).width;
    const w = tw + 28, h = 32;
    const x = (W - w) / 2;
    const y = facadeY() - 40 * unit();
    rounded(g, x, y, w, h, 16);
    strokeFill(g, C.scoreFill, C.ink, 1.5);
    g.fillStyle = C.ink;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, W / 2, y + h / 2 + 1);
    g.globalAlpha = 1;
  }

  function draw() {
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (shake ? (Math.random() - 0.5) * shake * 0.35 : 0);
    const sy = (shake ? (Math.random() - 0.5) * shake * 0.25 : 0);
    g.translate(sx, sy);

    if (paper) g.drawImage(paper, 0, 0, W, H);
    else {
      g.fillStyle = C.paper;
      g.fillRect(0, 0, W, H);
    }

    drawBuildings(g);
    drawPavement(g);
    drawBusStop(g);
    drawAim(g);

    // people back to front
    const ordered = people.slice().sort((a, b) => a.lane - b.lane || a.x - b.x);
    for (const p of ordered) drawPerson(g, p);

    drawFlyers(g);
    drawPuffs(g);
    drawFist(g);
    drawFloaters(g);
    drawHint(g);

    g.translate(-sx, -sy);
    drawScoreBadge(g);
    drawTimer(g);
    drawTicker(g);
  }

  // ---------- input ----------

  function localX(ev) {
    const rect = canvas.getBoundingClientRect();
    const src = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
    return (src.clientX - rect.left) / rect.width;
  }

  function onDown(ev) {
    if (mode !== "play") return;
    if (ev.target && ev.target.closest && ev.target.closest("button, .panel")) return;
    ev.preventDefault();
    pointerDown = true;
    aimX = clamp(localX(ev), 0.04, 0.96);
    startPunch();
    A && A.ensure();
  }
  function onMove(ev) {
    if (mode !== "play") return;
    ev.preventDefault();
    aimX = clamp(localX(ev), 0.04, 0.96);
  }
  function onUp(ev) {
    pointerDown = false;
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  // also listen on app so taps on empty areas work (canvas is full size)

  function syncMuteButtons() {
    const on = !(A && A.isMuted());
    const label = "聲音：" + (on ? "開" : "關");
    el.muteTitle.textContent = label;
    el.muteResult.textContent = label;
    el.mutePlay.textContent = on ? "聲" : "靜";
    el.mutePlay.setAttribute("aria-label", on ? "關閉聲音" : "開啟聲音");
  }

  function toggleMute() {
    if (!A) return;
    A.ensure();
    A.setMuted(!A.isMuted());
    syncMuteButtons();
    if (!A.isMuted()) A.ui();
  }

  el.start.addEventListener("click", () => { A && A.ensure(); A && A.ui(); startRun(); });
  el.retry.addEventListener("click", () => { A && A.ui(); startRun(); });
  el.home.addEventListener("click", () => { A && A.ui(); goTitle(); });
  el.muteTitle.addEventListener("click", toggleMute);
  el.mutePlay.addEventListener("click", toggleMute);
  el.muteResult.addEventListener("click", toggleMute);

  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
    window.visualViewport.addEventListener("scroll", resize);
  }
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  function loop(ts) {
    if (!lastT) lastT = ts;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // preview mode: compose a mid-run still / short live scene for a screenshot
  function setupPreview() {
    resize();
    startRun();
    timeLeft = 37;
    score = 4;
    ticker = -9;
    tickerFlash = 0.35;
    tickerDelta = 0;
    showHint = false;
    hintT = 0;
    clock = 0.45;
    people = [];
    const mk = (x, dir, role, hair, body, phone, lane, bubble, bag) => {
      const p = makePerson(dir > 0, true);
      p.x = x;
      p.dir = dir;
      p.role = role;
      p.hair = hair;
      p.body = body;
      p.phoneColor = phone;
      p.lane = lane;
      p.feet = laneY(lane);
      p.h = (role === "empty" && hair === "cap" ? 100 : 108) * unit() * laneScale(lane);
      if (hair === "bun" && role === "empty") p.h = 92 * unit() * laneScale(lane);
      p.bubble = bubble || null;
      p.bubbleT = 4;
      p.bag = bag || "none";
      p.skirt = hair === "ponytail" || hair === "bob";
      p.phase = x * 0.04;
      return p;
    };
    people.push(mk(W * 0.16, 1, "empty", "cap", "#5a4d40", "#f3d37a", 1, null, "tote"));
    people.push(mk(W * 0.34, 1, "phone", "short", "#3d4a3a", "#8fd3c4", 2, null, null));
    people.push(mk(Math.min(W * 0.56, stopX + 36 * unit()), -1, "phone", "ponytail", "#6a4634", "#f2a3a3", 2, "行過站啦", null));
    people.push(mk(W * 0.66, 1, "call", "bob", "#2e2a26", "#c5b3e6", 1, null, "backpack"));
    people.push(mk(W * 0.82, -1, "empty", "bun", "#8a6a5a", "#7ec4e3", 0, null, null));
    people.push(mk(W * 0.24, -1, "phone", "spiky", "#4d555c", "#f3d37a", 0, null, null));
    flyers.push({
      x: W * 0.58,
      y: facadeY() - 36 * unit(),
      vx: 80, vy: -40, spin: 6, rot: 0.8,
      color: "#7ec4e3",
      w: 16 * unit(),
      h: 26 * unit(),
      bounces: 0,
      life: 2,
    });
    aimX = 0.40;
    const fx = W * 0.40;
    fist = {
      x: fx,
      y: H * 0.22,
      state: "drop",
      t: 0.08,
      drop: 0.22,
      hold: 0.06,
      retract: 0.3,
      hits: 0,
      bumped: new Set(),
      startY: -20,
      endY: groundY() + 8,
    };
    cooldown = COOLDOWN * 0.55;
    puffs = [];
    floaters = [];
    frozen = true;
  }

  // boot
  syncMuteButtons();
  resize();
  seedStreet(6);
  const params = new URLSearchParams(location.search);
  if (params.get("preview") === "1" || location.hash === "#preview") {
    setupPreview();
  }
  requestAnimationFrame(loop);

  // expose a tiny hook for screenshots
  window.__sauGeiKuen = { setupPreview, startRun, resize };
})();
