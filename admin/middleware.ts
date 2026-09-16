import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/setup", "/api/telegram-webhook", "/_next", "/favicon.ico", "/Logo_DynoBoo.png"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Izinkan path publik & static assets
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cek session cookie
  const session = request.cookies.get("dynoboo_session")?.value;
  if (!session || session.length < 8) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|Logo_DynoBoo.png).*)"],
};