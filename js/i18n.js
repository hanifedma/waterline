/**
 * Waterline — interface translations.
 *
 * This module localises the *interface only*. A reader's own data — the times
 * on the clock, logged durations, calendar dates — is always rendered through
 * Intl in the browser's locale and is never touched here.
 *
 * Stage descriptions, quotes and completion copy live in English in stages.js
 * (the test suite pins that wording); their Korean equivalents live here and
 * are selected at display time. That keeps stages.js as the single canonical
 * source and this file as a pure translation layer.
 */

export const LANGS = ["en", "ko"];
const LS_LANG = "waterline:lang";

/** Stored choice, else the browser's preference, else English. */
export function getLang() {
  const saved = localStorage.getItem(LS_LANG);
  if (saved && LANGS.includes(saved)) return saved;
  return (navigator.language || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function setLang(lang) {
  if (LANGS.includes(lang)) localStorage.setItem(LS_LANG, lang);
}

/* ── Dictionaries ─────────────────────────────────────────────────────
 * A value is either a plain string with {placeholders}, or a function of the
 * interpolation vars (used where a language pluralises or re-orders).
 */
const DICT = {
  en: {
    "a11y.home": "Waterline home",
    "a11y.theme": "Toggle colour theme",
    "a11y.lang": "Change language",
    "a11y.prevMonth": "Previous month",
    "a11y.nextMonth": "Next month",

    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",

    "gauge.ready": "Ready when you are",
    "gauge.underway": "Underway",
    "gauge.toTop": "to the top",
    "gauge.overflowing": "overflowing",
    "gauge.readyDetail": "Goal: {goal}h · tap begin",
    "gauge.goalSmashed": "{goal}h goal smashed",
    "gauge.pctOfGoal": "{pct}% of {goal}h",

    "goal.label": "Goal",
    "btn.begin": "Begin fast",
    "btn.end": "End fast",
    "btn.editStart": "Edit start",
    "btn.discard": "Discard",

    "coach.until": "{time} until {stage}",
    "coach.pastAll": "You are past every milestone on the map.",

    "stats.streak": "Day streak",
    "stats.longest": "Longest fast",
    "stats.total": "Fasts completed",
    "stats.hours": "Hours fasted",

    "cal.heading": "Streak calendar",
    "cal.emptyHint": "No fasts logged yet",
    "cal.summary": ({ streak, days, month }) =>
      `${streak}-day streak · ${days} day${days === 1 ? "" : "s"} in ${month}`,
    "cal.fastedOn": "Fasted on {date}",

    "stages.heading": "What's happening inside you",
    "stages.subhead": "The metabolic timeline of a water fast",
    "label.now": "NOW",

    "history.heading": "Your fasts",
    "history.emptyHint": "Nothing logged yet",
    "history.empty": "Your first fast will appear here. Start the clock whenever you're ready.",
    "history.count": ({ n }) => `${n} fast${n === 1 ? "" : "s"} logged`,
    "history.goalTag": "{goal}h goal",
    "entry.editAria": "Edit this fast",
    "entry.deleteAria": "Delete this fast",
    "entry.deleteConfirm": "Delete this fast? This can't be undone.",

    "controls.startedAt": ({ start, goal, goalAt }) =>
      `Started ${start} · ${goal}h goal at ${goalAt}`,
    "controls.goalLocked": "Locked — end your fast to change the goal",

    "disclaimer.title": "Health note.",
    "disclaimer.body":
      "Waterline is an informational tool, not medical advice. Extended water fasting can be dangerous if you are pregnant or breastfeeding, underweight, diabetic, on medication, or have a history of disordered eating. Talk to a doctor before fasts longer than 24 hours, and stop immediately if you feel faint, confused, or unwell.",

    "footer.tagline": "Waterline · Fill your waterline.",
    "perf.reduce": "Reduce motion",
    "perf.reduced": "Motion reduced",
    "perf.reduceTitle": "Turn off blur, ambient motion and glows to save battery and CPU.",
    "perf.reducedTitle": "Blur, ambient motion and glows are off. Click to restore them.",

    "modal.startTime": "Start time",
    "modal.endTime": "End time",
    "modal.cancel": "Cancel",
    "modal.save": "Save",
    "done.close": "Nice",

    "editor.activeTitle": "When did you actually start?",
    "editor.activeHint": "Forgot to hit begin? Set the real time your fast started.",
    "editor.endTitle": "When did you break your fast?",
    "editor.endHint": "Defaults to right now. Back-date it if you ate earlier.",
    "editor.fastTitle": "Edit this fast",
    "editor.fastHint": "Adjust when this fast started and when you broke it.",
    "editor.saveEnd": "End fast",
    "editor.save": "Save",

    "valid.noLongerRunning": "This fast is no longer running.",
    "valid.pickEnd": "Pick an end time.",
    "valid.endFuture": "A fast can't end in the future.",
    "valid.endBeforeStart": "You can't end a fast before it started.",
    "valid.pickStart": "Pick a start time.",
    "valid.startFuture": "A fast can't start in the future.",
    "valid.tooOld": "That's more than 30 days ago.",
    "valid.endAfterStart": "The end has to come after the start.",

    "done.goalReached": "Goal reached",
    "done.fastLogged": "Fast logged",

    "toast.started": "Fast started. One hour at a time.",
    "toast.startUpdated": "Start time updated",
    "toast.fastUpdated": "Fast updated",
    "toast.deleted": "Fast deleted",
    "toast.discardConfirm": "Discard this fast without logging it?",
    "toast.discarded": "Fast discarded",
    "toast.goalReached": "{goal}h goal reached. Anything now is a bonus.",
    "toast.needKeys": "Add your Firebase keys in js/config.js to enable sync.",
    "toast.offlineSignin": "Can't reach Firebase. You're offline — local mode still works.",
    "toast.signinFailed": "Sign-in failed. Check your Firebase authorised domains.",
    "toast.signedOut": "Signed out. Back to local mode.",
    "toast.merged": ({ count }) =>
      `Moved ${count} local record${count === 1 ? "" : "s"} into your account.`,

    "notify.goalTitle": "Goal reached 🏆",
    "notify.goalBody": "You hit your {goal}-hour goal.",

    "status.syncingAs": "Syncing live as {name}",
    "status.localSignin": "Local mode — sign in to sync",
    "status.local": "Local mode"
  },

  ko: {
    "a11y.home": "Waterline 홈",
    "a11y.theme": "색상 테마 전환",
    "a11y.lang": "언어 변경",
    "a11y.prevMonth": "이전 달",
    "a11y.nextMonth": "다음 달",

    "nav.signIn": "로그인",
    "nav.signOut": "로그아웃",

    "gauge.ready": "준비되면 시작하세요",
    "gauge.underway": "진행 중",
    "gauge.toTop": "가득 차기까지",
    "gauge.overflowing": "흘러넘치는 중",
    "gauge.readyDetail": "목표: {goal}시간 · 시작을 누르세요",
    "gauge.goalSmashed": "{goal}시간 목표 달성",
    "gauge.pctOfGoal": "{goal}시간 중 {pct}%",

    "goal.label": "목표",
    "btn.begin": "단식 시작",
    "btn.end": "단식 종료",
    "btn.editStart": "시작 시간 수정",
    "btn.discard": "취소",

    "coach.until": "{stage}까지 {time} 남음",
    "coach.pastAll": "지도의 모든 단계를 지나왔습니다.",

    "stats.streak": "연속 일수",
    "stats.longest": "최장 단식",
    "stats.total": "완료한 단식",
    "stats.hours": "누적 단식 시간",

    "cal.heading": "연속 기록 달력",
    "cal.emptyHint": "아직 기록된 단식이 없습니다",
    "cal.summary": ({ streak, days, month }) =>
      `${streak}일 연속 · ${month}에 ${days}일`,
    "cal.fastedOn": "{date} 단식함",

    "stages.heading": "몸속에서 일어나는 일",
    "stages.subhead": "물 단식의 대사 타임라인",
    "label.now": "지금",

    "history.heading": "나의 단식 기록",
    "history.emptyHint": "아직 기록이 없습니다",
    "history.empty": "첫 단식이 여기에 표시됩니다. 준비되면 언제든 시작하세요.",
    "history.count": ({ n }) => `${n}개 기록됨`,
    "history.goalTag": "{goal}시간 목표",
    "entry.editAria": "이 단식 수정",
    "entry.deleteAria": "이 단식 삭제",
    "entry.deleteConfirm": "이 단식을 삭제할까요? 되돌릴 수 없습니다.",

    "controls.startedAt": ({ start, goal, goalAt }) =>
      `${start} 시작 · 목표 ${goal}시간, ${goalAt} 도달`,
    "controls.goalLocked": "잠김 — 목표를 바꾸려면 단식을 종료하세요",

    "disclaimer.title": "건강 유의사항.",
    "disclaimer.body":
      "Waterline은 정보 제공 도구이며 의학적 조언이 아닙니다. 임신·수유 중이거나 저체중, 당뇨, 복약 중이거나 섭식 장애 이력이 있다면 장시간 물 단식은 위험할 수 있습니다. 24시간이 넘는 단식 전에는 의사와 상담하고, 어지럽거나 혼란스럽거나 몸이 좋지 않으면 즉시 중단하세요.",

    "footer.tagline": "Waterline · 당신의 수위를 채우세요.",
    "perf.reduce": "모션 줄이기",
    "perf.reduced": "모션 감소됨",
    "perf.reduceTitle": "배터리와 CPU를 아끼려면 블러·움직임·광채를 끕니다.",
    "perf.reducedTitle": "블러·움직임·광채가 꺼져 있습니다. 다시 켜려면 누르세요.",

    "modal.startTime": "시작 시간",
    "modal.endTime": "종료 시간",
    "modal.cancel": "취소",
    "modal.save": "저장",
    "done.close": "좋아요",

    "editor.activeTitle": "실제로 언제 시작했나요?",
    "editor.activeHint": "시작 버튼을 깜빡했나요? 단식이 시작된 실제 시간을 입력하세요.",
    "editor.endTitle": "언제 단식을 중단했나요?",
    "editor.endHint": "기본값은 지금입니다. 더 일찍 먹었다면 이전 시간으로 지정하세요.",
    "editor.fastTitle": "이 단식 수정",
    "editor.fastHint": "이 단식의 시작과 종료 시간을 조정하세요.",
    "editor.saveEnd": "단식 종료",
    "editor.save": "저장",

    "valid.noLongerRunning": "이 단식은 더 이상 진행 중이 아닙니다.",
    "valid.pickEnd": "종료 시간을 선택하세요.",
    "valid.endFuture": "단식은 미래에 종료될 수 없습니다.",
    "valid.endBeforeStart": "단식은 시작 전에 종료할 수 없습니다.",
    "valid.pickStart": "시작 시간을 선택하세요.",
    "valid.startFuture": "단식은 미래에 시작될 수 없습니다.",
    "valid.tooOld": "30일보다 이전입니다.",
    "valid.endAfterStart": "종료 시간은 시작 이후여야 합니다.",

    "done.goalReached": "목표 달성",
    "done.fastLogged": "단식 기록됨",

    "toast.started": "단식을 시작했어요. 한 번에 한 시간씩.",
    "toast.startUpdated": "시작 시간이 업데이트되었습니다",
    "toast.fastUpdated": "단식이 업데이트되었습니다",
    "toast.deleted": "단식이 삭제되었습니다",
    "toast.discardConfirm": "이 단식을 기록하지 않고 취소할까요?",
    "toast.discarded": "단식을 취소했습니다",
    "toast.goalReached": "{goal}시간 목표 달성. 지금부터는 전부 보너스예요.",
    "toast.needKeys": "동기화를 사용하려면 js/config.js에 Firebase 키를 추가하세요.",
    "toast.offlineSignin": "Firebase에 연결할 수 없습니다. 오프라인 상태예요 — 로컬 모드는 계속 작동합니다.",
    "toast.signinFailed": "로그인에 실패했습니다. Firebase 승인된 도메인을 확인하세요.",
    "toast.signedOut": "로그아웃되었습니다. 로컬 모드로 돌아갑니다.",
    "toast.merged": ({ count }) => `${count}개의 로컬 기록을 계정으로 옮겼습니다.`,

    "notify.goalTitle": "목표 달성 🏆",
    "notify.goalBody": "{goal}시간 목표를 달성했어요.",

    "status.syncingAs": "{name}(으)로 실시간 동기화 중",
    "status.localSignin": "로컬 모드 — 로그인하면 동기화됩니다",
    "status.local": "로컬 모드"
  }
};

/** Stage title / body / cheer in Korean, keyed by the stage's elapsed hour. */
const STAGES_KO = {
  0:  { title: "식후 상태", text: "인슐린이 높고 몸은 방금 먹은 것을 저장하느라 바쁩니다. 시계가 시작되었습니다.", cheer: "단식이 시작됐어요. 가장 힘든 부분은 이미 지났습니다." },
  4:  { title: "인슐린 감소", text: "혈당이 안정되고 인슐린이 떨어집니다. 몸이 저장된 글리코겐을 연료로 쓰기 시작합니다.", cheer: "인슐린이 떨어지고 있어요. 몸이 연료원을 바꾸는 중입니다." },
  8:  { title: "글리코겐 연소", text: "간 글리코겐이 소모됩니다. 지방 세포가 지방산을 혈액으로 내보내기 시작합니다.", cheer: "글리코겐 저장고가 열리고 있어요. 지방 연소가 예열되는 중입니다." },
  12: { title: "지방 연소", text: "글리코겐이 바닥나고 지방 분해가 주가 됩니다. 이제 주로 지방을 태우고 있습니다.", cheer: "12시간. 이제 공식적으로 지방을 연료로 태우고 있어요." },
  16: { title: "케토시스 시작", text: "간이 지방을 케톤으로 바꿉니다. 배고픔이 사라지고 집중력이 또렷해지는 걸 느끼는 사람이 많습니다.", cheer: "케토시스. 뇌가 깨끗한 연료로 돌아가기 시작합니다." },
  18: { title: "자가포식 상승", text: "세포가 손상된 부분을 재활용하기 시작합니다 — 단식으로 유명한 세포 청소입니다.", cheer: "자가포식이 활발해지고 있어요. 세포가 쓰레기를 내다 버리는 중입니다." },
  24: { title: "깊은 케토시스", text: "케톤이 주 연료가 됩니다. 성장호르몬이 올라 근육을 보호하며 지방을 태웁니다.", cheer: "꼬박 하루. 깊은 케토시스, 맑은 정신, 성장호르몬 상승." },
  36: { title: "성장호르몬 급증", text: "성장호르몬이 기준치의 몇 배까지 오를 수 있어 단식 중 제지방을 지킵니다.", cheer: "36시간. 성장호르몬이 급증해 근육을 지키고 있어요." },
  48: { title: "면역 리셋", text: "자가포식이 강하고 오래된 면역세포가 정리됩니다. 이제 전해질이 매우 중요합니다.", cheer: "이틀. 전해질을 잊지 마세요 — 나트륨, 칼륨, 마그네슘." },
  72: { title: "줄기세포 재생", text: "연구에 따르면 줄기세포 주도의 면역 재생이 일어납니다. 이 정도로 긴 단식은 전문가의 관리가 필요합니다.", cheer: "3일. 이건 진지한 영역이에요 — 몸의 소리에 귀 기울이세요." }
};

/** Same order and length as QUOTES in stages.js. */
const QUOTES_KO = [
  "당신이 끝낸 모든 단식은 스스로와 지킨 약속입니다.",
  "배고픔은 파도처럼 옵니다. 파도는 지나갑니다.",
  "끼니를 거르는 게 아니라 습관을 만드는 겁니다.",
  "불편함은 잠깐이고, 절제는 남습니다.",
  "당신의 몸은 무엇을 해야 할지 정확히 압니다. 맡기세요.",
  "그 어떤 맛도 해냈을 때의 기분만큼 좋지 않습니다.",
  "물, 소금, 인내. 그게 레시피의 전부예요.",
  "당신은 전에도 힘든 일을 해냈습니다. 이것도 그중 하나예요.",
  "단식이 쉬워지는 게 아니라, 당신이 더 능숙해지는 겁니다.",
  "한 시간만 더. 당신이 해야 할 건 늘 그것뿐이에요.",
  "가만히 있는 것도 무언가를 하는 것입니다.",
  "당신의 수위를 채우세요."
];

/** Translate a key with optional {vars}. Falls back to English, then the key. */
export function t(key, vars = {}) {
  const table = DICT[getLang()] || DICT.en;
  let value = table[key];
  if (value == null) value = DICT.en[key];
  if (value == null) return key;
  if (typeof value === "function") return value(vars);
  return value.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
}

/** English stage in EN; the same stage with Korean copy in KO. */
export function localizedStage(stage) {
  if (getLang() === "ko" && STAGES_KO[stage.hour]) return { ...stage, ...STAGES_KO[stage.hour] };
  return stage;
}

/** Picks the rotating quote from the language's own list. */
export function localizedQuote(enQuotes) {
  const list = getLang() === "ko" ? QUOTES_KO : enQuotes;
  return list[Math.floor(Date.now() / 3.6e6) % list.length];
}

/** Korean completion copy; mirrors completionMessage() in stages.js. */
export function localizedCompletion(hours, goalHours, englishFn) {
  if (getLang() !== "ko") return englishFn(hours, goalHours);
  if (hours >= goalHours) {
    if (hours >= 72) return "물만 마신 3일. 놀랍습니다. 작고 단순한 음식으로 부드럽게 보식하세요.";
    if (hours >= 48) return "꼬박 이틀. 몸이 대단한 일을 해냈어요. 천천히 보식하세요.";
    if (hours >= 24) return "하루 종일 단식. 깊은 케토시스와 진짜 자가포식. 충분히 해냈어요.";
    return "목표 달성. 바로 이렇게 꾸준함이 만들어집니다.";
  }
  const pct = Math.round((hours / goalHours) * 100);
  if (pct >= 80) return `${pct}% 도달. 누가 봐도 훌륭한 단식이에요.`;
  if (pct >= 50) return `목표의 ${pct}%. 일찍 끝내는 것도 실패가 아니라 선택입니다.`;
  return "기록했어요. 몸의 소리를 듣는 것도 연습의 일부예요 — 내일 다시 만나요.";
}

/**
 * Writes every static string into the DOM: text for [data-i18n], the
 * aria-label for [data-i18n-aria], the document language, and the CSS custom
 * property the "NOW" badge reads. Safe to call repeatedly (on load and on
 * every language switch).
 */
export function applyStatic(scope = document) {
  const lang = getLang();
  document.documentElement.lang = lang;

  scope.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  scope.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });

  document.documentElement.style.setProperty("--label-now", JSON.stringify(t("label.now")));
}
