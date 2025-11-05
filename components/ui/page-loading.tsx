"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"

// Evento customizado para sinalizar que a página terminou de carregar
const PAGE_LOADED_EVENT = 'page-loaded'

export function PageLoading() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)

  useEffect(() => {
    // Detecta cliques em links para mostrar loading imediatamente
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href]')
      if (link) {
        const href = link.getAttribute('href')
        if (href && href.startsWith('/') && href !== pathname) {
          setLoading(true)
        }
      }
    }

    // Escuta evento de página carregada
    const handlePageLoaded = () => {
      // Aguarda 12 segundos após o carregamento completo antes de esconder
      setTimeout(() => {
        setLoading(false)
      }, 12000) // 12 segundos = 12000ms
    }

    document.addEventListener('click', handleClick)
    window.addEventListener(PAGE_LOADED_EVENT, handlePageLoaded)

    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener(PAGE_LOADED_EVENT, handlePageLoaded)
    }
  }, [pathname])

  useEffect(() => {
    // Detecta mudança de rota
    if (pathname !== prevPathname) {
      setLoading(true)
      setPrevPathname(pathname)
      
      // Timeout de segurança - sempre esconde após um tempo máximo
      // Deve ser maior que o delay de 12 segundos após carregamento completo
      const safetyTimeout = setTimeout(() => {
        setLoading(false)
      }, 20000) // Máximo 20 segundos (12s de delay + margem de segurança)
      
      return () => {
        clearTimeout(safetyTimeout)
      }
    } else {
      // Se não mudou, garante que não está em loading
      setLoading(false)
    }
  }, [pathname, prevPathname])

  // Mostra loading durante a transição
  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  )
}

// Função helper para páginas sinalizarem que terminaram de carregar
export function signalPageLoaded() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAGE_LOADED_EVENT))
  }
}

