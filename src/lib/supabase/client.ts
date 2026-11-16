import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getFirebaseAuth } from "@/lib/firebase/client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (url, options = {}) => {
        // Official Third-Party Auth Integration:
        // Automatically inject current Firebase ID token into request headers
        try {
          const auth = getFirebaseAuth();
          const token = await auth.currentUser?.getIdToken();
          if (token) {
            const headers = new Headers(options.headers);
            headers.set("Authorization", `Bearer ${token}`);
            options.headers = headers;
          }
        } catch {
          // In non-authenticated or build environments, proceed with anon headers
        }
        return fetch(url, options);
      },
    },
    accessToken: async () => {
      try {
        const auth = getFirebaseAuth();
        const token = await auth.currentUser?.getIdToken();
        return token ?? null;
      } catch {
        return null;
      }
    },
  });

  return browserClient;
}
