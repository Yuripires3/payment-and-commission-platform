"use client"

import { useEffect } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import Image from "next/image"
import QvLogo from "@/logo/qv-beneficios.png"

export default function LoginPage() {
  useEffect(() => {
    // Aplica fundo cinza no body e html com !important
    document.body.style.setProperty('background-color', '#f3f4f6', 'important')
    document.documentElement.style.setProperty('background-color', '#f3f4f6', 'important')
    
    // Cleanup ao desmontar
    return () => {
      document.body.style.removeProperty('background-color')
      document.documentElement.style.removeProperty('background-color')
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f3f4f6' }}>
      <div className="w-full max-w-lg">
        <Card className="rounded-2xl shadow-xl border-2" style={{ borderColor: '#e5e7eb' }}>
          <CardHeader className="px-8 pt-12 pb-8">
            <div className="w-full flex justify-center mb-4">
              <Image src={QvLogo} alt="QV Benefícios" className="w-[120px] h-auto" />
            </div>
            <h1 className="text-1xl font-bold text-center" style={{ color: '#002f67' }}>
            ACESSE O ARI
            </h1>
            <CardDescription className="text-center text-sm text-gray-500 mt-1">
              Plataforma integrada de automações, repasses e indicadores
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-12">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
