<div align="center">

<img src="icons/icon-192.png" width="88" alt="Waterline">

# Waterline

**Fill your waterline.**
A free, real-time water fasting tracker — no build step, no backend to run, no cost.

<img src="docs/screenshot-dark.png" width="380" alt="Waterline in dark mode: a green progress ring showing a fast 5 hours 30 minutes in, stats, and a streak calendar"> <img src="docs/screenshot-light.png" width="380" alt="The same screen in light mode">

</div>

---

## What it is

A fasting timer you can read in one glance. Pick a goal, hit begin, and one ring fills
while the clock counts. Along the way it tells you what's happening inside you — insulin
falling, glycogen emptying, ketosis, autophagy — and cheers you on when you cross each
threshold.

The face shows time elapsed and time left. Pass the goal and it keeps counting: the ring
turns amber, and the fast is logged at its true length. Ending asks *when* you broke it
(defaulting to now, never accepting a future time), and any logged fast's start and end can
be corrected afterwards. A **streak calendar** chains your consecutive days together.

- **Real-time sync.** Start a fast on your laptop, watch it tick on your phone. No refresh, no button.
- **Works signed out.** Everything runs from `localStorage`. Sign in later and your history moves with you.
- **Works offline.** Installable PWA. Offline changes queue and flush when you reconnect.
- **Zero build.** Plain ES modules. The folder *is* the website.
- **Dark and light.** Follows your system, remembers your choice.
- **English and Korean.** One tap in the header swaps the interface; your own data — times,
  durations, dates — always stays in your device's own locale.

## The design

Flat surfaces, one accent colour, no gradients, no blur, no glow — the palette is shared
with [hanifedma.com/ponder](https://hanifedma.com/ponder/) so the two apps read as one
family. Everything sits in a single 640 px column, and every control in the header speaks
the same shape language: 40 px tall, 1 px border, 11 px radius.

Type is San Francisco — Apple's system typeface — reached through `-apple-system`. On
Windows it falls back to Segoe UI, on Android to Roboto. Nothing is downloaded, so there is
no font request on any connection.

The colour in the interface comes from emoji rather than from illustration: 🔥 🏆 ✅ ⏳ on the
stats, 📅 📋 🔬 on the headings, 🏆 or 💧 on every logged fast, and one emoji per metabolic
stage. They're the system colour font, so they cost nothing to download and they carry
meaning instead of decorating. The app icon, favicon and social card are all flat accent
green on ink — regenerate them from `icons/icon-source.svg` and `favicon.svg`.

Switching theme cross-fades every colour over 1.5 s rather than snapping, which is why
`.theming` exists: it applies the long transition only during a deliberate toggle, so
ordinary hover stays instant.

### The ring is eased on purpose

Real progress is linear and, early on, invisible: twenty minutes into a 16-hour fast is 2% —
a sliver that reads as *you have done nothing*. So the ring is drawn through `p^0.55`, which
front-loads the fill and then slows as you approach the goal:

| Elapsed | True progress | Ring shows |
|---|---|---|
| 20 min of 16 h | 2% | 12% |
| 1 h 36 m of 16 h | 10% | 28% |
| 5 h 30 m of 16 h | 34% | 56% |
| 8 h of 16 h | 50% | 68% |
| 14 h 24 m of 16 h | 90% | 94% |
| 16 h of 16 h | 100% | 100% |

It still starts empty and lands exactly on full at the goal, so it never disagrees with
itself. **Nothing numeric is eased** — the clock, the time remaining, the logged duration,
the streak and every statistic are the real values. `RING_CURVE` in `js/app.js` is the one
knob; set it to `1` for a linear ring.

## Built to run anywhere

The first screen is 110 KB of HTML, CSS and JavaScript — **33 KB over the wire** once your
server gzips it — and it downloads **no fonts, no frameworks and no images** to render.
(A third of the source is Korean translations and comments, both of which compress away.)

- The whole module graph is declared with `modulepreload`, so `app.js`, `store.js`,
  `stages.js`, `i18n.js` and `config.js` are fetched in parallel instead of in a
  four-deep waterfall.
- The Firebase SDK is a dynamic `import()` that only runs once you've configured it, and
  never blocks the first paint.
- A service worker caches the shell, so every visit after the first renders offline-instantly.
- The ring is only written to the DOM when it *visibly* moves. Naively, a 16-hour fast nudges
  `stroke-dashoffset` by a fraction of a pixel every second, and each write restarts a 700 ms
  transition — a permanent repaint loop for a change no one can see.
- A hidden tab pauses the one-second clock entirely. Sitting idle, Waterline performs zero
  DOM writes per second; running, exactly one.
- There is nothing expensive enough to need a "low power" mode. `prefers-reduced-motion` is
  honoured in CSS and that's the whole story.
- Firestore write acknowledgements are never awaited. Offline they never arrive, and awaiting
  one would hang the UI on a write the local cache has already applied.

## Run it locally

Any static server. From this folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly with `file://` will **not** work — ES modules and service
workers both require `http://`. That's the only requirement.

With no Firebase configured, Waterline runs in **local mode**: fully functional, saved to
this browser, nothing leaves the machine. That is a legitimate way to use it forever.

## Turn on Google sign-in + cross-device sync

Free forever on Firebase's Spark plan for personal use.

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Build → Authentication → Get started → Sign-in method →** enable **Google**.
3. **Build → Firestore Database → Create database →** start in **production mode**, pick a region.
4. **Firestore → Rules →** replace everything with the contents of [`firestore.rules`](firestore.rules), then **Publish**.
   This is what stops anyone else reading your fasts. Don't skip it.
5. **Project settings (⚙) → General → Your apps →** click the web icon `</>`, register the app,
   and copy the `firebaseConfig` values.
6. Paste them into [`js/config.js`](js/config.js).
7. **Authentication → Settings → Authorized domains →** add `localhost` and the domain you
   deploy to, e.g. `yourname.github.io`.

Reload. The footer flips from `Local mode` to `Synced as …`, and any fasts you recorded as a
guest are moved into your account automatically.

> The values in `js/config.js` are **not secrets** — they identify your project, they don't grant
> access to it. Access is decided entirely by `firestore.rules`. They are safe to commit publicly.

## Deploy to GitHub Pages

```bash
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `root`**. Live in a minute at
`https://YOURNAME.github.io/YOURREPO/`.

Two things to update once you know your URL — search engines and social previews use them:

- `index.html` — the `canonical`, `og:url`, and `og:image` / `twitter:image` tags
- `sitemap.xml` and `robots.txt` — the `<loc>` and `Sitemap:` lines

Every internal path is relative, so the app works from a subfolder without any other change.

**After every deploy, bump `VERSION` in [`sw.js`](sw.js).** The service worker serves the old
cached CSS and JS until that string changes, so a stale version is the usual reason a deploy
"didn't take".

## How the sync works

| | Signed out | Signed in |
|---|---|---|
| Storage | `localStorage` | Firestore, under `users/{your-uid}` |
| Reads | direct | `onSnapshot` listeners — push, not poll |
| Offline | always | Firestore persistent cache, writes replay on reconnect |

A running fast is one field on your user document; each finished fast is its own document.
Because every read is a live listener, changing anything on one device repaints the others
immediately. Signing in for the first time merges your guest history in, de-duplicating by
start time, then clears the guest store.

## Layout

```
index.html            app shell, SEO tags, JSON-LD
404.html              themed, bilingual not-found page
css/style.css         design tokens, dark + light themes
docs/                 README screenshots
js/config.js          ← your Firebase keys go here
js/store.js           local + Firestore backends behind one interface
js/stages.js          metabolic timeline, encouragement copy (English, canonical)
js/i18n.js            interface translations (English + Korean) and the language switch
js/app.js             rendering, timer loop, streak calendar, milestone celebrations
sw.js                 offline shell cache — bump VERSION on every deploy
firestore.rules       owner-only access — publish this
test.html             open it in a browser; 77 assertions, no dependencies
```

## Health note

Waterline is an informational tool, **not medical advice**. Extended water fasting can be
dangerous if you are pregnant or breastfeeding, underweight, diabetic, taking medication, or
have a history of disordered eating. Talk to a doctor before fasting beyond 24 hours, mind your
electrolytes on long fasts, break long fasts gently — and stop immediately if you feel faint,
confused, or unwell.

## Licence

MIT. Use it, change it, ship it.
