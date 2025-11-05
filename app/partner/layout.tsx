import type React from "react"
import { PartnerSidebar } from "@/components/partner/partner-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <PartnerSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SidebarProvider>
  )
}

