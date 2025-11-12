import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

interface ExcluirDescontosRequest {
  ids?: number[]
  dt_movimentacao?: string
}

export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    const body: ExcluirDescontosRequest = await request.json()
    const { ids, dt_movimentacao } = body

    // Priorizar exclusão por IDs se fornecidos
    if (!ids && !dt_movimentacao) {
      return NextResponse.json(
        { error: "IDs dos descontos (ids) ou data de movimentação (dt_movimentacao) é obrigatória" },
        { status: 400 }
      )
    }

    // Criar conexão com banco
    connection = await getDBConnection()

    let registrosExcluidos = 0

    // Exclusão por IDs (prioridade)
    if (ids && ids.length > 0) {
      if (ids.length === 0) {
        return NextResponse.json({ ok: false, error: "Nenhum ID fornecido" }, { status: 400 })
      }

      const placeholders = ids.map(() => "?").join(", ")
      const sql = `DELETE FROM registro_bonificacao_descontos WHERE id IN (${placeholders})`
      const params = ids

      const [antes] = await connection.execute(
        `SELECT COUNT(*) AS total FROM registro_bonificacao_descontos WHERE id IN (${placeholders})`,
        params
      )

      const totalAntes = (antes as any[])[0]?.total || 0

      const [result] = await connection.execute(sql, params)
      const registrosExcluidos = (result as any)?.affectedRows || 0

      return NextResponse.json({ ok: true, registrosExcluidos, totalAntes })
    } 
    // Fallback: exclusão por data (mantido para compatibilidade)
    else if (dt_movimentacao) {
      const dtMov = dt_movimentacao.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dtMov)) {
        return NextResponse.json({ ok: false, error: "Formato de data inválido. Use YYYY-MM-DD" }, { status: 400 })
      }

      const [antes] = await connection.execute(
        "SELECT COUNT(*) AS total FROM registro_bonificacao_descontos WHERE dt_movimentacao = ?",
        [dtMov]
      )
      const totalAntes = (antes as any[])[0]?.total || 0

      const sql = "DELETE FROM registro_bonificacao_descontos WHERE dt_movimentacao = ?"
      const [result] = await connection.execute(sql, [dtMov])
      const registrosExcluidos = (result as any)?.affectedRows || 0

      if (registrosExcluidos === 0 && process.env.NODE_ENV !== "production") {
        const [check] = await connection.execute(
          "SELECT id, dt_movimentacao, status, is_active FROM registro_bonificacao_descontos WHERE dt_movimentacao LIKE ? LIMIT 5",
          [`${dtMov}%`]
        )
        console.warn("[EXCLUIR DESCONTOS] Nenhum registro excluído. Amostra de registros no banco:", JSON.stringify(check, null, 2))
      }

      return NextResponse.json({ ok: true, registrosExcluidos, totalAntes })
    }

    return NextResponse.json({
      success: true,
      message: `${registrosExcluidos} registro(s) de desconto excluído(s) com sucesso`,
      registrosExcluidos
    })

  } catch (error: any) {
    console.error("Erro ao excluir descontos:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao excluir descontos",
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

