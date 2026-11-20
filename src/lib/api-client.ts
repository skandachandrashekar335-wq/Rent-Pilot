"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Centralized authenticated API client for RentPilot.
 * - Automatically awaits Firebase auth readiness
 * - Attaches fresh Firebase ID token in Authorization header
 * - Automatically refreshes token and retries once on 401 Unauthorized
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const auth = getFirebaseAuth();

  // 1. Wait for Firebase Auth state to be ready
  if (typeof window !== "undefined" && typeof auth.authStateReady === "function") {
    try {
      await auth.authStateReady();
    } catch (e) {
      console.warn("[authFetch] authStateReady error:", e);
    }
  }

  const user = auth.currentUser;
  let token: string | null = null;
  if (user) {
    try {
      token = await user.getIdToken();
    } catch (err) {
      console.warn("[authFetch] Failed to get initial token:", err);
    }
  }

  // In automated test environments, allow test token injection
  if (!token && typeof window !== "undefined") {
    token = (window as unknown as { __RENTPILOT_TEST_TOKEN__?: string }).__RENTPILOT_TEST_TOKEN__ || null;
  }

  // Build headers
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (typeof window !== "undefined" && (window as unknown as { __RENTPILOT_TEST_EMAIL__?: string }).__RENTPILOT_TEST_EMAIL__) {
    headers.set("x-test-email", (window as unknown as { __RENTPILOT_TEST_EMAIL__: string }).__RENTPILOT_TEST_EMAIL__);
  }

  let res = await fetch(url, {
    ...options,
    headers,
  });

  // 2. If 401 occurs and user is logged in, force token refresh and retry once
  if (res.status === 401 && user) {
    try {
      const freshToken = await user.getIdToken(true);
      headers.set("Authorization", `Bearer ${freshToken}`);
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (refreshErr) {
      console.error("[authFetch] Token refresh retry failed:", refreshErr);
    }
  }

  return res;
}
