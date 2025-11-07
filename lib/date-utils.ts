export interface DateParts {
  year: number
  month: number
  day: number
}

export function getDateParts(value: string | Date | null | undefined): DateParts | null {
  if (!value) return null

  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    }
  }

  const raw = String(value).trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    }
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  }
}

export function formatDateISO(value: string | Date | null | undefined): string {
  const parts = getDateParts(value)
  if (!parts) return ""
  const { year, month, day } = parts
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatDateBR(value: string | Date | null | undefined): string {
  const parts = getDateParts(value)
  if (!parts) return ""
  const day = String(parts.day).padStart(2, '0')
  const month = String(parts.month).padStart(2, '0')
  const year = parts.year
  return `${day}/${month}/${year}`
}

export function formatDateTimeLocal(
  value: string | number | Date,
  timeZone: string = process.env.APP_TIMEZONE || process.env.TZ || "America/Sao_Paulo"
): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || "00"

  const year = getPart("year")
  const month = getPart("month")
  const day = getPart("day")
  const hour = getPart("hour")
  const minute = getPart("minute")
  const second = getPart("second")

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

