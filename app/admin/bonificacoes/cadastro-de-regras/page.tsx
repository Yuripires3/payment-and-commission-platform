"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

const OPERADORAS = [
  "UNIMED RIO",
  "UNIMED NOVA IGUAÇÚ",
  "UNIMED LESTE FLUMINENSE",
  "UNIMED FERJ",
  "SEGUROS UNIMED",
  "ASSIM SAÚDE",
  "HAPVIDA NOTREDAME SP_RJ",
  "NOVA SAUDE",
  "HEALTH-MED",
  "OPLAN SAUDE",
  "ONIX",
  "KLINI",
  "BLUE",
  "AMIL",
  "INFINITY DOCTORS"
]

const TIPOS_FAIXA = [
  "Faixa 01",
  "Faixa 02",
  "Faixa 03",
  "Faixa 04",
  "Faixa 05",
  "Faixa 06",
  "Faixa 07",
  "Faixa 08",
  "Faixa 09",
  "Faixa 10",
  "Faixa 11",
  "Faixa 12",
  "Faixa única"
]

const PRODUTOS = ["ADESAO", "PME"]

const PAGAMENTO_POR = ["Vida", "Contrato"]

const TIPO_BENEFICIARIO = ["Titular", "Dependente"]

const PARCELAS = ["1ª Parcela","2ª Parcela","Única"]

export default function BonificacoesPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    vigencia: "",
    operadora: "",
    entidade: "",
    plano: "",
    bonificacaoCorretor: "",
    bonificacaoSupervisor: "",
    parcela: "",
    tipoFaixa: "",
    pagamentoPor: "",
    tipoBeneficiario: "",
    produto: ""
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validação
      if (!formData.vigencia || !formData.operadora || !formData.entidade || !formData.plano) {
        toast({
          title: "Erro de validação",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive"
        })
        setLoading(false)
        return
      }

      // Preparar dados para envio
      const payload = {
        vigencia: formData.vigencia,
        operadora: formData.operadora,
        entidade: formData.entidade,
        plano: formData.plano,
        // Converter valores monetários: ponto para vírgula
        bonificacaoCorretor: formData.bonificacaoCorretor ? formData.bonificacaoCorretor.replace('.', ',') : "",
        bonificacaoSupervisor: formData.bonificacaoSupervisor ? formData.bonificacaoSupervisor.replace('.', ',') : "",
        parcela: formData.parcela,
        tipoFaixa: formData.tipoFaixa,
        pagamentoPor: formData.pagamentoPor,
        tipoBeneficiario: formData.tipoBeneficiario,
        produto: formData.produto
      }

      console.log("Dados a serem enviados:", payload)

      // Chamada para API
      const response = await fetch('/api/bonificacoes/regras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao registrar bonificação'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log("Resposta da API:", result)

      toast({
        title: "Sucesso!",
        description: `Regra de bonificação registrada com sucesso. Chave: ${result.chave}`
      })

      // Limpar formulário
      setFormData({
        vigencia: "",
        operadora: "",
        entidade: "",
        plano: "",
        bonificacaoCorretor: "",
        bonificacaoSupervisor: "",
        parcela: "",
        tipoFaixa: "",
        pagamentoPor: "",
        tipoBeneficiario: "",
        produto: ""
      })

    } catch (error) {
      console.error("Erro ao registrar:", error)
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao registrar bonificação",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Cadastro de Bonificação</h1>
        <p className="text-muted-foreground mt-1">
          Cadastro e gerenciamento de regras de bonificação para corretores e supervisores
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras de Bonificações</CardTitle>
          <CardDescription>
            Preencha os campos abaixo para registrar uma nova regra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vigência */}
            <div className="space-y-2">
              <Label htmlFor="vigencia">Vigência *</Label>
              <Input
                id="vigencia"
                type="date"
                value={formData.vigencia}
                onChange={(e) => handleChange("vigencia", e.target.value)}
                required
              />
            </div>

            {/* Operadora */}
            <div className="space-y-2">
              <Label htmlFor="operadora">Operadora *</Label>
              <Select 
                value={formData.operadora} 
                onValueChange={(value: string) => handleChange("operadora", value)}
                required
              >
                <SelectTrigger id="operadora">
                  <SelectValue placeholder="Selecione a operadora" />
                </SelectTrigger>
                <SelectContent>
                  {OPERADORAS.map((operadora) => (
                    <SelectItem key={operadora} value={operadora}>
                      {operadora}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid: Entidade e Plano */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entidade">Entidade *</Label>
                <Input
                  id="entidade"
                  value={formData.entidade}
                  onChange={(e) => handleChange("entidade", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plano">Plano *</Label>
                <Input
                  id="plano"
                  value={formData.plano}
                  onChange={(e) => handleChange("plano", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Grid: Bonificações */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bonificacaoCorretor">Bonificação Corretor (R$)</Label>
                <Input
                  id="bonificacaoCorretor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonificacaoCorretor}
                  onChange={(e) => handleChange("bonificacaoCorretor", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonificacaoSupervisor">Bonificação Supervisor (R$)</Label>
                <Input
                  id="bonificacaoSupervisor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonificacaoSupervisor}
                  onChange={(e) => handleChange("bonificacaoSupervisor", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Parcela */}
            <div className="space-y-2">
              <Label htmlFor="parcela">Parcela</Label>
              <Select 
                value={formData.parcela} 
                onValueChange={(value: string) => handleChange("parcela", value)}
              >
                <SelectTrigger id="parcela">
                  <SelectValue placeholder="Selecione a parcela" />
                </SelectTrigger>
                <SelectContent>
                  {PARCELAS.map((parcela) => (
                    <SelectItem key={parcela} value={parcela}>
                      {parcela}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Faixa */}
            <div className="space-y-2">
              <Label htmlFor="tipoFaixa">Tipo de Faixa</Label>
              <Select 
                value={formData.tipoFaixa} 
                onValueChange={(value: string) => handleChange("tipoFaixa", value)}
              >
                <SelectTrigger id="tipoFaixa">
                  <SelectValue placeholder="Selecione o tipo de faixa" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_FAIXA.map((faixa) => (
                    <SelectItem key={faixa} value={faixa}>
                      {faixa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid: Pagamento por e Tipo de Beneficiário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pagamentoPor">Pagamento por</Label>
                <Select 
                  value={formData.pagamentoPor} 
                  onValueChange={(value: string) => handleChange("pagamentoPor", value)}
                >
                  <SelectTrigger id="pagamentoPor">
                    <SelectValue placeholder="Selecione o tipo de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGAMENTO_POR.map((pagamento) => (
                      <SelectItem key={pagamento} value={pagamento}>
                        {pagamento}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipoBeneficiario">Tipo de Beneficiário</Label>
                <Select 
                  value={formData.tipoBeneficiario} 
                  onValueChange={(value: string) => handleChange("tipoBeneficiario", value)}
                >
                  <SelectTrigger id="tipoBeneficiario">
                    <SelectValue placeholder="Selecione o tipo de beneficiário" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_BENEFICIARIO.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Produto */}
            <div className="space-y-2">
              <Label htmlFor="produto">Produto</Label>
              <Select 
                value={formData.produto} 
                onValueChange={(value: string) => handleChange("produto", value)}
              >
                <SelectTrigger id="produto">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTOS.map((produto) => (
                    <SelectItem key={produto} value={produto}>
                      {produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão Submit */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    vigencia: "",
                    operadora: "",
                    entidade: "",
                    plano: "",
                    bonificacaoCorretor: "",
                    bonificacaoSupervisor: "",
                    parcela: "",
                    tipoFaixa: "",
                    pagamentoPor: "",
                    tipoBeneficiario: "",
                    produto: ""
                  })
                }}
                disabled={loading}
              >
                Limpar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
