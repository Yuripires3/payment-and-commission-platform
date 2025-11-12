export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { formatDateISO, toEndOfDaySQL, toStartOfDaySQL } from "@/lib/date-utils"
import { construirCampoNomeExibicao, construirCondicaoPapelNovoModelo } from "@/lib/dashboard-helpers"
    const condicaoCorretorNovoModelo = construirCondicaoPapelNovoModelo('corretor')
    const condicaoSupervisorNovoModelo = construirCondicaoPapelNovoModelo('supervisor')

/**
 * GET /api/dashboard/top-supervisores
 * Retorna top supervisores por valor líquido (bruto - descontos)
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: agrupa por cpf_supervisor/nome_supervisor, soma vlr_bruto_supervisor
 * - A partir de 2025-10-01: agrupa por cpf_corretor/nome_corretor onde papel='supervisor', soma vlr_bruto_corretor
 * 
 * Descontos são obtidos exclusivamente de registro_bonificacao_descontos 
 * com tipo_movimentacao = 'desconto realizado'.
 * Join feito por CPF do beneficiário.
 * 
 * Query params:
 * - inicio: YYYY-MM-DD
 * - fim: YYYY-MM-DD
 * - operadora: string (opcional)
 * - entidade: string (opcional, múltiplo separado por vírgula)
 * - limit: number (padrão: 10)
 */
export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    const searchParams = request.nextUrl.searchParams
    const inicio = searchParams.get("inicio")
    const fim = searchParams.get("fim")
    const operadora = searchParams.get("operadora")
    const entidade = searchParams.get("entidade")
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50)

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

    // Construir WHERE clause (lógica híbrida para supervisores)
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

    // Filtrar apenas supervisores (modelo antigo ou novo)
    whereConditions.push(`(
      (${dataReferencia} < '2025-10-01' AND ub.cpf_supervisor IS NOT NULL AND ub.cpf_supervisor != '')
      OR (${dataReferencia} >= '2025-10-01' 
          AND ${condicaoSupervisorNovoModelo} 
          AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
    )`)

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

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Buscar descontos agregados por CPF
    const [descontosRows]: any = await connection.execute(
      `SELECT cpf, SUM(valor) as valor
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}
       GROUP BY cpf`,
      [inicioSQL, fimSQL]
    )
    const descontosMap = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      if (row.cpf) {
        descontosMap.set(String(row.cpf).replace(/\D/g, ""), Number(row.valor || 0))
      }
    })

    // Buscar supervisores com agregação
    const safeLimit = Math.max(1, Math.min(limit, 50))

    // Para supervisores, vamos usar UNION para combinar modelo antigo e novo
    // Isso evita problemas com CASE WHEN no GROUP BY
    
    // Query para modelo antigo (< 2025-10-01)
    const whereAntigoConditions = [...whereConditions]
    const whereAntigoValues = [...whereValues]
    whereAntigoConditions.push(`${dataReferencia} < '2025-10-01'`)
    whereAntigoConditions.push("ub.cpf_supervisor IS NOT NULL AND ub.cpf_supervisor != ''")
    const whereAntigoClause = `WHERE ${whereAntigoConditions.join(" AND ")}`
    
    // Query para modelo novo (>= 2025-10-01)
    const whereNovoConditions = [...whereConditions]
    const whereNovoValues = [...whereValues]
    whereNovoConditions.push(`${dataReferencia} >= '2025-10-01'`)
    whereNovoConditions.push(condicaoSupervisorNovoModelo)
    whereNovoConditions.push("ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != ''")
    const whereNovoClause = `WHERE ${whereNovoConditions.join(" AND ")}`
    
    const query = `
      SELECT 
        nome_exibicao,
        'supervisor' as papel,
        SUM(valor_bruto) as valor_bruto,
        SUM(vidas) as vidas,
        CASE 
          WHEN SUM(vidas) > 0 THEN SUM(valor_bruto) / SUM(vidas)
          ELSE 0 
        END as ticket,
        GROUP_CONCAT(DISTINCT cpfs SEPARATOR ',') as cpfs
      FROM (
        -- Modelo antigo
        SELECT 
          COALESCE(ub.nome_supervisor, ub.cpf_supervisor, 'Não informado') as nome_exibicao,
          COALESCE(SUM(ub.vlr_bruto_supervisor), 0) as valor_bruto,
          COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, ''))) as vidas,
          GROUP_CONCAT(DISTINCT ub.cpf) as cpfs,
          ub.cpf_supervisor as cpf_key
        FROM unificado_bonificacao ub
        ${whereAntigoClause}
        GROUP BY ub.cpf_supervisor, ub.nome_supervisor
        
        UNION ALL
        
        -- Modelo novo
        SELECT 
          COALESCE(ub.nome_corretor, ub.cpf_corretor, 'Não informado') as nome_exibicao,
          COALESCE(SUM(ub.vlr_bruto_corretor), 0) as valor_bruto,
          COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, ''))) as vidas,
          GROUP_CONCAT(DISTINCT ub.cpf) as cpfs,
          ub.cpf_corretor as cpf_key
        FROM unificado_bonificacao ub
        ${whereNovoClause}
        GROUP BY ub.cpf_corretor, ub.nome_corretor
      ) as combined
      GROUP BY nome_exibicao
      ORDER BY valor_bruto DESC
      LIMIT ${safeLimit}
    `
    
    // Os valores precisam ser passados duas vezes (uma para cada parte da UNION)
    // Primeiro para modelo antigo, depois para modelo novo
    const [rows]: any = await connection.execute(query, [...whereAntigoValues, ...whereNovoValues])

    // Calcular descontos por supervisor
    const resultado = rows.map((row: any) => {
      const valorBruto = Number(row.valor_bruto || 0)
      const cpfs = (row.cpfs || "").split(",").filter(Boolean)
      let descontoTotal = 0
      
      cpfs.forEach((cpf: string) => {
        const cpfNormalizado = String(cpf).replace(/\D/g, "")
        descontoTotal += descontosMap.get(cpfNormalizado) || 0
      })

      const valorLiquido = valorBruto - descontoTotal
      const vidas = Number(row.vidas || 0)
      const ticket = vidas > 0 ? valorLiquido / vidas : 0

      return {
        nome: row.nome_exibicao || "Não informado",
        papel: row.papel || 'supervisor',
        valor: valorLiquido,
        valorBruto,
        desconto: descontoTotal,
        vidas,
        ticket: Number(ticket.toFixed(2))
      }
    })

    // Reordenar por valor líquido
    resultado.sort((a, b) => b.valor - a.valor)

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar top supervisores:", error)
    console.error("Stack:", error.stack)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar top supervisores", details: error.stack },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

