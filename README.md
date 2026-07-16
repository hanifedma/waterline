<div align="center">

<img src="icons/icon-192.png" width="88" alt="Waterline">

# Waterline

**Fill your waterline.**
A free, real-time water fasting tracker — no build step, no backend to run, no cost.

</div>

---

## What it is

A fasting timer that you can actually *see*. Pick a goal, hit begin, and a bowl fills with
water hour by hour. Along the way it tells you what's happening inside you — insulin falling,
glycogen emptying, ketosis, autophagy — and cheers you on when you cross each threshold.

The timer shows how much is **left** against your goal and when you'll reach it. Pass the goal
and it keeps counting: the ring turns gold, the bowl brims, and the fast is logged at its true
length. Ending asks *when* you broke it (defaulting to now, never accepting a future time), and
any logged fast's start and end can be corrected afterwards. A **streak calendar** chains your
consecutive days together.

- **Real-time sync.** Start a fast on your laptop, watch it tick on your phone. No refresh, no button.
- **Works signed out.** Everything runs from `localStorage`. Sign in later and your history moves with you.
- **Works offline.** Installable PWA. Offline changes queue and flush when you reconnect.
- **Zero build.** Plain ES modules. The folder *is* the website.
- **Dark and light.** Follows your system, remembers your choice.
- **English and Korean.** One tap in the header swaps the interface; your own data — times,
  durations, dates — always stays in your device's own locale.
- **Light on slow connections and weak hardware.** See below.

## Built to run anywhere

Waterline is about 40 KB of HTML, CSS and JavaScript, and it downloads **no fonts, no
frameworks and no images** to render the first screen.

**On a slow connection**

- Typography is San Francisco via `-apple-system` — Apple's own system typeface, already on
  the device. Segoe UI on Windows, Roboto on Android. Zero font requests.
- The whole module graph is declared with `modulepreload`, so `app.js`, `store.js`,
  `stages.js` and `config.js` are fetched in parallel instead of in a three-deep waterfall.
- The Firebase SDK is a dynamic `import()` that only runs once you've configured it, and
  never blocks the first paint.
- A service worker caches the shell, so every visit after the first renders offline-instantly.

**On a slow CPU or a device with no GPU**

`html[data-lite]` switches off blur, ambient motion, glows and shadows. It turns itself on
automatically for `prefers-reduced-motion`, Save-Data, 2G, ≤4 CPU cores or ≤4 GB RAM, and
anyone can flip it from the **Reduce motion** button in the footer. The choice is remembered.

Even at full quality the app is careful:

- The ambient background uses radial gradients rather than `filter: blur()` on animated
  elements — a blurred layer has to be re-rasterised every frame when it scales.
- The progress ring and water level are only written to the DOM when they *visibly* move.
  Naively, a 16-hour fast nudges `stroke-dashoffset` by 0.015 px every second, and each
  write restarts an 800 ms transition on a drop-shadowed stroke — a permanent repaint loop
  for a change no one can see.
- Long sections use `content-visibility: auto`, so the browser doesn't lay them out until
  you scroll near them.
- A hidden tab pauses the wave animation and the one-second clock entirely.
- The waves — the page's only permanent repaint — stop whenever no fast is
  running or the bowl is scrolled off screen. Sitting idle, Waterline performs
  **zero DOM writes per second**; running, exactly one (the clock).
- Firestore write acknowledgements are never awaited. Offline they never
  arrive, and awaiting one would hang the UI on a write the local cache has
  already applied.

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
7. **Authentication → Settings → Authorized domains →** add `localhost` and your GitHub Pages
   domain, e.g. `yourname.github.io`.

Reload. The pill in the header flips from `Local` to `Live`, and any fasts you recorded as a
guest are moved into your account automatically.

> The values in `js/config.js` are **not secrets** — they identify your project, they don't grant
> access to it. Access is decided entirely by `firestore.rules`. They are safe to commit publicly.

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Waterline"
git branch -M main
git remote add origin https://github.com/YOURNAME/YOURREPO.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `root`**. Live in a minute at
`https://YOURNAME.github.io/YOURREPO/`.

Two things to update once you know your URL — search engines and social previews use them:

- `index.html` — the `canonical`, `og:url`, and `og:image` / `twitter:image` tags
- `sitemap.xml` and `robots.txt` — the `<loc>` and `Sitemap:` lines

Every internal path is relative, so the app works from a subfolder without any other change.

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
js/config.js          ← your Firebase keys go here
js/store.js           local + Firestore backends behind one interface
js/stages.js          metabolic timeline, encouragement copy (English, canonical)
js/i18n.js            interface translations (English + Korean) and the language switch
js/app.js             rendering, timer loop, streak calendar, milestone celebrations
sw.js                 offline shell cache
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
