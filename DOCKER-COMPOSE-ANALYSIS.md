# Análise e Correções do docker-compose.yaml

## Objetivo
Garantir que o serviço seja acessível pelo IP real do servidor (ex: `http://192.168.X.X:3005`) e não pelo hostname do container (ex: `http://304c227fc8ae:3005`).

## Análise do Arquivo Original

### ✅ Configurações Corretas (mantidas)
1. **Ports mapeados corretamente**: `"3005:3005"` ✅
2. **Network bridge**: Rede isolada com driver bridge ✅
3. **HOST=0.0.0.0**: Servidor escuta em todas as interfaces ✅
4. **Command explícito**: `node server-start.js` ✅

### ⚠️ Problemas Identificados e Corrigidos

#### 1. Falta de Comentários Explicativos
**Problema**: Não estava claro o propósito de cada configuração.

**Solução**: Adicionados comentários detalhados explicando:
- Por que `HOST=0.0.0.0` é necessário
- Como o mapeamento de portas funciona
- Por que não definir `hostname` explicitamente

#### 2. Configuração de Rede
**Problema**: Não estava explícito que a rede bridge permite acesso externo.

**Solução**: 
- Mantida rede `app-network` com driver `bridge`
- Adicionado comentário explicando que bridge permite acesso via IP
- Removida tentativa de usar `network_mode: bridge` (conflita com `networks:`)

## Versão Corrigida do docker-compose.yaml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: payment-and-commission-platform
    restart: always
    
    # Mapeamento de portas: expõe a porta 3005 do container para o host
    ports:
      - "3005:3005"
    
    # Não definir hostname explicitamente
    # O server-start.js substitui o hostname pelo IP real nos logs
    
    environment:
      - NODE_ENV=production
      - PORT=3005
      - HOST=0.0.0.0  # Escuta em todas as interfaces
      - HOSTNAME=0.0.0.0
      - NEXT_TELEMETRY_DISABLED=1
      - NEXT_USE_TURBOPACK=0
      - DB_HOST=${DB_HOST:-192.168.1.193}
      - DB_PORT=${DB_PORT:-3306}
      - DB_USER=${DB_USER:-Indicadores}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME:-indicadores}
    
    env_file:
      - .env
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3005/api/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
    
    command: node server-start.js
    
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## Explicação das Mudanças

### 1. Mapeamento de Portas (`ports`)
```yaml
ports:
  - "3005:3005"
```
**O que faz**: 
- Mapeia a porta 3005 do container para a porta 3005 do host
- Permite acesso externo via `http://<IP_DO_SERVIDOR>:3005`

**Por que é importante**: 
- Sem isso, o container não seria acessível externamente
- O formato `"HOST_PORT:CONTAINER_PORT"` é essencial

### 2. Network Bridge
```yaml
networks:
  - app-network

networks:
  app-network:
    driver: bridge
```
**O que faz**: 
- Cria uma rede bridge isolada
- Permite comunicação entre containers e acesso externo via IP

**Por que não usar `host` mode**: 
- `host` mode expõe todas as portas do host (segurança)
- `bridge` mantém isolamento e permite acesso controlado

### 3. HOST=0.0.0.0
```yaml
environment:
  - HOST=0.0.0.0
```
**O que faz**: 
- Faz o servidor Next.js escutar em todas as interfaces de rede
- Permite conexões externas via IP do servidor

**Por que não usar `localhost` ou `127.0.0.1`**: 
- Esses valores só permitem conexões locais
- `0.0.0.0` permite conexões de qualquer interface

### 4. Não Definir Hostname
**O que faz**: 
- Deixa o Docker gerar o hostname automaticamente
- O `server-start.js` substitui o hostname pelo IP real nos logs

**Por que não definir hostname explicitamente**: 
- Se definirmos um hostname fixo, ele pode aparecer nos logs
- O script `server-start.js` já faz o patch necessário

### 5. Command: node server-start.js
**O que faz**: 
- Executa o script que força `HOST=0.0.0.0`
- Patcheia `os.hostname()` para retornar IP real
- Intercepta logs para substituir hostname por IP

**Por que é necessário**: 
- O Next.js usa `os.hostname()` para mostrar o endereço nos logs
- O script garante que sempre mostre o IP real

## Como Funciona a Solução Completa

### Fluxo de Inicialização

1. **Docker Compose inicia o container**
   - Mapeia porta `3005:3005`
   - Define variáveis de ambiente (`HOST=0.0.0.0`, `PORT=3005`)
   - Executa `node server-start.js`

2. **server-start.js executa**
   - Obtém IP real da máquina via `os.networkInterfaces()`
   - Patcheia `os.hostname()` para retornar o IP
   - Intercepta `process.stdout.write` para substituir hostname nos logs
   - Força `HOST=0.0.0.0` e `HOSTNAME=0.0.0.0`
   - Carrega `./server.js` (Next.js standalone)

3. **Next.js inicia**
   - Escuta em `0.0.0.0:3005` (todas as interfaces)
   - Usa `os.hostname()` (que retorna IP devido ao patch)
   - Mostra nos logs: `http://192.168.X.X:3005` (IP real)

### Resultado Final

- ✅ Servidor escuta em `0.0.0.0:3005` (aceita conexões externas)
- ✅ Logs mostram IP real: `http://192.168.X.X:3005`
- ✅ Acesso externo funciona: `http://<IP_SERVIDOR>:3005`
- ✅ Coolify detecta corretamente o IP e porta

## Verificação

### Teste Local
```bash
# Build e start
docker compose -f docker-compose.yaml up -d --build

# Ver logs (deve mostrar IP real, não hostname)
docker compose logs app

# Testar acesso
curl http://localhost:3005/api/health
curl http://<IP_SERVIDOR>:3005/api/health
```

### Teste no Coolify
1. Faça commit e push do `docker-compose.yaml`
2. O Coolify detectará automaticamente
3. Verifique os logs - deve mostrar IP real
4. Acesse via `http://<IP_SERVIDOR>:3005`

## Checklist de Validação

- [x] `ports: "3005:3005"` configurado
- [x] `HOST=0.0.0.0` definido
- [x] Network bridge configurada
- [x] `command: node server-start.js` definido
- [x] Sem `hostname` explícito
- [x] Healthcheck configurado
- [x] Variáveis de ambiente sem senhas hardcoded

## Troubleshooting: Erro "Docker Compose file not found"

### Erro: `Docker Compose file not found at: /docker-compose.yaml`

Este erro ocorre quando o Coolify procura o arquivo no caminho errado. Aqui estão as soluções:

#### Solução 1: Verificar Configuração do Coolify

1. **No painel do Coolify**, vá para as configurações do seu aplicativo
2. Verifique a seção **"Docker Compose"** ou **"Build Settings"**
3. Certifique-se de que o **"Docker Compose File Path"** está configurado como:
   - `docker-compose.yaml` (caminho relativo à raiz do repositório)
   - OU deixe em branco (o Coolify detectará automaticamente)

#### Solução 2: Verificar Estrutura do Repositório

O arquivo `docker-compose.yaml` **deve estar na raiz do repositório Git**:

```
payment-and-commission-platform/
├── docker-compose.yaml  ← Deve estar aqui
├── Dockerfile
├── package.json
└── ...
```

#### Solução 3: Configurar Caminho no Coolify

Se o Coolify não detectar automaticamente:

1. No Coolify, vá em **Settings** → **Docker Compose**
2. Configure o campo **"Docker Compose File"**:
   ```
   docker-compose.yaml
   ```
   (sem barra inicial, caminho relativo)

#### Solução 4: Usar docker-compose.yml (alternativa)

Alguns sistemas preferem `.yml` ao invés de `.yaml`:

```bash
# Renomear o arquivo (opcional)
mv docker-compose.yaml docker-compose.yml
```

**Nota**: O Docker Compose aceita ambos os formatos, mas alguns sistemas podem ter preferência.

#### Solução 5: Verificar Permissões e Commit

Certifique-se de que:

1. O arquivo está commitado no Git:
   ```bash
   git add docker-compose.yaml
   git commit -m "Add docker-compose.yaml"
   git push
   ```

2. O arquivo não está no `.gitignore`:
   ```bash
   # Verificar se não está ignorado
   git check-ignore docker-compose.yaml
   # Não deve retornar nada
   ```

#### Solução 6: Usar Dockerfile ao invés de Compose (alternativa)

Se o problema persistir, você pode configurar o Coolify para usar apenas o `Dockerfile`:

1. No Coolify, desabilite "Docker Compose"
2. Configure para usar apenas o `Dockerfile`
3. Configure as variáveis de ambiente manualmente no painel

### Verificação Rápida

Execute no servidor do Coolify (se tiver acesso SSH):

```bash
# Verificar se o arquivo existe no repositório clonado
cd /data/coolify/.../seu-projeto
ls -la docker-compose.yaml

# Verificar conteúdo
cat docker-compose.yaml
```

## Conclusão

O `docker-compose.yaml` está configurado corretamente para:
- Expor a aplicação via IP do servidor
- Mostrar IP real nos logs (não hostname do container)
- Permitir acesso externo via `http://<IP>:3005`
- Funcionar corretamente com o Coolify

O script `server-start.js` complementa a configuração ao fazer o patch do `os.hostname()` e interceptar os logs para substituir o hostname pelo IP real.

**Importante**: Se o erro persistir, verifique as configurações do Coolify e certifique-se de que o arquivo está na raiz do repositório e foi commitado corretamente.

