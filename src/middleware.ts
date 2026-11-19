import { NextRequest, NextResponse } from "next/server";

// Rate limiting in-memory bucket (Per Serverless Instance / Edge)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired buckets periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }, 300_000);
}

function checkRateLimit(
  ip: string,
  prefix: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterSeconds: 0 };
}

function getAllowedOrigins(): string[] {
  const allowed = [
    "https://rent-pilot-nine.vercel.app",
    "http://localhost:3000",
    "http://localhost:3008",
  ];
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
      if (!allowed.includes(url.origin)) {
        allowed.push(url.origin);
      }
    } catch {
      // ignore invalid app url
    }
  }
  return allowed;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  // 1. Strict CORS validation for API routes
  if (origin) {
    const isOriginAllowed = allowedOrigins.includes(origin);

    if (req.method === "OPTIONS") {
      if (!isOriginAllowed) {
        return new NextResponse("CORS Origin Not Allowed", { status: 403 });
      }
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Cache-Control, Pragma",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (!isOriginAllowed) {
      return NextResponse.json(
        { error: "Cross-Origin Resource Sharing forbidden" },
        { status: 403 }
      );
    }
  }

  // 2. Rate limiting on sensitive endpoints
  let maxRequests = 120; // default 120 req / minute
  const windowMs = 60_000;
  let rateLimitPrefix = "general";

  if (pathname.startsWith("/api/cron")) {
    maxRequests = 10;
    rateLimitPrefix = "cron";
  } else if (
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/invitations")
  ) {
    maxRequests = 60;
    rateLimitPrefix = "financial";
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(ip, rateLimitPrefix, maxRequests, windowMs);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const res = NextResponse.next();

  // Attach CORS header if origin is approved
  if (origin && allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
