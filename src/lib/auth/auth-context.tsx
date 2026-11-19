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

  const isDemoModeAllowed =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH_BYPASS === "true";

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
        throw new Error(`Sync failed with status ${res.status}`);
      }

      const data = await res.json();
      setProfile(data.profile);
      setMemberships(data.memberships || []);
      setIsOwner(Boolean(data.isOwner));
      setIsTenant(Boolean(data.isTenant));

      if (data.memberships && data.memberships.length > 0) {
        setActiveOrganization(data.memberships[0].organization || null);
      }
    } catch (err: unknown) {
      console.warn("Auth sync warning:", err);
      // Fallback local profile for development or offline modes
      const fallbackProfile: Profile = {
        id: "local-profile-" + firebaseUser.uid.slice(0, 8),
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email || "user@rentpilot.app",
        full_name: firebaseUser.displayName || "RentPilot User",
        photo_url: firebaseUser.photoURL || null,
        preferred_locale: "en",
      };
      setProfile(fallbackProfile);
      // Default to owner in initial local onboarding if no orgs present
      setIsOwner(true);
    }
  }, []);

  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
        if (currentUser) {
          if (typeof window !== "undefined") localStorage.removeItem("rentpilot_demo_role");
          setUser(currentUser);
          await syncProfile(currentUser);
        } else {
          if (isDemoModeAllowed) {
            const demoRole = typeof window !== "undefined" ? localStorage.getItem("rentpilot_demo_role") : null;
            if (demoRole === "owner") {
              signInAsDemoOwner();
              return;
            } else if (demoRole === "tenant") {
              signInAsDemoTenant();
              return;
            }
          } else if (typeof window !== "undefined") {
            localStorage.removeItem("rentpilot_demo_role");
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncProfile]);

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, googleProvider);
      await syncProfile(result.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in with Google";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rentpilot_demo_role");
      }
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      setMemberships([]);
      setActiveOrganization(null);
      setIsOwner(false);
      setIsTenant(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    if (user) {
      await syncProfile(user);
    }
  };

  const signInAsDemoOwner = () => {
    if (!isDemoModeAllowed) {
      console.warn("Demo mode is disabled in production environments.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("rentpilot_demo_role", "owner");
    }
    const mockUser = {
      uid: "demo-owner-uid",
      email: "owner@rentpilot.app",
      displayName: "Skanda Chandrashekar",
      photoURL: null,
      getIdToken: async () => "demo-owner-token",
    } as unknown as User;
    setUser(mockUser);
    setProfile({
      id: "demo-profile-owner",
      firebase_uid: "demo-owner-uid",
      email: "owner@rentpilot.app",
      full_name: "Skanda Chandrashekar",
      photo_url: null,
      preferred_locale: "en",
    });
    setIsOwner(true);
    setIsTenant(false);
    setMemberships([
      {
        id: "demo-membership-1",
        organization_id: "demo-org-1",
        profile_id: "demo-profile-owner",
        role: "OWNER",
        status: "ACTIVE",
        organization: {
          id: "demo-org-1",
          name: "Sri Lakshmi Estates",
          owner_profile_id: "demo-profile-owner",
          billing_day_of_month: 10,
          currency: "INR",
          timezone: "Asia/Kolkata",
        },
      },
    ]);
    setActiveOrganization({
      id: "demo-org-1",
      name: "Sri Lakshmi Estates",
      owner_profile_id: "demo-profile-owner",
      billing_day_of_month: 10,
      currency: "INR",
      timezone: "Asia/Kolkata",
    });
    setLoading(false);
  };

  const signInAsDemoTenant = () => {
    if (!isDemoModeAllowed) {
      console.warn("Demo mode is disabled in production environments.");
      return;
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("rentpilot_demo_role", "tenant");
    }
    const mockUser = {
      uid: "demo-tenant-uid",
      email: "rahul.sharma@example.com",
      displayName: "Rahul Sharma",
      photoURL: null,
      getIdToken: async () => "demo-tenant-token",
    } as unknown as User;
    setUser(mockUser);
    setProfile({
      id: "demo-profile-tenant",
      firebase_uid: "demo-tenant-uid",
      email: "rahul.sharma@example.com",
      full_name: "Rahul Sharma",
      photo_url: null,
      preferred_locale: "en",
    });
    setIsOwner(false);
    setIsTenant(true);
    setMemberships([]);
    setActiveOrganization(null);
    setLoading(false);
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
