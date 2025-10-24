import { ProductsTable } from "@/components/admin/products-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function ProductsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de produtos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <ProductsTable />
    </div>
  )
}
