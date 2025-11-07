import { NextRequest, NextResponse } from "next/server"
import { getDBConnection } from "@/lib/db"
import { formatDateISO } from "@/lib/date-utils"

interface RegistrarUnifComRequest {
  exec_id: string
  data: any[]
  confirmado: boolean
}

export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    const body: RegistrarUnifComRequest = await request.json()
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

    // Tabela: unificado_bonificacao_comercial
    // Estrutura: cpf, nome, id_cartao, valor_carga, tipo_cartao, tipo_carga, 
    //            premiacao, tipo_premiado, mes_apurado, apuracao, obs, dt_pagamento, dt_registro, dt_envio
    let registrosInseridos = 0

    const hojeIso = formatDateISO(new Date())

    for (const unif of data) {
      try {
        await connection.execute(
          `INSERT INTO unificado_bonificacao_comercial 
           (cpf, nome, id_cartao, valor_carga, tipo_cartao, tipo_carga, premiacao, tipo_premiado, 
            mes_apurado, apuracao, obs, dt_pagamento, dt_registro, dt_envio)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           nome=VALUES(nome),
           id_cartao=VALUES(id_cartao),
           valor_carga=VALUES(valor_carga),
           tipo_cartao=VALUES(tipo_cartao),
           tipo_carga=VALUES(tipo_carga),
           premiacao=VALUES(premiacao),
           tipo_premiado=VALUES(tipo_premiado),
           mes_apurado=VALUES(mes_apurado),
           apuracao=VALUES(apuracao),
           obs=VALUES(obs),
           dt_pagamento=VALUES(dt_pagamento),
           dt_registro=VALUES(dt_registro),
           dt_envio=VALUES(dt_envio)`,
          [
            unif.cpf || null,
            unif.nome || null,
            unif.id_cartao || null,
            unif.valor_carga || null,
            unif.tipo_cartao || null,
            unif.tipo_carga || null,
            unif.premiacao || null,
            unif.tipo_premiado || null,
            unif.mes_apurado || null,
            unif.apuracao || null,
            unif.obs || null,
            unif.dt_pagamento ? formatDateISO(unif.dt_pagamento) : null,
            unif.dt_registro ? formatDateISO(unif.dt_registro) : hojeIso,
            unif.dt_envio ? formatDateISO(unif.dt_envio) : hojeIso
          ]
        )
        registrosInseridos++
      } catch (error: any) {
        console.error("Erro ao inserir registro unif_com:", error)
        // Não fazer fallback - apenas logar o erro
      }
    }

    return NextResponse.json({
      success: true,
      message: `${registrosInseridos} registro(s) inserido(s) com sucesso`,
      registrosInseridos
    })

  } catch (error: any) {
    console.error("Erro ao registrar unif_com:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao registrar unif_com",
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

