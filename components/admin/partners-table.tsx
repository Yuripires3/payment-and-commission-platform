"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MoreHorizontal, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const partners = [
  {
    id: 1,
    name: "Tech Solutions Ltda",
    email: "contato@techsolutions.com",
    tier: "gold",
    sales: 125000,
    status: "active",
  },
  { id: 2, name: "Digital Corp", email: "vendas@digitalcorp.com", tier: "silver", sales: 89000, status: "active" },
  { id: 3, name: "Cloud Systems", email: "info@cloudsystems.com", tier: "platinum", sales: 215000, status: "active" },
  {
    id: 4,
    name: "Data Analytics",
    email: "contato@dataanalytics.com",
    tier: "bronze",
    sales: 45000,
    status: "pending",
  },
  { id: 5, name: "Smart Tech", email: "vendas@smarttech.com", tier: "silver", sales: 98000, status: "active" },
]

const tierColors = {
  platinum: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  gold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  silver: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  bronze: "bg-orange-500/10 text-orange-500 border-orange-500/20",
}

export function PartnersTable() {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parceiro</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Vendas Totais</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{partner.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{partner.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{partner.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className={tierColors[partner.tier]}>
                  {partner.tier.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>R$ {partner.sales.toLocaleString("pt-BR")}</TableCell>
              <TableCell>
                <Badge variant={partner.status === "active" ? "default" : "secondary"}>
                  {partner.status === "active" ? "Ativo" : "Pendente"}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
