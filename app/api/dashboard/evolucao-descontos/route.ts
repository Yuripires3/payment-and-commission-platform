import { NextRequest, NextResponse } from "next/server"
import { getDBConnection, getDescontosStatusFilter } from "@/lib/db"

/**
 * GET /api/dashboard/evolucao-descontos
 * Retorna evolução de descontos ao longo do tempo
 * 
 * Retorna:
 * - descontosRealizados: soma de todos os valores POSITIVOS do mês
 * - cancelamentos: soma de todos os valores NEGATIVOS do mês (em valor absoluto, mas tratado como negativo)
 * - saldoBanco: saldo acumulado progressivo mês a mês (Saldo Total a descontar)
 * 
 * CLASSIFICAÇÃO:
 * - Valores POSITIVOS = Descontos Realizados
 * - Valores NEGATIVOS = Cancelamentos
 * (Classificação feita pelo sinal do valor, não pelo campo tipo_movimentacao)
 * 
 * Cálculo do Saldo Acumulado:
 * Os registros são ordenados cronologicamente (por ano e mês) e o saldo é calculado progressivamente:
 * - jan → saldo histórico + janeiro
 * - fev → saldo histórico + janeiro + fevereiro
 * - mar → saldo histórico + janeiro + fevereiro + março
 * - ... e assim por diante
 * 
 * O saldo histórico é a SOMA de todos os valores (positivos e negativos) antes do período visualizado.
 * Cada mês acumula: saldo do mês anterior + variação líquida do mês atual (descontos realizados + cancelamentos)
 * 
 * Query params:
 * - inicio: YYYY-MM-DD (usado quando fornecido, mas garantindo período mínimo de 12 meses; caso contrário calcula 12 meses antes de fim)
 * - fim: YYYY-MM-DD (obrigatório)
 */
export async function GET(request: NextRequest) {
  let connection: any = null

  try {
    const searchParams = request.nextUrl.searchParams
    const inicio = searchParams.get("inicio")
    const fim = searchParams.get("fim")

    if (!fim) {
      return NextResponse.json(
        { error: "Parâmetro 'fim' é obrigatório (formato: YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    connection = await getDBConnection()
    
    // Garantir charset UTF-8 na conexão
    await connection.execute("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'")
    await connection.execute("SET CHARACTER SET utf8mb4")
    await connection.execute("SET character_set_connection=utf8mb4")

    // Garantir que o período seja no mínimo 12 meses (pode ser maior)
    // Se o período for menor que 12 meses, ajusta para 12 meses antes de fim
    let inicioCalculado: string
    const dataFimObj = new Date(fim)
    
    if (inicio) {
      const dataInicioObj = new Date(inicio)
      // Calcular diferença em meses
      const diffMonths = (dataFimObj.getFullYear() - dataInicioObj.getFullYear()) * 12 + 
                         (dataFimObj.getMonth() - dataInicioObj.getMonth())
      
      // Se o período for menor que 12 meses, usar 12 meses antes de fim
      if (diffMonths < 12) {
        const dataInicioAjustada = new Date(dataFimObj)
        dataInicioAjustada.setMonth(dataInicioAjustada.getMonth() - 12)
        inicioCalculado = dataInicioAjustada.toISOString().split('T')[0]
      } else {
        inicioCalculado = inicio
      }
    } else {
      // Se não fornecido, calcular 12 meses antes de fim
      const dataInicioObj = new Date(dataFimObj)
      dataInicioObj.setMonth(dataInicioObj.getMonth() - 12)
      inicioCalculado = dataInicioObj.toISOString().split('T')[0]
    }

    // Filtrar apenas descontos finalizados e ativos
    const statusFilter = getDescontosStatusFilter()

    // Buscar TODOS os registros do período e classificar por sinal do valor
    // Valores positivos = descontos realizados
    // Valores negativos = cancelamentos
    const [movimentacoesRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(dt_movimentacao, '%Y-%m') as mes,
         SUM(CASE WHEN valor >= 0 THEN valor ELSE 0 END) as descontos_positivos,
         SUM(CASE WHEN valor < 0 THEN valor ELSE 0 END) as cancelamentos_negativos
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         ${statusFilter}
       GROUP BY DATE_FORMAT(dt_movimentacao, '%Y-%m')
       ORDER BY mes ASC`,
      [inicioCalculado, fim]
    )

    // Buscar detalhes dos cancelamentos por mês (valores individuais)
    const [cancelamentosDetalhesRows]: any = await connection.execute(
      `SELECT 
         DATE_FORMAT(dt_movimentacao, '%Y-%m') as mes,
         valor,
         dt_movimentacao
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao >= ? AND dt_movimentacao <= ?
         AND valor < 0
         ${statusFilter}
       ORDER BY dt_movimentacao ASC`,
      [inicioCalculado, fim]
    )

    // Criar mapas separando descontos (positivos) e cancelamentos (negativos)
    const descontosPorMes = new Map<string, number>()
    const cancelamentosPorMes = new Map<string, number>()
    const cancelamentosDetalhesPorMes = new Map<string, Array<{ valor: number; data: string }>>()
    
    movimentacoesRows.forEach((row: any) => {
      const mes = row.mes
      const descontos = Number(row.descontos_positivos || 0)
      const cancelamentos = Number(row.cancelamentos_negativos || 0) // Já vem negativo
      
      if (descontos > 0) {
        descontosPorMes.set(mes, descontos)
      }
      if (cancelamentos < 0) {
        cancelamentosPorMes.set(mes, cancelamentos)
      }
    })

    // Agrupar detalhes dos cancelamentos por mês
    cancelamentosDetalhesRows.forEach((row: any) => {
      const mes = row.mes
      const valor = Number(row.valor || 0)
      const data = row.dt_movimentacao
      
      if (!cancelamentosDetalhesPorMes.has(mes)) {
        cancelamentosDetalhesPorMes.set(mes, [])
      }
      
      const detalhes = cancelamentosDetalhesPorMes.get(mes)!
      detalhes.push({
        valor: Math.abs(valor), // Valor absoluto para exibição
        data: data
      })
    })

    // Saldo histórico ANTES do período: soma de TODOS os valores (positivos e negativos)
    // Este é o saldo acumulado real antes do período visualizado
    // IMPORTANTE: Este saldo deve ser calculado da mesma forma que os meses do período
    // (soma de todos os valores, não separado por tipo)
    const [saldoAnteriorRows]: any = await connection.execute(
      `SELECT COALESCE(SUM(valor), 0) as saldo_total
       FROM registro_bonificacao_descontos
       WHERE dt_movimentacao < ?
         ${statusFilter}`,
      [inicioCalculado]
    )

    // Saldo histórico é a soma de todos os valores (já inclui positivos e negativos)
    const saldoHistorico = Number(saldoAnteriorRows?.[0]?.saldo_total || 0)

    // Unir todos os meses e ordenar cronologicamente (por ano e mês)
    const meses = new Set([...descontosPorMes.keys(), ...cancelamentosPorMes.keys()])
    const mesesOrdenados = Array.from(meses).sort()

    // Calcular saldo acumulado progressivo mês a mês
    // O acumulado de cada mês = soma de todos os valores anteriores + valor do mês atual
    let saldoAcumulado = saldoHistorico // Inicia com o saldo histórico

    const resultado = mesesOrdenados.map((mes) => {
      const descontosRealizados = descontosPorMes.get(mes) || 0
      const cancelamentos = cancelamentosPorMes.get(mes) || 0 // Já vem negativo
      
      // Variação líquida do mês: descontos realizados (positivos) + cancelamentos (negativos)
      const variacaoMes = descontosRealizados + cancelamentos
      
      // Acumular: saldo acumulado = saldo anterior + variação do mês atual
      // jan → saldo histórico + janeiro
      // fev → saldo histórico + janeiro + fevereiro
      // mar → saldo histórico + janeiro + fevereiro + março
      saldoAcumulado += variacaoMes

      // Para exibição, cancelamentos devem aparecer como valor absoluto positivo (mas somado como negativo)
      const cancelamentosAbsoluto = Math.abs(cancelamentos)
      
      // Buscar detalhes dos cancelamentos deste mês
      const detalhesCancelamentos = cancelamentosDetalhesPorMes.get(mes) || []

      return {
        mes,
        descontosRealizados: Number(descontosRealizados.toFixed(2)),
        cancelamentos: Number(cancelamentosAbsoluto.toFixed(2)), // Valor absoluto para exibição
        saldoBanco: Number(saldoAcumulado.toFixed(2)),
        cancelamentosDetalhes: detalhesCancelamentos.map(d => ({
          valor: Number(d.valor.toFixed(2)),
          data: d.data
        }))
      }
    })

    // Verificação: o último saldo acumulado deve ser igual ao saldo histórico + soma de todas as variações do período
    // Isso garante que o cálculo está correto
    const somaVariacoes = resultado.reduce((acc, item) => {
      const descontos = descontosPorMes.get(item.mes) || 0
      const cancelamentos = cancelamentosPorMes.get(item.mes) || 0
      return acc + descontos + cancelamentos
    }, 0)
    const saldoFinalEsperado = saldoHistorico + somaVariacoes
    const ultimoSaldo = resultado.length > 0 ? resultado[resultado.length - 1].saldoBanco : saldoHistorico
    
    // Log para debug (pode ser removido em produção se necessário)
    if (Math.abs(ultimoSaldo - saldoFinalEsperado) > 0.01) {
      console.warn(`Discrepância no cálculo do saldo: esperado ${saldoFinalEsperado}, calculado ${ultimoSaldo}`)
    }

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error("Erro ao buscar evolução de descontos:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar evolução de descontos" },
      { status: 500 }
    )
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

