import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

const DATA_CORTE = process.env.UNIFICADO_DATA_CORTE || "2025-10-01"
const dataReferenciaExpr = "DATE(ub.dt_analise)"

const sanitizeCpfExpr = (field: string) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(TRIM(${field}), '.', ''), '-', ''), '/', ''), ' ', '')`

function formatCpf(cpf: string | null | undefined) {
  if (!cpf) return ""
  const numericCpf = cpf.replace(/\D/g, "")
  const paddedCpf = numericCpf.padStart(11, "0")
  if (paddedCpf.length === 11) {
    return `${paddedCpf.slice(0, 3)}.${paddedCpf.slice(3, 6)}.${paddedCpf.slice(6, 9)}-${paddedCpf.slice(9, 11)}`
  }
  return paddedCpf
}

export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas", suggestions: [] },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const query = (searchParams.get("q") || "").replace(/\D/g, "")

    if (!query) {
      return NextResponse.json({ suggestions: [] })
    }

    connection = await getDBConnection()

    const cpfCorretorExpr = sanitizeCpfExpr("ub.cpf_corretor")
    const cpfSupervisorExpr = sanitizeCpfExpr("ub.cpf_supervisor")

    const suggestionsQuery = `
      SELECT 
        candidato.cpf_normalizado,
        COALESCE(
          MAX(CASE WHEN candidato.nome_preferencial IS NOT NULL AND candidato.nome_preferencial != '' THEN candidato.nome_preferencial END),
          ''
        ) AS nome,
        MAX(candidato.data_referencia) AS ultima_data
      FROM (
        SELECT 
          ${cpfCorretorExpr} AS cpf_normalizado,
          TRIM(COALESCE(ub.nome_corretor, ub.nome, '')) AS nome_preferencial,
          ${dataReferenciaExpr} AS data_referencia
        FROM unificado_bonificacao ub
        WHERE ${cpfCorretorExpr} IS NOT NULL
          AND ${cpfCorretorExpr} != ''
        
        UNION ALL
        
        SELECT 
          ${cpfSupervisorExpr} AS cpf_normalizado,
          TRIM(COALESCE(ub.nome_supervisor, ub.nome_corretor, ub.nome, '')) AS nome_preferencial,
          ${dataReferenciaExpr} AS data_referencia
        FROM unificado_bonificacao ub
        WHERE (${dataReferenciaExpr} < '${DATA_CORTE}' OR ${dataReferenciaExpr} IS NULL)
          AND ${cpfSupervisorExpr} IS NOT NULL
          AND ${cpfSupervisorExpr} != ''
      ) candidato
      WHERE candidato.cpf_normalizado LIKE ?
      GROUP BY candidato.cpf_normalizado
      ORDER BY ultima_data DESC
      LIMIT 20
    `

    const [rows]: any = await connection.execute(suggestionsQuery, [`%${query}%`])

    const suggestions = (rows || [])
      .map((row: any) => {
        const numericCpf = row.cpf_normalizado
        if (!numericCpf) {
          return null
        }
        return {
          cpf: String(numericCpf),
          nome: row.nome || "",
          formattedCpf: formatCpf(String(numericCpf)),
        }
      })
      .filter(Boolean)

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error("Erro ao buscar sugestões de CPF para extrato de propostas:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao buscar sugestões de CPF",
        suggestions: [],
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}


