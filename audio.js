/* 收機拳 — 原創 Web Audio 音效（無取樣、無外部檔） */
(function (root) {
  "use strict";

  const STORAGE_KEY = "sau-gei-kuen-mute";

  let ctx = null;
  let master = null;
  let muted = false;

  try {
    muted = localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    muted = false;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setMuted(v) {
    muted = !!v;
    if (master) {
      const t = now();
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(muted ? 0 : 0.85, t, 0.03);
    }
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch (e) { /* ignore */ }
  }

  function isMuted() {
    return muted;
  }

  function connect(node, volume) {
    const g = ctx.createGain();
    g.gain.value = volume;
    node.connect(g);
    g.connect(master);
    return g;
  }

  function env(gain, t, a, d, s, r, peak, sustain) {
    const p = peak == null ? 1 : peak;
    const sus = sustain == null ? p * 0.45 : sustain;
    gain.setValueAtTime(0.0001, t);
    gain.exponentialRampToValueAtTime(p, t + a);
    gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d);
    gain.setValueAtTime(Math.max(0.0001, sus), t + a + d + s);
    gain.exponentialRampToValueAtTime(0.0001, t + a + d + s + r);
  }

  function noiseBuffer(seconds) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noise(t, duration, type, freq, q, vol, attack, decay) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.max(0.05, duration + 0.05));
    const filt = ctx.createBiquadFilter();
    filt.type = type || "lowpass";
    filt.frequency.value = freq || 800;
    if (q) filt.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t, attack || 0.004, decay || duration * 0.5, 0.01, duration * 0.4, vol, vol * 0.3);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  function osc(type, t, f0, f1, duration, vol, attack) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duration);
    const g = ctx.createGain();
    env(g.gain, t, attack || 0.004, duration * 0.25, 0.01, duration * 0.7, vol, vol * 0.25);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + duration + 0.02);
  }

  function whoosh() {
    if (!ensure() || muted) return;
    const t = now();
    noise(t, 0.18, "bandpass", 900, 0.7, 0.22, 0.01, 0.08);
    noise(t, 0.16, "lowpass", 500, 0.4, 0.12, 0.008, 0.07);
    osc("sine", t, 220, 90, 0.16, 0.07, 0.01);
  }

  function punch() {
    if (!ensure() || muted) return;
    const t = now();
    osc("sine", t, 140, 42, 0.16, 0.55, 0.002);
    osc("triangle", t, 90, 36, 0.12, 0.2, 0.002);
    noise(t, 0.09, "lowpass", 350, 0.5, 0.35, 0.001, 0.04);
  }

  function clack() {
    if (!ensure() || muted) return;
    const t = now();
    osc("square", t, 1900, 900, 0.045, 0.08, 0.001);
    osc("triangle", t, 1400, 700, 0.05, 0.1, 0.001);
    noise(t, 0.06, "bandpass", 2400, 3.2, 0.28, 0.001, 0.02);
    noise(t, 0.05, "highpass", 1800, 0.7, 0.12, 0.001, 0.02);
  }

  function clacks(n) {
    if (!ensure() || muted) return;
    const count = Math.max(1, Math.min(4, n | 0));
    for (let i = 0; i < count; i++) {
      const t = now() + i * 0.038;
      osc("square", t, 1800 + i * 120, 820, 0.045, 0.07, 0.001);
      noise(t, 0.055, "bandpass", 2200 + i * 180, 3, 0.24, 0.001, 0.02);
    }
  }

  function bump() {
    if (!ensure() || muted) return;
    const t = now();
    osc("sine", t, 110, 60, 0.1, 0.18, 0.003);
    noise(t, 0.07, "lowpass", 280, 0.4, 0.12, 0.003, 0.04);
  }

  function puff() {
    if (!ensure() || muted) return;
    const t = now();
    noise(t, 0.14, "lowpass", 500, 0.5, 0.18, 0.004, 0.06);
    noise(t, 0.1, "bandpass", 800, 0.8, 0.08, 0.004, 0.05);
  }

  function ui() {
    if (!ensure() || muted) return;
    const t = now();
    osc("sine", t, 620, 820, 0.07, 0.12, 0.002);
  }

  function recover() {
    if (!ensure() || muted) return;
    const t = now();
    osc("sine", t, 520, 760, 0.08, 0.08, 0.004);
  }

  function stinger(good) {
    if (!ensure() || muted) return;
    const t = now();
    if (good) {
      osc("sine", t, 392, 392, 0.12, 0.14, 0.006);
      osc("sine", t + 0.1, 494, 494, 0.12, 0.14, 0.006);
      osc("sine", t + 0.2, 587, 587, 0.22, 0.16, 0.006);
    } else {
      osc("sine", t, 330, 280, 0.18, 0.12, 0.008);
      osc("sine", t + 0.14, 247, 196, 0.26, 0.12, 0.008);
    }
  }

  root.SauGeiAudio = {
    ensure,
    setMuted,
    isMuted,
    whoosh,
    punch,
    clack,
    clacks,
    bump,
    puff,
    ui,
    recover,
    stinger,
  };
})(window);
