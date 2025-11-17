"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/utils/bonificacao"
import { signalPageLoaded } from "@/components/ui/page-loading"
import { usePersistentState } from "@/hooks/usePersistentState"

interface ExtratoProposta {
  operadora?: string | null
  numero_proposta?: string | null
  entidade?: string | null
  nome_exibicao?: string | null
  nome_corretor?: string | null
  nome_supervisor?: string | null
  tipo_produtor?: string | null
  tipo_beneficiario?: string | null
  idade?: number | string | null
  bonus_bruto?: number | null
  dt_analise?: string | null
}

interface ApiResponse {
  data?: ExtratoProposta[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

type ExtratoPropostasFilters = {
  cpf: string
  nome: string
  data_pagamento: string
  numero_proposta: string
}

const FILTER_STORAGE_KEY = "admin-extrato-propostas"

const createEmptyFilters = (): ExtratoPropostasFilters => ({
  cpf: "",
  nome: "",
  data_pagamento: "",
  numero_proposta: "",
})

const formatCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return ""
  const numericCpf = cpf.replace(/\D/g, "")
  const paddedCpf = numericCpf.padStart(11, "0")
  if (paddedCpf.length === 11) {
    return `${paddedCpf.slice(0, 3)}.${paddedCpf.slice(3, 6)}.${paddedCpf.slice(6, 9)}-${paddedCpf.slice(9, 11)}`
  }
  return paddedCpf
}

export default function ExtratoPropostasPage() {
  const { toast } = useToast()
  const [data, setData] = useState<ExtratoProposta[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [pendingFilters, setPendingFilters] = usePersistentState<ExtratoPropostasFilters>(
    `${FILTER_STORAGE_KEY}:pending`,
    createEmptyFilters
  )
  const [appliedFilters, setAppliedFilters] = usePersistentState<ExtratoPropostasFilters>(
    `${FILTER_STORAGE_KEY}:applied`,
    createEmptyFilters
  )

  const [cpfQuery, setCpfQuery] = useState("")
  const [cpfFocused, setCpfFocused] = useState(false)
  const [cpfSuggestions, setCpfSuggestions] = useState<Array<{ cpf: string; nome: string; formattedCpf: string }>>([])
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", page.toString())
      params.append("pageSize", pageSize.toString())

      if (appliedFilters.cpf) params.append("cpf", appliedFilters.cpf)
      if (appliedFilters.nome) params.append("nome", appliedFilters.nome)
      if (appliedFilters.data_pagamento) params.append("data_pagamento", appliedFilters.data_pagamento)
      if (appliedFilters.numero_proposta) params.append("numero_proposta", appliedFilters.numero_proposta)

      const response = await fetch(`/api/bonificacoes/extrato-propostas?${params}`)
      if (!response.ok) {
        throw new Error(`Erro ao buscar extrato de propostas: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.error) {
        toast({
          title: "Erro ao carregar dados",
          description: result.error,
          variant: "destructive",
        })
        setData([])
        setTotal(0)
        setTotalPages(0)
        return
      }

      setData(result.data || [])
      setTotal(result.pagination?.total || 0)
      setTotalPages(result.pagination?.totalPages || 0)
    } catch (error: any) {
      console.error("Erro ao carregar extrato de propostas:", error)
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar extrato de propostas",
        variant: "destructive",
      })
      setData([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
      signalPageLoaded()
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters.cpf, appliedFilters.nome, appliedFilters.data_pagamento, appliedFilters.numero_proposta])

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const handler = setTimeout(async () => {
      const numericQuery = cpfQuery.replace(/\D/g, "")
      if (numericQuery.length < 2) {
        setCpfSuggestions([])
        return
      }
      try {
        const response = await fetch(
          `/api/bonificacoes/extrato-propostas/cpf-suggestions?q=${encodeURIComponent(numericQuery)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          setCpfSuggestions([])
          return
        }
        const result = await response.json()
        setCpfSuggestions(result.suggestions || [])
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error("Erro ao buscar sugestões de CPF:", error)
        setCpfSuggestions([])
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(handler)
    }
  }, [cpfQuery])

  useEffect(() => {
    if (!pendingFilters.cpf && !appliedFilters.cpf && cpfQuery && !cpfFocused) {
      setCpfQuery("")
    }
  }, [pendingFilters.cpf, appliedFilters.cpf, cpfQuery, cpfFocused])

  const handleFilterChange = (key: keyof ExtratoPropostasFilters, value: string) => {
    setPendingFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const applyFilters = (override?: Partial<ExtratoPropostasFilters>) => {
    const nextFilters = {
      ...pendingFilters,
      ...override,
    }

    const normalized: ExtratoPropostasFilters = {
      cpf: (nextFilters.cpf || "").replace(/\D/g, ""),
      nome: (nextFilters.nome || "").trim(),
      data_pagamento: nextFilters.data_pagamento || "",
      numero_proposta: (nextFilters.numero_proposta || "").trim(),
    }

    const changed =
      normalized.cpf !== appliedFilters.cpf ||
      normalized.nome !== appliedFilters.nome ||
      normalized.data_pagamento !== appliedFilters.data_pagamento ||
      normalized.numero_proposta !== appliedFilters.numero_proposta

    setPendingFilters(nextFilters)

    if (!changed) {
      return
    }

    setAppliedFilters(normalized)
    setPage(1)
  }

  const clearFilters = () => {
    const empty = createEmptyFilters()
    setPendingFilters(empty)
    setAppliedFilters(empty)
    setCpfQuery("")
    setPage(1)
  }

  const displayName = (row: ExtratoProposta) => {
    return row.nome_exibicao || row.nome_corretor || row.nome_supervisor || "Não informado"
  }

  const bonusBrutoTotal = useMemo(() => {
    return data.reduce((sum, item) => sum + (typeof item.bonus_bruto === "number" ? item.bonus_bruto : 0), 0)
  }, [data])

  const startRecord = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total)
  const endRecord = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Extrato de Propostas</h1>
        <p className="text-muted-foreground mt-1">
          Consulte as propostas com filtros por CPF, datas de pagamento, nome e número.
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine sua busca pelos critérios disponíveis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter_cpf">CPF do Produtor</Label>
              <div className="relative">
                <Input
                  id="filter_cpf"
                  placeholder="Buscar por CPF..."
                  value={
                    cpfFocused
                      ? cpfQuery
                      : pendingFilters.cpf
                        ? formatCpf(pendingFilters.cpf)
                        : cpfQuery
                  }
                  onFocus={() => {
                    setCpfFocused(true)
                    if (pendingFilters.cpf) {
                      setCpfQuery(formatCpf(pendingFilters.cpf))
                    }
                  }}
                  onBlur={() => setTimeout(() => setCpfFocused(false), 150)}
                  onChange={(e) => {
                    const value = e.target.value
                    setCpfQuery(value)
                    const numericValue = value.replace(/\D/g, "")
                    handleFilterChange("cpf", numericValue)
                  }}
                />
                {(pendingFilters.cpf || cpfQuery) && (
                  <button
                    type="button"
                    aria-label="Limpar CPF"
                    onClick={() => {
                      setCpfQuery("")
                      handleFilterChange("cpf", "")
                      setCpfFocused(true)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {cpfFocused && cpfSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-white text-popover-foreground shadow">
                    {cpfSuggestions.map((suggestion, idx) => (
                      <button
                        key={`${suggestion.cpf}-${idx}`}
                        type="button"
                        onClick={() => {
                          setPendingFilters(prev => ({
                            ...prev,
                            cpf: suggestion.cpf,
                            nome: suggestion.nome || prev.nome,
                          }))
                          setCpfQuery(suggestion.formattedCpf)
                          setCpfFocused(false)
                          applyFilters({
                            cpf: suggestion.cpf,
                            nome: suggestion.nome || pendingFilters.nome,
                          })
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="font-medium">{suggestion.formattedCpf}</div>
                        {suggestion.nome && (
                          <div className="text-sm text-muted-foreground">{suggestion.nome}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter_nome">Nome do Produtor</Label>
              <Input
                id="filter_nome"
                placeholder="Buscar por nome..."
                value={pendingFilters.nome}
                onChange={(e) => handleFilterChange("nome", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter_proposta">Número da Proposta</Label>
              <Input
                id="filter_proposta"
                placeholder="Ex: ON0123456"
                value={pendingFilters.numero_proposta}
                onChange={(e) => handleFilterChange("numero_proposta", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_pagamento">Data de Pagamento</Label>
              <Input
                id="data_pagamento"
                type="date"
                value={pendingFilters.data_pagamento}
                onChange={(e) => handleFilterChange("data_pagamento", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Limpar
            </Button>
            <Button onClick={() => applyFilters()} disabled={loading}>
              {loading ? "Aplicando..." : "Aplicar filtros"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {total > 0
                  ? `Mostrando ${startRecord} a ${endRecord} de ${total} registros`
                  : "Nenhum registro encontrado para os filtros selecionados."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operadora</TableHead>
                  <TableHead>Número da Proposta</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo de Beneficiário</TableHead>
                  <TableHead>Idade</TableHead>
                  <TableHead>Tipo de Produtor</TableHead>
                  <TableHead className="text-right">Bônus Bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, index) => (
                    <TableRow key={`${row.numero_proposta || "proposta"}-${index}`}>
                      <TableCell>{row.operadora || "-"}</TableCell>
                      <TableCell>{row.numero_proposta || "-"}</TableCell>
                      <TableCell>{row.entidade || "-"}</TableCell>
                      <TableCell>{displayName(row)}</TableCell>
                      <TableCell>{row.tipo_beneficiario || "-"}</TableCell>
                      <TableCell>{row.idade ?? "-"}</TableCell>
                      <TableCell>{row.tipo_produtor || "-"}</TableCell>
                      <TableCell className="text-right">
                        {typeof row.bonus_bruto === "number" ? formatCurrency(row.bonus_bruto) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {Math.min((page - 1) * pageSize + 1, total)} a {Math.min(page * pageSize, total)} de {total} registros
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


