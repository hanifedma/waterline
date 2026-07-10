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
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

/** True once the placeholders above have been replaced with real values. */
export const isConfigured = !Object.values(firebaseConfig).some(
  (v) => typeof v !== "string" || v.startsWith("YOUR_")
);

/** Firebase SDK version pulled from the CDN. */
export const FIREBASE_VERSION = "10.12.2";
