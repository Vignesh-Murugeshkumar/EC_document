import { NextResponse } from "next/server";

// Helper to decode JWT payload without library dependency (safe for Next.js Edge runtime)
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64URL to Base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Decode base64 to string
    const jsonPayload = atob(base64);
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function middleware(request) {
  const token = request.cookies.get("ec_token")?.value;
  const { pathname } = request.nextUrl;

  // Protect admin route
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    // Support offline development tokens
    if (token === "offline-token-free" || token === "offline-token-premium") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (token === "offline-token-admin") {
      return NextResponse.next();
    }
    
    const payload = decodeJwt(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Protect dashboard route
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
