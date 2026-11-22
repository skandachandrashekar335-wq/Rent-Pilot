"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onIdTokenChanged,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";
import { authFetch } from "@/lib/api-client";
import { clearMemoryCache } from "@/lib/cache/memory-query-cache";

interface CachedSyncData {
  profile: Profile | null;
  memberships: Membership[];
  isOwner: boolean;
  isTenant: boolean;
  activeOrganization: Organization | null;
  timestamp: number;
}

const syncDataCache = new Map<string, CachedSyncData>();
let inFlightSyncPromise: Promise<void> | null = null;

export interface Profile {
  id: string;
  firebase_uid: string;
  email: string;
  full_name: string | null;
  photo_url: string | null;
  preferred_locale: "en" | "kn" | "hi";
}

export interface Organization {
  id: string;
  name: string;
  owner_profile_id: string;
  billing_day_of_month: number;
  currency: string;
  timezone: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  profile_id: string;
  role: "OWNER" | "MANAGER";
  status: "ACTIVE" | "SUSPENDED";
  organization?: Organization;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  activeOrganization: Organization | null;
  isOwner: boolean;
  isTenant: boolean;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signInAsDemoOwner: () => void;
  signInAsDemoTenant: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  memberships: [],
  activeOrganization: null,
  isOwner: false,
  isTenant: false,
  loading: true,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshSession: async () => {},
  signInAsDemoOwner: () => {},
  signInAsDemoTenant: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isTenant, setIsTenant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncProfile = useCallback(async (force = false) => {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;

    if (!force && uid && syncDataCache.has(uid)) {
      const cached = syncDataCache.get(uid)!;
      // Valid for 5 minutes unless forced
      if (Date.now() - cached.timestamp < 300_000) {
        setProfile(cached.profile);
        setMemberships(cached.memberships);
        setIsOwner(cached.isOwner);
        setIsTenant(cached.isTenant);
        setActiveOrganization(cached.activeOrganization);
        setError(null);
        return;
      }
    }

    if (inFlightSyncPromise) {
      return inFlightSyncPromise;
    }

    inFlightSyncPromise = (async () => {
      try {
        const res = await authFetch("/api/auth/sync", {
          method: "POST",
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `Sync failed with status ${res.status}`);
        }

        const data = await res.json();
        const prof = data.profile || null;
        const mems = data.memberships || [];
        const ownerFlag = Boolean(data.isOwner);
        const tenantFlag = Boolean(data.isTenant);
        const activeOrg = mems.length > 0 ? mems[0].organization || null : null;

        setProfile(prof);
        setMemberships(mems);
        setIsOwner(ownerFlag);
        setIsTenant(tenantFlag);
        setActiveOrganization(activeOrg);
        setError(null);

        if (uid) {
          syncDataCache.set(uid, {
            profile: prof,
            memberships: mems,
            isOwner: ownerFlag,
            isTenant: tenantFlag,
            activeOrganization: activeOrg,
            timestamp: Date.now(),
          });
        }
      } catch (err: unknown) {
        console.error("[AuthProvider] Profile synchronization failed:", err);
        setError(err instanceof Error ? err.message : "Failed to synchronize profile");
      } finally {
        inFlightSyncPromise = null;
      }
    })();

    return inFlightSyncPromise;
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rentpilot_demo_role");

        // Automated test harness injection support
        if ((window as unknown as { __RENTPILOT_TEST_USER__?: unknown }).__RENTPILOT_TEST_USER__) {
          const testUser = (window as unknown as { __RENTPILOT_TEST_USER__: User }).__RENTPILOT_TEST_USER__;
          setUser(testUser);
          syncProfile().finally(() => {
            setLoading(false);
          });
          return;
        }
      }
      const auth = getFirebaseAuth();
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          await syncProfile();
        } else {
          setUser(null);
          setProfile(null);
          setMemberships([]);
          setActiveOrganization(null);
          setIsOwner(false);
          setIsTenant(false);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: unknown) {
      console.error("Firebase auth init error:", err);
      setLoading(false);
    }
  }, [syncProfile]);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      await syncProfile();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Google authentication failed";
      console.error("Google sign-in error:", err);
      setError(errorMessage);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      if (typeof window !== "undefined") {
        localStorage.removeItem("rentpilot_demo_role");
      }
      syncDataCache.clear();
      clearMemoryCache();
      setUser(null);
      setProfile(null);
      setMemberships([]);
      setActiveOrganization(null);
      setIsOwner(false);
      setIsTenant(false);
    } catch (err: unknown) {
      console.error("Sign-out error:", err);
    }
  };

  const refreshSession = async () => {
    const auth = getFirebaseAuth();
    if (auth.currentUser?.uid) {
      syncDataCache.delete(auth.currentUser.uid);
    }
    await syncProfile(true);
  };

  const signInAsDemoOwner = () => {
    console.warn("Demo mode is disabled. Please sign in with Google.");
  };

  const signInAsDemoTenant = () => {
    console.warn("Demo mode is disabled. Please sign in with Google.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        memberships,
        activeOrganization,
        isOwner,
        isTenant,
        loading,
        error,
        signInWithGoogle,
        signOut,
        refreshSession,
        signInAsDemoOwner,
        signInAsDemoTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
