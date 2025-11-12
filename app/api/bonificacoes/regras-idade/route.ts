import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"
import { formatDateISO } from "@/lib/date-utils"

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

    // Criar conexão com charset UTF-8
    connection = await getDBConnection()
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Extrair parâmetros
    const searchParams = request.nextUrl.searchParams
    const operadora = searchParams.get("operadora")
    const tipo_beneficiario = searchParams.get("tipo_beneficiario")
    const entidade = searchParams.get("entidade")
    const plano = searchParams.get("plano")
    const vigencia_inicio = searchParams.get("vigencia_inicio")
    const vigencia_fim = searchParams.get("vigencia_fim")
    // Parcela mapeia para chave_faixa na tabela registro_bonificacao_idades
    const parcela = searchParams.get("parcela") || searchParams.get("chave_faixa")
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100)
    const sort = searchParams.get("sort") || "vigencia"
    const order = searchParams.get("order") || "desc"

    // Construir WHERE - Mapeamento dos filtros para campos da tabela registro_bonificacao_idades
    // Tabela: registro_bonificacao_idades
    // Campos disponíveis: vigencia, operadora, entidade, plano, tipo_beneficiario, idade_min, idade_max, chave_faixa, registro
    const whereConditions: string[] = []
    const whereValues: any[] = []

    // Filtro: operadora → Campo: operadora (exata)
    if (operadora && operadora.trim()) { whereConditions.push("operadora = ?"); whereValues.push(operadora.trim()) }
    
    // Filtro: tipo_beneficiario → Campo: tipo_beneficiario (exata)
    if (tipo_beneficiario && tipo_beneficiario.trim()) { whereConditions.push("tipo_beneficiario = ?"); whereValues.push(tipo_beneficiario.trim()) }
    
    // Filtro: entidade → Campo: entidade (LIKE - busca parcial)
    if (entidade && entidade.trim()) { whereConditions.push("entidade LIKE ?"); whereValues.push(`%${entidade.trim()}%`) }
    
    // Filtro: plano → Campo: plano (LIKE - busca parcial)
    if (plano && plano.trim()) { whereConditions.push("plano LIKE ?"); whereValues.push(`%${plano.trim()}%`) }
    
    // Filtro: vigencia_inicio → Campo: vigencia
    // Se apenas vigencia_inicio for informado (sem vigencia_fim): usar igualdade exata (=)
    // Se ambos forem informados: usar intervalo (>= inicio AND <= fim)
    if (vigencia_inicio && vigencia_inicio.trim()) {
      if (vigencia_fim && vigencia_fim.trim()) {
        // Ambos informados: intervalo
        whereConditions.push("vigencia >= ?"); 
        whereValues.push(vigencia_inicio.trim())
      } else {
        // Apenas inicio: data exata
        whereConditions.push("vigencia = ?"); 
        whereValues.push(vigencia_inicio.trim())
      }
    }
    
    // Filtro: vigencia_fim → Campo: vigencia (<= data)
    // Só aplica se ambos forem informados (para criar intervalo)
    if (vigencia_fim && vigencia_fim.trim() && vigencia_inicio && vigencia_inicio.trim()) {
      whereConditions.push("vigencia <= ?"); 
      whereValues.push(vigencia_fim.trim())
    }
    
    // Filtro: parcela → Campo: chave_faixa (exata)
    if (parcela && parcela.trim()) { whereConditions.push("chave_faixa = ?"); whereValues.push(parcela.trim()) }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    // Contar total
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM registro_bonificacao_idades ${whereClause}`,
      whereValues
    )
    const total = (countResult as any[])[0]?.total || 0

    // Paginar
    const offset = (page - 1) * pageSize

    // Ordenação fixa: 1) vigencia DESC, 2) registro DESC, 3) plano ASC (A-Z), 4) tipo_beneficiario DESC (Z-A - Titular antes de Dependente)
    // Buscar dados com ordenação fixa múltipla - planos iguais agrupados com Titular antes de Dependente
    let query = `SELECT * FROM registro_bonificacao_idades ${whereClause} ORDER BY \`vigencia\` DESC, \`registro\` DESC, \`plano\` ASC, \`tipo_beneficiario\` DESC LIMIT ${pageSize} OFFSET ${offset}`
    
    const [rows] = await connection.execute(query, whereValues)
    
    return NextResponse.json(
      {
        data: rows || [],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      },
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    )
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
  
  // Garante YYYY-MM-DD usando formatação consistente
  return formatDateISO(d) || null
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
    
    // Validação dos campos obrigatórios para regras de idade
    if (!body.vigencia || !body.operadora || !body.entidade || !body.plano || 
        body.idadeMin === undefined || body.idadeMax === undefined) {
      return NextResponse.json(
        { error: "Campos obrigatórios: vigencia, operadora, entidade, plano, idadeMin, idadeMax" },
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
    connection = await getDBConnection()
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Normalizar dados - campos específicos para registro_bonificacao_idades
    // Esta tabela é sobre faixas de idade (idade_min, idade_max), não valores de bonificação
    const normalizedData: any = {
      vigencia: toSQLDate(body.vigencia),
      operadora: body.operadora || null,
      entidade: body.entidade || null,
      plano: body.plano || null,
      tipo_beneficiario: body.tipoBeneficiario || body.tipo_beneficiario || null,
      // Campos específicos de faixa de idade
      idade_min: body.idadeMin !== undefined ? Number(body.idadeMin || body.idade_min || 0) : (body.idade_min !== undefined ? Number(body.idade_min || 0) : null),
      idade_max: body.idadeMax !== undefined ? Number(body.idadeMax || body.idade_max || 0) : (body.idade_max !== undefined ? Number(body.idade_max || 0) : null),
      chave_faixa: body.chaveFaixa || body.chave_faixa || null,
    }

    // Data atual para o campo registro (apenas data, sem hora)
    const now = new Date()
    const registro = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Preparar dados para INSERT
    // Nota: a coluna 'chave' não existe na tabela registro_bonificacao_idades
    const insertData = {
      ...normalizedData,
      registro,
    }

    // Construir SQL INSERT
    const columns = Object.keys(insertData)
    const placeholders = columns.map(() => "?").join(", ")
    const values = Object.values(insertData)

    const sql = `INSERT INTO registro_bonificacao_idades (${columns.map(col => `\`${col}\``).join(", ")}) VALUES (${placeholders})`
    
    const [result] = await connection.execute(sql, values)

    return NextResponse.json({ 
      ok: true, 
      inserted: result,
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

