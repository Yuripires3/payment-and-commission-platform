import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

const DATA_CORTE = process.env.UNIFICADO_DATA_CORTE || "2025-10-01"
const MAX_PAGE_SIZE = 100

const sanitizeCpfExpr = (field: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(TRIM(${field}), '.', ''), '-', ''), '/', ''), ' ', '')`

const sanitizeNomeExpr = (field: string) => `LOWER(TRIM(COALESCE(${field}, '')))`

const dataReferenciaExpr = "DATE(ub.dt_analise)"
const supervisorRoleExpr = `LOWER(TRIM(COALESCE(ub.nome_supervisor, '')))`

const buildSupervisorMatchExpr = () =>
  `(${supervisorRoleExpr} = 'supervisor' OR ${supervisorRoleExpr} LIKE 'supervisor %' OR ${supervisorRoleExpr} LIKE '% supervisor' OR ${supervisorRoleExpr} LIKE '% supervisor %' OR ${supervisorRoleExpr} LIKE '%supervisor%')`

export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas" },
        { status: 500 }
      )
    }

    connection = await getDBConnection()

    const searchParams = request.nextUrl.searchParams
    const cpf = (searchParams.get("cpf") || "").replace(/\D/g, "")
    const nome = (searchParams.get("nome") || "").trim().toLowerCase()
    const dataPagamento = searchParams.get("data_pagamento")
    const dataInicio = searchParams.get("data_inicio")
    const dataFim = searchParams.get("data_fim")
    const numeroProposta = (searchParams.get("numero_proposta") || "").trim()

    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10)
    const safePage = Number.isNaN(requestedPage) ? 1 : requestedPage
    const page = Math.max(safePage, 1)

    const requestedPageSize = Number.parseInt(searchParams.get("pageSize") || "20", 10)
    const safePageSize = Number.isNaN(requestedPageSize) ? 20 : requestedPageSize
    const pageSize = Math.min(Math.max(safePageSize, 1), MAX_PAGE_SIZE)

    const whereConditions: string[] = []
    const whereValues: any[] = []

    const cpfCorretorExpr = sanitizeCpfExpr("ub.cpf_corretor")
    const cpfSupervisorExpr = sanitizeCpfExpr("ub.cpf_supervisor")

    if (cpf) {
      whereConditions.push(`(
        (
          (${dataReferenciaExpr} < '${DATA_CORTE}' OR ${dataReferenciaExpr} IS NULL)
          AND (${cpfCorretorExpr} LIKE ? OR ${cpfSupervisorExpr} LIKE ?)
        )
        OR (
          ${dataReferenciaExpr} >= '${DATA_CORTE}'
          AND ${cpfCorretorExpr} LIKE ?
        )
      )`)
      whereValues.push(`%${cpf}%`, `%${cpf}%`, `%${cpf}%`)
    }

    if (nome) {
      const nomeCorretorExpr = sanitizeNomeExpr("ub.nome_corretor")
      const nomeSupervisorExpr = sanitizeNomeExpr("ub.nome_supervisor")

      whereConditions.push(`(
        (
          (${dataReferenciaExpr} < '${DATA_CORTE}' OR ${dataReferenciaExpr} IS NULL)
          AND (${nomeCorretorExpr} LIKE ? OR ${nomeSupervisorExpr} LIKE ?)
        )
        OR (
          ${dataReferenciaExpr} >= '${DATA_CORTE}'
          AND ${nomeCorretorExpr} LIKE ?
        )
      )`)
      whereValues.push(`%${nome}%`, `%${nome}%`, `%${nome}%`)
    }

    if (dataPagamento) {
      whereConditions.push(`${dataReferenciaExpr} = ?`)
      whereValues.push(dataPagamento)
    } else {
      if (dataInicio) {
        whereConditions.push(`${dataReferenciaExpr} >= ?`)
        whereValues.push(dataInicio)
      }

      if (dataFim) {
        whereConditions.push(`${dataReferenciaExpr} <= ?`)
        whereValues.push(dataFim)
      }
    }

    if (numeroProposta) {
      whereConditions.push("ub.numero_proposta LIKE ?")
      whereValues.push(`%${numeroProposta}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    const [tableCheck]: any = await connection.execute(
      `SHOW TABLES LIKE 'unificado_bonificacao'`
    )
    if (tableCheck.length === 0) {
      return NextResponse.json(
        { error: "Tabela 'unificado_bonificacao' não encontrada no banco de dados" },
        { status: 404 }
      )
    }

    const [countResult]: any = await connection.execute(
      `SELECT COUNT(*) as total FROM unificado_bonificacao ub ${whereClause}`,
      whereValues
    )
    const total = countResult[0]?.total || 0
    const totalPages = Math.ceil(total / pageSize)
    const offset = (page - 1) * pageSize

    const bonusBrutoExpr = `CASE
      WHEN ${dataReferenciaExpr} IS NULL THEN COALESCE(ub.vlr_bruto_corretor, 0) + COALESCE(ub.vlr_bruto_supervisor, 0)
      WHEN ${dataReferenciaExpr} < '${DATA_CORTE}' THEN COALESCE(ub.vlr_bruto_corretor, 0) + COALESCE(ub.vlr_bruto_supervisor, 0)
      ELSE COALESCE(ub.vlr_bruto_corretor, 0)
    END AS bonus_bruto`

    const nomeExibicaoExpr = `CASE
      WHEN ub.nome IS NOT NULL AND TRIM(ub.nome) != '' THEN ub.nome
      WHEN ${dataReferenciaExpr} < '${DATA_CORTE}' OR ${dataReferenciaExpr} IS NULL THEN
        COALESCE(NULLIF(TRIM(ub.nome_corretor), ''), NULLIF(TRIM(ub.nome_supervisor), ''), 'Não informado')
      ELSE COALESCE(NULLIF(TRIM(ub.nome_corretor), ''), 'Não informado')
    END AS nome_exibicao`

    const tipoProdutorExpr = `CASE
      WHEN ${dataReferenciaExpr} IS NULL OR ${dataReferenciaExpr} < '${DATA_CORTE}' THEN
        CASE
          WHEN COALESCE(${cpfSupervisorExpr}, '') != '' AND COALESCE(ub.vlr_bruto_supervisor, 0) > 0 THEN 'BONIFICAÇÃO SUPERVISOR'
          ELSE 'BONIFICAÇÃO CORRETOR'
        END
      ELSE
        CASE
          WHEN ${buildSupervisorMatchExpr()} THEN 'BONIFICAÇÃO SUPERVISOR'
          ELSE 'BONIFICAÇÃO CORRETOR'
        END
    END AS tipo_produtor`

    const query = `
      SELECT
        ub.operadora,
        ub.numero_proposta,
        ub.entidade,
        ${nomeExibicaoExpr},
        ub.nome_corretor,
        ub.nome_supervisor,
        ub.tipo_beneficiario,
        ub.idade,
        ${bonusBrutoExpr},
        ${dataReferenciaExpr} AS dt_analise,
        ${tipoProdutorExpr}
      FROM unificado_bonificacao ub
      ${whereClause}
      ORDER BY 
        ${dataReferenciaExpr} DESC,
        nome_exibicao ASC,
        ub.tipo_beneficiario DESC,
        COALESCE(tipo_produtor, '') ASC,
        ub.numero_proposta DESC,
        ub.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `

    const [rows]: any = await connection.execute(query, whereValues)

    return NextResponse.json({
      data: rows || [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    })
  } catch (error: any) {
    console.error("Erro ao buscar extrato de propostas:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao buscar extrato de propostas",
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}


