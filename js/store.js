/**
 * Waterline — data layer.
 *
 * One interface, two backends:
 *
 *   LOCAL MODE   no Firebase config, or signed out. Everything lives in
 *                localStorage. Fully functional, fully offline.
 *
 *   CLOUD MODE   signed in with Google. Every read is an onSnapshot
 *                listener, so a change on your laptop lands on your phone
 *                without a refresh. Firestore's persistent cache keeps
 *                writes working while offline and flushes them on reconnect.
 *
 * On first sign-in, anything recorded as a guest is merged into the account
 * and the guest store is cleared.
 */
import { firebaseConfig, isConfigured, FIREBASE_VERSION } from "./config.js";

const LS_DATA = "waterline:data:v1";
const LS_THEME = "waterline:theme";
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const DEFAULT_STATE = () => ({
  activeFast: null, // { start: epochMs, goalHours: number }
  fasts: [],        // [{ id, start, end, goalHours }]
  settings: { goalHours: 16, hideTimes: false }
});

/* ── Guest (localStorage) persistence ─────────────────────────────── */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** A finished fast worth keeping. Also the shape firestore.rules will accept. */
export const isValidFast = (f) =>
  Boolean(f) && isNum(f.start) && isNum(f.end) && isNum(f.goalHours) && f.end > f.start;

/** A running fast worth trusting. Applied to localStorage and to Firestore alike. */
export const isValidActive = (a) =>
  Boolean(a) && isNum(a.start) && isNum(a.goalHours) && a.goalHours > 0;

/**
 * Settings reach us from three directions — localStorage, a Firestore
 * snapshot, and the guest merge — and any of them can be stale, hand-edited,
 * or written by a version that had never heard of a field. One gate, so a bad
 * value can never reach the UI, and a missing one always lands on its default.
 *
 * Unknown keys are dropped rather than carried, which keeps the shape of a
 * settings document identical everywhere it is written.
 */
export function sanitizeSettings(raw) {
  const base = DEFAULT_STATE().settings;
  const s = raw ?? {};
  return {
    goalHours: isNum(s.goalHours) && s.goalHours > 0 ? s.goalHours : base.goalHours,
    // Anything that isn't a literal true is off: an old document with no field
    // at all, a string "false", a stray null.
    hideTimes: s.hideTimes === true
  };
}

/*
 * localStorage is user-writable and survives across versions. One malformed
 * record would otherwise poison every statistic with NaN, so unusable entries
 * are dropped on the way in rather than defended against everywhere after.
 */
function readLocal() {
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    return {
      activeFast: isValidActive(parsed.activeFast) ? parsed.activeFast : null,
      fasts: Array.isArray(parsed.fasts)
        ? parsed.fasts.filter((f) => isValidFast(f) && typeof f.id === "string")
        : [],
      settings: sanitizeSettings(parsed.settings)
    };
  } catch {
    return DEFAULT_STATE();
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(state));
  } catch {
    /* private mode / quota — the session still works, it just won't persist */
  }
}

/* ── Store ────────────────────────────────────────────────────────── */

class Store extends EventTarget {
  constructor() {
    super();
    this.state = readLocal();
    this.user = null;
    this.mode = "local";
    this.fb = null;          // firebase module handles, once loaded
    this._unsubs = [];
    this._authReady = false;
    this._sawServer = false; // has the server ever answered a listener?
  }

  /* -- lifecycle ------------------------------------------------- */

  /** Boots auth if Firebase is configured. Resolves once we know who you are. */
  async init() {
    this._emit();
    if (!isConfigured) {
      this._status("local", "Local");
      return;
    }

    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`)
      ]);

      const app = appMod.initializeApp(firebaseConfig);
      const db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({
          tabManager: fsMod.persistentMultipleTabManager()
        })
      });

      this.fb = { app, db, auth: authMod.getAuth(app), authMod, fsMod };

      // Returning from a redirect-based sign-in (mobile Safari, popup blockers).
      authMod.getRedirectResult(this.fb.auth).catch(() => {});

      authMod.onAuthStateChanged(this.fb.auth, (user) => {
        this._authReady = true;
        user ? this._enterCloud(user) : this._enterLocal();
        this.dispatchEvent(new CustomEvent("auth", { detail: user }));
      });
    } catch (err) {
      console.warn("[waterline] Firebase unavailable, staying local:", err);
      this._status("local", "Local");
    }

    addEventListener("online", () => this._refreshStatus());
    addEventListener("offline", () => this._refreshStatus());
  }

  get isCloud() { return this.mode === "cloud"; }
  get canSignIn() { return isConfigured; }

  /* -- auth ------------------------------------------------------ */

  /**
   * Finish a sign-in that Google already completed on this page.
   *
   * The in-page Google button hands back an ID token — a JWT signed by Google,
   * addressed to our client id. Firebase re-verifies the signature, the issuer
   * and the audience on its own servers before it will mint a session, so what
   * crosses this boundary is a proof rather than a claim, and a token forged in
   * the console is refused there rather than here.
   *
   * This is the same exchange the Android app makes with the token Credential
   * Manager gives it — one shape, two platforms, no browser redirect on either.
   */
  async signInWithGoogleIdToken(idToken) {
    if (!isConfigured) throw new Error("unconfigured");
    if (!this.fb) throw new Error("sdk-unavailable");
    const { authMod, auth } = this.fb;
    const credential = authMod.GoogleAuthProvider.credential(idToken);
    await authMod.signInWithCredential(auth, credential);
  }

  /**
   * The fallback route: hand the whole flow to Firebase, which bounces through
   * `authDomain` and back. Works everywhere, and is the only thing that works
   * when the client id is missing, the origin is unauthorised, or Google's
   * script never loads — but the round trip is exactly why Google's prompt then
   * names a Firebase address instead of this site.
   */
  async signIn() {
    if (!isConfigured) throw new Error("unconfigured");
    if (!this.fb) throw new Error("sdk-unavailable"); // configured, but the SDK never loaded
    const { authMod, auth } = this.fb;
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await authMod.signInWithPopup(auth, provider);
    } catch (err) {
      const fallback = [
        "auth/popup-blocked",
        "auth/popup-closed-by-user",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment"
      ];
      if (fallback.includes(err.code)) {
        if (err.code === "auth/popup-closed-by-user") return; // user changed their mind
        await authMod.signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }

  async signOut() {
    if (this.fb) await this.fb.authMod.signOut(this.fb.auth);
  }

  /* -- mode transitions ------------------------------------------ */

  _enterLocal() {
    this._teardown();
    this.user = null;
    this.mode = "local";
    this._sawServer = false;
    this.state = readLocal();
    this._status("local", "Local");
    this._emit();
  }

  async _enterCloud(user) {
    this._teardown();
    this.user = user;
    this.mode = "cloud";
    this._sawServer = false;
    this._refreshStatus();

    const merged = await this._mergeGuestData(user.uid).catch((err) => {
      console.warn("[waterline] merge failed:", err);
      return 0;
    });

    // Signing out during the merge above would otherwise leave listeners
    // attached to the account we just left.
    if (this.user?.uid !== user.uid) return;

    if (merged > 0) {
      this.dispatchEvent(new CustomEvent("merged", { detail: merged }));
    }

    this._listen(user.uid);
  }

  _teardown() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  /* -- realtime listeners ---------------------------------------- */

  _listen(uid) {
    const { fsMod, db } = this.fb;
    const { doc, collection, onSnapshot } = fsMod;

    const userRef = doc(db, "users", uid);

    /*
     * Deliberately unordered. A Firestore orderBy silently DROPS documents
     * that lack the field it sorts on, so one fast written without `start` —
     * which firestore.rules forbids, but a hand-edited console entry does not
     * — would simply vanish from your history with no error anywhere. Sorting
     * happens below, where a missing value is just a value.
     */
    const fastsRef = collection(db, "users", uid, "fasts");

    const noteSource = (snap) => {
      if (!snap.metadata.fromCache) this._sawServer = true;
      this._refreshStatus(snap.metadata.fromCache);
    };

    /*
     * Nothing is painted until the user document has answered once.
     *
     * The running fast and your settings live on that document; the fasts
     * collection knows nothing about either. These are two independent
     * listeners with no ordering guarantee, so if the collection answers first
     * an ungated repaint says "no fast is running" and flashes the Begin
     * button at someone who is eleven hours in. The flag is set on an errored
     * snapshot too, so a document that can never answer degrades to showing
     * the history rather than nothing at all.
     */
    let sawUser = false;
    const emit = () => { if (sawUser) this._emit(); };

    this._unsubs.push(
      onSnapshot(userRef, { includeMetadataChanges: true }, (snap) => {
        const data = snap.data() ?? {};
        // Same gate the local store uses. A running fast with a missing or
        // non-numeric start prints "NaN:NaN:NaN" on the ring and never ends.
        this.state.activeFast = isValidActive(data.activeFast) ? data.activeFast : null;
        this.state.settings = sanitizeSettings(data.settings);
        sawUser = true;
        noteSource(snap);
        emit();
      }, (err) => {
        console.warn("[waterline] user listener:", err);
        sawUser = true;
        emit();
      })
    );

    this._unsubs.push(
      onSnapshot(fastsRef, { includeMetadataChanges: true }, (snap) => {
        // Validated on the way in, exactly as the local store is: the rules
        // reject a malformed fast, but they do not police the Firebase console,
        // and one record with no `end` would turn every statistic into NaN.
        this.state.fasts = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(isValidFast)
          .sort((a, b) => b.start - a.start);
        noteSource(snap);
        emit();
      }, (err) => console.warn("[waterline] fasts listener:", err))
    );
  }

  /* -- guest → cloud migration ----------------------------------- */

  async _mergeGuestData(uid) {
    const guest = readLocal();
    const hasData = guest.fasts.length > 0 || guest.activeFast;
    if (!hasData) return 0;

    const { fsMod, db } = this.fb;
    const { doc, collection, getDocs, getDoc, setDoc, writeBatch } = fsMod;

    const cloudSnap = await getDocs(collection(db, "users", uid, "fasts"));
    const cloudStarts = cloudSnap.docs.map((d) => d.data().start);
    const isDuplicate = (start) => cloudStarts.some((s) => Math.abs(s - start) < 60_000);

    const batch = writeBatch(db);
    let count = 0;
    for (const fast of guest.fasts) {
      // firestore.rules would reject a malformed record, and the rejection
      // would arrive long after we cleared the guest store.
      if (!isValidFast(fast) || isDuplicate(fast.start)) continue;
      const ref = doc(collection(db, "users", uid, "fasts"));
      batch.set(ref, { start: fast.start, end: fast.end, goalHours: fast.goalHours });
      count++;
    }
    // Queued durably; awaiting the ack would block sign-in while offline.
    if (count) this._fire(batch.commit());

    const userDoc = await getDoc(doc(db, "users", uid));
    const patch = {};

    // Only adopt the guest's running fast if the account isn't already fasting.
    if (guest.activeFast && (!userDoc.exists() || !userDoc.data().activeFast)) {
      patch.activeFast = guest.activeFast;
      count++;
    }
    // Carry the guest's chosen goal over to a brand-new account.
    if (!userDoc.exists() || !userDoc.data().settings) {
      patch.settings = guest.settings;
    }
    if (Object.keys(patch).length) {
      this._fire(setDoc(doc(db, "users", uid), patch, { merge: true }));
    }

    writeLocal(DEFAULT_STATE());
    return count;
  }

  /* -- writes ---------------------------------------------------- */

  /*
   * Firestore resolves a write promise only once the *server* acknowledges it.
   * Offline that never happens, so awaiting one hangs indefinitely — the fast
   * would be filed in the local cache while the UI sat waiting forever. The
   * write is durably queued in IndexedDB and onSnapshot has already repainted
   * from the cache, so we deliberately don't wait for the acknowledgement.
   */
  _fire(promise) {
    promise.catch((err) => console.warn("[waterline] write rejected:", err));
  }

  async _writeUser(patch) {
    if (this.isCloud) {
      const { fsMod, db } = this.fb;
      this._fire(fsMod.setDoc(fsMod.doc(db, "users", this.user.uid), patch, { merge: true }));
    } else {
      Object.assign(this.state, patch);
      writeLocal(this.state);
      this._emit();
    }
  }

  /**
   * Merges a patch into settings, always writing the whole map.
   *
   * Local mode's _writeUser() is an Object.assign, which *replaces*
   * `settings` rather than merging into it — so a patch of `{ hideTimes }`
   * alone would silently erase `goalHours` on this device. Every settings
   * write goes through here so that can't happen from any caller.
   */
  async _writeSettings(patch) {
    await this._writeUser({ settings: { ...this.state.settings, ...patch } });
  }

  async startFast(goalHours) {
    if (this.state.activeFast) return;
    const activeFast = { start: Date.now(), goalHours };
    await this._writeUser({
      activeFast,
      settings: { ...this.state.settings, goalHours }
    });
  }

  /** Sets the goal for your *next* fast. A fast already in progress keeps the goal it started with. */
  async setGoal(goalHours) {
    if (this.state.activeFast) return;
    await this._writeSettings({ goalHours });
  }

  /**
   * Focus mode. When on, a *running* fast shows only the ring — no elapsed
   * clock, no countdown, no goal, no start or finish time. Unlike the goal it
   * can be flipped mid-fast, because it changes nothing about the fast itself:
   * it is purely how much the timer card is willing to tell you.
   */
  async setHideTimes(hideTimes) {
    await this._writeSettings({ hideTimes: hideTimes === true });
  }

  async setStart(startMs) {
    if (!this.state.activeFast) return;
    await this._writeUser({ activeFast: { ...this.state.activeFast, start: startMs } });
  }

  /**
   * Ends the running fast and files it in history. `endAt` defaults to now.
   *
   * The value is clamped rather than trusted: a fast can never end in the
   * future, and never before it started. The lower bound also satisfies
   * firestore.rules, which demands end > start — begin-then-end inside one
   * millisecond would otherwise have its write rejected by the server.
   */
  async endFast(endAt) {
    const active = this.state.activeFast;
    if (!active) return null;
    const requested = Number.isFinite(endAt) ? endAt : Date.now();
    const end = Math.max(active.start + 1, Math.min(requested, Date.now()));
    const record = { start: active.start, end, goalHours: active.goalHours };

    if (this.isCloud) {
      const { fsMod, db } = this.fb;
      const uid = this.user.uid;
      const batch = fsMod.writeBatch(db);
      batch.set(fsMod.doc(fsMod.collection(db, "users", uid, "fasts")), record);
      batch.set(fsMod.doc(db, "users", uid), { activeFast: null }, { merge: true });
      this._fire(batch.commit());
    } else {
      this.state.fasts.unshift({ id: crypto.randomUUID(), ...record });
      this.state.activeFast = null;
      writeLocal(this.state);
      this._emit();
    }
    return record;
  }

  async cancelFast() {
    await this._writeUser({ activeFast: null });
  }

  /** Corrects a logged fast. `patch` may carry `start`, `end` or both. */
  async updateFast(id, patch) {
    if (this.isCloud) {
      const { fsMod, db } = this.fb;
      this._fire(fsMod.updateDoc(fsMod.doc(db, "users", this.user.uid, "fasts", id), patch));
    } else {
      this.state.fasts = this.state.fasts.map((f) => (f.id === id ? { ...f, ...patch } : f));
      writeLocal(this.state);
      this._emit();
    }
  }

  async deleteFast(id) {
    if (this.isCloud) {
      const { fsMod, db } = this.fb;
      this._fire(fsMod.deleteDoc(fsMod.doc(db, "users", this.user.uid, "fasts", id)));
    } else {
      this.state.fasts = this.state.fasts.filter((f) => f.id !== id);
      writeLocal(this.state);
      this._emit();
    }
  }

  /* -- theme (always device-local) -------------------------------- */

  get theme() {
    return localStorage.getItem(LS_THEME) ??
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }
  set theme(value) {
    localStorage.setItem(LS_THEME, value);
  }

  /* -- plumbing --------------------------------------------------- */

  subscribe(fn) {
    this.addEventListener("change", fn);
    return () => this.removeEventListener("change", fn);
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("change", { detail: this.state }));
  }

  _status(state, text) {
    this.dispatchEvent(new CustomEvent("status", { detail: { state, text } }));
  }

  /*
   * `fromCache` means "this snapshot did not come from the server", which is
   * true of the very first snapshot even when perfectly online. Treating it as
   * offline flashed the wrong badge on every load, so it only counts once the
   * server has answered at least once and then stopped.
   */
  _refreshStatus(fromCache = false) {
    if (!this.isCloud) return this._status("local", "Local");
    if (!navigator.onLine) return this._status("offline", "Offline");
    if (fromCache && this._sawServer) return this._status("offline", "Offline");
    this._status("live", "Live");
  }
}

/* ── Derived statistics ───────────────────────────────────────────── */

const DAY = 86_400_000;

/**
 * A calendar day, numbered. Days must be compared by ordinal, never by
 * subtracting timestamps: across a daylight-saving boundary two consecutive
 * local midnights are 23 or 25 hours apart, which would silently break a
 * streak twice a year.
 */
export function dayIndex(ms) {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** The set of calendar days on which a fast was completed. */
export const fastedDays = (fasts) => new Set(fasts.map((f) => dayIndex(f.end)));

export function computeStats(fasts) {
  if (!fasts.length) return { streak: 0, longest: 0, total: 0, hours: 0 };

  let longest = 0;
  let totalMs = 0;
  for (const f of fasts) {
    const dur = f.end - f.start;
    totalMs += dur;
    if (dur > longest) longest = dur;
  }

  // A streak counts consecutive calendar days on which a fast ended. Today not
  // being logged yet doesn't break it — yesterday still counts.
  const days = [...fastedDays(fasts)].sort((a, b) => b - a);
  const today = dayIndex(Date.now());
  let streak = 0;
  if (days[0] === today || days[0] === today - 1) {
    streak = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1] - days[i] === 1) streak++;
      else break;
    }
  }

  return { streak, longest, total: fasts.length, hours: totalMs / 3.6e6 };
}

export const store = new Store();
