"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  LogOut,
  Award,
  ChevronRight,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useState } from "react"

const bonificacoesSubmenu = [
  { label: "Cadastro de Regras", href: "/admin/bonificacoes/cadastro-de-regras"},
  { label: "Visualizar Regras", href: "/admin/bonificacoes/visualizar-regras"},
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [isBonificacoesOpen, setIsBonificacoesOpen] = useState(() => 
    pathname.startsWith("/admin/bonificacoes")
  )

  const isBonificacoesActive = pathname.startsWith("/admin/bonificacoes")

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CB</span>
          </div>
          <div>
            <h2 className="font-semibold text-sm">Cálculo de Bonificações</h2>
            <p className="text-xs text-muted-foreground">Admin Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {/* Dashboard */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin"}>
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Bonificações com Submenu */}
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={pathname.startsWith("/admin/bonificacoes")}
              onClick={() => setIsBonificacoesOpen(!isBonificacoesOpen)}
            >
              <Award className="h-4 w-4" />
              <span>Bonificações</span>
              <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${isBonificacoesOpen ? 'rotate-90' : ''}`} />
            </SidebarMenuButton>
            {isBonificacoesOpen && (
              <SidebarMenuSub>
                {bonificacoesSubmenu.map((subItem) => (
                  <SidebarMenuSubItem key={subItem.href}>
                    <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                      <Link href={subItem.href}>
                        <span>{subItem.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>

          {/* Relatórios */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/admin/reports"}>
              <Link href="/admin/reports">
                <BarChart3 className="h-4 w-4" />
                <span>Relatórios</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Administrador</p>
            <p className="text-xs text-muted-foreground truncate">yuri.oliveira@qvsaude.com.br</p>
            <p className="text-xs text-muted-foreground truncate"> Ramal: 2018</p>
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
