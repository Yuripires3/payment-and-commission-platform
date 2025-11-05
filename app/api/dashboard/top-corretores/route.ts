import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"
import { construirCampoNomeExibicao } from "@/lib/dashboard-helpers"

/**
 * GET /api/dashboard/top-corretores
 * Retorna top corretores por valor líquido (bruto - descontos)
 * 
 * Lógica híbrida:
 * - Antes de 2025-10-01: agrupa por cpf_corretor/nome_corretor, soma vlr_bruto_corretor
 * - A partir de 2025-10-01: agrupa por cpf_corretor/nome_corretor onde papel='corretor', soma vlr_bruto_corretor
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

    // Construir WHERE clause (lógica híbrida para corretores)
    const whereConditions: string[] = []
    const whereValues: any[] = []

    whereConditions.push("ub.dt_analise >= ?")
    whereValues.push(inicio)
    whereConditions.push("ub.dt_analise <= ?")
    whereValues.push(fim)

    // Filtrar apenas corretores (modelo antigo ou novo)
    whereConditions.push(`(
      (ub.dt_analise < '2025-10-01' AND ub.cpf_corretor IS NOT NULL AND ub.cpf_corretor != '')
      OR (ub.dt_analise >= '2025-10-01' 
          AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' 
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
      [inicio, fim]
    )
    const descontosMap = new Map<string, number>()
    descontosRows.forEach((row: any) => {
      if (row.cpf) {
        descontosMap.set(String(row.cpf).replace(/\D/g, ""), Number(row.valor || 0))
      }
    })

    // Buscar corretores com agregação
    // Buscar mais itens do que o necessário para garantir que após calcular descontos e reordenar ainda temos o suficiente
    const safeLimit = Math.max(1, Math.min(limit, 50))
    const queryLimit = Math.min(safeLimit * 2, 100) // Buscar o dobro para garantir que temos suficientes após reordenação

    const [rows]: any = await connection.execute(
      `SELECT 
         ${construirCampoNomeExibicao('ub')},
         'corretor' as papel,
         COALESCE(SUM(
           CASE 
             WHEN ub.dt_analise < '2025-10-01' THEN ub.vlr_bruto_corretor
             WHEN ub.dt_analise >= '2025-10-01' 
                  AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' THEN ub.vlr_bruto_corretor
             ELSE 0
           END
         ), 0) as valor_bruto,
         COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, ''))) as vidas,
         CASE 
           WHEN COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, ''))) > 0 
           THEN COALESCE(SUM(
             CASE 
               WHEN ub.dt_analise < '2025-10-01' THEN ub.vlr_bruto_corretor
               WHEN ub.dt_analise >= '2025-10-01' 
                    AND LOWER(TRIM(COALESCE(ub.nome_supervisor, ''))) = 'corretor' THEN ub.vlr_bruto_corretor
               ELSE 0
             END
           ), 0) / COUNT(DISTINCT CONCAT(ub.cpf, '-', COALESCE(ub.id_beneficiario, '')))
           ELSE 0 
         END as ticket,
         GROUP_CONCAT(DISTINCT ub.cpf) as cpfs
       FROM unificado_bonificacao ub
       ${whereClause}
       GROUP BY ub.cpf_corretor, ub.nome_corretor
       ORDER BY valor_bruto DESC
       LIMIT ${queryLimit}`,
      whereValues
    )

    // Calcular descontos por corretor (soma dos descontos dos CPFs dos beneficiários do corretor)
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
        papel: row.papel || 'corretor',
        valor: valorLiquido,
        valorBruto,
        desconto: descontoTotal,
        vidas,
        ticket: Number(ticket.toFixed(2))
      }
    })

    // Reordenar por valor líquido
    resultado.sort((a, b) => b.valor - a.valor)

    // Aplicar LIMIT final após calcular descontos e reordenar
    return NextResponse.json(resultado.slice(0, safeLimit))
  } catch (error: any) {
    console.error("Erro ao buscar top corretores:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar top corretores" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}
