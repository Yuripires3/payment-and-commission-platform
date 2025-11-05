/**
 * Helpers para lógica híbrida de bonificações
 * 
 * A partir de 01/10/2025, o modelo muda:
 * - nome_corretor: contém nome do Corretor ou Supervisor
 * - nome_supervisor: rótulo do papel ("corretor" ou "supervisor")
 * - vlr_bruto_corretor: fonte única de valor para bonificações
 */

const DATA_CORTE = '2025-10-01'

/**
 * Verifica se uma data está no novo modelo (>= 2025-10-01) por dt_analise
 */
export function isNovoModelo(_dataPagamento: string | null | undefined, dtAnalise?: string | null): boolean {
  const dataRef = dtAnalise
  if (!dataRef) return false
  return dataRef >= DATA_CORTE
}

/**
 * Deriva o papel (corretor/supervisor/indefinido) do nome_supervisor
 */
export function derivarPapel(nomeSupervisor: string | null | undefined): 'corretor' | 'supervisor' | 'indefinido' {
  if (!nomeSupervisor) return 'indefinido'
  const papel = nomeSupervisor.trim().toLowerCase()
  if (papel === 'corretor') return 'corretor'
  if (papel === 'supervisor') return 'supervisor'
  return 'indefinido'
}

/**
 * Obtém o nome de exibição (sempre de nome_corretor)
 */
export function obterNomeExibicao(nomeCorretor: string | null | undefined, cpfCorretor?: string | null): string {
  return nomeCorretor || cpfCorretor || 'Não informado'
}

/**
 * Constrói SQL CASE para calcular valor conforme modelo (antigo ou novo)
 * Retorna expressão SQL que soma valores considerando a data de pagamento
 */
export function construirCampoValorPorData(
  papelFiltro: 'geral' | 'corretores' | 'supervisores',
  alias: string = 'ub'
): string {
  // Lógica antiga (< 2025-10-01): usa colunas separadas
  // Lógica nova (>= 2025-10-01): usa apenas vlr_bruto_corretor, filtrando por papel derivado, com base em dt_analise
  
  if (papelFiltro === 'corretores') {
    return `COALESCE(SUM(
      CASE 
        WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN ${alias}.vlr_bruto_corretor
        WHEN ${alias}.dt_analise >= '${DATA_CORTE}' 
             AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'corretor' THEN ${alias}.vlr_bruto_corretor
        ELSE 0
      END
    ), 0)`
  } else if (papelFiltro === 'supervisores') {
    return `COALESCE(SUM(
      CASE 
        WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN ${alias}.vlr_bruto_supervisor
        WHEN ${alias}.dt_analise >= '${DATA_CORTE}' 
             AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'supervisor' THEN ${alias}.vlr_bruto_corretor
        ELSE 0
      END
    ), 0)`
  } else {
    // Geral: soma tudo (mas exclui "indefinido" no novo modelo)
    return `COALESCE(SUM(
      CASE 
        WHEN ${alias}.dt_analise < '${DATA_CORTE}' 
          THEN COALESCE(${alias}.vlr_bruto_corretor, 0) + COALESCE(${alias}.vlr_bruto_supervisor, 0)
        WHEN ${alias}.dt_analise >= '${DATA_CORTE}' 
             AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) IN ('corretor', 'supervisor')
          THEN ${alias}.vlr_bruto_corretor
        ELSE 0
      END
    ), 0)`
  }
}

/**
 * Constrói condição WHERE para filtrar por papel (novo modelo)
 * Retorna string vazia se não precisa filtrar
 */
export function construirFiltroPapel(
  papelFiltro: 'geral' | 'corretores' | 'supervisores',
  alias: string = 'ub'
): string {
  if (papelFiltro === 'geral') {
    // Para geral, apenas excluir "indefinido" no novo modelo
    return `AND (
      ${alias}.dt_analise < '${DATA_CORTE}' 
      OR (
        ${alias}.dt_analise >= '${DATA_CORTE}' 
        AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) IN ('corretor', 'supervisor')
      )
    )`
  }
  
  // Para novo modelo (>= 2025-10-01), filtrar por papel derivado
  // Para modelo antigo (< 2025-10-01), já é tratado pelo campo valor
  // Mas precisamos garantir que excluímos "indefinido" no novo modelo
  if (papelFiltro === 'corretores') {
    return `AND (
      ${alias}.dt_analise < '${DATA_CORTE}' 
      OR (
        ${alias}.dt_analise >= '${DATA_CORTE}' 
        AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'corretor'
      )
    )`
  } else if (papelFiltro === 'supervisores') {
    return `AND (
      ${alias}.dt_analise < '${DATA_CORTE}' 
      OR (
        ${alias}.dt_analise >= '${DATA_CORTE}' 
        AND LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'supervisor'
      )
    )`
  }
  
  return ''
}

/**
 * Constrói SELECT para nome de exibição (sempre nome_corretor)
 */
export function construirCampoNomeExibicao(alias: string = 'ub'): string {
  return `COALESCE(${alias}.nome_corretor, ${alias}.cpf_corretor, 'Não informado') as nome_exibicao`
}

/**
 * Constrói SELECT para papel derivado
 */
export function construirCampoPapel(alias: string = 'ub'): string {
  return `CASE 
    WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN
      CASE 
        WHEN ${alias}.cpf_corretor IS NOT NULL AND ${alias}.cpf_corretor != '' THEN 'corretor'
        WHEN ${alias}.cpf_supervisor IS NOT NULL AND ${alias}.cpf_supervisor != '' THEN 'supervisor'
        ELSE 'indefinido'
      END
    WHEN ${alias}.dt_analise >= '${DATA_CORTE}' THEN
      CASE 
        WHEN LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'corretor' THEN 'corretor'
        WHEN LOWER(TRIM(COALESCE(${alias}.nome_supervisor, ''))) = 'supervisor' THEN 'supervisor'
        ELSE 'indefinido'
      END
    ELSE 'indefinido'
  END as papel`
}

