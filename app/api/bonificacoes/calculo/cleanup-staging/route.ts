import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

/**
 * POST /api/bonificacoes/calculo/cleanup-staging
 * 
 * Job de limpeza para cancelar staging antigas sem heartbeat
 * Deve ser executado via cron a cada 15 minutos
 */
export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    // Verificar autenticação/secreta (adicionar token se necessário)
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CLEANUP_TOKEN || "cleanup-secret"}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    connection = await getDBConnection()

    // Buscar sessões sem heartbeat há mais de 30 minutos
    const [sessionsExpired]: any = await connection.execute(
      `SELECT run_id, session_id
       FROM calculo_sessions
       WHERE last_heartbeat < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    )

    let totalRemovidos = 0

    if (sessionsExpired.length > 0) {
      await connection.beginTransaction()

      try {
        for (const session of sessionsExpired) {
          // Guardar dt_referencia antes de remover (fallback para liberar lock)
          const [dtInfo]: any = await connection.execute(
            `SELECT DISTINCT dt_referencia 
             FROM registro_bonificacao_descontos 
             WHERE run_id = ? AND status = 'staging' 
             LIMIT 1`,
            [session.run_id]
          )

          // Remover staging do run_id
          const [result]: any = await connection.execute(
            `DELETE FROM registro_bonificacao_descontos
             WHERE run_id = ? AND status = 'staging'`,
            [session.run_id]
          )

          totalRemovidos += result.affectedRows || 0

          // Remover sessão
          await connection.execute(
            `DELETE FROM calculo_sessions WHERE session_id = ?`,
            [session.session_id]
          )

          // Liberar lock
          const [sessionInfo]: any = await connection.execute(
            `SELECT dt_referencia FROM calculo_sessions WHERE run_id = ?`,
            [session.run_id]
          )

          if (sessionInfo.length === 0) {
            const refInfo = sessionInfo.length > 0 ? sessionInfo : dtInfo
            if (refInfo.length > 0) {
              await connection.execute(
                `DELETE FROM locks_calculo WHERE dt_referencia = ?`,
                [refInfo[0].dt_referencia]
              )
            }
          }
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }

    // Limpar locks expirados
    await connection.execute(
      `DELETE FROM locks_calculo WHERE expires_at < NOW()`
    )

    return NextResponse.json({
      success: true,
      message: `Limpeza concluída. ${totalRemovidos} registro(s) removido(s).`,
      total_removidos: totalRemovidos
    })

  } catch (error: any) {
    console.error("Erro na limpeza de staging:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro na limpeza de staging",
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

