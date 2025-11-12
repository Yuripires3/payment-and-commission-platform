export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { formatDateISO, toEndOfDaySQL, toStartOfDaySQL } from "@/lib/date-utils"
import { construirCampoValorPorData, construirFiltroPapel } from "@/lib/dashboard-helpers"

/**
 * GET /api/dashboard/status-mensal
 * Retorna status de pagamento agrupado por mês
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: usa colunas separadas (vlr_bruto_corretor e vlr_bruto_supervisor)
 * - A partir de 2025-10-01: usa vlr_bruto_corretor como fonte única, filtrando por papel derivado de nome_supervisor
 * 
 * Descontos são obtidos exclusivamente de registro_bonificacao_descontos 
 * com tipo_movimentacao = 'desconto realizado' (case-insensitive).
 * Descontos são alocados pelo mês de data_movimentacao.
 * 
 * Alocação mensal: pagamentos agregados por mês de dt_pagamento (ou dt_analise),
 * descontos agregados por mês de dt_movimentacao.
 * Status: "Pago" (pagamentos - descontos) ou "Descontado" (apenas descontos).
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
         ${campoValor} as pagamentos
       FROM unificado_bonificacao ub
       ${whereClause}
       GROUP BY DATE_FORMAT(${dataReferencia}, '%Y-%m')
       ORDER BY mes ASC`,
      whereValues
    )

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Agregar descontos por mês de dt_movimentacao
    const [descontosRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(dt_movimentacao, '%Y-%m') as mes,
         SUM(valor) as descontos
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}
       GROUP BY DATE_FORMAT(dt_movimentacao, '%Y-%m')
       ORDER BY mes ASC`,
      [inicioSQL, fimSQL]
    )

    // Criar mapas
    const pagamentosPorMes = new Map<string, number>()
    pagamentosRows.forEach((row: any) => {
      pagamentosPorMes.set(row.mes, Number(row.pagamentos || 0))
    })

    const descontosPorMes = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      descontosPorMes.set(row.mes, Number(row.descontos || 0))
    })

    // Unir por mês e criar status
    const meses = new Set([...pagamentosPorMes.keys(), ...descontosPorMes.keys()])
    const resultado: Array<{ mes: string; status: string; valor: number }> = []

    Array.from(meses)
      .sort()
      .forEach((mes) => {
        const pagamentos = pagamentosPorMes.get(mes) || 0
        const descontos = descontosPorMes.get(mes) || 0
        const valorPago = pagamentos - descontos

        if (valorPago > 0) {
          resultado.push({
            mes,
            status: "Pago",
            valor: Number(valorPago.toFixed(2))
          })
        }

        if (descontos > 0) {
          resultado.push({
            mes,
            status: "Descontado",
            valor: Number(descontos.toFixed(2))
          })
        }
      })

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar status mensal:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar status mensal" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
