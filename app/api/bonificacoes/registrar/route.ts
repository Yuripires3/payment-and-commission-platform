import { NextRequest, NextResponse } from "next/server"
import { getCalculoResult, deleteCalculoResult } from "@/lib/calculo-cache"
import { getDBConnection } from "@/lib/db"
import { arrayToCSV } from "@/lib/pandas-utils"
import fs from "fs/promises"
import path from "path"

interface RegistrarRequest {
  exec_id: string
  confirmado: boolean
}

export async function POST(request: NextRequest) {
  let connection: any = null

  try {
    const body: RegistrarRequest = await request.json()
    const { exec_id, confirmado } = body

    if (!confirmado) {
      return NextResponse.json(
        { error: "Confirmação necessária para registrar" },
        { status: 400 }
      )
    }

    // Recuperar resultados do cache
    const resultados = getCalculoResult(exec_id)
    if (!resultados) {
      return NextResponse.json(
        { error: "Execução não encontrada ou expirada. Execute o cálculo novamente." },
        { status: 404 }
      )
    }

    // Criar conexão com banco
    connection = await getDBConnection()

    // Aplicar ajuste de descontos em df5 antes de exportar (conforme item 4)
    // 1. Carregar aux_descontos do banco (apenas finalizados ativos)
    let aux_descontos: any[] = []
    try {
      const [descontosRows]: any = await connection.execute(
        `SELECT cpf, SUM(valor) as saldo 
         FROM registro_bonificacao_descontos 
         WHERE status = 'finalizado' AND is_active = TRUE
         GROUP BY cpf`
      )
      aux_descontos = descontosRows || []
    } catch (error) {
      console.warn("Erro ao carregar descontos (pode não existir ainda):", error)
    }

    // 2. Criar mapas de desconto por CPF
    const descontosMap = new Map<string, number>()
    aux_descontos.forEach((row: any) => {
      const cpf = String(row.cpf || "").replace(/\D/g, "").padStart(11, "0")
      descontosMap.set(cpf, parseFloat(row.saldo || 0))
    })

    // 3. Calcular totais brutos por CPF (corretor e supervisor separadamente)
    const brutosCorretor = new Map<string, number>()
    const brutosSupervisor = new Map<string, number>()
    
    resultados.df5.forEach((row: any) => {
      const cpfCorretor = String(row["CPF Corretor"] || "").replace(/\D/g, "").padStart(11, "0")
      const cpfSupervisor = String(row["CPF Supervisor"] || "").replace(/\D/g, "").padStart(11, "0")
      const vlrBrutoCor = parseFloat(String(row["Vlr bruto Corretor"] || 0).replace(/[^\d,]/g, "").replace(",", ".")) || 0
      const vlrBrutoSup = parseFloat(String(row["Vlr bruto Supervisor"] || 0).replace(/[^\d,]/g, "").replace(",", ".")) || 0
      
      if (cpfCorretor !== "00000000000" && cpfCorretor !== "N/A") {
        brutosCorretor.set(cpfCorretor, (brutosCorretor.get(cpfCorretor) || 0) + vlrBrutoCor)
      }
      if (cpfSupervisor !== "00000000000" && cpfSupervisor !== "N/A") {
        brutosSupervisor.set(cpfSupervisor, (brutosSupervisor.get(cpfSupervisor) || 0) + vlrBrutoSup)
      }
    })

    // 4. Calcular descontos aplicados (corretor: min(saldo, 45% bruto), supervisor: 0)
    const descontosAplicados = new Map<string, number>()
    descontosMap.forEach((saldo, cpf) => {
      const brutoCor = brutosCorretor.get(cpf) || 0
      if (brutoCor > 0) {
        // Para corretor: desconto = min(saldo negativo, 45% do bruto)
        const descontoMaximo = brutoCor * 0.45
        const desconto = Math.min(Math.abs(saldo), descontoMaximo)
        descontosAplicados.set(cpf, -desconto) // Negativo porque é desconto
      }
      // Supervisor sempre tem desconto 0 (conforme script original)
    })

    // 5. Adicionar colunas em df5
    const df5_com_descontos = resultados.df5.map((row: any) => {
      const cpfCorretor = String(row["CPF Corretor"] || "").replace(/\D/g, "").padStart(11, "0")
      const cpfSupervisor = String(row["CPF Supervisor"] || "").replace(/\D/g, "").padStart(11, "0")
      
      // Identificar se é linha de corretor ou supervisor
      const isCorretor = cpfCorretor !== "00000000000" && cpfCorretor !== "N/A"
      const isSupervisor = cpfSupervisor !== "00000000000" && cpfSupervisor !== "N/A"
      
      // Calcular desconto aplicado
      let descontoAplicado = 0
      if (isCorretor) {
        descontoAplicado = descontosAplicados.get(cpfCorretor) || 0
      }
      // Supervisor sempre 0
      
      // Calcular valores brutos numéricos
      const vlrBrutoCor = parseFloat(String(row["Vlr bruto Corretor"] || 0).replace(/[^\d,]/g, "").replace(",", ".")) || 0
      const vlrBrutoSup = parseFloat(String(row["Vlr bruto Supervisor"] || 0).replace(/[^\d,]/g, "").replace(",", ".")) || 0
      
      // Valor líquido = bruto corretor + bruto supervisor + desconto (que já é negativo)
      const valorLiquido = vlrBrutoCor + vlrBrutoSup + descontoAplicado
      
      // Formatar valores para exibição
      const formatarMoeda = (valor: number) => {
        return `R$ ${Math.abs(valor).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
      }
      
      return {
        ...row,
        "Desconto aplicado": formatarMoeda(descontoAplicado),
        "Valor líquido (Corretor + Supervisor)": formatarMoeda(valorLiquido),
        "Possui desconto?": descontoAplicado < 0 ? "Sim" : "Não"
      }
    })

    // Criar diretório de saída se não existir
    const outputDir = path.join(process.cwd(), "output", "bonificacao")
    await fs.mkdir(outputDir, { recursive: true })

    // Gerar CSVs com df5 ajustado
    const csvAnalisePath = path.join(outputDir, `bonificacao_analise_${Date.now()}.csv`)
    const csvSemPixPath = path.join(outputDir, `bonificados_sem_pix_${Date.now()}.csv`)

    // Converter para CSV
    const csvAnalise = arrayToCSV(df5_com_descontos)
    const csvSemPix = arrayToCSV(resultados.df4_sem_pix || [])

    await fs.writeFile(csvAnalisePath, csvAnalise, "utf-8")
    await fs.writeFile(csvSemPixPath, csvSemPix, "utf-8")

    // Inserir descontos em registro_bonificacao_descontos e armazenar IDs
    const idsDescontosInseridos: number[] = []
    if (resultados.desc && resultados.desc.length > 0) {
      for (const desc of resultados.desc) {
        const [result]: any = await connection.execute(
          `INSERT INTO registro_bonificacao_descontos 
           (dt_movimentacao, cpf, nome, valor, dt_apuracao, tipo_movimentacao, registro)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            desc.dt_movimentacao || null,
            desc.cpf || null,
            desc.nome || null,
            desc.valor || null,
            desc.dt_apuracao || null,
            desc.tipo_movimentacao || null,
            desc.registro || null
          ]
        )
        // Armazenar o ID do registro inserido
        if (result.insertId) {
          idsDescontosInseridos.push(result.insertId)
        }
      }
    }

    // Inserir em unificado_bonificacao
    if (resultados.unif_bonif && resultados.unif_bonif.length > 0) {
      for (const unif of resultados.unif_bonif) {
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
            unif.dt_registro || null,
            unif.descontado || 0,
            unif.dt_analise || null,
            unif.chave_id || null
          ]
        )
      }
    }

    // Limpar cache após registro bem-sucedido
    deleteCalculoResult(exec_id)

    return NextResponse.json({
      success: true,
      message: "Cálculo registrado com sucesso",
      arquivos: {
        analise: csvAnalisePath,
        sem_pix: csvSemPixPath
      },
      registros: {
        descontos: resultados.desc?.length || 0,
        unificado: resultados.unif_bonif?.length || 0,
        idsDescontos: idsDescontosInseridos
      }
    })

  } catch (error: any) {
    console.error("Erro ao registrar cálculo:", error)
    return NextResponse.json(
      {
        error: error.message || "Erro ao registrar cálculo de bonificação",
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

