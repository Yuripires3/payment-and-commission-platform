import { NextRequest, NextResponse } from "next/server"
import mysql from "mysql2/promise"

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

// Converte valores numéricos
function toSQLNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "number") return value
  
  const num = Number(value)
  return isNaN(num) ? null : num
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection: any = null
  
  try {
    const body = await request.json().catch(() => ({}))
    const { id } = await params
    
    console.log("=== PUT /api/bonificacoes/regras-idade/[id] ===")
    console.log("ID:", id)
    console.log("Body recebido:", JSON.stringify(body, null, 2))

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
      charset: 'utf8mb4'
    })
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Buscar dados atuais para poder recalcular a chave se necessário
    const [currentRows] = await connection.execute(
      "SELECT * FROM registro_bonificacao_idades WHERE id = ?",
      [id]
    )
    
    if ((currentRows as any[]).length === 0) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      )
    }

    const currentData = (currentRows as any[])[0]

    // Normalizar dados - mapear campos camelCase para snake_case e remover campos inválidos
    const normalizedData: any = {}
    
    // Campos permitidos na tabela (baseado na estrutura esperada)
    const allowedFields = [
      'vigencia',
      'operadora',
      'entidade',
      'plano',
      'tipo_beneficiario',
      'idade_min',
      'idade_max',
      'chave_faixa',
      'produto',
      'pagamento_por',
      'parcela'
    ]

    // Mapeamento de campos camelCase para snake_case
    const fieldMapping: { [key: string]: string } = {
      'idadeMin': 'idade_min',
      'idadeMax': 'idade_max',
      'tipoBeneficiario': 'tipo_beneficiario',
      'chaveFaixa': 'chave_faixa',
      'pagamentoPor': 'pagamento_por'
    }

    // Processar apenas os campos que estão no body e são permitidos
    Object.keys(body).forEach((key) => {
      // Ignorar id e campos calculados/não editáveis
      // 'chave' não existe nesta tabela, então sempre ignoramos
      if (key === 'id' || key === 'chave' || key === 'registro') {
        return
      }

      // Mapear campo se necessário
      const dbField = fieldMapping[key] || key

      // Apenas processar se o campo for permitido
      if (allowedFields.includes(dbField)) {
        let value = body[key]

        // Normalizar tipos específicos
        if (dbField === 'vigencia') {
          value = toSQLDate(value)
        } else if (dbField === 'idade_min' || dbField === 'idade_max') {
          value = toSQLNumber(value)
        } else if (typeof value === 'string') {
          value = value.trim() || null
        }

        normalizedData[dbField] = value
      }
    })

    // A coluna 'chave' não existe nesta tabela, então não tentamos atualizá-la
    // Se precisar recalcular a chave, isso deve ser feito em outra tabela ou processo

    // Se não há nada para atualizar, retornar sucesso
    if (Object.keys(normalizedData).length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "Nenhuma alteração detectada",
        data: currentData
      })
    }

    // Construir SQL UPDATE
    const setClauses: string[] = []
    const values: any[] = []

    Object.entries(normalizedData).forEach(([key, value]) => {
      setClauses.push(`\`${key}\` = ?`)
      values.push(value)
    })

    // Adicionar id no final para o WHERE
    values.push(id)

    const sql = `UPDATE registro_bonificacao_idades SET ${setClauses.join(", ")} WHERE id = ?`
    
    console.log("SQL UPDATE:", sql)
    console.log("Values:", values)

    const [result] = await connection.execute(sql, values)

    console.log("Update result:", result)

    // Buscar dados atualizados
    const [updatedRows] = await connection.execute(
      "SELECT * FROM registro_bonificacao_idades WHERE id = ?",
      [id]
    )

    return NextResponse.json({ 
      ok: true, 
      updated: result,
      data: (updatedRows as any[])[0]
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

// Método DELETE também pode ser útil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection: any = null
  
  try {
    const { id } = await params

    // Verificar variáveis de ambiente
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas" },
        { status: 500 }
      )
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4'
    })
    
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    const [result] = await connection.execute(
      "DELETE FROM registro_bonificacao_idades WHERE id = ?",
      [id]
    )

    return NextResponse.json({ 
      ok: true, 
      deleted: result
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

