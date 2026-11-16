import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a server-side Supabase client authenticated as the caller using their verified Firebase ID token.
 * Passes the token in the Authorization header so PostgreSQL evaluates RLS via (auth.jwt() ->> 'sub').
 */
export function createServerSupabaseClient(userToken?: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: userToken
        ? {
            Authorization: `Bearer ${userToken}`,
          }
        : {},
    },
  });
}

/**
 * Creates an administrative Supabase client using the service-role key.
 * STRICTLY SERVER-SIDE: Used for system provisioning, invite token verification, and initial profile sync.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminSupabaseClient cannot be called on the client side.");
  }

  const key = supabaseServiceRoleKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
