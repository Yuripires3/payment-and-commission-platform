export function formatVigenciaToKey(v?: string | Date | null) {
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
