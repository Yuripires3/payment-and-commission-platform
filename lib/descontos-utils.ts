/**
 * Utilitários para geração de chaves de negócio e operações com descontos
 */

/**
 * Gera chave de negócio única para um desconto
 * Formato: vigencia|operadora|entidade|parcela|plano|faixa|tipo_dependente|produto|cpf_corretor|cpf_supervisor
 */
export function gerarChaveNegocio(desconto: {
  dt_apuracao?: string | null
  dt_movimentacao?: string | null
  cpf?: string | null
  proposta?: string | null
  tipo_movimentacao?: string | null
  [key: string]: any
}): string {
  const partes: string[] = []

  // Data de referência (dt_apuracao ou dt_movimentacao)
  const dtRef = desconto.dt_apuracao || desconto.dt_movimentacao || ''
  partes.push(dtRef.replace(/\D/g, '') || 'N/A')

  // CPF (normalizado)
  const cpf = String(desconto.cpf || '').replace(/\D/g, '').padStart(11, '0')
  partes.push(cpf || 'N/A')

  // Proposta
  partes.push(String(desconto.proposta || 'N/A'))

  // Tipo de movimentação
  partes.push(String(desconto.tipo_movimentacao || 'N/A'))

  // Campos adicionais se disponíveis (para garantir unicidade)
  if (desconto.operadora) partes.push(String(desconto.operadora))
  if (desconto.entidade) partes.push(String(desconto.entidade))
  if (desconto.parcela) partes.push(String(desconto.parcela))

  return partes.join('|')
}

/**
 * Prepara dados de desconto para inserção em staging
 */
export function prepararDescontoStaging(
  desconto: any,
  run_id: string,
  session_id: string,
  usuario_id: number,
  dt_referencia: string
): {
  run_id: string
  session_id: string
  usuario_id: number
  dt_referencia: string
  status: 'staging'
  is_active: boolean
  chave_negocio: string
  dt_movimentacao: string | null
  cpf: string | null
  nome: string | null
  valor: number
  dt_apuracao: string | null
  tipo_movimentacao: string | null
  proposta: string | null
  dt_exclusao_proposta: string | null
  motivo: string | null
  origem: string
} {
  return {
    run_id,
    session_id,
    usuario_id,
    dt_referencia,
    status: 'staging',
    is_active: false,
    chave_negocio: gerarChaveNegocio(desconto),
    dt_movimentacao: desconto.dt_movimentacao || null,
    cpf: desconto.cpf || null,
    nome: desconto.nome || null,
    valor: parseFloat(String(desconto.valor || 0)),
    dt_apuracao: desconto.dt_apuracao || null,
    tipo_movimentacao: desconto.tipo_movimentacao || 'desconto realizado',
    proposta: desconto.proposta || null,
    dt_exclusao_proposta: desconto.dt_exclusao_proposta || null,
    motivo: desconto.motivo || null,
    origem: desconto.origem || 'script_python'
  }
}

