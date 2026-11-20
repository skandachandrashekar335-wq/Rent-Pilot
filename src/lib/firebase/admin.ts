import type { App } from "firebase-admin/app";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import crypto from "crypto";

export function cleanEnv(val?: string): string {
  if (!val) return "";
  return val
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n");
}

export function getFirebaseProjectId(): string {
  const adminId = cleanEnv(process.env.FIREBASE_ADMIN_PROJECT_ID);
  const publicId = cleanEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  if (adminId && adminId !== "your-project-id" && adminId !== "mock-project") {
    return adminId.trim();
  }
  if (publicId && publicId !== "mock-project") {
    return publicId.trim();
  }
  return "rent-pilot-14fb8";
}

let cachedGoogleCerts: Record<string, string> | null = null;
let googleCertsExpiry = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < googleCertsExpiry) {
    return cachedGoogleCerts;
  }
  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certificates [status: ${res.status}]`);
  }
  const cacheControl = res.headers.get("cache-control") || "";
  const match = cacheControl.match(/max-age=(\d+)/);
  const maxAge = match ? parseInt(match[1], 10) : 3600;
  googleCertsExpiry = now + maxAge * 1000;
  cachedGoogleCerts = await res.json();
  return cachedGoogleCerts!;
}

async function verifyWithGooglePublicCerts(idToken: string, expectedProjectId: string): Promise<DecodedIdToken> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format (expected 3 parts separated by dots)");
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string; typ?: string };
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Failed to parse token header");
  }

  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Failed to parse token payload");
  }

  if (header.alg !== "RS256") {
    throw new Error(`Invalid token algorithm: ${header.alg} (expected RS256)`);
  }
  if (!header.kid) {
    throw new Error("Missing kid in token header");
  }

  const certs = await getGooglePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error(`Google certificate not found for kid: ${header.kid}`);
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const isValid = verifier.verify(cert, Buffer.from(sigB64, "base64url"));
  if (!isValid) {
    throw new Error("Invalid token signature against Google public x509 certs");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const iat = typeof payload.iat === "number" ? payload.iat : 0;
  const aud = String(payload.aud || "");
  const iss = String(payload.iss || "");
  const sub = String(payload.sub || "");

  if (exp && exp < now) {
    const expiredErr = new Error("Firebase ID token has expired");
    (expiredErr as { code?: string }).code = "auth/id-token-expired";
    throw expiredErr;
  }
  if (iat && iat > now + 300) {
    throw new Error("Firebase ID token was issued in the future");
  }
  if (aud !== expectedProjectId) {
    throw new Error(`Firebase token audience mismatch: expected ${expectedProjectId}, received ${aud}`);
  }
  if (iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error(`Firebase token issuer mismatch: ${iss}`);
  }
  if (!sub) {
    throw new Error("Firebase ID token must have a non-empty sub claim");
  }

  return {
    aud,
    iss,
    sub,
    uid: sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    email_verified: Boolean(payload.email_verified),
    auth_time: typeof payload.auth_time === "number" ? payload.auth_time : iat,
    exp,
    iat,
    firebase: (payload.firebase as DecodedIdToken["firebase"]) || {
      identities: {},
      sign_in_provider: "google.com",
    },
    ...payload,
  } as DecodedIdToken;
}

export function getFirebaseAdminApp(): App {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const projectId = getFirebaseProjectId();
  const clientEmail = cleanEnv(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKey = cleanEnv(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  const isRealCert =
    clientEmail &&
    !clientEmail.includes("your-project-id") &&
    !clientEmail.includes("xxxxx") &&
    privateKey &&
    privateKey.includes("-----BEGIN PRIVATE KEY-----");

  if (isRealCert && projectId && clientEmail.includes(projectId)) {
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

  return initializeApp({
    projectId: projectId || "rent-pilot-14fb8",
  });
}

export function getFirebaseAdminAuth(): Auth {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  return getAuth(getFirebaseAdminApp());
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const projectId = getFirebaseProjectId();
  try {
    const auth = getFirebaseAdminAuth();
    return await auth.verifyIdToken(idToken, false);
  } catch (adminErr: unknown) {
    const adminCode = (adminErr as { code?: string })?.code;
    const adminMessage = adminErr instanceof Error ? adminErr.message : String(adminErr);
    console.warn(`[Firebase Admin] SDK verifyIdToken failed [${adminCode || "unknown"}]: ${adminMessage}. Attempting public cert verification...`);
    
    try {
      return await verifyWithGooglePublicCerts(idToken, projectId);
    } catch (fallbackErr: unknown) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error(`[Firebase Admin] Public cert verification failed:`, fallbackMsg);
      throw fallbackErr;
    }
  }
}
