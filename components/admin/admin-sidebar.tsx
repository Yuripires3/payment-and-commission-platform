"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  CreditCard,
  Settings,
  BarChart3,
  Shield,
  LogOut,
  Percent,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
  { icon: Package, label: "Produtos", href: "/admin/products" },
  { icon: Percent, label: "Regras de Comissão", href: "/admin/commission-rules" },
  { icon: Users, label: "Parceiros", href: "/admin/partners" },
  { icon: FileText, label: "Faturas", href: "/admin/invoices" },
  { icon: CreditCard, label: "Pagamentos", href: "/admin/payments" },
  { icon: BarChart3, label: "Relatórios", href: "/admin/reports" },
  { icon: Shield, label: "Auditoria", href: "/admin/audit" },
  { icon: Settings, label: "Configurações", href: "/admin/settings" },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CP</span>
          </div>
          <div>
            <h2 className="font-semibold text-sm">Comissões B2B</h2>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={pathname === item.href}>
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Administrador</p>
            <p className="text-xs text-muted-foreground truncate">admin@empresa.com</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full bg-transparent">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
