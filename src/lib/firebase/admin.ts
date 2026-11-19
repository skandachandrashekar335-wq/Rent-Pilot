import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

export function getFirebaseAdminApp(): App {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const rawProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const projectId =
    rawProjectId && rawProjectId !== "your-project-id"
      ? rawProjectId
      : (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "rent-pilot-14fb8");

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (privateKey) {
    // Strip accidental outer quotes if pasted with quotes into environment variables
    privateKey = privateKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  }

  const isRealCert =
    clientEmail &&
    !clientEmail.includes("your-project-id") &&
    !clientEmail.includes("xxxxx") &&
    privateKey &&
    privateKey.includes("-----BEGIN PRIVATE KEY-----");

  if (isRealCert && projectId) {
    try {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (certErr) {
      console.warn("[Firebase Admin] Certificate initialization warning, falling back to projectId:", certErr);
    }
  }

  // Fallback initializing with verified Project ID (supports public token verification)
  return initializeApp({
    projectId: projectId || "rent-pilot-14fb8",
  });
}

export function getFirebaseAdminAuth(): Auth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(getFirebaseAdminApp());
}

