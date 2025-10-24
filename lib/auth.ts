import { jwtVerify } from "jose"

export interface User {
  id: string
  cnpj: string
  username: string
  role: "admin" | "partner"
  name: string
  email: string
  partner_id?: string
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

    const { payload } = await jwtVerify(token, secret)

    return {
      id: payload.userId as string,
      role: payload.role as "admin" | "partner",
      cnpj: payload.cnpj as string,
      username: "",
      name: "",
      email: "",
    }
  } catch (error) {
    console.error("[v0] Token verification failed:", error)
    return null
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }
  return authHeader.substring(7)
}
