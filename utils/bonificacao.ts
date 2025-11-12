function formatVigenciaToKey(v?: string | Date | null) {
  if (!v) return ""
  const d = typeof v === "string" ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return ""
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
  const m = meses[d.getMonth()]
  const yy = String(d.getFullYear()).slice(-2)
  return `${m}/${yy}`
}

export function buildChaveKey(opts: {
  vigencia?: string | Date | null
  operadora?: string | null
  entidade?: string | null
  parcela?: string | null
  plano?: string | null
  tipo_faixa?: string | null
  tipo_dependente?: string | null // mapear de tipo_beneficiario, se for o nome no DB
  produto?: string | null
}) {
  const seg = [
    formatVigenciaToKey(opts.vigencia),
    opts.operadora ?? "",
    opts.entidade ?? "",
    opts.parcela ?? "",
    opts.plano ?? "",
    opts.tipo_faixa ?? "",
    opts.tipo_dependente ?? "",
    opts.produto ?? "",
  ]
  return seg.join(" - ")
}

export function formatCurrency(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  
  let numValue: number
  
  if (typeof value === 'number') {
    numValue = value
  } else if (typeof value === 'string') {
    // Remove símbolos de moeda e espaços
    let cleaned = value.replace(/[R$\s]/g, '').trim()
    
    // Se tem vírgula, assume formato brasileiro (ex: "1.234,56")
    if (cleaned.includes(',')) {
      // Remove pontos (milhares) e substitui vírgula por ponto
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
    // Se só tem ponto, pode ser formato internacional (ex: "1234.56")
    // ou pode ser separador de milhares brasileiro antes da conversão
    
    numValue = parseFloat(cleaned)
    
    if (isNaN(numValue)) {
      return value // Retorna o valor original se não conseguir converter
    }
  } else {
    return String(value)
  }
  
  // Formatar como moeda brasileira
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(numValue)
}