import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const trimVal = (v?: string, fallback = "") => (v ? v.trim().replace(/^["']|["']$/g, "") : fallback);

const firebaseConfig = {
  apiKey: trimVal(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "mock-api-key"),
  authDomain: trimVal(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "rent-pilot-14fb8.firebaseapp.com"),
  projectId: trimVal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "rent-pilot-14fb8"),
  storageBucket: trimVal(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "rent-pilot-14fb8.firebasestorage.app"),
  messagingSenderId: trimVal(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "495114914560"),
  appId: trimVal(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "1:495114914560:web:8890425c6dfb8142d381e5"),
  measurementId: trimVal(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || undefined,
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  return getAuth(app);
}

export async function getFirebaseAnalytics() {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    try {
      const { getAnalytics, isSupported } = await import("firebase/analytics");
      if (await isSupported()) {
        return getAnalytics(getFirebaseApp());
      }
    } catch {
      // Analytics is optional and non-blocking in restricted/server environments
    }
  }
  return null;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});
