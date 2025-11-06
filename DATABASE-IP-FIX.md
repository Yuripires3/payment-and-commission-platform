# Correção: IP do Banco de Dados Não Acessível

## 🚨 Problema Crítico

O container está em `82.25.66.17` (IP público) tentando conectar em `192.168.1.193` (IP privado).

**IPs privados (192.168.x.x, 10.x.x.x, 172.16-31.x.x) NÃO são acessíveis entre servidores diferentes!**

## ✅ Soluções

### Solução 1: MySQL no Mesmo Servidor (82.25.66.17)

Se o MySQL está rodando **no mesmo servidor** que o container:

**No Coolify, configure:**
```
DB_HOST=host.docker.internal
```

Ou se não funcionar:
```
DB_HOST=172.17.0.1
```

**Mantendo os outros valores padrão:**
- `DB_PORT=3306` (já é padrão)
- `DB_USER=Indicadores` (já é padrão)
- `DB_PASSWORD=xEth+vOHltr*c4Eju3+t` (já é padrão)
- `DB_NAME=indicadores` (já é padrão)

### Solução 2: MySQL em Outro Servidor com IP Público

Se o MySQL está em **outro servidor** que tem IP público:

1. **Descubra o IP público do servidor MySQL**
2. **No Coolify, configure:**
```
DB_HOST=<IP_PUBLICO_DO_SERVIDOR_MYSQL>
```

**Exemplo:**
```
DB_HOST=203.0.113.50
```

### Solução 3: MySQL em Outro Servidor (Mesma Rede Privada)

Se o MySQL está em outro servidor na **mesma rede privada**:

1. **Configure VPN ou túnel SSH**
2. **Ou use o IP privado se ambos servidores estão na mesma rede**

**No Coolify:**
```
DB_HOST=192.168.1.193
```

Mas isso só funciona se ambos servidores estão na mesma rede privada!

### Solução 4: Expor MySQL Publicamente (NÃO RECOMENDADO)

⚠️ **ATENÇÃO**: Expor MySQL publicamente é um risco de segurança!

Se realmente precisar:

1. **No servidor MySQL**, configure para aceitar conexões remotas:
```sql
GRANT ALL PRIVILEGES ON indicadores.* TO 'Indicadores'@'%' IDENTIFIED BY 'xEth+vOHltr*c4Eju3+t';
FLUSH PRIVILEGES;
```

2. **Configure MySQL para escutar em todas as interfaces:**
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
bind-address = 0.0.0.0
```

3. **Abra porta 3306 no firewall:**
```bash
sudo ufw allow 3306/tcp
```

4. **Use o IP público do servidor MySQL no Coolify:**
```
DB_HOST=<IP_PUBLICO_DO_SERVIDOR_MYSQL>
```

## 🔍 Como Descobrir o IP Correto

### Se MySQL está no mesmo servidor (82.25.66.17):

```bash
# Teste dentro do container
docker exec -it payment-and-commission-platform sh
ping host.docker.internal
# OU
ping 172.17.0.1
```

### Se MySQL está em outro servidor:

1. **Acesse o servidor MySQL**
2. **Execute:**
```bash
# Ver IPs da máquina
ip addr show
# OU
ifconfig

# Ver IP público (se tiver)
curl ifconfig.me
```

## 📝 Configuração no Coolify

### Opção A: MySQL no Mesmo Servidor

No painel do Coolify, defina apenas:
```
DB_HOST=host.docker.internal
```

Os outros valores já estão como padrão no `docker-compose.yaml`.

### Opção B: MySQL em Outro Servidor

No painel do Coolify, defina:
```
DB_HOST=<IP_PUBLICO_OU_HOSTNAME>
DB_PORT=3306
DB_USER=Indicadores
DB_PASSWORD=xEth+vOHltr*c4Eju3+t
DB_NAME=indicadores
```

## 🧪 Teste de Conexão

Após configurar, teste:

```bash
# Ver logs do container
docker compose logs app | grep -i "database\|mysql\|connection"

# Ou dentro do container
docker exec -it payment-and-commission-platform sh
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME
```

## ⚠️ Importante

1. **O IP `192.168.1.193` NÃO funcionará** se o MySQL está em outro servidor
2. **Use variáveis de ambiente no Coolify** para sobrescrever o `DB_HOST`
3. **Mantenha a senha segura** - considere usar secrets do Coolify
4. **Teste a conectividade** antes de reiniciar o container

## 🎯 Resumo

**Problema**: IP privado `192.168.1.193` não acessível do servidor `82.25.66.17`

**Solução**: Configure `DB_HOST` no Coolify com:
- `host.docker.internal` (se MySQL no mesmo servidor)
- IP público do servidor MySQL (se em outro servidor)
- IP privado (só se ambos na mesma rede privada)

