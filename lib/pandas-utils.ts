/**
 * Utilitários para conversão de DataFrames pandas (via JSON) para arrays JavaScript
 */

export function pandasToArray(dfJson: any): any[] {
  if (!dfJson || !Array.isArray(dfJson)) {
    return []
  }
  
  // Se já é um array de objetos, retornar direto
  if (dfJson.length > 0 && typeof dfJson[0] === 'object' && !Array.isArray(dfJson[0])) {
    return dfJson
  }
  
  // Se é um array de arrays (formato CSV-like), converter para objetos
  if (dfJson.length > 0 && Array.isArray(dfJson[0])) {
    const headers = dfJson[0] as string[]
    return dfJson.slice(1).map((row: any[]) => {
      const obj: any = {}
      headers.forEach((header, idx) => {
        obj[header] = row[idx] ?? null
      })
      return obj
    })
  }
  
  return dfJson
}

export function arrayToCSV(data: any[], headers?: string[]): string {
  if (!data || data.length === 0) {
    return ''
  }
  
  // Se headers não fornecidos, usar as chaves do primeiro objeto
  const actualHeaders = headers || Object.keys(data[0] || {})
  
  // Criar linha de cabeçalho
  const csvRows = [actualHeaders.join(';')]
  
  // Criar linhas de dados
  data.forEach(row => {
    const values = actualHeaders.map(header => {
      const value = row[header]
      // Escapar valores que contêm ; ou "
      if (value === null || value === undefined) {
        return ''
      }
      const str = String(value)
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    })
    csvRows.push(values.join(';'))
  })
  
  return csvRows.join('\n')
}

