import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"
import { formatDateTimeLocal } from "@/lib/date-utils"

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

    // Extrair parâmetros
    const searchParams = request.nextUrl.searchParams
    const cpf = searchParams.get("cpf")
    const nome = searchParams.get("nome")
    const proposta = searchParams.get("proposta")
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100)

    // Construir WHERE
    const whereConditions: string[] = []
    const whereValues: any[] = []

    if (cpf) {
      // Normalizar CPF removendo formatação para busca no banco
      const numericCpf = cpf.replace(/\D/g, "")
      if (numericCpf) {
        whereConditions.push("REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') LIKE ?")
        whereValues.push(`%${numericCpf}%`)
      }
    }
    if (nome) {
      whereConditions.push("nome LIKE ?")
      whereValues.push(`%${nome}%`)
    }
    if (proposta) {
      whereConditions.push("proposta LIKE ?")
      whereValues.push(`%${proposta}%`)
    }

    // Verificar se a tabela existe primeiro
    try {
      const [tableCheck]: any = await connection.execute(
        `SHOW TABLES LIKE 'registro_bonificacao_descontos'`
      )
      if (tableCheck.length === 0) {
        return NextResponse.json(
          { error: "Tabela 'registro_bonificacao_descontos' não encontrada no banco de dados" },
          { status: 404 }
        )
      }
    } catch (tableError: any) {
      console.error("Erro ao verificar tabela:", tableError)
    }

    // Construir WHERE: filtrar apenas registros finalizados e ativos
    const statusFilter = `(status = 'finalizado' AND is_active = TRUE)`
    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")} AND ${statusFilter}`
      : `WHERE ${statusFilter}`

    // Contar total de registros
    const [countResult]: any = await connection.execute(
      `SELECT COUNT(*) as total FROM registro_bonificacao_descontos ${whereClause}`,
      whereValues
    )
    const total = countResult[0]?.total || 0
    const totalPages = Math.ceil(total / pageSize)
    
    // Buscar dados com paginação
    const offset = (page - 1) * pageSize
    
    // Construir ORDER BY - sempre ordenar por data de registro (mais recente primeiro) usando id DESC
    const orderByClause = `ORDER BY \`id\` DESC`
    
    // Construir query de forma mais segura - usar LIMIT e OFFSET diretamente na string
    let query = `SELECT dt_apuracao, dt_movimentacao, dt_exclusao_proposta, tipo_movimentacao, valor, cpf, nome, proposta, id`
    query += ` FROM registro_bonificacao_descontos`
    query += ` ${whereClause}`
    query += ` ${orderByClause}`
    query += ` LIMIT ${pageSize} OFFSET ${offset}`
    
    try {
      const [rows]: any = await connection.execute(query, whereValues)

      // Calcular saldo total baseado nos filtros aplicados
      const [saldoResult]: any = await connection.execute(
        `SELECT COALESCE(SUM(valor), 0) as saldo_total FROM registro_bonificacao_descontos ${whereClause}`,
        whereValues
      )
      const saldoTotal = saldoResult[0]?.saldo_total || 0

      return NextResponse.json({
        data: rows || [],
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        saldoTotal
      })
    } catch (queryError: any) {
      console.error("=== ERRO NA QUERY ===")
      console.error("Mensagem:", queryError.message)
      console.error("Código:", queryError.code)
      console.error("Query que falhou:", query)
      console.error("Parâmetros WHERE:", whereValues)
      console.error("Stack:", queryError.stack)
      console.error("===================")
      throw queryError // Re-lança o erro para ser capturado pelo catch externo
    }
  } catch (error: any) {
    console.error("Erro ao buscar extrato de descontos:", error)
    console.error("Stack trace:", error.stack)
    return NextResponse.json(
      { 
        error: error.message || "Erro ao buscar extrato de descontos",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { 
      dt_movimentacao, 
      cpf, 
      nome, 
      valor, 
      dt_apuracao, 
      tipo_movimentacao, 
      proposta,
      dt_exclusao_proposta 
    } = body

    // Validações obrigatórias
    if (!dt_movimentacao || !cpf || !nome || valor === undefined || !dt_apuracao || !tipo_movimentacao) {
      return NextResponse.json(
        { error: "Campos obrigatórios: dt_movimentacao, cpf, nome, valor, dt_apuracao, tipo_movimentacao" },
        { status: 400 }
      )
    }

    // Normalizar CPF
    const numericCpf = String(cpf).replace(/\D/g, "").padStart(11, "0")
    
    // Converter valor para número
    const parseValor = (input: string | number): number => {
      if (typeof input === "number") return input
      const normalized = input
        .trim()
        .replace(/\./g, "")
        .replace(/[^0-9,-]/g, "")
      const isNegative = normalized.startsWith("-")
      const numericPart = normalized.replace(/-/g, "").replace(",", ".")
      const cleaned = (isNegative ? "-" : "") + numericPart
      return parseFloat(cleaned)
    }

    const valorNumero = parseValor(valor)

    if (isNaN(valorNumero)) {
      return NextResponse.json(
        { error: "Valor inválido" },
        { status: 400 }
      )
    }

    if (valorNumero === 0) {
      return NextResponse.json(
        { error: "Registros com valor 0,00 não são permitidos" },
        { status: 400 }
      )
    }

    // Data/hora de registro
    const registro = formatDateTimeLocal(new Date())

    const dtReferencia = dt_movimentacao

    // Inserir registro
    const [result]: any = await connection.execute(
      `INSERT INTO registro_bonificacao_descontos 
       (dt_movimentacao, dt_referencia, cpf, nome, valor, dt_apuracao, tipo_movimentacao, proposta, dt_exclusao_proposta, status, is_active, finalizado_at, origem, registro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalizado', TRUE, NOW(), 'manual', ?)`,
      [
        dt_movimentacao || null,
        dtReferencia || null,
        numericCpf || null,
        nome || null,
        valorNumero || null,
        dt_apuracao || null,
        tipo_movimentacao || null,
        proposta || null,
        dt_exclusao_proposta || null,
        registro
      ]
    )

    return NextResponse.json({
      success: true,
      message: "Movimentação inserida com sucesso",
      id: result.insertId
    })

  } catch (error: any) {
    console.error("Erro ao inserir movimentação:", error)
    return NextResponse.json(
      { 
        error: error.message || "Erro ao inserir movimentação",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

