"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Filter,
  RefreshCw
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Cores QV (paleta conforme especificado)
const COLORS_QV = {
  azulEscuro: "#002f67",
  azulClaro: "#184286",
  azulTabelaHeader: "#333b5f", // Cor do cabeçalho das tabelas
  laranja: "#f58220",
  verde: "#00a2a5"
}

// Cores específicas por operadora
const CORES_OPERADORAS: Record<string, string> = {
  "ASSIM SAÚDE": "#118DFF",
  "ASSIM SAUDE": "#118DFF", // variação sem acento
  "NOVA SAÚDE": "#D9B300",
  "NOVA SAUDE": "#D9B300", // variação sem acento
  "HAPVIDA NOTREDAME": "#E66C37",
  "HAPVIDA NOTRE DAME": "#E66C37", // variação com espaço
  "ONIX": "#808080",
  "OPLAN": "#C7D9F8",
  "HEALTH MED": "#7AA479",
  "HEALTHMED": "#7AA479" // variação sem espaço
}

// Função para normalizar nome da operadora (remove acentos, espaços extras, etc)
const normalizarNomeOperadora = (nome: string): string => {
  return nome
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ') // múltiplos espaços vira um espaço
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

// Função para obter cor da operadora ou cor padrão
const getCorOperadora = (operadora: string, index: number): string => {
  if (!operadora) return "#002f67"
  
  const nomeOriginal = operadora.trim()
  const nomeNormalizado = normalizarNomeOperadora(nomeOriginal)
  
  // Tentar match exato primeiro (com e sem acento)
  if (CORES_OPERADORAS[nomeNormalizado]) {
    return CORES_OPERADORAS[nomeNormalizado]
  }
  
  // Tentar match parcial - verificar se o nome normalizado contém alguma das chaves
  const keysNormalizadas = Object.keys(CORES_OPERADORAS).map(k => normalizarNomeOperadora(k))
  
  for (let i = 0; i < keysNormalizadas.length; i++) {
    const keyNormalizada = keysNormalizadas[i]
    // Se o nome normalizado contém a chave normalizada ou vice-versa
    if (nomeNormalizado.includes(keyNormalizada) || keyNormalizada.includes(nomeNormalizado)) {
      const keyOriginal = Object.keys(CORES_OPERADORAS)[i]
      return CORES_OPERADORAS[keyOriginal]
    }
  }
  
  // Match por palavras-chave (caso o nome tenha partes conhecidas)
  if (nomeNormalizado.includes("ASSIM")) return "#118DFF"
  if (nomeNormalizado.includes("NOVA SAUDE")) return "#D9B300"
  if (nomeNormalizado.includes("HAPVIDA")) return "#E66C37"
  if (nomeNormalizado.includes("ONIX")) return "#808080"
  if (nomeNormalizado.includes("OPLAN")) return "#C7D9F8"
  if (nomeNormalizado.includes("HEALTH")) return "#7AA479"
  
  // Se não encontrar, usar cor padrão
  return "#002f67"
}

// Tipos
type Kpis = {
  comissoesMes: number
  variacaoMesPercent: number
  parceirosAtivos: number
  vidasFaturadas: number
  vidasPagas: number
  ticketMedio: number
  comissoesCorretores?: number
  comissoesSupervisores?: number
  descontoTotal?: number
  pagamentosBruto?: number
}

type SerieMensal = { mes: string; valor: number; bruto?: number; descontos?: number }
type ItemRank = { nome: string; papel?: string; valor: number; valorBruto?: number; desconto?: number; vidas?: number; ticket?: number }
type DistribuicaoOperadora = { operadora: string; valor: number; percentual: number }
type StatusMensal = { mes: string; status: string; valor: number }
type ImpactoDescontos = { mes: string; valorDesconto: number; valorProducao: number; percentualDesconto: number }

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Estados de filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const param = searchParams.get("inicio")
    if (param) return param
    // Padrão: 30 dias atrás a partir da data fim
    const dataFim = new Date()
    const thirtyDaysAgo = new Date(dataFim)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return thirtyDaysAgo.toISOString().split("T")[0]
  })
  const [dataFim, setDataFim] = useState(() => {
    return searchParams.get("fim") || new Date().toISOString().split("T")[0]
  })
  const [operadora, setOperadora] = useState(searchParams.get("operadora") || "")
  const [entidades, setEntidades] = useState<string[]>(() => {
    const entidadesParam = searchParams.get("entidade")
    return entidadesParam ? entidadesParam.split(",") : []
  })
  const [papel, setPapel] = useState<"geral" | "corretores" | "supervisores">(
    (searchParams.get("papel") as "geral" | "corretores" | "supervisores") || "geral"
  )

  // Estados de dados
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [evolucao, setEvolucao] = useState<SerieMensal[]>([])
  const [topCorretores, setTopCorretores] = useState<ItemRank[]>([])
  const [topSupervisores, setTopSupervisores] = useState<ItemRank[]>([])
  const [porEntidade, setPorEntidade] = useState<ItemRank[]>([])
  const [porOperadora, setPorOperadora] = useState<DistribuicaoOperadora[]>([])
  const [statusMensal, setStatusMensal] = useState<StatusMensal[]>([])
  const [impactoDescontos, setImpactoDescontos] = useState<ImpactoDescontos[]>([])

  // Estados de filtros disponíveis
  const [operadorasDisponiveis, setOperadorasDisponiveis] = useState<string[]>([])
  const [entidadesDisponiveis, setEntidadesDisponiveis] = useState<string[]>([])

  // Estados de loading
  const [loading, setLoading] = useState(true)
  const [loadingFiltros, setLoadingFiltros] = useState(true)

  // Formatação
  const fmtBRL = (v: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

  const fmtNumber = (v: number) => 
    new Intl.NumberFormat("pt-BR").format(v)

  const fmtMes = (mes: string) => {
    const [ano, mesNum] = mes.split("-")
    const date = new Date(parseInt(ano), parseInt(mesNum) - 1, 1)
    return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
  }

  // Carregar filtros disponíveis
  useEffect(() => {
    const loadFiltros = async () => {
      try {
        const res = await fetch("/api/dashboard/filtros")
        if (!res.ok) throw new Error("Erro ao carregar filtros")
        const data = await res.json()
        setOperadorasDisponiveis(data.operadoras || [])
        setEntidadesDisponiveis(data.entidades || [])
      } catch (error: any) {
        console.error("Erro ao carregar filtros:", error)
        toast({
          title: "Erro",
          description: "Não foi possível carregar filtros",
          variant: "destructive"
        })
      } finally {
        setLoadingFiltros(false)
      }
    }
    loadFiltros()
  }, [toast])

  // Carregar dados do dashboard
  const loadDashboard = useCallback(async () => {
    if (!dataInicio || !dataFim) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        inicio: dataInicio,
        fim: dataFim,
        papel: papel
      })
      if (operadora) params.append("operadora", operadora)
      if (entidades.length > 0) params.append("entidade", entidades.join(","))

      // Carregar todos os dados em paralelo
      // As tabelas de top 10 sempre mostram corretores e supervisores separados (ignoram filtro de papel)
      const paramsTopFixos = new URLSearchParams(params)
      paramsTopFixos.delete('papel') // Remove papel para top tables - sempre mostram ambos separados
      
      const [kpisRes, evolucaoRes, topCorretoresRes, topSupervisoresRes, porEntidadeRes, porOperadoraRes, statusMensalRes, impactoRes] = await Promise.all([
        fetch(`/api/dashboard/kpis?${params}`),
        fetch(`/api/dashboard/evolucao?${params}`),
        fetch(`/api/dashboard/top-corretores?${paramsTopFixos}`),
        fetch(`/api/dashboard/top-supervisores?${paramsTopFixos}`),
        fetch(`/api/dashboard/por-entidade?${params}`),
        fetch(`/api/dashboard/por-operadora?${params}`),
        fetch(`/api/dashboard/status-mensal?${params}`),
        fetch(`/api/dashboard/impacto-descontos?${params}`)
      ])

      if (!kpisRes.ok) throw new Error("Erro ao carregar KPIs")
      if (!evolucaoRes.ok) throw new Error("Erro ao carregar evolução")
      if (!topCorretoresRes.ok) throw new Error("Erro ao carregar top corretores")
      if (!topSupervisoresRes.ok) throw new Error("Erro ao carregar top supervisores")
      if (!porEntidadeRes.ok) throw new Error("Erro ao carregar por entidade")
      if (!porOperadoraRes.ok) throw new Error("Erro ao carregar por operadora")
      if (!statusMensalRes.ok) throw new Error("Erro ao carregar status mensal")
      if (!impactoRes.ok) throw new Error("Erro ao carregar impacto de descontos")

      const [kpisData, evolucaoData, topCorretoresData, topSupervisoresData, porEntidadeData, porOperadoraData, statusMensalData, impactoData] = await Promise.all([
        kpisRes.json(),
        evolucaoRes.json(),
        topCorretoresRes.json(),
        topSupervisoresRes.json(),
        porEntidadeRes.json(),
        porOperadoraRes.json(),
        statusMensalRes.json(),
        impactoRes.json()
      ])

      setKpis(kpisData)
      setEvolucao(evolucaoData)
      setTopCorretores(topCorretoresData)
      setTopSupervisores(topSupervisoresData)
      setPorEntidade(porEntidadeData)
      setPorOperadora(porOperadoraData)
      setStatusMensal(statusMensalData)
      setImpactoDescontos(impactoData)
    } catch (error: any) {
      console.error("Erro ao carregar dashboard:", error)
      // Garantir que os estados sejam arrays vazios em caso de erro
      setTopCorretores([])
      setTopSupervisores([])
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar dados do dashboard",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [dataInicio, dataFim, operadora, entidades, papel, toast])

  // Carregar dados quando filtros mudarem
  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Atualizar URL quando papel mudar
  useEffect(() => {
    const params = new URLSearchParams()
    if (dataInicio) params.set("inicio", dataInicio)
    if (dataFim) params.set("fim", dataFim)
    if (operadora) params.set("operadora", operadora)
    if (entidades.length > 0) params.set("entidade", entidades.join(","))
    if (papel) params.set("papel", papel)

    router.replace(`/admin?${params.toString()}`, { scroll: false })
  }, [dataInicio, dataFim, operadora, entidades, papel, router])


  // Toggle entidade no filtro
  const toggleEntidade = (entidade: string) => {
    setEntidades(prev => 
      prev.includes(entidade) 
        ? prev.filter(e => e !== entidade)
        : [...prev, entidade]
    )
  }


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-balance">Dashboard de Bonificações</h1>
        <p className="text-muted-foreground mt-1">Visão geral executiva e operacional</p>
      </div>

      {/* Filtros Globais */}
      <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operadora">Operadora</Label>
              <Select value={operadora || undefined} onValueChange={(val) => setOperadora(val || "")}>
                <SelectTrigger id="operadora">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {operadorasDisponiveis.map(op => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {operadora && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOperadora("")}
                  className="h-6 text-xs"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Entidades</Label>
              <Select 
                value={entidades.length > 0 ? entidades[0] : undefined} 
                onValueChange={(val) => {
                  if (val && !entidades.includes(val)) {
                    setEntidades([...entidades, val])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {entidadesDisponiveis
                    .filter(e => !entidades.includes(e))
                    .map(ent => (
                      <SelectItem key={ent} value={ent}>{ent}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {entidades.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {entidades.map(ent => (
                    <span
                      key={ent}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md text-sm"
                    >
                      {ent}
                      <button
                        onClick={() => toggleEntidade(ent)}
                        className="hover:text-red-500"
                        aria-label={`Remover ${ent}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo de produtor</Label>
              <Select value={papel} onValueChange={(val) => setPapel(val as "geral" | "corretores" | "supervisores")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Todos</SelectItem>
                  <SelectItem value="corretores">Corretores</SelectItem>
                  <SelectItem value="supervisores">Supervisores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => loadDashboard()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs - Cards principais conforme papel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comissões do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{fmtBRL(kpis?.comissoesMes || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bruto: {fmtBRL(kpis?.pagamentosBruto || 0)} • Descontos: {fmtBRL(kpis?.descontoTotal || 0)}
                </p>
                <p className={`text-xs flex items-center gap-1 mt-1 ${
                  (kpis?.variacaoMesPercent || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}>
                  {(kpis?.variacaoMesPercent || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(kpis?.variacaoMesPercent || 0).toFixed(2)}% vs mês anterior
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Parceiros Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{fmtNumber(kpis?.parceirosAtivos || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vidas Faturadas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{fmtNumber(kpis?.vidasFaturadas || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vidas Pagas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{fmtNumber(kpis?.vidasPagas || 0)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{fmtBRL(kpis?.ticketMedio || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução de Comissões */}
      <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
        <CardHeader>
          <CardTitle>Evolução de Comissões</CardTitle>
          <CardDescription>Últimos 12 meses - Comissões líquidas e descontos</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : evolucao.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={evolucao.map(item => ({ ...item, mes: fmtMes(item.mes) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(value) => {
                  const formatted = fmtBRL(value)
                  return formatted.replace('R$', '').trim()
                }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    
                    // Pegar os dados do payload (pode vir de qualquer uma das barras)
                    const data = payload[0].payload as SerieMensal
                    
                    // Extrair valores do payload para garantir precisão
                    let valorBruto = data.bruto || 0
                    let valorDescontos = data.descontos || 0
                    let valorLiquido = data.valor || 0
                    
                    // Se os valores vierem dos payloads individuais, usar eles
                    payload.forEach((entry: any) => {
                      if (entry.dataKey === "descontos" && entry.value !== undefined) {
                        valorDescontos = entry.value
                      } else if (entry.dataKey === "valor" && entry.value !== undefined) {
                        valorLiquido = entry.value
                      }
                    })
                    
                    // Calcular bruto = líquido + descontos (mais preciso)
                    if (valorBruto === 0) {
                      valorBruto = valorLiquido + valorDescontos
                    }
                    
                    return (
                      <div className="bg-white dark:bg-zinc-900 p-3 border rounded-lg shadow-lg">
                        <p className="font-semibold mb-2">{data.mes}</p>
                        <p className="text-sm mb-1">
                          <span style={{ color: COLORS_QV.azulEscuro }}>Bruto:</span> {fmtBRL(valorBruto)}
                        </p>
                        {valorDescontos > 0 && (
                          <p className="text-sm mb-1">
                            <span style={{ color: "#CA8282" }}>Descontos:</span> {fmtBRL(valorDescontos)}
                          </p>
                        )}
                        <p className="text-sm font-semibold">
                          <span style={{ color: COLORS_QV.azulTabelaHeader }}>Líquido:</span> {fmtBRL(valorLiquido)}
                        </p>
                      </div>
                    )
                  }}
                />
                <Legend />
                {/* Descontos na base (vermelho) - colocado primeiro para aparecer embaixo */}
                {evolucao.length > 0 && evolucao[0].descontos !== undefined && (
                  <Bar 
                    dataKey="descontos" 
                    name="Descontos" 
                    stackId="1" 
                    fill="#CA8282"
                  />
                )}
                {/* Líquido no topo (azul do cabeçalho) - colocado depois para aparecer em cima */}
                <Bar 
                  dataKey="valor" 
                  name="Líquido" 
                  stackId="1" 
                  fill={COLORS_QV.azulTabelaHeader} 
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Por Entidade e Por Operadora */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader>
            <CardTitle>Distribuição por Entidade (Top 10)</CardTitle>
            <CardDescription>Comissões líquidas por entidade</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : porEntidade.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porEntidade.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => {
                      const formatted = fmtBRL(value)
                      return formatted.replace('R$', '').trim()
                    }} 
                  />
                  <YAxis 
                    dataKey="nome" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => fmtBRL(value)}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar 
                    dataKey="valor" 
                    fill={COLORS_QV.azulTabelaHeader}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader>
            <CardTitle>Distribuição por Operadora</CardTitle>
            <CardDescription>Percentual de comissões líquidas</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : porOperadora.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={porOperadora}
                    dataKey="valor"
                    nameKey="operadora"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    labelLine={false}
                    label={(entry: any) => {
                      // Recharts passa o entry completo + percent (0-1)
                      const operadora = entry.operadora || ''
                      const percent = entry.percent || 0 // percent é 0-1 no Recharts
                      const percentual = percent * 100 // converter para 0-100
                      
                      // Mostrar labels apenas para fatias maiores que 7%
                      if (!isFinite(percentual) || isNaN(percentual) || percentual < 7) return ''
                      return `${operadora}: ${percentual.toFixed(1)}%`
                    }}
                  >
                    {porOperadora.map((entry, index) => {
                      const cor = getCorOperadora(entry.operadora, index)
                      // Debug: log apenas se não encontrar match exato
                      if (cor === "#002f67") {
                        console.log("Operadora não encontrada:", entry.operadora, "Normalizado:", normalizarNomeOperadora(entry.operadora))
                      }
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={cor}
                        />
                      )
                    })}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null
                      const data = payload[0].payload as DistribuicaoOperadora
                      const operadora = data.operadora || 'Não informado'
                      const valor = data.valor || 0
                      const percentual = data.percentual || 0
                      
                      return (
                        <div className="bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                          <p className="font-semibold mb-1 text-sm">Operadora: {operadora}</p>
                          <p className="text-sm mb-1">Valor líquido: {fmtBRL(valor)}</p>
                          <p className="text-sm font-medium">Participação: {percentual.toFixed(1)}%</p>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null
                      return (
                        <ul className="list-none space-y-2">
                          {payload.map((entry: any, index: number) => {
                            const item = porOperadora.find(item => item.operadora === entry.value)
                            if (!item || !item.valor || item.valor <= 0) return null
                            
                            const percentual = item.percentual || 0
                            if (!isFinite(percentual) || isNaN(percentual) || percentual < 0) return null
                            
                            // Obter a cor correta da operadora
                            const corOperadora = getCorOperadora(item.operadora, index)
                            
                            return (
                              <li key={`legend-${index}`} className="flex items-center gap-2 text-sm">
                                <span 
                                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: corOperadora }}
                                />
                                <span className="text-black dark:text-black">
                                  {item.operadora} ({percentual.toFixed(1)}%)
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Corretores e Supervisores */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader>
            <CardTitle>Top Corretores (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topCorretores.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Corretor</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead className="text-right">Vidas</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCorretores.slice(0, 10).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{index + 1}º</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.nome}</span>
                            {item.papel && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                item.papel === 'corretor' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : item.papel === 'supervisor'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {item.papel === 'corretor' ? 'Corretor' : item.papel === 'supervisor' ? 'Supervisor' : item.papel}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmtBRL(item.valor)}</TableCell>
                        <TableCell className="text-right">{fmtNumber(item.vidas || 0)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(item.ticket || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
          <CardHeader>
            <CardTitle>Top Supervisores (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topSupervisores.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posição</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead className="text-right">Vidas</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSupervisores.slice(0, 10).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{index + 1}º</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{item.nome}</span>
                            {item.papel && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                item.papel === 'corretor' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : item.papel === 'supervisor'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {item.papel === 'corretor' ? 'Corretor' : item.papel === 'supervisor' ? 'Supervisor' : item.papel}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmtBRL(item.valor)}</TableCell>
                        <TableCell className="text-right">{fmtNumber(item.vidas || 0)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(item.ticket || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impacto de Descontos */}
      <Card className="bg-white rounded-2xl shadow-sm border-zinc-200/70">
        <CardHeader>
          <CardTitle>Impacto de Descontos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : impactoDescontos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={impactoDescontos.map(item => ({ ...item, mes: fmtMes(item.mes) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis yAxisId="left" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const data = payload[0].payload as ImpactoDescontos
                    
                    return (
                      <div className="bg-white dark:bg-zinc-900 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                        <p className="font-semibold mb-2">{data.mes}</p>
                        {payload.map((entry: any, index: number) => {
                          if (entry.dataKey === "percentualDesconto") {
                            return (
                              <p key={index} className="text-sm mb-1">
                                <span style={{ color: entry.color }}>{entry.name}:</span> {entry.value.toFixed(2)}%
                              </p>
                            )
                          } else {
                            return (
                              <p key={index} className="text-sm mb-1">
                                <span style={{ color: entry.color }}>{entry.name}:</span> {fmtBRL(entry.value)}
                              </p>
                            )
                          }
                        })}
                      </div>
                    )
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="valorDesconto" 
                  stroke={COLORS_QV.laranja} 
                  name="Valor Desconto"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="percentualDesconto" 
                  stroke={COLORS_QV.verde} 
                  name="% Desconto"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
