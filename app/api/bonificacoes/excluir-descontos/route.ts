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
      console.log(`[EXCLUIR DESCONTOS] Tentando excluir descontos por IDs: ${ids.join(", ")}`)
      
      // Verificar quantos registros existem antes de excluir
      const placeholders = ids.map(() => "?").join(",")
      const [checkResult] = await connection.execute(
        `SELECT COUNT(*) as total 
         FROM registro_bonificacao_descontos 
         WHERE id IN (${placeholders})`,
        ids
      )
      
      const totalAntes = (checkResult as any[])[0]?.total || 0
      console.log(`[EXCLUIR DESCONTOS] Encontrados ${totalAntes} registro(s) antes da exclusão`)

      // Excluir registros por IDs
      const [result] = await connection.execute(
        `DELETE FROM registro_bonificacao_descontos 
         WHERE id IN (${placeholders})`,
        ids
      )

      registrosExcluidos = (result as any).affectedRows || 0
      console.log(`[EXCLUIR DESCONTOS] ${registrosExcluidos} registro(s) excluído(s) por IDs`)
    } 
    // Fallback: exclusão por data (mantido para compatibilidade)
    else if (dt_movimentacao) {
      console.log(`[EXCLUIR DESCONTOS] Tentando excluir descontos com dt_movimentacao: ${dt_movimentacao} (formato: YYYY-MM-DD)`)

      // Primeiro, verificar quantos registros existem antes de excluir
      const [checkResult] = await connection.execute(
        `SELECT COUNT(*) as total 
         FROM registro_bonificacao_descontos 
         WHERE DATE(dt_movimentacao) = DATE(?) 
         AND tipo_movimentacao = 'desconto realizado'`,
        [dt_movimentacao]
      )
      
      const totalAntes = (checkResult as any[])[0]?.total || 0
      console.log(`[EXCLUIR DESCONTOS] Encontrados ${totalAntes} registro(s) antes da exclusão`)

      // Se não encontrou nenhum registro, verificar formato dos dados no banco para debug
      if (totalAntes === 0) {
        const [checkResult2] = await connection.execute(
          `SELECT dt_movimentacao, tipo_movimentacao, DATE(dt_movimentacao) as dt_movimentacao_date
           FROM registro_bonificacao_descontos 
           WHERE tipo_movimentacao = 'desconto realizado'
           ORDER BY dt_movimentacao DESC
           LIMIT 5`,
          []
        )
        console.log(`[EXCLUIR DESCONTOS] Amostra de registros no banco:`, JSON.stringify(checkResult2, null, 2))
        console.log(`[EXCLUIR DESCONTOS] Data que estamos buscando: ${dt_movimentacao}`)
      }

      // Excluir registros de descontos usando dt_movimentacao e tipo_movimentacao
      const [result] = await connection.execute(
        `DELETE FROM registro_bonificacao_descontos 
         WHERE DATE(dt_movimentacao) = DATE(?) 
         AND tipo_movimentacao = 'desconto realizado'`,
        [dt_movimentacao]
      )

      registrosExcluidos = (result as any).affectedRows || 0
      console.log(`[EXCLUIR DESCONTOS] ${registrosExcluidos} registro(s) excluído(s) por data`)
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

