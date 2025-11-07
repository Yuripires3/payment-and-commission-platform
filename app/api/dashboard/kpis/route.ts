import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { construirCampoValorPorData, construirFiltroPapel } from "@/lib/dashboard-helpers"
import { formatDateISO } from "@/lib/date-utils"

/**
 * GET /api/dashboard/kpis
 * Retorna KPIs do dashboard de bonificações
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: usa colunas separadas (vlr_bruto_corretor e vlr_bruto_supervisor)
 * - A partir de 2025-10-01: usa vlr_bruto_corretor como fonte única, filtrando por papel derivado de nome_supervisor
 * 
 * Separa valores de Corretores e Supervisores.
 * Descontos são obtidos exclusivamente de registro_bonificacao_descontos 
 * com tipo_movimentacao = 'desconto realizado' (case-insensitive).
 * Descontos são alocados pelo mês de data_movimentacao.
 * 
 * Alocação mensal: pagamentos agregados por mês de dt_pagamento (ou dt_analise),
 * descontos agregados por mês de dt_movimentacao.
 * Valor líquido = pagamentos_mes - descontos_mes.
 * 
 * Query params:
 * - inicio: YYYY-MM-DD (data inicial)
 * - fim: YYYY-MM-DD (data final)
 * - operadora: string (filtro opcional)
 * - entidade: string (filtro opcional, pode ser múltiplo separado por vírgula)
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

    // Construir WHERE clause base por dt_analise
    const whereConditions: string[] = []
    const whereValues: any[] = []

    whereConditions.push("ub.dt_analise >= ?")
    whereValues.push(inicio)
    whereConditions.push("ub.dt_analise <= ?")
    whereValues.push(fim)

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

    // Calcular mês atual e mês anterior para variação
    const dataFim = new Date(fim)
    const anoAtual = dataFim.getFullYear()
    const mesAtual = dataFim.getMonth() + 1
    
    const inicioMesAtual = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-01`
    const fimMesAtual = fim
    
    // Mês anterior
    const dataInicioMesAnterior = new Date(anoAtual, mesAtual - 2, 1)
    const inicioMesAnterior = `${dataInicioMesAnterior.getFullYear()}-${String(dataInicioMesAnterior.getMonth() + 1).padStart(2, "0")}-01`
    const fimMesAnterior = formatDateISO(new Date(anoAtual, mesAtual - 1, 0))

    // Construir WHERE para mês atual
    const whereMesAtualConditions = [...whereConditions]
    const whereMesAtualValues = [...whereValues]
    const idxInicio = whereMesAtualConditions.findIndex(c => c.includes("ub.dt_analise >="))
    const idxFim = whereMesAtualConditions.findIndex(c => c.includes("ub.dt_analise <="))
    if (idxInicio >= 0) whereMesAtualConditions[idxInicio] = "ub.dt_analise >= ?"
    if (idxFim >= 0) whereMesAtualConditions[idxFim] = "ub.dt_analise <= ?"
    whereMesAtualValues[0] = inicioMesAtual
    whereMesAtualValues[1] = fimMesAtual
    const filtroPapelMesAtual = construirFiltroPapel(papel as 'geral' | 'corretores' | 'supervisores')
    const whereMesAtual = `WHERE ${whereMesAtualConditions.join(" AND ")} ${filtroPapelMesAtual}`

    // Construir WHERE para mês anterior
    const whereMesAnteriorConditions = [...whereConditions]
    const whereMesAnteriorValues = [...whereValues]
    const idxInicioAnt = whereMesAnteriorConditions.findIndex(c => c.includes("ub.dt_analise >="))
    const idxFimAnt = whereMesAnteriorConditions.findIndex(c => c.includes("ub.dt_analise <="))
    if (idxInicioAnt >= 0) whereMesAnteriorConditions[idxInicioAnt] = "ub.dt_analise >= ?"
    if (idxFimAnt >= 0) whereMesAnteriorConditions[idxFimAnt] = "ub.dt_analise <= ?"
    whereMesAnteriorValues[0] = inicioMesAnterior
    whereMesAnteriorValues[1] = fimMesAnterior
    const filtroPapelMesAnterior = construirFiltroPapel(papel as 'geral' | 'corretores' | 'supervisores')
    const whereMesAnterior = `WHERE ${whereMesAnteriorConditions.join(" AND ")} ${filtroPapelMesAnterior}`

    // Agregar pagamentos do período completo (usando range do filtro)
    const campoValor = construirCampoValorPorData(papel as 'geral' | 'corretores' | 'supervisores')

    const [pagamentosPeriodo]: any = await connection.execute(
      `SELECT ${campoValor} as pagamentos
       FROM unificado_bonificacao ub
       ${whereClause}`,
      whereValues
    )

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Agregar descontos do período completo
    const [descontosPeriodo]: any = await connection.execute(
      `SELECT SUM(valor) as descontos
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}`,
      [inicio, fim]
    )

    // Calcular valores do período completo
    const pagamentosAtual = Number(pagamentosPeriodo[0]?.pagamentos || 0)
    const descontosAtual = Number(descontosPeriodo[0]?.descontos || 0)
    const comissoesMes = pagamentosAtual - descontosAtual

    // Agregar pagamentos do mês atual por papel (usando lógica híbrida) para cálculo de variação
    const campoValorMesAtual = construirCampoValorPorData(papel as 'geral' | 'corretores' | 'supervisores')

    const [pagamentosMesAtual]: any = await connection.execute(
      `SELECT ${campoValorMesAtual} as pagamentos
       FROM unificado_bonificacao ub
       ${whereMesAtual}`,
      whereMesAtualValues
    )

    // Agregar descontos do mês atual (por mês de dt_movimentacao)
    const mesAtualStr = `${anoAtual}-${String(mesAtual).padStart(2, "0")}`

    const [descontosMesAtual]: any = await connection.execute(
      `SELECT SUM(valor) as descontos
       FROM registro_bonificacao_descontos
       WHERE DATE_FORMAT(dt_movimentacao, '%Y-%m') = ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}`,
      [mesAtualStr]
    )

    // Mesmo para mês anterior (para cálculo de variação)
    const [pagamentosMesAnterior]: any = await connection.execute(
      `SELECT ${campoValorMesAtual} as pagamentos
       FROM unificado_bonificacao ub
       ${whereMesAnterior}`,
      whereMesAnteriorValues
    )

    const mesAnteriorStr = `${dataInicioMesAnterior.getFullYear()}-${String(dataInicioMesAnterior.getMonth() + 1).padStart(2, "0")}`
    const [descontosMesAnterior]: any = await connection.execute(
      `SELECT SUM(valor) as descontos
       FROM registro_bonificacao_descontos
       WHERE DATE_FORMAT(dt_movimentacao, '%Y-%m') = ?
         AND LOWER(tipo_movimentacao) = 'desconto realizado'
         ${statusFilter}`,
      [mesAnteriorStr]
    )

    const pagamentosAnterior = Number(pagamentosMesAnterior[0]?.pagamentos || 0)
    const descontosAnterior = Number(descontosMesAnterior[0]?.descontos || 0)
    const comissoesMesAnt = pagamentosAnterior - descontosAnterior

    const variacaoMesPercent = comissoesMesAnt > 0 
      ? ((comissoesMes - comissoesMesAnt) / comissoesMesAnt) * 100 
      : (comissoesMes > 0 ? 100 : 0)

    // Parceiros ativos (distinct corretores ou supervisores conforme papel e modelo)
    let parceirosQuery = ""
    if (papel === "corretores") {
      parceirosQuery = `SELECT COUNT(DISTINCT 
        CASE 
          WHEN COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' THEN ub.cpf_corretor
          ELSE CASE WHEN LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' THEN ub.cpf_corretor ELSE NULL END
        END
      ) as total
        FROM unificado_bonificacao ub
        ${whereClause}
        AND (
          (COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
          OR (COALESCE(ub.dt_pagamento, ub.dt_analise) >= '2025-10-01' AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
        )`
    } else if (papel === "supervisores") {
      parceirosQuery = `SELECT COUNT(DISTINCT 
        CASE 
          WHEN COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' THEN ub.cpf_supervisor
          ELSE CASE WHEN LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'supervisor' THEN ub.cpf_corretor ELSE NULL END
        END
      ) as total
        FROM unificado_bonificacao ub
        ${whereClause}
        AND (
          (COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' AND ub.cpf_supervisor IS NOT NULL AND ub.cpf_supervisor != '')
          OR (COALESCE(ub.dt_pagamento, ub.dt_analise) >= '2025-10-01' AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'supervisor' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
        )`
    } else {
      // Para "geral", usar UNION para garantir valores únicos de corretores e supervisores
      parceirosQuery = `SELECT COUNT(DISTINCT cpf) as total
        FROM (
          SELECT DISTINCT
            CASE 
              WHEN COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' THEN ub.cpf_corretor
              ELSE CASE WHEN LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' THEN ub.cpf_corretor ELSE NULL END
            END as cpf
          FROM unificado_bonificacao ub
          ${whereClause}
          AND (
            (COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
            OR (COALESCE(ub.dt_pagamento, ub.dt_analise) >= '2025-10-01' AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
          )
          UNION
          SELECT DISTINCT
            CASE 
              WHEN COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' THEN ub.cpf_supervisor
              ELSE CASE WHEN LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'supervisor' THEN ub.cpf_corretor ELSE NULL END
            END as cpf
          FROM unificado_bonificacao ub
          ${whereClause}
          AND (
            (COALESCE(ub.dt_pagamento, ub.dt_analise) < '2025-10-01' AND ub.cpf_supervisor IS NOT NULL AND ub.cpf_supervisor != '')
            OR (COALESCE(ub.dt_pagamento, ub.dt_analise) >= '2025-10-01' AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'supervisor' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
          )
        ) as parceiros_unicos
        WHERE cpf IS NOT NULL AND cpf != ''`
    }

    // Para query UNION, precisamos duplicar os valores do whereClause
    const parceirosValues = papel === "geral" ? [...whereValues, ...whereValues] : whereValues
    const [parceiros]: any = await connection.execute(parceirosQuery, parceirosValues)

    // Vidas pagas (count distinct beneficiários)
    const [vidasPagas]: any = await connection.execute(
      `SELECT COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, ''))) as total
       FROM unificado_bonificacao ub
       ${whereClause}
       AND ub.cpf IS NOT NULL AND ub.cpf != ''`,
      whereValues
    )

    // Vidas faturadas (assumindo mesmo que vidas pagas)
    const vidasFaturadas = vidasPagas[0]?.total || 0

    // Ticket médio conforme papel (usando período completo)
    const ticketMedio = vidasPagas[0]?.total > 0 
      ? comissoesMes / vidasPagas[0].total 
      : 0

    // Buscar valores brutos separados para retorno (usando período completo)
    // Para valores separados, não aplicar filtro de papel no WHERE pois a função já filtra internamente
    const whereSemPapelConditions = [...whereConditions]
    const whereSemPapelValues = [...whereValues]
    const whereSemPapel = `WHERE ${whereSemPapelConditions.join(" AND ")}`
    
    const [valoresBrutos]: any = await connection.execute(
      `SELECT 
         ${construirCampoValorPorData('corretores')} as comissoes_corretor,
         ${construirCampoValorPorData('supervisores')} as comissoes_supervisor
       FROM unificado_bonificacao ub
       ${whereSemPapel}`,
      whereSemPapelValues
    )

    return NextResponse.json({
      comissoesMes,
      variacaoMesPercent: Number(variacaoMesPercent.toFixed(2)),
      parceirosAtivos: Number(parceiros[0]?.total || 0),
      vidasFaturadas: Number(vidasFaturadas),
      vidasPagas: Number(vidasPagas[0]?.total || 0),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      // Valores separados por papel
      comissoesCorretores: Number(valoresBrutos[0]?.comissoes_corretor || 0),
      comissoesSupervisores: Number(valoresBrutos[0]?.comissoes_supervisor || 0),
      descontoTotal: descontosAtual,
      pagamentosBruto: pagamentosAtual
    })
  } catch (error: any) {
    console.error("Erro ao buscar KPIs:", error)
    console.error("Stack:", error.stack)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar KPIs", details: error.stack },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
