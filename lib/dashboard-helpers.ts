/**
 * Helpers para lógica híbrida de bonificações
 * 
 * A partir de 01/10/2025, o modelo muda:
 * - nome_corretor: contém nome do Corretor ou Supervisor
 * - nome_supervisor: rótulo do papel ("corretor" ou "supervisor")
 * - vlr_bruto_corretor: fonte única de valor para bonificações
 */

const DATA_CORTE = '2025-10-01'

function construirDataReferencia(alias: string = 'ub'): string {
  return `${alias}.dt_analise`
}

function buildRoleMatchExpression(alias: string, role: 'corretor' | 'supervisor'): string {
  const field = `LOWER(TRIM(COALESCE(${alias}.nome_supervisor, '')))`
  return `(${field} = '${role}' OR ${field} LIKE '${role} %' OR ${field} LIKE '% ${role}' OR ${field} LIKE '% ${role} %' OR ${field} LIKE '%${role}%')`
}

export function construirCondicaoPapelNovoModelo(
  papel: 'corretor' | 'supervisor',
  alias: string = 'ub'
): string {
  return buildRoleMatchExpression(alias, papel)
}

export function construirCampoCpfParceiro(
  papelFiltro: 'geral' | 'corretores' | 'supervisores',
  alias: string = 'ub'
): string {
  const sanitizeCpf = (field: string) =>
    `NULLIF(REPLACE(REPLACE(REPLACE(TRIM(${field}), '.', ''), '-', ''), '/', ''), '')`

  const cpfCorretor = sanitizeCpf(`${alias}.cpf_corretor`)
  const cpfSupervisor = sanitizeCpf(`${alias}.cpf_supervisor`)
  const condicaoCorretorNovoModelo = construirCondicaoPapelNovoModelo('corretor', alias)
  const condicaoSupervisorNovoModelo = construirCondicaoPapelNovoModelo('supervisor', alias)

  if (papelFiltro === 'corretores') {
    return `(CASE 
      WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN ${cpfCorretor}
      WHEN ${alias}.dt_analise >= '${DATA_CORTE}' AND ${condicaoCorretorNovoModelo} THEN ${cpfCorretor}
      ELSE NULL
    END)`
  }

  if (papelFiltro === 'supervisores') {
    return `(CASE 
      WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN ${cpfSupervisor}
      WHEN ${alias}.dt_analise >= '${DATA_CORTE}' AND ${condicaoSupervisorNovoModelo} THEN ${cpfCorretor}
      ELSE NULL
    END)`
  }

  return `(CASE 
    WHEN ${alias}.dt_analise < '${DATA_CORTE}' THEN COALESCE(${cpfCorretor}, ${cpfSupervisor})
    WHEN ${alias}.dt_analise >= '${DATA_CORTE}' THEN
      ${cpfCorretor}
    ELSE NULL
  END)`
}

/**
 * Constrói SQL CASE para calcular valor conforme modelo (antigo ou novo)
 * Retorna expressão SQL que soma valores considerando a data de pagamento
 */
export function construirCampoValorPorData(
  papelFiltro: 'geral' | 'corretores' | 'supervisores',
  alias: string = 'ub'
): string {
  const dataReferencia = construirDataReferencia(alias)

  // Lógica antiga (< 2025-10-01): usa colunas separadas
  // Lógica nova (>= 2025-10-01): usa apenas vlr_bruto_corretor, filtrando por papel derivado, com base em dt_analise
  
  if (papelFiltro === 'corretores') {
    const roleMatch = buildRoleMatchExpression(alias, 'corretor')
    return `COALESCE(SUM(
      CASE 
        WHEN ${dataReferencia} < '${DATA_CORTE}' THEN ${alias}.vlr_bruto_corretor
        WHEN ${dataReferencia} >= '${DATA_CORTE}' 
             AND ${roleMatch} THEN ${alias}.vlr_bruto_corretor
        ELSE 0
      END
    ), 0)`
  } else if (papelFiltro === 'supervisores') {
    const roleMatch = buildRoleMatchExpression(alias, 'supervisor')
    return `COALESCE(SUM(
      CASE 
        WHEN ${dataReferencia} < '${DATA_CORTE}' THEN ${alias}.vlr_bruto_supervisor
        WHEN ${dataReferencia} >= '${DATA_CORTE}' 
             AND ${roleMatch} THEN ${alias}.vlr_bruto_corretor
        ELSE 0
      END
    ), 0)`
  } else {
    // Geral: soma tudo (mas exclui "indefinido" no novo modelo)
    return `COALESCE(SUM(
      CASE 
        WHEN ${dataReferencia} < '${DATA_CORTE}' 
          THEN COALESCE(${alias}.vlr_bruto_corretor, 0) + COALESCE(${alias}.vlr_bruto_supervisor, 0)
        WHEN ${dataReferencia} >= '${DATA_CORTE}' 
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
  const dataReferencia = construirDataReferencia(alias)

  if (papelFiltro === 'geral') {
    return ''
  }
  
  // Para novo modelo (>= 2025-10-01), filtrar por papel derivado
  // Para modelo antigo (< 2025-10-01), já é tratado pelo campo valor
  // Mas precisamos garantir que excluímos "indefinido" no novo modelo
  if (papelFiltro === 'corretores') {
    const roleMatch = buildRoleMatchExpression(alias, 'corretor')
    return `AND (
      ${dataReferencia} < '${DATA_CORTE}' 
      OR (
        ${dataReferencia} >= '${DATA_CORTE}' 
        AND ${roleMatch}
      )
    )`
  } else if (papelFiltro === 'supervisores') {
    const roleMatch = buildRoleMatchExpression(alias, 'supervisor')
    return `AND (
      ${dataReferencia} < '${DATA_CORTE}' 
      OR (
        ${dataReferencia} >= '${DATA_CORTE}' 
        AND ${roleMatch}
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

