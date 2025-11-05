import { NextRequest, NextResponse } from "next/server"
import mysql from "mysql2/promise"

export async function GET(request: NextRequest) {
  let connection: any = null
  
  try {
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

    // Obter estrutura da tabela
    const [columns] = await connection.execute(
      "DESCRIBE registro_bonificacao_idades"
    )
    
    // Obter um registro de exemplo
    const [sample] = await connection.execute(
      "SELECT * FROM registro_bonificacao_idades LIMIT 1"
    )

    return NextResponse.json({
      columns: columns,
      sample: sample[0] || null,
      columnNames: (columns as any[]).map((col: any) => col.Field)
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

