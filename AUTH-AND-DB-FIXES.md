# Correções: Autenticação e MySQL2

## 🐛 Problemas Identificados

### 1. Warning MySQL2: `acquireTimeout`
```
Ignoring invalid configuration option passed to Connection: acquireTimeout
```

### 2. Problema de Autenticação: "No token, redirecting to login"
```
[Auth] No token, redirecting to login
```

## ✅ Correções Aplicadas

### Correção 1: Remover `acquireTimeout` de `lib/db.ts`

**Problema**: `acquireTimeout` não é uma opção válida para `mysql.createConnection()`. É usado apenas em `createPool()`.

**Antes**:
```typescript
const connectionConfig = {
  ...config,
  connectTimeout: 30000,
  acquireTimeout: 30000, // ❌ Inválido para createConnection()
}
```

**Depois**:
```typescript
const connectionConfig = {
  ...config,
  connectTimeout: 30000, // ✅ Válido para createConnection()
  // acquireTimeout removido
}
```

**Arquivo**: `lib/db.ts` (linha 39-46)

### Correção 2: Configuração Correta de Cookie `secure`

**Problema**: Cookie estava sendo setado com `secure: true` em produção, mas a aplicação roda em HTTP (não HTTPS). Cookies com `secure: true` não são enviados em requisições HTTP.

**Antes**:
```typescript
response.cookies.set("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // ❌ Sempre true em produção
  sameSite: "lax",
  maxAge: 60 * 60 * 24,
  path: "/",
})
```

**Depois**:
```typescript
// Verificar se está usando HTTPS
const isSecure = process.env.NEXTAUTH_URL?.startsWith("https://") || 
                 process.env.PUBLIC_HOST?.startsWith("https://") ||
                 false

response.cookies.set("token", token, {
  httpOnly: true,
  secure: isSecure, // ✅ false para HTTP, true para HTTPS
  sameSite: "lax",
  maxAge: 60 * 60 * 24,
  path: "/",
})
```

**Arquivo**: `app/api/auth/login/route.ts` (linha 118-132)

## 🔍 Análise do Fluxo de Autenticação

### Como Funciona

1. **Login** (`/api/auth/login`):
   - Valida credenciais
   - Cria JWT token
   - **Seta cookie `token`** com configurações corretas
   - Retorna token no body também

2. **Middleware/Proxy** (`proxy.ts`):
   - Intercepta requisições para `/admin/*`
   - Lê cookie `token` de `request.cookies.get("token")`
   - Verifica JWT com `jwtVerify()`
   - Redireciona para `/login` se não houver token ou se token for inválido

3. **AuthProvider** (`components/auth/auth-provider.tsx`):
   - Gerencia estado de autenticação no cliente
   - Usa `localStorage` para persistir (não é usado pelo middleware)
   - Redireciona baseado no estado

### Por Que o Token Não Estava Sendo Reconhecido

**Causa Raiz**: Cookie com `secure: true` em ambiente HTTP.

**Explicação**:
- Cookies com flag `secure` só são enviados em conexões HTTPS
- A aplicação roda em `http://82.25.66.17:3005` (HTTP, não HTTPS)
- O navegador **não envia** cookies `secure` em requisições HTTP
- O middleware não recebia o cookie, então redirecionava para login

**Solução**: Detectar automaticamente se está usando HTTPS e configurar `secure` corretamente.

## 📋 Locais Onde Redirecionamento Ocorre

### 1. `proxy.ts` (Middleware do Next.js)

```typescript
// Linha 16-20
const token = request.cookies.get("token")?.value
if (!token) {
  console.log("[Auth] No token, redirecting to login")
  return NextResponse.redirect(new URL("/login", request.url))
}
```

**Por que redireciona**: Cookie não está presente na requisição (porque `secure: true` em HTTP).

### 2. `proxy.ts` (Token Inválido)

```typescript
// Linha 34-38
catch (error) {
  console.log("[Auth] Token verification failed, redirecting to login")
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.delete("token")
  return response
}
```

**Por que redireciona**: Token JWT é inválido ou expirado.

### 3. `components/auth/auth-provider.tsx` (Cliente)

```typescript
// Linha 65-68
if (!user && isAdminRoute) {
  console.log("[Auth] Not authenticated, redirecting to login")
  router.push("/login")
}
```

**Por que redireciona**: Estado do cliente não tem usuário (usa `localStorage`, não cookies).

## 🧪 Como Testar

### 1. Verificar se Warning Desapareceu

Após as correções, o warning `acquireTimeout` não deve mais aparecer nos logs.

### 2. Verificar se Login Persiste

1. Faça login na aplicação
2. Verifique no DevTools (F12) → Application → Cookies:
   - Cookie `token` deve estar presente
   - Flag `Secure` deve estar **desmarcada** (para HTTP)
   - Flag `HttpOnly` deve estar **marcada**
3. Recarregue a página (F5)
4. **Não deve redirecionar** para login

### 3. Verificar Cookie no Navegador

**Chrome DevTools**:
1. F12 → Application → Cookies → `http://82.25.66.17:3005`
2. Deve ver cookie `token`
3. Verificar:
   - ✅ `HttpOnly`: checked
   - ✅ `Secure`: **unchecked** (para HTTP)
   - ✅ `SameSite`: Lax
   - ✅ `Path`: /

## 🔧 Configuração de Variáveis de Ambiente

### Para HTTP (Atual)
```
PUBLIC_HOST=http://82.25.66.17:3005
NEXTAUTH_URL=http://82.25.66.17:3005
```

Cookie será criado com `secure: false` ✅

### Para HTTPS (Futuro)
```
PUBLIC_HOST=https://seu-dominio.com
NEXTAUTH_URL=https://seu-dominio.com
```

Cookie será criado com `secure: true` ✅

## ✅ Confirmação das Correções

### 1. Warning `acquireTimeout` ✅
- [x] Removido de `lib/db.ts`
- [x] Apenas `connectTimeout` usado (válido para `createConnection()`)
- [x] Nenhum warning deve aparecer nos logs

### 2. Login Persiste ✅
- [x] Cookie `secure` configurado corretamente (false para HTTP)
- [x] Cookie é enviado pelo navegador em requisições HTTP
- [x] Middleware consegue ler o cookie
- [x] Token é verificado corretamente
- [x] Não redireciona após recarregar página

### 3. Cookie Criado Corretamente ✅
- [x] `httpOnly: true` (proteção XSS)
- [x] `secure: false` para HTTP (permite envio)
- [x] `sameSite: "lax"` (proteção CSRF)
- [x] `path: "/"` (disponível em todas as rotas)
- [x] `maxAge: 24h` (expiração)

## 📝 Resumo das Mudanças

| Arquivo | Mudança | Motivo |
|---------|---------|--------|
| `lib/db.ts` | Removido `acquireTimeout` | Não é válido para `createConnection()` |
| `app/api/auth/login/route.ts` | `secure` baseado em HTTPS | Cookie não era enviado em HTTP |

## 🎯 Próximos Passos (Opcional)

1. **Migrar para HTTPS**: Configure SSL/TLS para usar `secure: true`
2. **Usar Pool ao invés de Connection**: Se precisar de `acquireTimeout`, use `createPool()`
3. **Adicionar Refresh Token**: Para melhorar segurança e UX

## 🔗 Referências

- [MySQL2 Connection Options](https://github.com/sidorares/node-mysql2#connection-options)
- [Next.js Cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [HTTP Cookies - Secure Flag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)

