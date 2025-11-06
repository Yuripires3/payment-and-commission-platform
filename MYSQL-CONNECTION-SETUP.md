# Configuração de Conexão MySQL - Servidor "sql"

## 📋 Informações do Banco

- **Hostname**: `sql`
- **IP**: `192.168.1.193`
- **Porta**: `3306`
- **Usuário**: `Indicadores`
- **Database**: `indicadores`

## 🔍 Diagnóstico da Situação

O container está em `82.25.66.17` (IP público) e precisa conectar em `sql` (`192.168.1.193`, IP privado).

**Cenários possíveis:**

### Cenário 1: Ambos na mesma rede privada ✅

Se o servidor `82.25.66.17` e o servidor `sql` (`192.168.1.193`) estão na **mesma rede privada** (mesma VPN, mesma infraestrutura):

**Solução**: Use o hostname `sql` ou o IP `192.168.1.193`

**No Coolify, configure:**
```
DB_HOST=sql
```

Ou:
```
DB_HOST=192.168.1.193
```

### Cenário 2: Servidores em redes diferentes ❌

Se estão em **redes diferentes**, o IP privado não funcionará.

**Soluções:**

#### Opção A: Usar IP Público do Servidor MySQL

1. **Descubra o IP público do servidor `sql`**
2. **No Coolify, configure:**
```
DB_HOST=<IP_PUBLICO_DO_SERVIDOR_SQL>
```

#### Opção B: Configurar DNS/Hostname Público

Se o servidor `sql` tem um hostname público:

**No Coolify:**
```
DB_HOST=sql.exemplo.com
```

#### Opção C: VPN ou Túnel SSH

Configure VPN ou túnel SSH entre os servidores.

## ✅ Configuração no Coolify

### Se na mesma rede privada:

No painel do Coolify, defina:
```
DB_HOST=sql
```

Os outros valores já estão como padrão:
- `DB_PORT=3306`
- `DB_USER=Indicadores`
- `DB_PASSWORD=xEth+vOHltr*c4Eju3+t`
- `DB_NAME=indicadores`

### Se em redes diferentes:

1. **Descubra o IP público ou hostname do servidor `sql`**
2. **No Coolify, configure:**
```
DB_HOST=<IP_PUBLICO_OU_HOSTNAME>
DB_PORT=3306
DB_USER=Indicadores
DB_PASSWORD=xEth+vOHltr*c4Eju3+t
DB_NAME=indicadores
```

## 🧪 Teste de Conectividade

### Teste 1: Do servidor onde está o container

```bash
# Teste se consegue resolver o hostname
ping sql

# Teste se consegue acessar a porta
telnet sql 3306
# OU
nc -zv sql 3306
```

### Teste 2: Do container

```bash
# Acesse o container
docker exec -it payment-and-commission-platform sh

# Teste conexão MySQL
mysql -h sql -u Indicadores -pxEth+vOHltr*c4Eju3+t indicadores

# OU teste com IP
mysql -h 192.168.1.193 -u Indicadores -pxEth+vOHltr*c4Eju3+t indicadores
```

### Teste 3: Verificar logs do container

```bash
docker compose logs app | grep -i "database\|mysql\|connection\|ETIMEDOUT"
```

## 🔧 Resolução de Problemas

### Erro: `ETIMEDOUT` ou `ECONNREFUSED`

**Causa**: Servidor MySQL não acessível da rede do container.

**Soluções:**
1. Verifique se ambos servidores estão na mesma rede privada
2. Verifique firewall (porta 3306 deve estar aberta)
3. Verifique se MySQL aceita conexões remotas
4. Use IP público se disponível

### Erro: `ENOTFOUND` (hostname não resolve)

**Causa**: Hostname `sql` não resolve na rede do container.

**Soluções:**
1. Use o IP diretamente: `DB_HOST=192.168.1.193`
2. Configure DNS no servidor
3. Use IP público se disponível

### Erro: `Access denied`

**Causa**: Credenciais incorretas ou usuário sem permissão.

**Soluções:**
1. Verifique usuário e senha
2. Verifique se o usuário tem permissão para conectar remotamente:
```sql
-- No servidor MySQL
SELECT user, host FROM mysql.user WHERE user = 'Indicadores';
```

## 📝 Checklist

- [ ] Identificar se servidores estão na mesma rede privada
- [ ] Testar conectividade: `ping sql` ou `ping 192.168.1.193`
- [ ] Testar porta: `telnet sql 3306`
- [ ] Configurar `DB_HOST` no Coolify
- [ ] Reiniciar container após configurar
- [ ] Verificar logs do container
- [ ] Testar login na aplicação

## 🎯 Resumo

**Configuração atual no docker-compose.yaml:**
- `DB_HOST=${DB_HOST:-sql}` (usa hostname "sql" por padrão)

**Ação necessária:**
1. **Se na mesma rede privada**: Configure `DB_HOST=sql` no Coolify
2. **Se em redes diferentes**: Descubra IP público/hostname e configure no Coolify

**Teste primeiro:**
```bash
# Do servidor 82.25.66.17
ping sql
telnet sql 3306
```

Se funcionar, use `DB_HOST=sql` no Coolify.
Se não funcionar, você precisa do IP público ou hostname do servidor `sql`.

