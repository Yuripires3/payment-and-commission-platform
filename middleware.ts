import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  if (pathname === "/login" || pathname === "/") {
    return NextResponse.next()
  }

  // Protected routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/partner")) {
    const token = request.cookies.get("token")?.value

    if (!token) {
      console.log("[v0] No token, redirecting to login")
      return NextResponse.redirect(new URL("/login", request.url))
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")
      const { payload } = await jwtVerify(token, secret)

      if (pathname.startsWith("/admin") && payload.role !== "admin") {
        console.log("[v0] Non-admin trying to access admin area")
        return NextResponse.redirect(new URL("/partner", request.url))
      }

      if (pathname.startsWith("/partner") && payload.role !== "partner") {
        console.log("[v0] Non-partner trying to access partner area")
        return NextResponse.redirect(new URL("/admin", request.url))
      }

      console.log("[v0] Access granted for:", payload.role)
      return NextResponse.next()
    } catch (error) {
      console.log("[v0] Token verification failed, redirecting to login")
      const response = NextResponse.redirect(new URL("/login", request.url))
      response.cookies.delete("token")
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/partner/:path*"],
}
