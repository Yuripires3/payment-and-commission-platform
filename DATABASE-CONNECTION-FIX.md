# Correção: Erro de Conexão com Banco de Dados (ETIMEDOUT)

## 🐛 Problema

O container está tentando conectar em `192.168.1.193:3306` (IP privado), mas o servidor está em `82.25.66.17` (IP público). IPs privados não são acessíveis entre servidores diferentes.

**Erro**:
```
[Auth] Login error: Error: connect ETIMEDOUT
```

## 🔍 Diagnóstico

1. **Container está em**: `82.25.66.17` (servidor de hospedagem)
2. **Tentando conectar em**: `192.168.1.193:3306` (IP privado)
3. **Problema**: IP privado não é acessível de outro servidor

## ✅ Soluções

### Solução 1: Banco no Mesmo Servidor (Recomendado)

Se o MySQL está no **mesmo servidor** que o container:

1. **Usar `host.docker.internal`** (Docker Desktop) ou **IP do host**
2. **Ou usar o IP da interface Docker bridge**

No `docker-compose.yaml`:
```yaml
environment:
  - DB_HOST=host.docker.internal  # Docker Desktop
  # OU
  - DB_HOST=172.17.0.1  # IP padrão do Docker bridge
  # OU
  - DB_HOST=82.25.66.17  # Se MySQL está acessível no IP público
```

### Solução 2: Banco em Servidor Diferente (Acesso Remoto)

Se o MySQL está em **outro servidor**, precisa ser acessível:

#### Opção A: MySQL com IP Público

1. **Configure o MySQL para aceitar conexões remotas**:
```sql
-- No servidor MySQL
GRANT ALL PRIVILEGES ON indicadores.* TO 'Indicadores'@'%' IDENTIFIED BY 'senha';
FLUSH PRIVILEGES;
```

2. **Configure o firewall** para permitir porta 3306:
```bash
# No servidor MySQL
sudo ufw allow 3306/tcp
# OU
sudo iptables -A INPUT -p tcp --dport 3306 -j ACCEPT
```

3. **Configure o MySQL para escutar em todas as interfaces**:
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
bind-address = 0.0.0.0
```

4. **Use o IP público do servidor MySQL** no `docker-compose.yaml`:
```yaml
environment:
  - DB_HOST=<IP_PUBLICO_DO_SERVIDOR_MYSQL>
```

#### Opção B: VPN ou Tunnel SSH

Se o MySQL não pode ser exposto publicamente:

1. **Crie um túnel SSH**:
```bash
ssh -L 3306:localhost:3306 user@servidor-mysql
```

2. **Use `localhost` no container**:
```yaml
environment:
  - DB_HOST=localhost
```

### Solução 3: Usar Variáveis de Ambiente no Coolify (Recomendado)

**NUNCA** coloque senhas hardcoded no `docker-compose.yaml`!

1. **No Coolify**, configure as variáveis de ambiente:
   - `DB_HOST` = IP público ou hostname do MySQL
   - `DB_PORT` = 3306
   - `DB_USER` = Indicadores
   - `DB_PASSWORD` = sua senha
   - `DB_NAME` = indicadores

2. **No `docker-compose.yaml`**, use apenas variáveis:
```yaml
environment:
  - DB_HOST=${DB_HOST}
  - DB_PORT=${DB_PORT:-3306}
  - DB_USER=${DB_USER}
  - DB_PASSWORD=${DB_PASSWORD}
  - DB_NAME=${DB_NAME}
```

## 🔧 Correção Imediata

### Passo 1: Remover Senha Hardcoded

**NUNCA** coloque senhas no código! Use variáveis de ambiente.

### Passo 2: Identificar IP Correto do MySQL

**Perguntas**:
1. O MySQL está no mesmo servidor que o container? (`82.25.66.17`)
2. O MySQL tem IP público acessível?
3. O MySQL está em outro servidor na mesma rede privada?

### Passo 3: Configurar no Coolify

No painel do Coolify, defina:
```
DB_HOST=<IP_CORRETO_DO_MYSQL>
DB_PORT=3306
DB_USER=Indicadores
DB_PASSWORD=<SUA_SENHA>
DB_NAME=indicadores
```

### Passo 4: Testar Conexão

```bash
# Do servidor onde está o container
mysql -h <IP_DO_MYSQL> -u Indicadores -p indicadores

# Se conectar, o problema é apenas configuração
# Se não conectar, verifique firewall e configuração do MySQL
```

## 📝 Checklist

- [ ] Remover senha hardcoded do `docker-compose.yaml`
- [ ] Identificar IP correto do MySQL
- [ ] Configurar variáveis de ambiente no Coolify
- [ ] Verificar se MySQL aceita conexões remotas
- [ ] Verificar firewall (porta 3306 aberta)
- [ ] Testar conexão manualmente
- [ ] Reiniciar container após mudanças

## ⚠️ Segurança

1. **NUNCA** coloque senhas em arquivos versionados
2. **SEMPRE** use variáveis de ambiente
3. **CONSIDERE** usar SSL/TLS para conexão MySQL
4. **RESTRINJA** acesso MySQL por IP (firewall)

## 🔗 Referências

- [MySQL Remote Access](https://dev.mysql.com/doc/refman/8.0/en/remote-access.html)
- [Docker Networking](https://docs.docker.com/network/)
- [Coolify Environment Variables](https://coolify.io/docs)

