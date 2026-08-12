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
  // The one value here a user ever sees. Google's account chooser says
  // "continue to <authDomain>", so the default puts a project id in front of
  // someone at the moment they are deciding whether to trust you. Pointing it
  // at a domain you own fixes that — but only after that domain actually
  // serves /__/auth/, so change this line last. README → "Make the sign-in
  // dialog say your name".
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

/** Firebase SDK version pulled from the CDN. */
export const FIREBASE_VERSION = "10.12.2";
