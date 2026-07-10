/**
 * Waterline — the metabolic timeline of a water fast.
 *
 * `hour` is the elapsed hour at which the stage begins. Descriptions are
 * a plain-language summary of well-established fasting physiology; they are
 * educational, not medical advice.
 */
export const STAGES = [
  {
    hour: 0,
    icon: "🍽️",
    title: "Fed state",
    text: "Insulin is high and your body is busy storing what you last ate. The clock has started.",
    cheer: "The fast has begun. The hardest part is already behind you."
  },
  {
    hour: 4,
    icon: "📉",
    title: "Insulin falling",
    text: "Blood sugar settles and insulin drops. Your body turns to stored glycogen for fuel.",
    cheer: "Insulin is falling. Your body is switching fuel sources."
  },
  {
    hour: 8,
    icon: "🔓",
    title: "Glycogen burning",
    text: "Liver glycogen is being drawn down. Fat cells begin releasing fatty acids into the blood.",
    cheer: "Glycogen stores are opening up. Fat burning is warming up."
  },
  {
    hour: 12,
    icon: "🔥",
    title: "Fat burning",
    text: "Glycogen runs low and lipolysis takes over. You are now running mostly on fat.",
    cheer: "Twelve hours. You're officially burning fat for fuel."
  },
  {
    hour: 16,
    icon: "💠",
    title: "Ketosis begins",
    text: "The liver converts fat into ketones. Many people notice hunger fading and focus sharpening.",
    cheer: "Ketosis. Your brain is starting to run on clean fuel."
  },
  {
    hour: 18,
    icon: "♻️",
    title: "Autophagy rising",
    text: "Cells begin recycling damaged components — the cellular clean-up that fasting is famous for.",
    cheer: "Autophagy is ramping up. Your cells are taking out the trash."
  },
  {
    hour: 24,
    icon: "🧠",
    title: "Deep ketosis",
    text: "Ketones are a primary fuel. Growth hormone climbs to protect muscle while fat is burned.",
    cheer: "A full day. Deep ketosis, clear head, growth hormone rising."
  },
  {
    hour: 36,
    icon: "⚡",
    title: "Growth hormone surge",
    text: "Growth hormone can reach several times baseline, preserving lean tissue during the fast.",
    cheer: "36 hours. Growth hormone is surging to protect your muscle."
  },
  {
    hour: 48,
    icon: "🛡️",
    title: "Immune reset",
    text: "Autophagy is strong and old immune cells are cleared. Electrolytes now matter a great deal.",
    cheer: "Two days. Remember your electrolytes — sodium, potassium, magnesium."
  },
  {
    hour: 72,
    icon: "🌱",
    title: "Stem cell renewal",
    text: "Research points to stem-cell-driven immune regeneration. Fasts this long deserve supervision.",
    cheer: "Three days. This is serious territory — listen to your body."
  }
];

/** The stage you are currently in, plus the one coming next. */
export function stageAt(hours) {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (hours >= STAGES[i].hour) index = i;
  }
  return { index, current: STAGES[index], next: STAGES[index + 1] ?? null };
}

/** Rotating encouragement shown under the timer. */
export const QUOTES = [
  "Every fast you finish is a promise you kept to yourself.",
  "Hunger comes in waves. Waves pass.",
  "You are not missing a meal. You are building a habit.",
  "The discomfort is temporary. The discipline is permanent.",
  "Your body knows exactly what to do. Let it work.",
  "Nothing tastes as good as finishing feels.",
  "Water, salt, patience. That's the whole recipe.",
  "You have done hard things before. This is one of them.",
  "The fast doesn't get easier. You get better at it.",
  "One more hour. That's all you ever have to do.",
  "Stillness is doing something.",
  "Fill your waterline."
];

export const quoteOfTheHour = () =>
  QUOTES[Math.floor(Date.now() / 3.6e6) % QUOTES.length];

/** Message shown in the celebration modal, tuned to what you achieved. */
export function completionMessage(hours, goalHours) {
  if (hours >= goalHours) {
    if (hours >= 72) return "Three days on water alone. Extraordinary. Break it gently — small, simple food.";
    if (hours >= 48) return "Two full days. Your body did remarkable work. Refeed slowly.";
    if (hours >= 24) return "A whole day fasted. Deep ketosis, real autophagy. Well earned.";
    return "Goal reached. That's exactly how consistency is built.";
  }
  const pct = Math.round((hours / goalHours) * 100);
  if (pct >= 80) return `${pct}% of the way there. That's a strong fast in anyone's book.`;
  if (pct >= 50) return `${pct}% of your goal. Ending early is a decision, not a failure.`;
  return "Logged. Listening to your body is part of the practice — come back tomorrow.";
}
