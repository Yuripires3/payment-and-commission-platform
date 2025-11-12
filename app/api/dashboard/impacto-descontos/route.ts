export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { construirCampoValorPorData, construirFiltroPapel } from "@/lib/dashboard-helpers"
import { formatDateISO, toEndOfDaySQL, toStartOfDaySQL } from "@/lib/date-utils"

/**
 * GET /api/dashboard/impacto-descontos
 * Retorna impacto de descontos ao longo do tempo
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: usa colunas separadas (vlr_bruto_corretor e vlr_bruto_supervisor)
 * - A partir de 2025-10-01: usa vlr_bruto_corretor como fonte única, filtrando por papel derivado de nome_supervisor
 * 
 * Descontos são obtidos exclusivamente de registro_bonificacao_descontos 
 * com tipo_movimentacao = 'desconto realizado' (case-insensitive).
 * Descontos são alocados pelo mês de data_movimentacao.
 * 
 * Alocação mensal: pagamentos agregados por mês de dt_analise,
 * descontos agregados por mês de dt_movimentacao.
 * 
 * Query params:
 * - inicio: YYYY-MM-DD (usado quando fornecido, mas garantindo período mínimo de 12 meses; caso contrário calcula 12 meses antes de fim)
 * - fim: YYYY-MM-DD (obrigatório)
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

    if (!fim) {
      return NextResponse.json(
        { error: "Parâmetro 'fim' é obrigatório (formato: YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    connection = await getDBConnection()
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Garantir que o período seja no mínimo 12 meses (pode ser maior)
    // Se o período for menor que 12 meses, ajusta para 12 meses antes de fim
    let inicioCalculado: string
    const dataFimObj = new Date(fim)
    
    if (inicio) {
      const dataInicioObj = new Date(inicio)
      // Calcular diferença em meses
      const diffMonths = (dataFimObj.getFullYear() - dataInicioObj.getFullYear()) * 12 + 
                         (dataFimObj.getMonth() - dataInicioObj.getMonth())
      
      // Se o período for menor que 12 meses, usar 12 meses antes de fim
      if (diffMonths < 12) {
        const dataInicioAjustada = new Date(dataFimObj)
        dataInicioAjustada.setMonth(dataInicioAjustada.getMonth() - 12)
        inicioCalculado = formatDateISO(dataInicioAjustada)
      } else {
        inicioCalculado = inicio
      }
    } else {
      // Se não fornecido, calcular 12 meses antes de fim
      const dataInicioObj = new Date(dataFimObj)
      dataInicioObj.setMonth(dataInicioObj.getMonth() - 12)
      inicioCalculado = formatDateISO(dataInicioObj)
    }

    // Construir WHERE clause para pagamentos
    const whereConditions: string[] = []
    const whereValues: any[] = []

    const inicioDate = formatDateISO(inicioCalculado)
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

    // Agregar pagamentos por mês conforme papel (usando lógica híbrida)
    const campoValor = construirCampoValorPorData(papel as 'geral' | 'corretores' | 'supervisores')

    const [pagamentosRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(${dataReferencia}, '%Y-%m') as mes,
         ${campoValor} as valor_producao
       FROM unificado_bonificacao ub
       ${whereClause}
       GROUP BY DATE_FORMAT(${dataReferencia}, '%Y-%m')
       ORDER BY mes ASC`,
      whereValues
    )

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Agregar descontos por mês de dt_movimentacao (usar range de 12 meses)
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

    // Criar mapas
    const producaoPorMes = new Map<string, number>()
    pagamentosRows.forEach((row: any) => {
      producaoPorMes.set(row.mes, Number(row.valor_producao || 0))
    })

    const descontosPorMes = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      descontosPorMes.set(row.mes, Number(row.valor_desconto || 0))
    })

    // Unir por mês
    const meses = new Set([...producaoPorMes.keys(), ...descontosPorMes.keys()])
    const resultado = Array.from(meses)
      .sort()
      .map((mes) => {
        // Valor bruto de comissão no mês (soma de vlr_bruto_corretor e/ou vlr_bruto_supervisor conforme papel)
        const valorBrutoComissao = producaoPorMes.get(mes) || 0
        const valorDesconto = descontosPorMes.get(mes) || 0

        // Percentual = (Valor do desconto no mês / Valor bruto de comissão no mês) * 100
        const percentualDesconto = valorBrutoComissao > 0 
          ? (valorDesconto / valorBrutoComissao) * 100 
          : 0

        return {
          mes,
          valorDesconto: Number(valorDesconto.toFixed(2)),
          valorProducao: Number(valorBrutoComissao.toFixed(2)), // Mantido para compatibilidade, mas é o valor bruto
          percentualDesconto: Number(percentualDesconto.toFixed(2))
        }
      })

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar impacto de descontos:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar impacto de descontos" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
