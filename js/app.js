/**
 * Waterline — UI controller.
 */
import { store, computeStats, dayIndex, fastedDays } from "./store.js";
import { STAGES, stageAt, QUOTES, completionMessage } from "./stages.js";
import {
  t, getLang, setLang, applyStatic,
  localizedStage, localizedQuote, localizedCompletion
} from "./i18n.js";

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

const el = {
  ring: $("ring"), ringFill: $("ringFill"),
  ringLabel: $("ringLabel"), ringTime: $("ringTime"), ringMeta: $("ringMeta"),
  coach: $("coach"),
  goalRow: $("goalRow"), goalSelect: $("goalSelect"),
  startBtn: $("startBtn"), endBtn: $("endBtn"),
  timerFoot: $("timerFoot"), startedAt: $("startedAt"),
  editStartBtn: $("editStartBtn"), cancelBtn: $("cancelBtn"),
  statStreak: $("statStreak"), statLongest: $("statLongest"),
  statTotal: $("statTotal"), statHours: $("statHours"),
  stages: $("stages"), history: $("history"), historyHint: $("historyHint"),
  calDow: $("calDow"), calGrid: $("calGrid"), calMonth: $("calMonth"),
  calHint: $("calHint"), calPrev: $("calPrev"), calNext: $("calNext"),
  themeBtn: $("themeBtn"), signInBtn: $("signInBtn"),
  avatarMenu: $("avatarMenu"), avatarBtn: $("avatarBtn"), avatarImg: $("avatarImg"),
  chipName: $("chipName"), userMenu: $("userMenu"),
  menuName: $("menuName"), menuEmail: $("menuEmail"), signOutBtn: $("signOutBtn"),
  buildMode: $("buildMode"), toasts: $("toasts"),
  langBtn: $("langBtn"), langLabel: $("langLabel"),
  editModal: $("editModal"), editForm: $("editForm"), startInput: $("startInput"),
  endInput: $("endInput"), endField: $("endField"), editTitle: $("editTitle"),
  editHint: $("editHint"), editError: $("editError"), cancelEditBtn: $("cancelEditBtn"),
  startField: $("startField"), saveEditBtn: $("saveEditBtn"),
  doneModal: $("doneModal"), doneTitle: $("doneTitle"), doneTime: $("doneTime"),
  doneMsg: $("doneMsg"), doneCloseBtn: $("doneCloseBtn")
};

/** Must match r on .ring__fill in the stylesheet. */
const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;

/**
 * The ring is an encouragement curve, not a ruler.
 *
 * Real progress is linear and, early on, invisible: twenty minutes into a
 * 16-hour fast is 2% — a sliver that reads as "you have done nothing". So the
 * *ring* is eased by p^0.55, which front-loads the fill (2% real → 12% drawn,
 * 50% → 68%), then slows as you approach the goal. It still starts at empty
 * and lands exactly on full at the goal, so it never disagrees with itself.
 *
 * Nothing numeric is eased: the clock, the time remaining, the logged
 * duration and every statistic are the real values. Set this to 1 for a
 * linear ring.
 */
const RING_CURVE = 0.55;
const easeProgress = (p) => Math.pow(p, RING_CURVE);

/** Goals offered in the picker, in hours. */
const GOAL_CHOICES = [12, 13, 14, 16, 18, 20, 24, 36, 48, 72];

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

/**
 * "16h 04m" — the human-readable form used in history and stats.
 *
 * Floored, never rounded: rounding would print "16h 00m" for a fast of
 * 15h 59m 40s and then not award the 16h goal beside it.
 */
function formatDuration(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

/** Time still to come, rounded up so it only hits "0m" when it really is up. */
function formatCountdown(ms) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const MINUTE = 60_000;

/** `datetime-local` works in whole minutes, so its bounds must too. */
const toLocalInput = (ms) =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Rounded up to the next whole minute — a lower bound must not fall below `ms`. */
const toLocalInputCeil = (ms) => toLocalInput(Math.ceil(ms / MINUTE) * MINUTE);

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
  node.innerHTML = `<span class="toast__icon" aria-hidden="true"></span><span></span>`;
  node.firstElementChild.textContent = icon;
  node.lastElementChild.textContent = message;
  el.toasts.append(node);

  setTimeout(() => {
    node.dataset.out = "true";
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400); // reduced-motion collapses the animation
  }, duration);
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "./icons/icon-192.png", tag: "waterline-stage" });
  } catch { /* some browsers need a service worker registration; the toast still fired */ }
}

/* ── The ring ─────────────────────────────────────────────────────── */

/*
 * Written only when it visibly moves. Left unguarded, a 16-hour fast nudges
 * stroke-dashoffset by a fraction of a pixel every second, and each write
 * restarts a 700ms transition — a permanent repaint loop for a change nobody
 * can see.
 */
let lastOffset = null, lastComplete = null;

/** Pinned from JS so the dash pattern can never drift from RING_R. */
el.ringFill.style.strokeDasharray = RING_C;

function paintRing(progress, complete) {
  const offset = RING_C * (1 - easeProgress(progress));
  if (lastOffset === null || Math.abs(offset - lastOffset) >= 0.5) {
    el.ringFill.style.strokeDashoffset = offset;
    lastOffset = offset;
  }
  if (complete !== lastComplete) {
    el.ring.dataset.complete = String(complete);
    lastComplete = complete;
  }
}

/* ── The one-second loop ──────────────────────────────────────────── */

function tick() {
  const { activeFast, settings } = store.state;

  if (!activeFast) {
    setText(el.ringLabel, t("ring.ready"));
    setText(el.ringTime, "00:00:00");
    setText(el.ringMeta, t("ring.readyMeta", { goal: settings.goalHours }));
    setText(el.coach, idleQuote);
    paintRing(0, false);
    markStages(-1);
    unprime();
    return;
  }

  const elapsed = Date.now() - activeFast.start;
  const goalMs = activeFast.goalHours * 3.6e6;
  const progress = goalMs > 0 ? Math.min(1, Math.max(0, elapsed / goalMs)) : 0;
  const reachedGoal = goalMs > 0 && elapsed >= goalMs;
  const { index, current, next } = stageAt(elapsed / 3.6e6);
  const stage = localizedStage(current);

  setText(el.ringLabel, stage.title);
  setText(el.ringTime, formatElapsed(elapsed));
  setText(el.ringMeta, reachedGoal
    ? t("ring.past", { time: formatDuration(elapsed - goalMs), goal: activeFast.goalHours })
    : t("ring.left", { time: formatCountdown(goalMs - elapsed) }));

  setText(el.coach, next
    ? t("coach.until", { time: formatCountdown(next.hour * 3.6e6 - elapsed), stage: localizedStage(next).title })
    : t("coach.pastAll"));

  paintRing(progress, reachedGoal);
  markStages(index);

  if (!primed) {
    lastStageIndex = index;
    goalCelebrated = reachedGoal;
    primed = true;
    return;
  }

  if (index > lastStageIndex) {
    toast(stage.cheer, { icon: stage.icon, win: true, duration: 8000 });
    notify(`${stage.icon} ${stage.title}`, stage.cheer);
    lastStageIndex = index;
  }

  if (reachedGoal && !goalCelebrated) {
    goalCelebrated = true;
    toast(t("toast.goalReached", { goal: activeFast.goalHours }), { icon: "🏆", win: true, duration: 7000 });
    notify(t("notify.goalTitle"), t("notify.goalBody", { goal: activeFast.goalHours }));
  }
}

/* ── Sections ─────────────────────────────────────────────────────── */

/** Built once at boot; the timer only flips each row's `data-state` after that. */
function buildStages() {
  el.stages.replaceChildren(...STAGES.map((raw) => {
    const stage = localizedStage(raw);
    const li = document.createElement("li");
    li.className = "stage";
    li.dataset.state = "todo";
    li.innerHTML = `
      <span class="stage__hour"></span>
      <div class="stage__body">
        <h3 class="stage__title"><span aria-hidden="true"></span><span></span></h3>
        <p class="stage__text"></p>
      </div>`;
    li.querySelector(".stage__hour").textContent = `${stage.hour}h`;
    li.querySelector(".stage__title span:first-child").textContent = stage.icon;
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

/* ── Goal picker ──────────────────────────────────────────────────── */

/**
 * One control instead of a wall of chips. Any goal already saved that isn't on
 * the menu is added, so the picker can never show a value that isn't yours.
 */
function buildGoalOptions() {
  const saved = store.state.activeFast?.goalHours ?? store.state.settings.goalHours;
  const hours = [...new Set([...GOAL_CHOICES, saved])].sort((a, b) => a - b);

  el.goalSelect.replaceChildren(...hours.map((h) => {
    const option = document.createElement("option");
    option.value = h;
    option.textContent = t("goal.option", { h });
    return option;
  }));
  el.goalSelect.value = String(saved);
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

    const cell = document.createElement("div");
    cell.className = "cell";

    const day = document.createElement("span");
    day.className = "day" +
      (hit ? " day--hit" : "") +
      (idx === todayIdx ? " day--today" : "") +
      (idx > todayIdx ? " day--future" : "");
    day.textContent = date;
    day.title = hit ? t("cal.fastedOn", { date: dayNameFmt.format(stamp) }) : dayNameFmt.format(stamp);

    cell.append(day);
    cells.push(cell);
  }

  el.calGrid.replaceChildren(...cells);

  if (!fasts.length) {
    el.calHint.textContent = t("cal.emptyHint");
    return;
  }
  const { streak } = computeStats(fasts);
  el.calHint.textContent = t("cal.summary", {
    streak, days: monthHits, month: monthShortFmt.format(calCursor)
  });
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
    el.historyHint.textContent = t("history.emptyHint");
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.innerHTML = `<span class="empty__mark" aria-hidden="true">💧</span>`;
    empty.append(t("history.empty"));
    el.history.replaceChildren(empty);
    return;
  }

  el.historyHint.textContent = t("history.count", { n: fasts.length });
  const sorted = [...fasts].sort((a, b) => b.start - a.start);

  el.history.replaceChildren(...sorted.map((fast) => {
    const duration = fast.end - fast.start;
    const hit = duration >= fast.goalHours * 3.6e6;

    const row = document.createElement("article");
    row.className = "entry";
    row.dataset.hit = String(hit);
    row.innerHTML = `
      <span class="entry__hit" aria-hidden="true"></span>
      <div class="entry__main">
        <span class="entry__dur"></span>
        <span class="entry__when"></span>
      </div>
      <span class="entry__goal"></span>
      <button class="entry__act" type="button" data-act="edit"></button>
      <button class="entry__act" type="button" data-act="delete"></button>`;

    row.querySelector(".entry__dur").textContent = formatDuration(duration);
    row.querySelector(".entry__when").textContent =
      `${dateFmt.format(fast.start)}, ${timeFmt.format(fast.start)} → ${timeFmt.format(fast.end)}`;
    row.querySelector(".entry__goal").textContent = t("history.goalTag", { goal: fast.goalHours });

    const editBtn = row.querySelector('[data-act="edit"]');
    editBtn.innerHTML = PENCIL_ICON;
    editBtn.setAttribute("aria-label", t("entry.editAria"));
    editBtn.addEventListener("click", () => {
      openEditor({ kind: "fast", id: fast.id, start: fast.start, end: fast.end });
    });

    const delBtn = row.querySelector('[data-act="delete"]');
    delBtn.innerHTML = TRASH_ICON;
    delBtn.setAttribute("aria-label", t("entry.deleteAria"));
    delBtn.addEventListener("click", async () => {
      if (!confirm(t("entry.deleteConfirm"))) return;
      await store.deleteFast(fast.id);
      toast(t("toast.deleted"), { icon: "🗑️", duration: 2600 });
    });
    return row;
  }));
}

function paintControls() {
  const active = store.state.activeFast;
  const running = Boolean(active);
  const goal = active?.goalHours ?? store.state.settings.goalHours;

  el.startBtn.hidden = running;
  el.endBtn.hidden = !running;
  el.timerFoot.hidden = !running;

  if (running) {
    const { start, goalHours } = active;
    const goalAt = start + goalHours * 3.6e6;
    const sameDay = dayIndex(goalAt) === dayIndex(start);
    el.startedAt.textContent = t("controls.startedAt", {
      start: `${dateFmt.format(start)} ${timeFmt.format(start)}`,
      goal: goalHours,
      goalAt: `${sameDay ? "" : dateFmt.format(goalAt) + " "}${timeFmt.format(goalAt)}`
    });
  }

  // A goal already in progress is fixed; the picker shows it, greyed.
  if (el.goalSelect.disabled !== running) {
    el.goalSelect.disabled = running;
    el.goalRow.classList.toggle("goal--locked", running);
  }
  const lockNote = running ? t("goal.locked") : "";
  if (el.goalRow.title !== lockNote) el.goalRow.title = lockNote;

  const value = String(goal);
  if (el.goalSelect.value !== value) {
    // A goal restored from another device may not be on the menu yet.
    if (!Array.from(el.goalSelect.options).some((o) => o.value === value)) buildGoalOptions();
    el.goalSelect.value = value;
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
  active: { titleKey: "editor.activeTitle", hintKey: "editor.activeHint", saveKey: "editor.save",    start: true,  end: false },
  end:    { titleKey: "editor.endTitle",    hintKey: "editor.endHint",    saveKey: "editor.saveEnd", start: false, end: true },
  fast:   { titleKey: "editor.fastTitle",   hintKey: "editor.fastHint",   saveKey: "editor.save",    start: true,  end: true }
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
  if (el.editModal.open) return;

  editTarget = target;
  const nowValue = toLocalInput(Date.now());

  el.editTitle.textContent = t(mode.titleKey);
  el.editHint.textContent = t(mode.hintKey);
  el.saveEditBtn.textContent = t(mode.saveKey);

  /*
   * Only the fields a mode actually shows have a value; an "end" target has no
   * `start` of its own, and formatting `undefined` as a date throws.
   *
   * Deliberately no `max`. "Not in the future" is the one bound that moves
   * while the dialog sits open: a max of 10:30 pinned at open time would
   * reject 10:32 two minutes later, even though 10:32 is now safely in the
   * past. validateEditor() re-reads the clock on submit, so it owns that rule.
   * `min` is derived from a start that cannot drift, so it stays.
   */
  setField(el.startField, el.startInput, {
    show: mode.start,
    value: target.kind === "active" ? toLocalInput(active.start)
         : target.kind === "fast"   ? toLocalInput(target.start) : ""
  });

  setField(el.endField, el.endInput, {
    show: mode.end,
    value: target.kind === "end"  ? nowValue
         : target.kind === "fast" ? toLocalInput(target.end) : "",
    // Can't end before you began. Rounded *up* to the minute: a fast begun at
    // 10:00:45 must not offer 10:00 as an end.
    min: target.kind === "end"  ? toLocalInputCeil(active.start)
       : target.kind === "fast" ? toLocalInputCeil(target.start + 1) : null
  });

  el.editError.hidden = true;
  el.editModal.showModal();
}

const parseField = (input) => new Date(input.value).getTime();

/** The end-of-fast sheet, shown once a fast has been filed. */
function celebrate(record) {
  const duration = record.end - record.start;
  const hours = duration / 3.6e6;
  el.doneTitle.textContent = hours >= record.goalHours ? t("done.goalReached") : t("done.fastLogged");
  el.doneTime.textContent = formatDuration(duration);
  el.doneMsg.textContent = localizedCompletion(hours, record.goalHours, completionMessage);
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
    toast(t("toast.startUpdated"), { icon: "🕰️", duration: 2600 });
  } else {
    await store.updateFast(target.id, { start, end: parseField(el.endInput) });
    toast(t("toast.fastUpdated"), { icon: "🕰️", duration: 2600 });
  }
}

/** Returns a human message when the form can't be saved, otherwise null. */
function validateEditor() {
  if (!editTarget) return null;
  const now = Date.now();

  if (editTarget.kind === "end") {
    const active = store.state.activeFast;
    if (!active) return t("valid.noLongerRunning");
    const end = parseField(el.endInput);
    if (Number.isNaN(end)) return t("valid.pickEnd");
    if (end > now) return t("valid.endFuture");
    if (end < active.start) return t("valid.endBeforeStart");
    return null;
  }

  const start = parseField(el.startInput);
  if (Number.isNaN(start)) return t("valid.pickStart");
  if (start > now) return t("valid.startFuture");

  if (editTarget.kind === "active") {
    return now - start > 30 * 86_400_000 ? t("valid.tooOld") : null;
  }

  const end = parseField(el.endInput);
  if (Number.isNaN(end)) return t("valid.pickEnd");
  if (end > now) return t("valid.endFuture");
  if (end <= start) return t("valid.endAfterStart");
  return null;
}

/* ── Events ───────────────────────────────────────────────────────── */

function wireControls() {
  el.goalSelect.addEventListener("change", () => {
    store.setGoal(Number(el.goalSelect.value));
  });

  el.startBtn.addEventListener("click", async () => {
    unprime();
    await store.startFast(store.state.settings.goalHours);
    toast(t("toast.started"), { icon: "🌊", win: true });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  });

  el.endBtn.addEventListener("click", () => {
    if (store.state.activeFast) openEditor({ kind: "end" });
  });

  el.cancelBtn.addEventListener("click", async () => {
    if (!confirm(t("toast.discardConfirm"))) return;
    await store.cancelFast();
    unprime();
    toast(t("toast.discarded"), { icon: "↩️", duration: 2600 });
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

  for (const input of [el.startInput, el.endInput]) {
    input.addEventListener("input", () => { el.editError.hidden = true; });

    /*
     * `min` and `required` let the browser refuse the submit before our own
     * handler ever runs, which would leave the dialog open saying nothing at
     * all — the native bubble is easy to miss and can't be styled. Take the
     * message back: suppress the bubble and print the same in-dialog text
     * every other failure uses.
     */
    input.addEventListener("invalid", (event) => {
      event.preventDefault();
      el.editError.textContent = validateEditor() ?? t("valid.outOfRange");
      el.editError.hidden = false;
    });
  }

  el.startInput.addEventListener("input", () => {
    if (editTarget?.kind !== "fast") return;
    const start = parseField(el.startInput);
    if (Number.isNaN(start)) el.endInput.removeAttribute("min");
    else el.endInput.min = toLocalInputCeil(start + 1);
  });

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

/** Cross-fades every colour, then gets out of the way so hover stays snappy. */
let themingTimer = null;

function wireTheme() {
  el.themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    store.theme = next;
    root.dataset.theme = next;

    document.body.classList.add("theming");
    clearTimeout(themingTimer);
    themingTimer = setTimeout(() => document.body.classList.remove("theming"), 600);
  });
}

/* ── Language ─────────────────────────────────────────────────────── */

let currentUser = null;
let syncState = "local";          // local | live | offline, from the store
let idleQuote = "";

/** Footer status line — depends on the user, the language and the connection. */
function updateBuildMode() {
  const name = currentUser?.displayName ?? currentUser?.email ?? "";
  if (currentUser) {
    el.buildMode.textContent = syncState === "offline"
      ? t("status.offline")
      : t("status.syncingAs", { name });
  } else {
    el.buildMode.textContent = store.canSignIn ? t("status.localSignin") : t("status.local");
  }
}

function syncLangBtn() {
  el.langLabel.textContent = getLang() === "ko" ? "한" : "EN";
}

/** Re-render everything that carries translated text. */
function applyLanguage() {
  applyStatic(document);
  syncLangBtn();
  updateBuildMode();
  idleQuote = localizedQuote(QUOTES);
  buildStages();
  buildGoalOptions();
  lastFastsKey = null;   // force the data-driven lists to repaint in the new language
  render();
}

function wireLang() {
  el.langBtn.addEventListener("click", () => {
    setLang(getLang() === "ko" ? "en" : "ko");
    applyLanguage();
  });
}

function wireAuth() {
  el.signInBtn.addEventListener("click", async () => {
    if (!store.canSignIn) {
      toast(t("toast.needKeys"), { icon: "🔑", duration: 7000 });
      return;
    }
    try {
      await store.signIn();
    } catch (err) {
      console.error(err);
      toast(
        err.message === "sdk-unavailable" ? t("toast.offlineSignin") : t("toast.signinFailed"),
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
    el.avatarBtn.setAttribute("aria-expanded", "false");
    await store.signOut();
    toast(t("toast.signedOut"), { icon: "👋" });
  });

  store.addEventListener("auth", ({ detail: user }) => {
    currentUser = user;
    el.signInBtn.hidden = Boolean(user);
    el.avatarMenu.hidden = !user;
    if (user) {
      const name = user.displayName ?? "Signed in";
      el.avatarImg.src = user.photoURL ?? "";
      el.avatarImg.alt = "";
      el.chipName.textContent = name;
      el.menuName.textContent = name;
      el.menuEmail.textContent = user.email ?? "";
    }
    updateBuildMode();
  });

  // Local / Live / Offline, decided by the store as snapshots arrive.
  store.addEventListener("status", ({ detail }) => {
    syncState = detail.state;
    updateBuildMode();
  });

  store.addEventListener("merged", ({ detail: count }) => {
    toast(t("toast.merged", { count }), { icon: "☁️", win: true, duration: 6000 });
  });
}

/* ── Boot ─────────────────────────────────────────────────────────── */

applyStatic(document);      // swap the static HTML into the chosen language before first paint
syncLangBtn();
idleQuote = localizedQuote(QUOTES);
buildStages();
buildGoalOptions();
buildCalendar();
wireTheme();
wireLang();
wireControls();
wireAuth();
updateBuildMode();

store.subscribe(render);
render();
store.init();

// Let the first paint land before anything is allowed to animate.
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.body.classList.remove("preload");
}));

// A hidden tab still runs compositor animations; stop the clock while it is.
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
