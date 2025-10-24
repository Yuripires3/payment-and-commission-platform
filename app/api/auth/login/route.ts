import { type NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"

// Mock users for testing (replace with database query later)
const MOCK_USERS = [
  {
    id: "1",
    cnpj: "12345678000190",
    username: "admin",
    password: "Admin@123",
    role: "admin",
    name: "Administrador",
    email: "admin@empresa.com",
  },
  {
    id: "2",
    cnpj: "98765432000110",
    username: "parceiro1",
    password: "Admin@123",
    role: "partner",
    name: "Parceiro Tech Solutions",
    email: "contato@parceiro1.com",
    partner_id: "1",
  },
  {
    id: "3",
    cnpj: "11222333000144",
    username: "parceiro2",
    password: "Admin@123",
    role: "partner",
    name: "Parceiro Digital Services",
    email: "contato@parceiro2.com",
    partner_id: "2",
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cnpj, username, password } = body

    console.log("[v0] Login attempt:", { cnpj, username })

    // Remove formatting from CNPJ
    const cleanCnpj = cnpj.replace(/\D/g, "")

    // Find user
    const user = MOCK_USERS.find((u) => u.cnpj === cleanCnpj && u.username === username && u.password === password)

    if (!user) {
      console.log("[v0] Login failed: Invalid credentials")
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 })
    }

    console.log("[v0] Login successful for user:", user.username)

    // Create JWT token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

    const token = await new SignJWT({
      userId: user.id,
      role: user.role,
      cnpj: user.cnpj,
      username: user.username,
      name: user.name,
      email: user.email,
      partner_id: user.partner_id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret)

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user

    const redirectPath = user.role === "admin" ? "/admin" : "/partner"
    const response = NextResponse.json(
      {
        access_token: token,
        token_type: "bearer",
        user: userWithoutPassword,
        redirect: redirectPath,
      },
      { status: 200 },
    )

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: false, // Allow in development
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    console.log("[v0] Cookie set for user:", user.username, "redirecting to:", redirectPath)

    return response
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
