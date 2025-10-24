import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-balance">Plataforma de Comissões</h1>
          <p className="text-muted-foreground mt-2">Sistema B2B de gestão de pagamentos</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar na plataforma</CardTitle>
            <CardDescription>Digite suas credenciais para acessar</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
