import { NextRequest, NextResponse } from "next/server"
import mysql from "mysql2/promise"
import { buildChaveKey } from "@/utils/bonificacao"

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

    // Extrair parâmetros
    const searchParams = request.nextUrl.searchParams
    const operadora = searchParams.get("operadora")
    const tipo_faixa = searchParams.get("tipo_faixa")
    const produto = searchParams.get("produto")
    const pagamento_por = searchParams.get("pagamento_por")
    const tipo_beneficiario = searchParams.get("tipo_beneficiario")
    const parcela = searchParams.get("parcela")
    const entidade = searchParams.get("entidade")
    const plano = searchParams.get("plano")
    const vigencia_inicio = searchParams.get("vigencia_inicio")
    const vigencia_fim = searchParams.get("vigencia_fim")
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100)
    const sort = searchParams.get("sort") || "vigencia"
    const order = searchParams.get("order") || "desc"

    // Construir WHERE
    const whereConditions: string[] = []
    const whereValues: any[] = []

    if (operadora) { whereConditions.push("operadora = ?"); whereValues.push(operadora) }
    if (tipo_faixa) { whereConditions.push("tipo_faixa = ?"); whereValues.push(tipo_faixa) }
    if (produto) { whereConditions.push("produto = ?"); whereValues.push(produto) }
    if (pagamento_por) { whereConditions.push("pagamento_por = ?"); whereValues.push(pagamento_por) }
    if (tipo_beneficiario) { whereConditions.push("tipo_beneficiario = ?"); whereValues.push(tipo_beneficiario) }
    if (parcela) { whereConditions.push("parcela = ?"); whereValues.push(parcela) }
    if (entidade) { whereConditions.push("entidade LIKE ?"); whereValues.push(`%${entidade}%`) }
    if (plano) { whereConditions.push("plano LIKE ?"); whereValues.push(`%${plano}%`) }
    if (vigencia_inicio) { whereConditions.push("vigencia >= ?"); whereValues.push(vigencia_inicio) }
    if (vigencia_fim) { whereConditions.push("vigencia <= ?"); whereValues.push(vigencia_fim) }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""
    const sortColumn = sort || "vigencia"
    const sortOrder = (order === "asc" || order === "desc") ? order.toUpperCase() : "DESC"

    // Contar total
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM registro_bonificacao_valores_v2 ${whereClause}`,
      whereValues
    )
    const total = (countResult as any[])[0]?.total || 0

    // Paginar
    const offset = (page - 1) * pageSize

    // Buscar dados - construir query de forma mais simples
    let query = `SELECT * FROM registro_bonificacao_valores_v2 ${whereClause} ORDER BY \`${sortColumn}\` ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`
    
    const [rows] = await connection.execute(query, whereValues)
    
    return NextResponse.json({
      data: rows || [],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    })
  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      try { await connection.end() } catch (e) {}
    }
  }
}

// Converte para YYYY-MM-DD (sem hora) - garante formato correto para MySQL DATE
function toSQLDate(date: any): string | null {
  if (!date) return null
  
  // Se já está no formato YYYY-MM-DD, retorna direto
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }
  
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  
  // Garante YYYY-MM-DD usando toISOString().split("T")[0]
  return d.toISOString().split("T")[0]
}

// Converte valores decimais com vírgula/ponto para número real
function toSQLDecimal(value: any): number | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") return value
  
  // String no formato brasileiro: vírgula como separador decimal
  const sanitized = String(value).trim().replace(/\./g, "").replace(",", ".")
  const num = Number(sanitized)
  
  return isNaN(num) ? null : num
}

export async function POST(request: NextRequest) {
  let connection: any = null
  
  try {
    const body = await request.json().catch(() => ({}))
    
    console.log("=== POST /api/bonificacoes/regras ===")
    console.log("Body:", JSON.stringify(body, null, 2))

    // Validação dos campos obrigatórios
    if (!body.vigencia || !body.operadora || !body.entidade || !body.plano) {
      return NextResponse.json(
        { error: "Campos obrigatórios: vigencia, operadora, entidade, plano" },
        { status: 400 }
      )
    }

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

    // Normalizar dados
    const normalizedData = {
      vigencia: toSQLDate(body.vigencia),
      operadora: body.operadora || null,
      entidade: body.entidade || null,
      plano: body.plano || null,
      bonificacao_corretor: toSQLDecimal(body.bonificacaoCorretor || body.bonificacao_corretor),
      bonificacao_supervisor: toSQLDecimal(body.bonificacaoSupervisor || body.bonificacao_supervisor),
      parcela: body.parcela || null,
      tipo_faixa: body.tipoFaixa || body.tipo_faixa || null,
      pagamento_por: body.pagamentoPor || body.pagamento_por || null,
      tipo_beneficiario: body.tipoBeneficiario || body.tipo_beneficiario || null,
      produto: body.produto || null,
    }

    // Gerar chave usando os dados normalizados
    const chave = buildChaveKey({
      vigencia: normalizedData.vigencia,
      operadora: normalizedData.operadora,
      entidade: normalizedData.entidade,
      parcela: normalizedData.parcela,
      plano: normalizedData.plano,
      tipo_faixa: normalizedData.tipo_faixa,
      tipo_dependente: normalizedData.tipo_beneficiario, // mapear tipo_beneficiario para tipo_dependente
      produto: normalizedData.produto,
    })

    console.log("Generated chave:", chave)

    // Data atual para o campo registro (apenas data, sem hora)
    const now = new Date()
    const registro = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    console.log("Registro (apenas data):", registro)

    // Preparar dados para INSERT
    const insertData = {
      ...normalizedData,
      chave,
      registro,
    }

    // Construir SQL INSERT
    const columns = Object.keys(insertData)
    const placeholders = columns.map(() => "?").join(", ")
    const values = Object.values(insertData)

    const sql = `INSERT INTO registro_bonificacao_valores_v2 (${columns.map(col => `\`${col}\``).join(", ")}) VALUES (${placeholders})`
    
    console.log("SQL:", sql)
    console.log("Values:", values)

    const [result] = await connection.execute(sql, values)

    console.log("Insert result:", result)

    return NextResponse.json({ 
      ok: true, 
      inserted: result,
      chave: chave,
      registro: registro
    })

  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      try { await connection.end() } catch (e) {}
    }
  }
}
