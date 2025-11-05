"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Award, Plus } from "lucide-react"

export default function BonificacoesPage() {
  const router = useRouter()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bonificações</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie regras de bonificação para corretores e supervisores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push("/admin/bonificacoes/cadastro-de-regras")}>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Cadastro de Regras</CardTitle>
            <CardDescription>
              Cadastre novas regras de bonificação para operadoras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Lista de Regras</CardTitle>
            <CardDescription>
              Visualize e gerencie todas as regras cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Ver Lista
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>
              Acesse relatórios e análises de bonificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Ver Relatórios
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

