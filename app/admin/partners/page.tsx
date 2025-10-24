import { PartnersTable } from "@/components/admin/partners-table"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function PartnersPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Parceiros</h1>
          <p className="text-muted-foreground mt-1">Gerencie a rede de parceiros</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Parceiro
        </Button>
      </div>

      <PartnersTable />
    </div>
  )
}
