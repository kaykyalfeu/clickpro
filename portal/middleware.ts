import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

type Role = "SUPER_ADMIN" | "CLIENT_ADMIN" | "CLIENT_USER";

// Routes that require authentication
const protectedPaths = ["/dashboard", "/credentials", "/contacts", "/campaigns", "/templates", "/conversations"];

// Routes that require SUPER_ADMIN role
const adminOnlyPaths = ["/admin"];

// Routes that require at least CLIENT_ADMIN role
const clientAdminPaths: string[] = [];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });

  // Protected routes
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAdminOnly = adminOnlyPaths.some((path) => pathname.startsWith(path));
  const isClientAdminOnly = clientAdminPaths.some((path) => pathname.startsWith(path));

  // Handle admin-only routes
  if (isAdminOnly) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as Role;
    if (role !== "SUPER_ADMIN") {
      // Redirect non-admins to dashboard with error
      const dashboardUrl = new URL("/dashboard", request.url);
      dashboardUrl.searchParams.set("error", "access_denied");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Handle client-admin routes
  if (isClientAdminOnly) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as Role;
    if (role !== "SUPER_ADMIN" && role !== "CLIENT_ADMIN") {
      const dashboardUrl = new URL("/dashboard", request.url);
      dashboardUrl.searchParams.set("error", "access_denied");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Handle general protected routes
  if (isProtected && !isAdminOnly && !isClientAdminOnly) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from login and signup pages
  if (pathname === "/login" || pathname === "/signup") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
