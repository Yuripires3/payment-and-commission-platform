import { Badge } from "@/components/ui/badge"

const invoices = [
  { id: "INV-001", partner: "Tech Solutions", amount: 12500, status: "approved" },
  { id: "INV-002", partner: "Digital Corp", amount: 8900, status: "pending" },
  { id: "INV-003", partner: "Cloud Systems", amount: 15200, status: "approved" },
  { id: "INV-004", partner: "Data Analytics", amount: 6700, status: "review" },
  { id: "INV-005", partner: "Smart Tech", amount: 9800, status: "approved" },
]

const statusConfig = {
  approved: { label: "Aprovada", variant: "default" as const },
  pending: { label: "Pendente", variant: "secondary" as const },
  review: { label: "Em Revisão", variant: "outline" as const },
}

export function RecentInvoices() {
  return (
    <div className="space-y-4">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{invoice.partner}</p>
            <p className="text-xs text-muted-foreground">{invoice.id}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm font-medium">R$ {invoice.amount.toLocaleString("pt-BR")}</p>
            <Badge variant={statusConfig[invoice.status].variant} className="text-xs">
              {statusConfig[invoice.status].label}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
