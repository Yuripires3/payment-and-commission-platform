"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OPERADORAS, TIPOS_FAIXA, PRODUTOS, PAGAMENTO_POR, TIPO_BENEFICIARIO, PARCELAS } from "./constants"
import { Download, Search, ChevronLeft, ChevronRight, X, Pencil, Check, XCircle, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Interface dinâmica para suportar todas as colunas do banco
interface RegraData {
  [key: string]: any
}

interface ApiResponse {
  data?: RegraData[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  error?: string
}

export function RegrasTable() {
  const { toast } = useToast()
  const [data, setData] = useState<RegraData[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filtros
  const [filters, setFilters] = useState({
    operadora: "",
    tipo_faixa: "",
    produto: "",
    pagamento_por: "",
    tipo_beneficiario: "",
    parcela: "",
    entidade: "",
    plano: "",
    vigencia_inicio: ""
  })

  // Debounce para inputs de texto
  const [debouncedEntidade, setDebouncedEntidade] = useState("")
  const [debouncedPlano, setDebouncedPlano] = useState("")

  // Estado para edição inline
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<{ [key: string]: any }>({})
  const [originalData, setOriginalData] = useState<{ [key: string]: any }>({})

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEntidade(filters.entidade)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.entidade])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlano(filters.plano)
    }, 300)
    return () => clearTimeout(timer)
  }, [filters.plano])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (key === "entidade") {
          if (debouncedEntidade) params.append(key, debouncedEntidade)
        } else if (key === "plano") {
          if (debouncedPlano) params.append(key, debouncedPlano)
        } else if (value) {
          params.append(key, value)
        }
      })

      params.append("page", page.toString())
      params.append("pageSize", pageSize.toString())
      // Sempre ordenar por 'registro' desc (mais recente primeiro)
      params.append("sort", "registro")
      params.append("order", "desc")

      const response = await fetch(`/api/bonificacoes/regras?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result: ApiResponse = await response.json()

      // Verificar se há erro na resposta
      if (result.error) {
        console.error("API Error:", result.error)
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

      // Validar se a resposta tem o formato esperado
      if (result && result.data && result.pagination) {
        setData(result.data)
        setTotal(result.pagination.total)
        setTotalPages(result.pagination.totalPages)
      } else {
        console.error("Invalid response format:", result)
        setData([])
        setTotal(0)
        setTotalPages(0)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um erro ao buscar as regras de bonificação",
        variant: "destructive",
      })
      setData([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [filters, debouncedEntidade, debouncedPlano, page, pageSize, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page on filter change
  }

  const clearFilters = () => {
    setFilters({
      operadora: "",
      tipo_faixa: "",
      produto: "",
      pagamento_por: "",
      tipo_beneficiario: "",
      parcela: "",
      entidade: "",
      plano: "",
      vigencia_inicio: ""
    })
    // Limpar também os valores de debounce
    setDebouncedEntidade("")
    setDebouncedPlano("")
    setPage(1)
  }

  const startEditing = (rowId: string, rowData: RegraData) => {
    setEditingRow(rowId)
    setEditedData(rowData)
    setOriginalData({ ...rowData }) // Guardar cópia dos dados originais
  }

  const cancelEditing = () => {
    setEditingRow(null)
    setEditedData({})
    setOriginalData({})
  }

  const deleteRow = async (id: any) => {
    console.log("deleteRow called with ID:", id, "Type:", typeof id)
    
    // Garantir que o ID seja um número válido
    const numericId = Number(id)
    if (!numericId || Number.isNaN(numericId)) {
      console.error("Invalid ID:", id)
      toast({
        title: "Erro",
        description: "ID inválido para exclusão",
        variant: "destructive"
      })
      return
    }
    
    if (!confirm('Tem certeza que deseja excluir esta regra?')) {
      return
    }

    try {
      console.log("Making DELETE request to:", `/api/bonificacoes/regras/${numericId}`)
      const response = await fetch(`/api/bonificacoes/regras/${numericId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao excluir regra'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      // Recarregar dados após exclusão
      await fetchData()
      
      toast({
        title: "Sucesso!",
        description: "Regra excluída com sucesso"
      })
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao excluir regra",
        variant: "destructive"
      })
    }
  }

  const handleCellChange = (key: string, value: any) => {
    setEditedData(prev => ({ ...prev, [key]: value }))
  }

  const saveEditing = async () => {
    if (!editingRow || !editedData.id) {
      console.error("Missing editingRow or id:", { editingRow, id: editedData.id })
      return
    }

    // Comparar dados editados com originais
    const changedFields: { [key: string]: any } = {}
    
    Object.keys(editedData).forEach((key) => {
      if (key !== 'id') {
        const oldValue = originalData[key]
        const newValue = editedData[key]
        
        // Converter para string para comparação segura
        const oldStr = oldValue === null || oldValue === undefined ? '' : String(oldValue)
        const newStr = newValue === null || newValue === undefined ? '' : String(newValue)
        
        // Se os valores são diferentes, adicionar ao objeto de mudanças
        if (oldStr !== newStr) {
          let normalizedValue = newValue
          
          // Normalizar data para YYYY-MM-DD
          if (key === 'vigencia' && newValue) {
            try {
              const date = new Date(newValue)
              if (!isNaN(date.getTime())) {
                normalizedValue = date.toISOString().split('T')[0] // YYYY-MM-DD
              }
            } catch (e) {
              console.error("Error normalizing date:", e)
            }
          }
          
          // Normalizar valores monetários: converter ponto para vírgula
          if ((key === 'bonificacao_corretor' || key === 'bonificacao_supervisor') && newValue) {
            if (typeof newValue === 'string') {
              // Se contém ponto, converte para vírgula (ex: "1200.00" -> "1200,00")
              normalizedValue = newValue.replace('.', ',')
            } else if (typeof newValue === 'number') {
              // Se for número, converte para string com vírgula (ex: 1200.5 -> "1200,5")
              normalizedValue = String(newValue).replace('.', ',')
            }
          }
          
          changedFields[key] = normalizedValue
          console.log(`Field changed ${key}: "${oldStr}" -> "${newStr}"`)
        }
      }
    })

    // Se não houve mudanças, não fazer nada
    if (Object.keys(changedFields).length === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não foram detectadas alterações",
      })
      setEditingRow(null)
      setEditedData({})
      setOriginalData({})
      return
    }

    // Filtrar qualquer undefined que possa ter sido incluído
    const cleanFields: { [key: string]: any } = {}
    Object.entries(changedFields).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanFields[key] = value
      } else {
        console.warn(`Undefined value filtered out for key "${key}"`)
      }
    })
    
    // Adicionar o id no início
    const finalPayload = { id: editedData.id, ...cleanFields }
    
    console.log("=== Payload to send ===")
    console.log("Changed fields:", changedFields)
    console.log("Clean fields:", cleanFields)
    console.log("Final payload:", finalPayload)
    console.log("JSON:", JSON.stringify(finalPayload, (key, value) => value === undefined ? null : value))
    
    setLoading(true)
    try {
      const response = await fetch(`/api/bonificacoes/regras/${editedData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      })

      console.log("Response status:", response.status)

      if (!response.ok) {
        let errorMessage = 'Erro ao salvar alterações'
        try {
          const errorData = await response.json()
          console.error("Error response:", errorData)
          errorMessage = errorData.error || errorMessage
        } catch {
          // Se não conseguir parsear o JSON, usar a mensagem padrão
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("Success response:", result)

      toast({
        title: "Sucesso",
        description: "Regra atualizada com sucesso",
      })

      setEditingRow(null)
      setEditedData({})
      setOriginalData({})
      
      // Recarregar dados
      await fetchData()
    } catch (error) {
      console.error("Error saving data:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível salvar as alterações",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (data.length === 0) return

    // Obter todas as colunas dinamicamente, exceto 'id' e 'chave'
    const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'chave')
    
    // Criar headers com nomes formatados
    const headers = columns.map(col => 
      col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    )

    // Criar linhas de dados
    const csvData = [
      headers.join(","),
      ...data.map(row => 
        columns.map(col => {
          const value = row[col]
          // Formatar valores especiais
          if (col === 'vigencia' && value) {
            return new Date(value).toLocaleDateString("pt-BR")
          }
          if (typeof value === 'number' && col.includes('bonificacao')) {
            return value.toFixed(2)
          }
          // Escapar vírgulas em strings
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`
          }
          return value || ''
        }).join(",")
      )
    ].join("\n")

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `regras_bonificacao_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
        <CardDescription>Filtre as regras de bonificação por critérios específicos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Grid de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Operadora */}
          <div className="space-y-2">
            <Label htmlFor="operadora">Operadora</Label>
            <div className="relative">
              <Select key={`operadora-${filters.operadora}`} value={filters.operadora || undefined} onValueChange={(v) => handleFilterChange("operadora", v)}>
                <SelectTrigger id="operadora">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {OPERADORAS.map((op) => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.operadora && (
                <button
                  onClick={() => handleFilterChange("operadora", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tipo de Faixa */}
          <div className="space-y-2">
            <Label htmlFor="tipo_faixa">Tipo de Faixa</Label>
            <div className="relative">
              <Select key={`tipo_faixa-${filters.tipo_faixa}`} value={filters.tipo_faixa || undefined} onValueChange={(v) => handleFilterChange("tipo_faixa", v)}>
                <SelectTrigger id="tipo_faixa">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_FAIXA.map((faixa) => (
                    <SelectItem key={faixa} value={faixa}>{faixa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.tipo_faixa && (
                <button
                  onClick={() => handleFilterChange("tipo_faixa", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label htmlFor="produto">Produto</Label>
            <div className="relative">
              <Select key={`produto-${filters.produto}`} value={filters.produto || undefined} onValueChange={(v) => handleFilterChange("produto", v)}>
                <SelectTrigger id="produto">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.produto && (
                <button
                  onClick={() => handleFilterChange("produto", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Pagamento por */}
          <div className="space-y-2">
            <Label htmlFor="pagamento_por">Pagamento por</Label>
            <div className="relative">
              <Select key={`pagamento_por-${filters.pagamento_por}`} value={filters.pagamento_por || undefined} onValueChange={(v) => handleFilterChange("pagamento_por", v)}>
                <SelectTrigger id="pagamento_por">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {PAGAMENTO_POR.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.pagamento_por && (
                <button
                  onClick={() => handleFilterChange("pagamento_por", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tipo de Beneficiário */}
          <div className="space-y-2">
            <Label htmlFor="tipo_beneficiario">Tipo de Beneficiário</Label>
            <div className="relative">
              <Select key={`tipo_beneficiario-${filters.tipo_beneficiario}`} value={filters.tipo_beneficiario || undefined} onValueChange={(v) => handleFilterChange("tipo_beneficiario", v)}>
                <SelectTrigger id="tipo_beneficiario">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_BENEFICIARIO.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.tipo_beneficiario && (
                <button
                  onClick={() => handleFilterChange("tipo_beneficiario", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Parcela */}
          <div className="space-y-2">
            <Label htmlFor="parcela">Parcela</Label>
            <div className="relative">
              <Select key={`parcela-${filters.parcela}`} value={filters.parcela || undefined} onValueChange={(v) => handleFilterChange("parcela", v)}>
                <SelectTrigger id="parcela">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {PARCELAS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.parcela && (
                <button
                  onClick={() => handleFilterChange("parcela", "")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Entidade */}
          <div className="space-y-2">
            <Label htmlFor="entidade">Entidade</Label>
            <Input
              id="entidade"
              placeholder="Buscar entidade..."
              value={filters.entidade}
              onChange={(e) => handleFilterChange("entidade", e.target.value)}
            />
          </div>

          {/* Plano */}
          <div className="space-y-2">
            <Label htmlFor="plano">Plano</Label>
            <Input
              id="plano"
              placeholder="Buscar plano..."
              value={filters.plano}
              onChange={(e) => handleFilterChange("plano", e.target.value)}
            />
          </div>

          {/* Vigência Início */}
          <div className="space-y-2">
            <Label htmlFor="vigencia_inicio">Vigência Início</Label>
            <Input
              id="vigencia_inicio"
              type="date"
              value={filters.vigencia_inicio}
              onChange={(e) => handleFilterChange("vigencia_inicio", e.target.value)}
            />
          </div>

        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={clearFilters}>
            Limpar
          </Button>
          <Button onClick={exportToCSV} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Tabela */}
        <div className="border rounded-md overflow-x-auto">
                                           <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ações</TableHead>
                  {data.length > 0 && Object.keys(data[0]).filter(col => col !== 'id' && col !== 'chave').map((column) => (
                    <TableHead key={column}>
                      {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={data.length > 0 ? Object.keys(data[0]).filter(col => col !== 'id' && col !== 'chave').length + 1 : 1} className="text-center py-8">
                      <Search className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Carregando...</p>
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={1} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, idx) => {
                    const rowId = row.id?.toString() || idx.toString()
                    const isEditing = editingRow === rowId
                    
                    return (
                      <TableRow key={rowId}>
                        <TableCell>
                          {!isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(rowId, row)}
                                className="h-8 w-8 p-0"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteRow(row.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEditing}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                title="Salvar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        {Object.entries(row).filter(([key]) => key !== 'id' && key !== 'chave').map(([key, value]) => (
                          <TableCell key={key}>
                            {isEditing ? (
                              key === 'vigencia' ? (
                                <Input
                                  type="date"
                                  value={editedData[key] ? (() => {
                                    try {
                                      const date = new Date(editedData[key])
                                      if (!isNaN(date.getTime())) {
                                        return date.toISOString().split('T')[0]
                                      }
                                      return ''
                                    } catch {
                                      return ''
                                    }
                                  })() : ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    if (value) {
                                      try {
                                        const date = new Date(value)
                                        if (!isNaN(date.getTime())) {
                                          handleCellChange(key, date.toISOString())
                                        }
                                      } catch {
                                        handleCellChange(key, value)
                                      }
                                    } else {
                                      handleCellChange(key, '')
                                    }
                                  }}
                                  className="w-32"
                                />
                              ) : (typeof value === 'number' && key.includes('bonificacao')) ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editedData[key] || value}
                                  onChange={(e) => handleCellChange(key, parseFloat(e.target.value) || 0)}
                                  className="w-24"
                                />
                              ) : key === 'operadora' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {OPERADORAS.map((op) => (
                                      <SelectItem key={op} value={op}>{op}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'tipo_faixa' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPOS_FAIXA.map((faixa) => (
                                      <SelectItem key={faixa} value={faixa}>{faixa}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'produto' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRODUTOS.map((p) => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'pagamento_por' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAGAMENTO_POR.map((p) => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'tipo_beneficiario' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPO_BENEFICIARIO.map((t) => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : key === 'parcela' ? (
                                <Select 
                                  value={editedData[key] || value} 
                                  onValueChange={(v) => handleCellChange(key, v)}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PARCELAS.map((p) => (
                                      <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={editedData[key] || value}
                                  onChange={(e) => handleCellChange(key, e.target.value)}
                                  className="min-w-[150px]"
                                />
                              )
                            ) : (
                              <>
                                {(key === 'vigencia' || key === 'registro') && value ? (() => {
                                  try {
                                    const date = new Date(value as string)
                                    if (!isNaN(date.getTime())) {
                                      return date.toLocaleDateString("pt-BR")
                                    }
                                    return String(value || '')
                                  } catch {
                                    return String(value || '')
                                  }
                                })() : 
                                  (typeof value === 'number' && key.includes('bonificacao')) ? 
                                    `R$ ${value.toFixed(2)}` : 
                                    String(value || '')
                                }
                              </>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {data.length > 0 ? (page - 1) * pageSize + 1 : 0} a {Math.min(page * pageSize, total)} de {total} resultados
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
