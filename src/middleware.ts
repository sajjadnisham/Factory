import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE } from "@/lib/auth/cookies";

/**
 * Edge-level gate for the admin area.
 *
 * This only checks that an admin cookie is *present* — the middleware runtime
 * has no database access, so it cannot validate the session. Real authorisation
 * happens in every admin page and server action (`getCurrentAdmin` /
 * `requireAdminOrFail`); this just avoids rendering admin chrome for obviously
 * signed-out visitors.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin itself is the login page, so it must stay reachable.
  if (pathname === "/admin") return NextResponse.next();

  if (pathname.startsWith("/admin")) {
    const hasCookie = request.cookies.has(ADMIN_COOKIE);
    if (!hasCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
