import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { construirCampoValorPorData, construirFiltroPapel } from "@/lib/dashboard-helpers"
import { formatDateISO } from "@/lib/date-utils"

/**
 * GET /api/dashboard/evolucao
 * Retorna evolução mensal de comissões
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
 * Valor líquido = pagamentos_mes - descontos_mes.
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

    whereConditions.push("ub.dt_analise >= ?")
    whereValues.push(inicioCalculado)
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

    // Agregar pagamentos por mês conforme papel (usando lógica híbrida)
    const campoValor = construirCampoValorPorData(papel as 'geral' | 'corretores' | 'supervisores')

    const [pagamentosRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(ub.dt_analise, '%Y-%m') as mes,
         ${campoValor} as pagamentos
       FROM unificado_bonificacao ub
       ${whereClause}
       GROUP BY DATE_FORMAT(ub.dt_analise, '%Y-%m')
       ORDER BY mes ASC`,
      whereValues
    )

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Agregar descontos por mês de dt_movimentacao (usar range de 12 meses)
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
      [inicioCalculado, fim]
    )

    // Criar mapas para união
    const pagamentosPorMes = new Map<string, number>()
    pagamentosRows.forEach((row: any) => {
      pagamentosPorMes.set(row.mes, Number(row.pagamentos || 0))
    })

    const descontosPorMes = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      descontosPorMes.set(row.mes, Number(row.descontos || 0))
    })

    // Unir por mês (FULL JOIN simulado)
    const meses = new Set([...pagamentosPorMes.keys(), ...descontosPorMes.keys()])
    const resultado = Array.from(meses)
      .sort()
      .map((mes) => {
        const pagamentos = pagamentosPorMes.get(mes) || 0
        const descontos = descontosPorMes.get(mes) || 0
        const valorLiquido = pagamentos - descontos

        return {
          mes,
          valor: Number(valorLiquido.toFixed(2)),
          bruto: Number(pagamentos.toFixed(2)),
          descontos: Number(descontos.toFixed(2))
        }
      })

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar evolução:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar evolução" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
