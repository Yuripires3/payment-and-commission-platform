export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { formatDateISO, toEndOfDaySQL, toStartOfDaySQL } from "@/lib/date-utils"
import { construirCampoValorPorData, construirFiltroPapel } from "@/lib/dashboard-helpers"

/**
 * GET /api/dashboard/por-operadora
 * Retorna distribuição de comissões por operadora
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: usa colunas separadas (vlr_bruto_corretor e vlr_bruto_supervisor)
 * - A partir de 2025-10-01: usa vlr_bruto_corretor como fonte única, filtrando por papel derivado de nome_supervisor
 * 
 * Descontos são obtidos exclusivamente de registro_bonificacao_descontos 
 * com tipo_movimentacao = 'desconto realizado' (case-insensitive).
 * Descontos são alocados pelo mês de data_movimentacao.
 * 
 * Query params:
 * - inicio: YYYY-MM-DD
 * - fim: YYYY-MM-DD
 * - operadora: string (opcional)
 * - entidade: string (opcional, múltiplo separado por vírgula)
 * - papel: 'geral' | 'corretores' | 'supervisores' (padrão: 'geral')
 */
export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    const searchParams = request.nextUrl.searchParams
    const inicio = searchParams.get("inicio")
    const fim = searchParams.get("fim")
    const operadora = searchParams.get("operadora")
    const entidade = searchParams.get("entidade")
    const papel = searchParams.get("papel") || "geral"

    if (!inicio || !fim) {
      return NextResponse.json(
        { error: "Parâmetros 'inicio' e 'fim' são obrigatórios (formato: YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    connection = await getDBConnection()
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Construir WHERE clause para pagamentos
    const whereConditions: string[] = []
    const whereValues: any[] = []

    const inicioDate = formatDateISO(inicio)
    const fimDate = formatDateISO(fim)
    const inicioSQL = toStartOfDaySQL(inicioDate)
    const fimSQL = toEndOfDaySQL(fimDate)
    const dataReferencia = "ub.dt_analise"
    const condicaoDataInicio = `${dataReferencia} >= ?`
    const condicaoDataFim = `${dataReferencia} <= ?`

    whereConditions.push(condicaoDataInicio)
    whereValues.push(inicioSQL)
    whereConditions.push(condicaoDataFim)
    whereValues.push(fimSQL)
    whereConditions.push("ub.operadora IS NOT NULL AND ub.operadora != ''")

    if (operadora) {
      whereConditions.push("ub.operadora = ?")
      whereValues.push(operadora)
    }

    if (entidade) {
      const entidades = entidade.split(",").map(e => e.trim()).filter(Boolean)
      if (entidades.length > 0) {
        whereConditions.push(`ub.entidade IN (${entidades.map(() => "?").join(",")})`)
        whereValues.push(...entidades)
      }
    }

    // Adicionar filtro de papel
    const filtroPapel = construirFiltroPapel(papel as 'geral' | 'corretores' | 'supervisores')
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")} ${filtroPapel}` : `WHERE 1=1 ${filtroPapel}`

    // Agregar pagamentos por operadora conforme papel (usando lógica híbrida)
    const campoValor = construirCampoValorPorData(papel as 'geral' | 'corretores' | 'supervisores')

    const [pagamentosRows]: any = await connection.execute(
      `SELECT 
         ub.operadora as nome,
         ${campoValor} as valor_bruto,
         GROUP_CONCAT(DISTINCT DATE_FORMAT(${dataReferencia}, '%Y-%m')) as meses
       FROM unificado_bonificacao ub
       ${whereClause}
       GROUP BY ub.operadora
       ORDER BY valor_bruto DESC`,
      whereValues
    )

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Buscar descontos agregados por mês de dt_movimentacao
    const [descontosRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(dt_movimentacao, '%Y-%m') as mes,
         SUM(valor) as valor_desconto
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}
       GROUP BY DATE_FORMAT(dt_movimentacao, '%Y-%m')
       ORDER BY mes ASC`,
      [inicioSQL, fimSQL]
    )

    // Organizar descontos por mês
    const descontosPorMes = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      descontosPorMes.set(row.mes, Number(row.valor_desconto || 0))
    })

    // Calcular descontos totais do período
    const descontoTotal = Array.from(descontosPorMes.values()).reduce((sum, val) => sum + val, 0)

    // Calcular valor total de pagamentos para rateio proporcional
    const totalPagamentos = pagamentosRows.reduce((sum: number, row: any) => sum + Number(row.valor_bruto || 0), 0)

    // Calcular valores líquidos por operadora (rateio proporcional de descontos)
    const valoresLiquidos = pagamentosRows.map((row: any) => {
      const valorBruto = Number(row.valor_bruto || 0)
      const percentual = totalPagamentos > 0 ? valorBruto / totalPagamentos : 0
      const descontoRateado = descontoTotal * percentual
      const valorLiquido = valorBruto - descontoRateado

      return {
        operadora: row.nome || "Não informado",
        valor: Math.max(0, Number(valorLiquido.toFixed(2))) // Garantir que seja >= 0 e número válido
      }
    }).filter(item => item.valor > 0) // Remover operadoras com valor zero

    // Calcular total líquido para percentuais
    const totalLiquido = valoresLiquidos.reduce((sum: number, item: any) => sum + item.valor, 0)

    // Calcular percentuais e ordenar do maior para o menor
    const resultado = valoresLiquidos.map((item: any) => {
      const percentual = totalLiquido > 0 ? (item.valor / totalLiquido) * 100 : 0
      return {
        operadora: item.operadora,
        valor: item.valor,
        percentual: Number(percentual.toFixed(2))
      }
    }).sort((a: any, b: any) => b.valor - a.valor) // Ordenar do maior para o menor

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar por operadora:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar por operadora" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

