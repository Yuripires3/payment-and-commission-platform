import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

    const { payload } = await jwtVerify(token, secret)

    return NextResponse.json({
      user: {
        id: payload.userId,
        role: payload.role,
        cnpj: payload.cnpj,
        username: payload.username,
        name: payload.name,
        email: payload.email,
        partner_id: payload.partner_id,
      },
    })
  } catch (error) {
    console.error("[v0] Auth verification error:", error)
    return NextResponse.json({ error: "Token inválido" }, { status: 401 })
  }
}
