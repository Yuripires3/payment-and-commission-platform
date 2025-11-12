import { NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

export async function GET() {
  try {
    const connection = await getDBConnection()

    // Testar query simples
    const [rows] = await connection.execute("SELECT 1 as test")

    // Tentar count na tabela
    const [countRows] = await connection.execute(
      "SELECT COUNT(*) as total FROM registro_bonificacao_valores_v2"
    )

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

