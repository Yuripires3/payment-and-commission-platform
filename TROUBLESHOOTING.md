# Troubleshooting - Guia de Resolução de Problemas

## 1. Tráfego indo para cPanel (defaultwebpage.cgi)

### Problema
O domínio/IP está caindo no cPanel ao invés de chegar no container.

### Causa
Problema de roteamento/DNS, não é relacionado ao Docker ou Basic Auth.

### Soluções

#### Opção A: Testar acesso direto pela porta
```bash
# Teste direto pelo IP e porta
curl http://<IP_DO_SERVIDOR>:3005

# Se não responder, o problema é de rede/porta
```

#### Opção B: Verificar mapeamento de portas
No `docker-compose.yml`, garanta que a porta está mapeada:
```yaml
ports:
  - "3005:3005"  # externo:interno
```

#### Opção C: Configurar DNS corretamente
- Se usa proxy do Coolify: não mapeie `ports:` no compose, deixe o Coolify gerenciar
- Se usa acesso direto: configure DNS para apontar para o IP do servidor Coolify
- Verifique se o domínio não está apontando para outro servidor (cPanel)

#### Opção D: Liberar porta no firewall
```bash
# Se usar UFW
sudo ufw allow 3005/tcp

# Verificar se a porta está aberta
sudo ufw status
```

## 2. Build do Next.js abortando no Coolify

### Problema
O build para no meio com "Oops something is not okay..." sem erro útil.

### Causas Comuns

#### A) OOM (Out of Memory)
O processo morre silenciosamente por falta de memória.

**Solução aplicada no Dockerfile:**
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=2048"
```

#### B) Turbopack causando crash
O Turbopack (Next.js 16) pode falhar sem stacktrace legível.

**Solução aplicada no Dockerfile:**
```dockerfile
ENV NEXT_USE_TURBOPACK=0
```

### Verificações

1. **Verificar logs do build:**
```bash
docker compose logs app
```

2. **Verificar memória disponível:**
```bash
docker stats
```

3. **Testar build localmente:**
```bash
docker compose build --no-cache
```

## 3. Health Check Failing

### Problema
Container fica "Unhealthy" mesmo com app rodando.

### Solução
O healthcheck está configurado para `/api/health`. Certifique-se de que:
- A rota existe: `app/api/health/route.ts`
- Retorna status 200
- O endpoint está acessível

**Teste manual:**
```bash
curl -f http://localhost:3005/api/health
# Deve retornar: {"ok":true,"status":"ok","timestamp":"..."}
```

## 4. Variáveis de Ambiente não Funcionando

### Problema
Aplicação pede HTTP Basic Authentication mesmo com credenciais configuradas.

### Verificações

1. **Verificar se variáveis estão no container:**
```bash
docker compose exec app printenv | grep -i DB
```

2. **Verificar arquivo .env:**
```bash
cat .env
```

3. **Verificar no Coolify:**
- Acesse "Environment Variables" no painel
- Certifique-se de que todas as variáveis obrigatórias estão configuradas
- Remova espaços extras ou aspas desnecessárias

### Variáveis Obrigatórias
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## 5. Segredos Expostos no Dockerfile

### Problema
Senhas aparecem nos logs ou na imagem Docker.

### Solução
- **NUNCA** use `ARG` para credenciais no Dockerfile
- Use apenas `ENV` para variáveis não-sensíveis
- Configure credenciais via `environment:` no docker-compose ou no Coolify
- Se a senha apareceu nos logs, **rotacione imediatamente**

## 6. Container não inicia

### Verificações

1. **Ver logs:**
```bash
docker compose logs app
```

2. **Verificar se a porta está em uso:**
```bash
lsof -i :3005
# ou
netstat -tulpn | grep 3005
```

3. **Testar build localmente:**
```bash
docker compose build --no-cache
docker compose up
```

## 7. Acesso via IP não funciona

### Checklist

1. Container está rodando?
```bash
docker compose ps
```

2. Porta está mapeada?
```bash
docker compose config | grep ports
```

3. Firewall está bloqueando?
```bash
sudo ufw status
sudo ufw allow 3005/tcp
```

4. Teste interno:
```bash
curl http://localhost:3005/api/health
```

## Comandos Úteis

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f app

# Rebuild completo
docker compose down -v
docker compose build --no-cache
docker compose up -d

# Verificar variáveis de ambiente no container
docker compose exec app printenv

# Testar health check
curl -f http://localhost:3005/api/health

# Acessar shell do container
docker compose exec app sh

# Ver uso de recursos
docker stats
```

## Configurações Aplicadas

### Dockerfile
- ✅ `NODE_OPTIONS="--max-old-space-size=2048"` - Aumenta memória
- ✅ `NEXT_USE_TURBOPACK=0` - Desabilita Turbopack
- ✅ `output: 'standalone'` - Configurado no next.config.mjs
- ✅ Healthcheck configurado para `/api/health`
- ✅ Sem ARG de credenciais (apenas runtime)

### docker-compose.yml
- ✅ Porta 3005 mapeada
- ✅ Healthcheck configurado
- ✅ Variáveis de ambiente configuradas (sem senhas hardcoded)
- ✅ Comando explícito: `node server-start.js`

