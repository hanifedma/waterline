/**
 * Waterline — UI controller.
 */
import { store, computeStats, dayIndex, fastedDays } from "./store.js";
import { STAGES, stageAt, quoteOfTheHour, completionMessage } from "./stages.js";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

const el = {
  gauge: $("gauge"), ring: $("progressRing"), water: $("waterGroup"),
  label: $("gaugeLabel"), time: $("gaugeTime"), sub: $("gaugeSub"),
  goalRow: $("goalRow"), startBtn: $("startBtn"), endBtn: $("endBtn"),
  editStartBtn: $("editStartBtn"), cancelBtn: $("cancelBtn"), startedAt: $("startedAt"),
  coachQuote: $("coachQuote"), coachNext: $("coachNext"),
  statStreak: $("statStreak"), statLongest: $("statLongest"),
  statTotal: $("statTotal"), statHours: $("statHours"),
  stages: $("stages"), history: $("history"), historyHint: $("historyHint"),
  calDow: $("calDow"), calGrid: $("calGrid"), calMonth: $("calMonth"),
  calHint: $("calHint"), calPrev: $("calPrev"), calNext: $("calNext"),
  syncPill: $("syncPill"), themeBtn: $("themeBtn"), signInBtn: $("signInBtn"),
  avatarMenu: $("avatarMenu"), avatarBtn: $("avatarBtn"), avatarImg: $("avatarImg"),
  userMenu: $("userMenu"), menuName: $("menuName"), menuEmail: $("menuEmail"),
  signOutBtn: $("signOutBtn"), buildMode: $("buildMode"), perfBtn: $("perfBtn"),
  toasts: $("toasts"),
  editModal: $("editModal"), editForm: $("editForm"), startInput: $("startInput"),
  endInput: $("endInput"), endField: $("endField"), editTitle: $("editTitle"),
  editHint: $("editHint"), editError: $("editError"), cancelEditBtn: $("cancelEditBtn"),
  startField: $("startField"), saveEditBtn: $("saveEditBtn"),
  doneModal: $("doneModal"), doneTitle: $("doneTitle"), doneTime: $("doneTime"),
  doneMsg: $("doneMsg"), doneCloseBtn: $("doneCloseBtn")
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 139;
const BOWL_TOP = 22, BOWL_HEIGHT = 256, WAVE_CREST = 14;
const DEEP_AT = 0.42; // water has risen behind the centred text

const TRASH_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 12h9l1-12"/></svg>`;

const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/></svg>`;

/**
 * Milestone celebration state. `primed` is false whenever we don't yet know
 * where the fast stands — on boot, on a fresh start, after a start-time edit,
 * or when a fast arrives from another device. The first tick after that seeds
 * the trackers silently, so a refresh mid-fast never replays old milestones.
 */
let primed = false;
let lastStageIndex = -1;
let goalCelebrated = false;
const unprime = () => { primed = false; };

let stageNodes = [];

/* ── Formatting ───────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/** "16h 04m" — the human-readable form used in history and stats. */
function formatDuration(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

function formatCountdown(ms) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const toLocalInput = (ms) =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/**
 * Writing an identical string still invalidates layout, and assigning
 * `textContent` throws away the old text node to build a new one — once a
 * second, forever. Compare first, then poke the existing node in place.
 */
function setText(node, text) {
  if (node.textContent === text) return;
  const only = node.childNodes.length === 1 ? node.firstChild : null;
  if (only && only.nodeType === Node.TEXT_NODE) only.data = text;
  else node.textContent = text;
}

/* ── Toasts ───────────────────────────────────────────────────────── */

function toast(message, { icon = "💧", win = false, duration = 5200 } = {}) {
  const node = document.createElement("div");
  node.className = `toast${win ? " toast--win" : ""}`;
  node.innerHTML = `<span class="toast__icon" aria-hidden="true">${icon}</span><span></span>`;
  node.lastElementChild.textContent = message;
  el.toasts.append(node);

  setTimeout(() => {
    node.dataset.out = "true";
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400); // lite mode collapses the animation
  }, duration);
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "./icons/icon-192.png", tag: "waterline-stage" });
  } catch { /* some browsers need a service worker registration; the toast still fired */ }
}

/* ── Gauge ────────────────────────────────────────────────────────── */

/*
 * The ring and the water level are written only when they visibly move.
 * Left unguarded, a 16-hour fast nudges stroke-dashoffset by 0.015px every
 * second, and each write restarts an 800ms transition on a drop-shadowed
 * stroke — a permanent repaint loop for a change nobody can see.
 */
let lastOffset = null, lastWaterY = null, lastDeep = null, lastComplete = null;

function paintGauge(elapsedMs, goalHours) {
  const goalMs = goalHours * 3.6e6;
  const raw = goalMs > 0 ? elapsedMs / goalMs : 0;
  const progress = Math.min(1, Math.max(0, raw));

  const offset = RING_CIRCUMFERENCE * (1 - progress);
  if (lastOffset === null || Math.abs(offset - lastOffset) >= 0.5) {
    el.ring.style.strokeDashoffset = offset;
    lastOffset = offset;
  }

  const waterY = BOWL_TOP + BOWL_HEIGHT - WAVE_CREST - progress * BOWL_HEIGHT;
  if (lastWaterY === null || Math.abs(waterY - lastWaterY) >= 0.25) {
    el.water.style.transform = `translateY(${waterY}px)`;
    lastWaterY = waterY;
  }

  const complete = raw >= 1;
  if (complete !== lastComplete) {
    el.gauge.dataset.complete = String(complete);
    lastComplete = complete;
  }

  const deep = progress > DEEP_AT;
  if (deep !== lastDeep) {
    el.gauge.dataset.deep = String(deep);
    lastDeep = deep;
  }
}

/** Idle, this runs once a second — so it must not write unless something moved. */
function resetGauge() {
  const offset = RING_CIRCUMFERENCE;
  const waterY = BOWL_TOP + BOWL_HEIGHT - WAVE_CREST;

  if (lastOffset !== offset) {
    el.ring.style.strokeDashoffset = offset;
    lastOffset = offset;
  }
  if (lastWaterY !== waterY) {
    el.water.style.transform = `translateY(${waterY}px)`;
    lastWaterY = waterY;
  }
  if (lastComplete !== false) {
    el.gauge.dataset.complete = "false";
    lastComplete = false;
  }
  if (lastDeep !== false) {
    el.gauge.dataset.deep = "false";
    lastDeep = false;
  }
}

/*
 * The wave animation is the page's only permanent repaint. It is worth running
 * only while a fast is on and the bowl is actually on screen.
 *
 * Visibility is measured from the tick rather than trusted to the observer:
 * an IntersectionObserver that misses its "back on screen" callback would
 * leave the water frozen in plain sight. The observer stays for instant
 * response while scrolling; the rect read is the one that must be right, and
 * it only runs while a fast is active.
 */
let gaugeOnScreen = true;

function measureGaugeVisibility() {
  const rect = el.gauge.getBoundingClientRect();
  gaugeOnScreen = rect.bottom > 0 && rect.top < window.innerHeight;
}

function syncWaves() {
  const still = String(!store.state.activeFast || !gaugeOnScreen);
  if (el.gauge.dataset.still !== still) el.gauge.dataset.still = still;
}

function watchGaugeVisibility() {
  if (!("IntersectionObserver" in window)) return;
  new IntersectionObserver(([entry]) => {
    gaugeOnScreen = entry.isIntersecting;
    syncWaves();
  }).observe(el.gauge);
}

/* ── The one-second loop ──────────────────────────────────────────── */

function tick() {
  const { activeFast, settings } = store.state;

  if (!activeFast) {
    setText(el.time, "00:00:00");
    setText(el.label, "Ready when you are");
    setText(el.sub, `Goal: ${settings.goalHours}h · tap begin`);
    setText(el.coachNext, "");
    resetGauge();
    markStages(-1);
    syncWaves();
    unprime();
    return;
  }

  const elapsed = Date.now() - activeFast.start;
  const goalMs = activeFast.goalHours * 3.6e6;
  const reachedGoal = elapsed >= goalMs;
  const { index, current, next } = stageAt(elapsed / 3.6e6);

  setText(el.time, formatElapsed(elapsed));
  setText(el.label, current.title);
  setText(el.sub, reachedGoal
    ? `Goal smashed · +${formatDuration(elapsed - goalMs)} over`
    : `${formatCountdown(goalMs - elapsed)} left · ${Math.floor((elapsed / goalMs) * 100)}% of ${activeFast.goalHours}h`);

  paintGauge(elapsed, activeFast.goalHours);
  markStages(index);
  measureGaugeVisibility();
  syncWaves();

  setText(el.coachNext, next
    ? `${formatCountdown(next.hour * 3.6e6 - elapsed)} until ${next.title}`
    : "You are past every milestone on the map.");

  if (!primed) {
    lastStageIndex = index;
    goalCelebrated = reachedGoal;
    primed = true;
    return;
  }

  if (index > lastStageIndex) {
    toast(current.cheer, { icon: current.icon, win: true, duration: 8000 });
    notify(`${current.icon} ${current.title}`, current.cheer);
    lastStageIndex = index;
  }

  if (reachedGoal && !goalCelebrated) {
    goalCelebrated = true;
    toast(`${activeFast.goalHours}h goal reached. Anything now is a bonus.`, { icon: "🏆", win: true, duration: 7000 });
    notify("Goal reached 🏆", `You hit your ${activeFast.goalHours}-hour goal.`);
  }
}

/* ── Sections ─────────────────────────────────────────────────────── */

/** Built once at boot; the timer only flips each row's `data-state` after that. */
function buildStages() {
  el.stages.replaceChildren(...STAGES.map((stage) => {
    const li = document.createElement("li");
    li.className = "stage";
    li.dataset.state = "todo";
    li.innerHTML = `
      <span class="stage__hour"></span>
      <div class="stage__body">
        <h3 class="stage__title"><span aria-hidden="true">${stage.icon}</span><span></span></h3>
        <p class="stage__text"></p>
      </div>`;
    li.querySelector(".stage__hour").textContent = `${stage.hour}h`;
    li.querySelector(".stage__title span:last-child").textContent = stage.title;
    li.querySelector(".stage__text").textContent = stage.text;
    return li;
  }));
  stageNodes = [...el.stages.children];
}

/** `activeIndex` of -1 means no fast is running. */
function markStages(activeIndex) {
  for (let i = 0; i < stageNodes.length; i++) {
    const state = i === activeIndex ? "active" : i < activeIndex ? "done" : "todo";
    if (stageNodes[i].dataset.state !== state) stageNodes[i].dataset.state = state;
  }
}

/* ── Streak calendar ──────────────────────────────────────────────── */

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat(undefined, { month: "long" });
const dayNameFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "short" });

/** First of the month currently on screen. */
let calCursor = new Date();

function buildCalendar() {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);

  // 2024-09-01 was a Sunday, so this walks Sun→Sat in the reader's locale.
  const narrow = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
  el.calDow.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const span = document.createElement("span");
    span.textContent = narrow.format(new Date(2024, 8, 1 + i));
    return span;
  }));

  const step = (months) => {
    calCursor.setMonth(calCursor.getMonth() + months);
    paintCalendar(store.state.fasts);
  };
  el.calPrev.addEventListener("click", () => step(-1));
  el.calNext.addEventListener("click", () => step(1));
}

function paintCalendar(fasts) {
  const hits = fastedDays(fasts);
  const todayIdx = dayIndex(Date.now());
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();

  el.calMonth.textContent = monthFmt.format(calCursor);

  // Nothing to see in the future.
  const now = new Date();
  el.calNext.disabled =
    year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.innerHTML = `<span class="day day--blank"></span>`;
    cells.push(blank);
  }

  let monthHits = 0;
  for (let date = 1; date <= daysInMonth; date++) {
    const stamp = new Date(year, month, date).getTime();
    const idx = dayIndex(stamp);
    const hit = hits.has(idx);
    if (hit) monthHits++;

    const column = (firstDow + date - 1) % 7;
    // Chain into tomorrow only when it's fasted and sits in the same week row.
    const chain = hit && column < 6 && date < daysInMonth && hits.has(idx + 1);

    const cell = document.createElement("div");
    cell.className = `cell${chain ? " cell--chain" : ""}`;

    const day = document.createElement("span");
    day.className = "day" +
      (hit ? " day--hit" : "") +
      (idx === todayIdx ? " day--today" : "") +
      (idx > todayIdx ? " day--future" : "");
    day.textContent = date;
    day.title = hit ? `Fasted on ${dayNameFmt.format(stamp)}` : dayNameFmt.format(stamp);

    cell.append(day);
    cells.push(cell);
  }

  el.calGrid.replaceChildren(...cells);

  if (!fasts.length) {
    el.calHint.textContent = "No fasts logged yet";
    return;
  }
  const { streak } = computeStats(fasts);
  const label = monthShortFmt.format(calCursor);
  el.calHint.textContent =
    `${streak}-day streak · ${monthHits} day${monthHits === 1 ? "" : "s"} in ${label}`;
}

function paintStats(fasts) {
  const { streak, longest, total, hours } = computeStats(fasts);
  el.statStreak.textContent = streak;
  el.statLongest.textContent = longest ? formatDuration(longest) : "0h";
  el.statTotal.textContent = total;
  el.statHours.textContent = `${Math.round(hours)}h`;
}

function paintHistory(fasts) {
  if (!fasts.length) {
    el.historyHint.textContent = "Nothing logged yet";
    el.history.innerHTML =
      `<p class="empty"><span class="empty__drop" aria-hidden="true">💧</span><br>
       Your first fast will appear here. Start the clock whenever you're ready.</p>`;
    return;
  }

  el.historyHint.textContent = `${fasts.length} fast${fasts.length === 1 ? "" : "s"} logged`;
  const sorted = [...fasts].sort((a, b) => b.start - a.start);

  el.history.replaceChildren(...sorted.map((fast) => {
    const duration = fast.end - fast.start;
    const hit = duration >= fast.goalHours * 3.6e6;

    const row = document.createElement("article");
    row.className = "entry";
    row.dataset.hit = String(hit);
    row.innerHTML = `
      <span class="entry__badge" aria-hidden="true">${hit ? "🏆" : "💧"}</span>
      <div class="entry__main">
        <span class="entry__dur"></span>
        <span class="entry__when"></span>
      </div>
      <span class="entry__goal"></span>
      <button class="entry__act" type="button" data-act="edit" aria-label="Edit this fast">${PENCIL_ICON}</button>
      <button class="entry__act" type="button" data-act="delete" aria-label="Delete this fast">${TRASH_ICON}</button>`;

    row.querySelector(".entry__dur").textContent = formatDuration(duration);
    row.querySelector(".entry__when").textContent =
      `${dateFmt.format(fast.start)}, ${timeFmt.format(fast.start)} → ${timeFmt.format(fast.end)}`;
    row.querySelector(".entry__goal").textContent = `${fast.goalHours}h goal`;

    row.querySelector('[data-act="edit"]').addEventListener("click", () => {
      openEditor({ kind: "fast", id: fast.id, start: fast.start, end: fast.end });
    });

    row.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      if (!confirm("Delete this fast? This can't be undone.")) return;
      await store.deleteFast(fast.id);
      toast("Fast deleted", { icon: "🗑️", duration: 2600 });
    });
    return row;
  }));
}

function paintControls() {
  const running = Boolean(store.state.activeFast);
  const goal = store.state.activeFast?.goalHours ?? store.state.settings.goalHours;

  el.startBtn.hidden = running;
  el.endBtn.hidden = !running;
  el.editStartBtn.hidden = !running;
  el.cancelBtn.hidden = !running;

  el.startedAt.hidden = !running;
  if (running) {
    const { start, goalHours } = store.state.activeFast;
    const goalAt = start + goalHours * 3.6e6;
    const sameDay = dayIndex(goalAt) === dayIndex(start);
    el.startedAt.textContent =
      `Started ${dateFmt.format(start)} at ${timeFmt.format(start)}` +
      ` · ${goalHours}h goal at ${sameDay ? "" : dateFmt.format(goalAt) + " "}${timeFmt.format(goalAt)}`;
  }

  for (const chip of el.goalRow.querySelectorAll(".chip")) {
    const pressed = String(Number(chip.dataset.goal) === goal);
    if (chip.getAttribute("aria-pressed") !== pressed) chip.setAttribute("aria-pressed", pressed);
  }
}

/*
 * Firestore fires a snapshot for metadata changes too (pending write, cache →
 * server), so `change` can arrive several times per edit. Rebuilding ~50 nodes
 * each time is wasted work; only redraw the lists when the data really moved.
 */
let lastFastsKey = null;
const fastsKey = (fasts) =>
  fasts.map((f) => `${f.id}:${f.start}:${f.end}:${f.goalHours}`).join("|");

function render() {
  paintControls();

  const key = fastsKey(store.state.fasts);
  if (key !== lastFastsKey) {
    lastFastsKey = key;
    paintStats(store.state.fasts);
    paintCalendar(store.state.fasts);
    paintHistory(store.state.fasts);
  }
  tick();
}

/* ── Start / end editor ───────────────────────────────────────────── */

/**
 * Three modes:
 *   { kind: "active" }            move the running fast's start
 *   { kind: "end" }               finish the running fast at a chosen time
 *   { kind: "fast", id, ... }     correct a logged fast's start and end
 */
let editTarget = null;

const EDITOR_MODES = {
  active: {
    title: "When did you actually start?",
    hint: "Forgot to hit begin? Set the real time your fast started.",
    start: true, end: false, save: "Save"
  },
  end: {
    title: "When did you break your fast?",
    hint: "Defaults to right now. Back-date it if you ate earlier.",
    start: false, end: true, save: "End fast"
  },
  fast: {
    title: "Edit this fast",
    hint: "Adjust when this fast started and when you broke it.",
    start: true, end: true, save: "Save"
  }
};

/** A hidden input that is still `required` blocks submit and can't be focused. */
function setField(field, input, { show, value = "", min = null, max = null }) {
  field.hidden = !show;
  input.required = show;
  input.value = show ? value : "";
  if (min) input.min = min; else input.removeAttribute("min");
  if (max) input.max = max; else input.removeAttribute("max");
}

function openEditor(target) {
  const mode = EDITOR_MODES[target.kind];
  const active = store.state.activeFast;
  if (!mode) return;
  if ((target.kind === "active" || target.kind === "end") && !active) return;

  editTarget = target;
  const nowValue = toLocalInput(Date.now());

  el.editTitle.textContent = mode.title;
  el.editHint.textContent = mode.hint;
  el.saveEditBtn.textContent = mode.save;

  // Only the fields a mode actually shows have a value; an "end" target has no
  // `start` of its own, and formatting `undefined` as a date throws.
  setField(el.startField, el.startInput, {
    show: mode.start,
    value: target.kind === "active" ? toLocalInput(active.start)
         : target.kind === "fast"   ? toLocalInput(target.start) : "",
    max: nowValue
  });

  setField(el.endField, el.endInput, {
    show: mode.end,
    value: target.kind === "end"  ? nowValue
         : target.kind === "fast" ? toLocalInput(target.end) : "",
    // Can't end before you began, can't end after now.
    min: target.kind === "end" ? toLocalInput(active.start) : null,
    max: nowValue
  });

  el.editError.hidden = true;
  el.editModal.showModal();
}

const parseField = (input) => new Date(input.value).getTime();

/** The end-of-fast sheet, shown once a fast has been filed. */
function celebrate(record) {
  const duration = record.end - record.start;
  const hours = duration / 3.6e6;
  el.doneTitle.textContent = hours >= record.goalHours ? "Goal reached" : "Fast logged";
  el.doneTime.textContent = formatDuration(duration);
  el.doneMsg.textContent = completionMessage(hours, record.goalHours);
  el.doneModal.showModal();
}

/** Writes the edit. The dialog has already accepted the submission. */
async function applyEdit() {
  const target = editTarget;
  editTarget = null;
  if (!target) return;

  if (target.kind === "end") {
    const record = await store.endFast(parseField(el.endInput));
    unprime();
    if (record) celebrate(record);
    return;
  }

  const start = parseField(el.startInput);
  if (target.kind === "active") {
    await store.setStart(start);
    unprime(); // a backdated start must not fire a burst of skipped milestones
    toast("Start time updated", { icon: "🕰️", duration: 2600 });
  } else {
    await store.updateFast(target.id, { start, end: parseField(el.endInput) });
    toast("Fast updated", { icon: "🕰️", duration: 2600 });
  }
}

/** Returns a human message when the form can't be saved, otherwise null. */
function validateEditor() {
  if (!editTarget) return null;
  const now = Date.now();

  if (editTarget.kind === "end") {
    const active = store.state.activeFast;
    if (!active) return "This fast is no longer running.";
    const end = parseField(el.endInput);
    if (Number.isNaN(end)) return "Pick an end time.";
    if (end > now) return "A fast can't end in the future.";
    if (end < active.start) return "You can't end a fast before it started.";
    return null;
  }

  const start = parseField(el.startInput);
  if (Number.isNaN(start)) return "Pick a start time.";
  if (start > now) return "A fast can't start in the future.";

  if (editTarget.kind === "active") {
    return now - start > 30 * 86_400_000 ? "That's more than 30 days ago." : null;
  }

  const end = parseField(el.endInput);
  if (Number.isNaN(end)) return "Pick an end time.";
  if (end > now) return "A fast can't end in the future.";
  if (end <= start) return "The end has to come after the start.";
  return null;
}

/* ── Events ───────────────────────────────────────────────────────── */

function wireControls() {
  el.goalRow.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (chip) store.setGoal(Number(chip.dataset.goal));
  });

  el.startBtn.addEventListener("click", async () => {
    unprime();
    await store.startFast(store.state.settings.goalHours);
    toast("Fast started. One hour at a time.", { icon: "🌊", win: true });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  });

  el.endBtn.addEventListener("click", () => {
    if (store.state.activeFast) openEditor({ kind: "end" });
  });

  el.cancelBtn.addEventListener("click", async () => {
    if (!confirm("Discard this fast without logging it?")) return;
    await store.cancelFast();
    unprime();
    toast("Fast discarded", { icon: "↩️", duration: 2600 });
  });

  el.doneCloseBtn.addEventListener("click", () => el.doneModal.close());

  el.editStartBtn.addEventListener("click", () => {
    if (store.state.activeFast) openEditor({ kind: "active" });
  });

  el.cancelEditBtn.addEventListener("click", () => {
    editTarget = null;
    el.editModal.close();
  });

  // Escape dismisses the dialog without a submit; don't leave a target behind.
  el.editModal.addEventListener("cancel", () => { editTarget = null; });

  // `max` on the inputs lets the browser block a submit before our validator
  // runs, which would leave a stale message on screen. Clear it as they type.
  for (const input of [el.startInput, el.endInput]) {
    input.addEventListener("input", () => { el.editError.hidden = true; });
  }

  /*
   * The save happens here rather than on the dialog's `close` event. A
   * form[method=dialog] closes the dialog itself, and `close` fires on its own
   * schedule; hanging a write off it makes the save silently depend on an event
   * that is awkward to observe and easy to miss. Submitting is the intent.
   */
  el.editForm.addEventListener("submit", (event) => {
    const problem = validateEditor();
    if (problem) {
      event.preventDefault();          // keeps the dialog open with the message
      el.editError.textContent = problem;
      el.editError.hidden = false;
      return;
    }
    applyEdit();                       // the dialog closes itself
  });
}

function wireTheme() {
  el.themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    store.theme = next;
    root.dataset.theme = next;
  });
}

/** Lite mode is chosen before first paint by the inline boot script. */
function wirePerf() {
  const sync = () => {
    const lite = root.dataset.lite === "true";
    el.perfBtn.setAttribute("aria-pressed", String(lite));
    el.perfBtn.textContent = lite ? "Motion reduced" : "Reduce motion";
    el.perfBtn.title = lite
      ? "Blur, ambient motion and glows are off. Click to restore them."
      : "Turn off blur, ambient motion and glows to save battery and CPU.";
  };

  el.perfBtn.addEventListener("click", () => {
    const lite = root.dataset.lite === "true";
    if (lite) delete root.dataset.lite;
    else root.dataset.lite = "true";
    localStorage.setItem("waterline:perf", lite ? "full" : "lite");
    sync();
  });

  sync();
}

function wireAuth() {
  el.signInBtn.addEventListener("click", async () => {
    if (!store.canSignIn) {
      toast("Add your Firebase keys in js/config.js to enable sync.", { icon: "🔑", duration: 7000 });
      return;
    }
    try {
      await store.signIn();
    } catch (err) {
      console.error(err);
      toast(
        err.message === "sdk-unavailable"
          ? "Can't reach Firebase. You're offline — local mode still works."
          : "Sign-in failed. Check your Firebase authorised domains.",
        { icon: "⚠️", duration: 7000 }
      );
    }
  });

  el.avatarBtn.addEventListener("click", () => {
    const open = el.userMenu.hidden;
    el.userMenu.hidden = !open;
    el.avatarBtn.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (event) => {
    if (!el.avatarMenu.contains(event.target) && !el.userMenu.hidden) {
      el.userMenu.hidden = true;
      el.avatarBtn.setAttribute("aria-expanded", "false");
    }
  });

  el.signOutBtn.addEventListener("click", async () => {
    el.userMenu.hidden = true;
    await store.signOut();
    toast("Signed out. Back to local mode.", { icon: "👋" });
  });

  store.addEventListener("auth", ({ detail: user }) => {
    el.signInBtn.hidden = Boolean(user);
    el.avatarMenu.hidden = !user;
    if (user) {
      el.avatarImg.src = user.photoURL ?? "";
      el.avatarImg.alt = user.displayName ?? "Your account";
      el.menuName.textContent = user.displayName ?? "Signed in";
      el.menuEmail.textContent = user.email ?? "";
      el.buildMode.textContent = `Syncing live as ${user.displayName ?? user.email}`;
    } else {
      el.buildMode.textContent = store.canSignIn ? "Local mode — sign in to sync" : "Local mode";
    }
  });

  store.addEventListener("merged", ({ detail: count }) => {
    toast(`Moved ${count} local ${count === 1 ? "record" : "records"} into your account.`, { icon: "☁️", win: true, duration: 6000 });
  });

  store.addEventListener("status", ({ detail }) => {
    el.syncPill.dataset.state = detail.state;
    el.syncPill.querySelector(".sync-pill__text").textContent = detail.text;
    el.syncPill.title = {
      live: "Changes sync to your other devices instantly",
      offline: "Offline — changes are queued and will sync",
      local: "Saved on this device only"
    }[detail.state];
  });
}

/* ── Boot ─────────────────────────────────────────────────────────── */

el.coachQuote.textContent = quoteOfTheHour();
resetGauge();
buildStages();
buildCalendar();
wireTheme();
wirePerf();
wireControls();
wireAuth();

watchGaugeVisibility();
store.subscribe(render);
render();
store.init();

// A hidden tab still runs compositor animations; stop the clock and the waves.
// Crossing midnight with the tab open moves "today" and can extend a streak,
// so the calendar and stats are repainted when the calendar day changes.
let shownDay = dayIndex(Date.now());
setInterval(() => {
  if (document.hidden) return;
  tick();
  const today = dayIndex(Date.now());
  if (today !== shownDay) {
    shownDay = today;
    paintCalendar(store.state.fasts);
    paintStats(store.state.fasts);
  }
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    root.dataset.hidden = "true";
  } else {
    delete root.dataset.hidden;
    tick();
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
