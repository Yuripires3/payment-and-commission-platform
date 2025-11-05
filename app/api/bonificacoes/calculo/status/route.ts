import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

/**
 * GET /api/bonificacoes/calculo/status?run_id=...
 * 
 * Retorna status e progresso de uma execução de cálculo.
 * Também atualiza heartbeat da sessão para evitar timeout.
 */
export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    const searchParams = request.nextUrl.searchParams
    const run_id = searchParams.get("run_id")

    if (!run_id) {
      return NextResponse.json(
        { error: "run_id é obrigatório" },
        { status: 400 }
      )
    }

    connection = await getDBConnection()

    // Atualizar heartbeat
    await connection.execute(
      `UPDATE calculo_sessions 
       SET last_heartbeat = NOW()
       WHERE run_id = ?`,
      [run_id]
    )

    // Buscar informações do run
    const [stagingCount]: any = await connection.execute(
      `SELECT COUNT(*) as total
       FROM registro_bonificacao_descontos
       WHERE run_id = ? AND status = 'staging'`,
      [run_id]
    )

    const [sessionInfo]: any = await connection.execute(
      `SELECT session_id, usuario_id, dt_referencia, last_heartbeat, created_at
       FROM calculo_sessions
       WHERE run_id = ?`,
      [run_id]
    )

    return NextResponse.json({
      run_id,
      staging_count: stagingCount[0]?.total || 0,
      session: sessionInfo[0] || null,
      is_active: sessionInfo.length > 0
    })

  } catch (error: any) {
    console.error("Erro ao buscar status:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao buscar status",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

