const sales = [
  { id: "VND-001", product: "Software Enterprise", amount: 5000, commission: 500, date: "28/12/2024" },
  { id: "VND-002", product: "Consultoria Premium", amount: 8000, commission: 800, date: "27/12/2024" },
  { id: "VND-003", product: "Licença Cloud", amount: 3500, commission: 350, date: "26/12/2024" },
  { id: "VND-004", product: "Suporte Técnico", amount: 2000, commission: 200, date: "25/12/2024" },
  { id: "VND-005", product: "Treinamento", amount: 1500, commission: 150, date: "24/12/2024" },
]

export function RecentSales() {
  return (
    <div className="space-y-4">
      {sales.map((sale) => (
        <div key={sale.id} className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{sale.product}</p>
            <p className="text-xs text-muted-foreground">
              {sale.id} • {sale.date}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm font-medium text-success">+R$ {sale.commission}</p>
            <p className="text-xs text-muted-foreground">de R$ {sale.amount.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

