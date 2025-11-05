import { NextResponse } from "next/server"
import mysql from "mysql2/promise"

export async function GET() {
  try {
    console.log("=== TESTE DE CONEXÃO COM BANCO ===")
    console.log("Config:", {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ? "***" : "MISSING",
      database: process.env.DB_NAME
    })

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })

    console.log("✅ Conexão estabelecida!")

    // Testar query simples
    const [rows] = await connection.execute("SELECT 1 as test")
    console.log("Query test result:", rows)

    // Tentar count na tabela
    const [countRows] = await connection.execute(
      "SELECT COUNT(*) as total FROM registro_bonificacao_valores_v2"
    )
    console.log("Count result:", countRows)

    await connection.end()

    return NextResponse.json({
      success: true,
      message: "Conexão estabelecida com sucesso",
      data: { test: rows, count: countRows }
    })
  } catch (error) {
    console.error("❌ Erro:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}

