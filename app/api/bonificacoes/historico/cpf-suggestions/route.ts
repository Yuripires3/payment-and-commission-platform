import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

export async function GET(request: NextRequest) {
  let connection: any = null
  
  try {
    // Verificar variáveis de ambiente
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas" },
        { status: 500 }
      )
    }

    // Criar conexão
    connection = await getDBConnection()

    // Extrair parâmetro de busca
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || ""

    // Buscar CPFs únicos que correspondem à busca
    // Normalizar CPF removendo formatação para busca
    const numericQuery = query.replace(/\D/g, "")
    
    let cpfQuery = `
      SELECT DISTINCT cpf, nome
      FROM unificado_bonificacao_comercial
      WHERE cpf IS NOT NULL AND cpf != ''
    `
    
    const queryValues: any[] = []
    
    if (numericQuery) {
      // Remove formatação do CPF no banco (pontos, traços e espaços) e compara com a query numérica
      // Isso funciona independente de como o CPF está armazenado no banco (com ou sem formatação)
      cpfQuery += ` AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') LIKE ?`
      queryValues.push(`%${numericQuery}%`)
    }
    
    cpfQuery += ` ORDER BY cpf LIMIT 20`

    const [rows]: any = await connection.execute(cpfQuery, queryValues)

    // Formatar CPFs e retornar com nome associado
    const suggestions = rows.map((row: any) => ({
      cpf: row.cpf,
      nome: row.nome || "",
      formattedCpf: formatCpf(row.cpf)
    }))

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error("Erro ao buscar sugestões de CPF:", error)
    return NextResponse.json(
      { 
        error: error.message || "Erro ao buscar sugestões de CPF",
        suggestions: []
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return ""
  // Remove qualquer caractere não numérico
  const numericCpf = cpf.replace(/\D/g, "")
  // Preenche com zeros à esquerda se tiver menos de 11 dígitos
  const paddedCpf = numericCpf.padStart(11, "0")
  // Formata como XXX.XXX.XXX-XX
  if (paddedCpf.length === 11) {
    return `${paddedCpf.slice(0, 3)}.${paddedCpf.slice(3, 6)}.${paddedCpf.slice(6, 9)}-${paddedCpf.slice(9, 11)}`
  }
  return paddedCpf
}

