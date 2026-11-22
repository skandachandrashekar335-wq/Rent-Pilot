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
  const isDev = process.env.NODE_ENV === "development" || !process.env.VERCEL;
  const allowed = [
    "https://rent-pilot-nine.vercel.app",
  ];

  if (isDev) {
    allowed.push("http://localhost:3000", "http://localhost:3008", "http://127.0.0.1:3000", "http://127.0.0.1:3008");
  }

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
  const referer = req.headers.get("referer");
  const allowedOrigins = getAllowedOrigins();

  // 1. Strict CORS validation for API routes (Control 16)
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

  // 2. CSRF Protection on state-changing API requests (Control 3)
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isCronRoute = pathname.startsWith("/api/cron");

  if (isStateChanging && !isCronRoute) {
    // If an origin is provided, it must match an allowed origin
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { error: "CSRF Validation Failed: Unauthorized request origin." },
        { status: 403 }
      );
    }

    // If no origin but referer is provided, referer must originate from an allowed origin
    if (!origin && referer) {
      try {
        const refUrl = new URL(referer);
        if (!allowedOrigins.includes(refUrl.origin)) {
          return NextResponse.json(
            { error: "CSRF Validation Failed: Unauthorized referer origin." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "CSRF Validation Failed: Malformed referer." },
          { status: 403 }
        );
      }
    }
  }

  // 3. Sliding-window rate limiting on sensitive endpoints (Control 7)
  let maxRequests = 120; // default 120 req / minute
  const windowMs = 60_000;
  let rateLimitPrefix = "general";

  if (pathname.startsWith("/api/cron")) {
    maxRequests = 10;
    rateLimitPrefix = "cron";
  } else if (pathname.startsWith("/api/auth")) {
    maxRequests = 30;
    rateLimitPrefix = "auth";
  } else if (pathname.startsWith("/api/storage")) {
    maxRequests = 30;
    rateLimitPrefix = "upload";
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

  // Security Headers (Controls 2, 3, 16)
  res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleusercontent.com https://pnbtexouxvlurtvphzpz.supabase.co https://*.gstatic.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://pnbtexouxvlurtvphzpz.supabase.co wss://pnbtexouxvlurtvphzpz.supabase.co https://api.brevo.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  if (pathname.startsWith("/api")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
  }

  // Attach CORS header if origin is approved
  if (origin && allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static file extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .woff, .woff2)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)).*)",
  ],
};
