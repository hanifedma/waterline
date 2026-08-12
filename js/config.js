/**
 * Waterline — Firebase configuration
 * ----------------------------------
 * Leave this file exactly as-is and Waterline runs in LOCAL MODE:
 * everything is saved to this browser, nothing leaves the device.
 *
 * To turn on Google sign-in + real-time sync across devices:
 *   1. Create a free project at https://console.firebase.google.com
 *   2. Build → Authentication → Sign-in method → enable "Google"
 *   3. Build → Firestore Database → Create database (production mode)
 *   4. Project settings → General → Your apps → Web app (</>)
 *   5. Copy the config values it shows you into the object below.
 *   6. Authentication → Settings → Authorized domains → add your
 *      GitHub Pages domain (e.g. yourname.github.io)
 *
 * These values are NOT secrets — they identify your project, they don't
 * grant access. Access is controlled by firestore.rules. Safe to commit.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDnGyplH_iENKAshzou2NXf8wag9NyshWY",
  // Only the fallback sign-in route hands off to this address; the Google
  // button below never leaves the page. See googleClientId.
  authDomain: "waterline-af54d.firebaseapp.com",
  projectId: "waterline-af54d",
  storageBucket: "waterline-af54d.firebasestorage.app",
  messagingSenderId: "522318543600",
  appId: "1:522318543600:web:d59e23418ae01cfc16e035"
};

/** True once the placeholders above have been replaced with real values. */
export const isConfigured = !Object.values(firebaseConfig).some(
  (v) => typeof v !== "string" || v.startsWith("YOUR_")
);

/**
 * The OAuth *web* client id — the same one the Android app signs in with.
 * Google Cloud console → APIs & Services → Credentials → "Web client (auto
 * created by Google Service)".
 *
 * With it, Google's own button runs here on the page and the browser never
 * leaves the site, so Google's prompt names *this site*. Left empty, sign-in
 * falls back to Firebase's popup, which hands off to `authDomain` — and then
 * Google names that address instead, because a project id is the only thing it
 * has been given to name.
 *
 * A client id is public; it is meant to be read out of the page. All of its
 * security is that it refuses to work from an origin you have not authorised,
 * which is why adding one is a deliberate step rather than a default.
 */
export const googleClientId =
  "522318543600-osmc2v86s9qldugnq42gke1qljo2m33o.apps.googleusercontent.com";

/**
 * A real client id, as opposed to blank, a placeholder, or the *project*
 * number pasted by mistake — all of which fail inside Google's popup, where
 * nothing can report the reason back to the page.
 */
export const isClientId = (value) =>
  typeof value === "string" && value.trim().endsWith(".apps.googleusercontent.com");

/** True when the in-page Google button can be attempted at all. */
export const hasGoogleClientId = isClientId(googleClientId);

/** Firebase SDK version pulled from the CDN. */
export const FIREBASE_VERSION = "10.12.2";
