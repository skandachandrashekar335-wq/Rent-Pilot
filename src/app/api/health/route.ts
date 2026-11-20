import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getFirebaseProjectId } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const firebaseProjectId = getFirebaseProjectId();

  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("organizations")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          database: "disconnected",
          firebaseProjectId,
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        firebaseProjectId,
        version: "1.0.0",
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal health check failure";
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "error",
        firebaseProjectId,
        error: message,
      },
      { status: 503 }
    );
  }
}
