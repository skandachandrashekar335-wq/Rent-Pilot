"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onIdTokenChanged,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";

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

  const syncProfile = useCallback(async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Sync failed with status ${res.status}`);
      }

      const data = await res.json();
      setProfile(data.profile);
      setMemberships(data.memberships || []);
      setIsOwner(Boolean(data.isOwner));
      setIsTenant(Boolean(data.isTenant));

      if (data.memberships && data.memberships.length > 0) {
        setActiveOrganization(data.memberships[0].organization || null);
      } else {
        setActiveOrganization(null);
      }
      setError(null);
    } catch (err: unknown) {
      console.error("[AuthProvider] Profile synchronization failed:", err);
      setError(err instanceof Error ? err.message : "Failed to synchronize profile");
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rentpilot_demo_role");
      }
      const auth = getFirebaseAuth();
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          await syncProfile(currentUser);
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
      await syncProfile(result.user);
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
    if (user) {
      await syncProfile(user);
    }
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
