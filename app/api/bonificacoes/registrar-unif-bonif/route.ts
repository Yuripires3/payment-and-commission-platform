import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"

interface RegistrarUnifBonifRequest {
  exec_id: string
  data: any[]
  confirmado: boolean
}

export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    const body: RegistrarUnifBonifRequest = await request.json()
    const { data, confirmado } = body

    if (!confirmado) {
      return NextResponse.json(
        { error: "Confirmação necessária para registrar" },
        { status: 400 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado para registrar" },
        { status: 400 }
      )
    }

    // Criar conexão com banco
    connection = await getDBConnection()

    // Inserir em unificado_bonificacao
    let registrosInseridos = 0
    for (const unif of data) {
      try {
        await connection.execute(
          `INSERT INTO unificado_bonificacao 
           (dt_pagamento, operadora, entidade, numero_proposta, dt_inicio_vigencia, cpf, nome, 
            tipo_beneficiario, idade, parcela, cnpj_concessionaria, cpf_corretor, nome_corretor, 
            vlr_bruto_corretor, id_beneficiario, chave_plano, cpf_supervisor, nome_supervisor, 
            vlr_bruto_supervisor, dt_registro, descontado, dt_analise, chave_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            unif.dt_pagamento || null,
            unif.operadora || null,
            unif.entidade || null,
            unif.numero_proposta || null,
            unif.dt_inicio_vigencia || null,
            unif.cpf || null,
            unif.nome || null,
            unif.tipo_beneficiario || null,
            unif.idade || null,
            unif.parcela || null,
            unif.cnpj_concessionaria || null,
            unif.cpf_corretor || null,
            unif.nome_corretor || null,
            unif.vlr_bruto_corretor || null,
            unif.id_beneficiario || null,
            unif.chave_plano || null,
            unif.cpf_supervisor || null,
            unif.nome_supervisor || null,
            unif.vlr_bruto_supervisor || null,
            unif.dt_registro || new Date().toISOString().slice(0, 19).replace('T', ' '),
            unif.descontado || 0,
            unif.dt_analise || null,
            unif.chave_id || null
          ]
        )
        registrosInseridos++
      } catch (error: any) {
        console.error("Erro ao inserir registro unif_bonif:", error)
        // Continuar com os próximos registros mesmo se houver erro em um
      }
    }

    return NextResponse.json({
      success: true,
      message: `${registrosInseridos} registro(s) inserido(s) com sucesso`,
      registrosInseridos
    })

  } catch (error: any) {
    console.error("Erro ao registrar unif_bonif:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao registrar unif_bonif",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

