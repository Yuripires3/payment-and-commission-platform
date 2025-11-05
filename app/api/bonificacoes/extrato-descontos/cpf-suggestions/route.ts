import { NextRequest, NextResponse } from "next/server"
import mysql from "mysql2/promise"

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
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    })

    // Extrair parâmetro de busca
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || ""

    // Buscar CPFs únicos que correspondem à busca
    // Normalizar CPF removendo formatação para busca
    const numericQuery = query.replace(/\D/g, "")
    
    let cpfQuery = `
      SELECT DISTINCT cpf, nome
      FROM registro_bonificacao_descontos
      WHERE cpf IS NOT NULL AND cpf != ''
    `
    
    const queryValues: any[] = []
    
    if (numericQuery) {
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

