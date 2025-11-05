import { NextRequest, NextResponse } from "next/server"
import mysql from "mysql2/promise"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let connection: any = null
  
  try {
    // Verificar variáveis de ambiente
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas" },
        { status: 500 }
      )
    }

    // Resolver params caso seja Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json(
        { error: "ID é obrigatório" },
        { status: 400 }
      )
    }

    const body = await request.json()
    let {
      cpf,
      nome,
      id_cartao,
      valor_carga,
      tipo_cartao,
      premiacao,
      tipo_premiado,
      mes_apurado,
      obs,
      dt_pagamento
    } = body

    // Normalizar CPF para o formato aceito pelo banco (apenas números, máximo 11 dígitos)
    if (cpf) {
      const numericCpf = String(cpf).replace(/\D/g, "")
      cpf = numericCpf.slice(0, 11) || null
    }

    // Observação: se vazio, preencher automaticamente com "Transferência realizada"
    if (!obs || !String(obs).trim()) {
      obs = 'Transferência realizada'
    } else {
      obs = String(obs).trim()
    }

    // Validações básicas
    if (!cpf || !nome) {
      return NextResponse.json(
        { error: "CPF e Nome são obrigatórios" },
        { status: 400 }
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

    // Verificar se o registro existe
    const [rows]: any = await connection.execute(
      `SELECT id FROM unificado_bonificacao_comercial WHERE id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      )
    }

    // Atualizar registro
    await connection.execute(
      `UPDATE unificado_bonificacao_comercial 
       SET cpf = ?, nome = ?, id_cartao = ?, valor_carga = ?, tipo_cartao = ?, premiacao = ?, tipo_premiado = ?, mes_apurado = ?, obs = ?, dt_pagamento = ?
       WHERE id = ?`,
      [
        cpf || null,
        nome || null,
        id_cartao || null,
        valor_carga || null,
        tipo_cartao || null,
        premiacao || null,
        tipo_premiado || null,
        mes_apurado || null,
        obs || null,
        dt_pagamento || null,
        id
      ]
    )

    return NextResponse.json({
      success: true,
      message: "Registro atualizado com sucesso"
    })
  } catch (error: any) {
    console.error("Erro ao atualizar registro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao atualizar registro" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let connection: any = null
  
  try {
    // Verificar variáveis de ambiente
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
      return NextResponse.json(
        { error: "Variáveis de ambiente não configuradas" },
        { status: 500 }
      )
    }

    // Resolver params caso seja Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params)
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json(
        { error: "ID é obrigatório" },
        { status: 400 }
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

    // Verificar se o registro existe
    const [rows]: any = await connection.execute(
      `SELECT id FROM unificado_bonificacao_comercial WHERE id = ?`,
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Registro não encontrado" },
        { status: 404 }
      )
    }

    // Deletar registro
    await connection.execute(
      `DELETE FROM unificado_bonificacao_comercial WHERE id = ?`,
      [id]
    )

    return NextResponse.json({
      success: true,
      message: "Registro deletado com sucesso"
    })
  } catch (error: any) {
    console.error("Erro ao deletar registro:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao deletar registro" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

