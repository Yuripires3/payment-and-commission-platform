import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

/**
 * POST /api/bonificacoes/calculo/cancelar
 * 
 * Cancela uma execução de cálculo, marcando descontos em staging como cancelados.
 * NUNCA toca em registros finalizados.
 * 
 * Body:
 * - run_id: string - UUID da execução
 */
export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    const body = await request.json()
    const { run_id } = body

    if (!run_id) {
      return NextResponse.json(
        { error: "run_id é obrigatório" },
        { status: 400 }
      )
    }

    connection = await getDBConnection()

    // Iniciar transação
    await connection.beginTransaction()

    try {
      // Cancelar apenas registros em staging do run_id
      const [result]: any = await connection.execute(
        `UPDATE registro_bonificacao_descontos
         SET status = 'cancelado',
             canceled_at = NOW(),
             is_active = FALSE
         WHERE run_id = ? 
           AND status = 'staging'`,
        [run_id]
      )

      const totalCancelados = result.affectedRows || 0

      // Liberar lock
      const [sessionInfo]: any = await connection.execute(
        `SELECT dt_referencia FROM calculo_sessions WHERE run_id = ?`,
        [run_id]
      )

      if (sessionInfo.length > 0) {
        await connection.execute(
          `DELETE FROM locks_calculo WHERE dt_referencia = ?`,
          [sessionInfo[0].dt_referencia]
        )
      }

      // Remover sessão
      await connection.execute(
        `DELETE FROM calculo_sessions WHERE run_id = ?`,
        [run_id]
      )

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: `${totalCancelados} registro(s) de desconto cancelado(s)`,
        total_cancelados: totalCancelados
      })

    } catch (error: any) {
      await connection.rollback()
      throw error
    }

  } catch (error: any) {
    console.error("Erro ao cancelar cálculo:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao cancelar cálculo",
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

