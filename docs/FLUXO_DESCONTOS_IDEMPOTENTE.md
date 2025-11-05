# Fluxo de Descontos Idempotente e Transacional

## Visão Geral

Este documento descreve o sistema idempotente e transacional de gerenciamento de descontos de bonificação, projetado para permitir reexecuções no mesmo dia sem duplicar nem apagar descontos válidos.

## Princípios Fundamentais

1. **Idempotência**: Reexecuções com mesmo resultado não criam duplicatas
2. **Transacionalidade**: Operações são atômicas e consistentes
3. **Proteção contra cancelamentos**: Cancelar/sair da tela só afeta staging da execução corrente
4. **Ledger/Compensação**: Ajustes são feitos via lançamentos de compensação, nunca DELETE

## Arquitetura

### Modelo de Dados

#### Tabela `registro_bonificacao_descontos`

Campos principais:
- `id` (PK)
- `run_id` VARCHAR(36) - UUID da execução
- `session_id` VARCHAR(64) - ID da sessão/UI
- `usuario_id` BIGINT - ID do usuário
- `dt_referencia` DATE - Data de referência (escopo do dia)
- `status` ENUM('staging','finalizado','cancelado') - Status do registro
- `is_active` BOOLEAN - Ativo apenas após finalização
- `chave_negocio` TEXT - Chave natural única do desconto
- `valor` NUMERIC(16,2)
- `parent_id` BIGINT NULL - Linka compensações ao lançamento anterior
- `finalizado_at` TIMESTAMP NULL
- `canceled_at` TIMESTAMP NULL

#### Tabelas Auxiliares

- `locks_calculo`: Controle de concorrência por `dt_referencia`
- `calculo_sessions`: Sessões ativas para heartbeat/timeout

## Fluxo de Operações

### 1. Iniciar Cálculo (`POST /api/bonificacoes/calculo/iniciar`)

**Parâmetros:**
```json
{
  "dt_referencia": "2024-01-15",
  "usuario_id": 123,
  "session_id": "session_abc123"
}
```

**Comportamento:**
1. Gera `run_id` (UUID)
2. Tenta adquirir lock por `dt_referencia` (bloqueia se outro usuário está calculando)
3. Registra sessão ativa
4. Retorna `run_id` para uso no script Python

**Resposta:**
```json
{
  "success": true,
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Execução iniciada..."
}
```

### 2. Script Python Insere em Staging

O script Python deve:
1. Receber `run_id` e `session_id` do endpoint `/calculo/iniciar`
2. Inserir descontos com `status='staging'`, `is_active=FALSE`
3. Gerar `chave_negocio` para cada desconto
4. Incluir `run_id`, `session_id`, `dt_referencia` em cada registro

**Exemplo de inserção:**
```sql
INSERT INTO registro_bonificacao_descontos
(run_id, session_id, usuario_id, dt_referencia, status, is_active, 
 chave_negocio, dt_movimentacao, cpf, nome, valor, dt_apuracao, 
 tipo_movimentacao, origem)
VALUES
(?, ?, ?, ?, 'staging', FALSE, ?, ?, ?, ?, ?, ?, ?, 'script_python')
```

### 3. Finalizar Cálculo (`POST /api/bonificacoes/calculo/finalizar`)

**Parâmetros:**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "usuario_id": 123
}
```

**Lógica de Promoção:**

Para cada desconto em staging do `run_id`:

1. **Se não existe finalizado ativo para a chave:**
   - Promove staging → `status='finalizado'`, `is_active=TRUE`

2. **Se existe e valor igual (idempotente):**
   - Cancela staging, mantém finalizado intacto

3. **Se existe e valor diferente (ajuste):**
   - Cria lançamento de compensação (negativo) com `parent_id` apontando para o anterior
   - Promove staging para finalizado com novo valor
   - Desativa lançamento anterior (`is_active=FALSE`)

**Resposta:**
```json
{
  "success": true,
  "message": "Cálculo finalizado com sucesso",
  "stats": {
    "total_promovidos": 10,
    "total_compensados": 2,
    "total_ignorados": 5,
    "difs": [...]
  }
}
```

### 4. Cancelar Cálculo (`POST /api/bonificacoes/calculo/cancelar`)

**Parâmetros:**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Comportamento:**
- Marca apenas registros `status='staging'` do `run_id` como `cancelado`
- **NUNCA** toca em registros `finalizado`
- Libera lock e remove sessão

### 5. Limpeza Automática (`POST /api/bonificacoes/calculo/cleanup-staging`)

**Job Cron (a cada 15 minutos):**

- Busca sessões sem heartbeat há mais de 30 minutos
- Cancela staging dessas sessões
- Libera locks expirados

**Autenticação:** Via header `Authorization: Bearer <CLEANUP_TOKEN>`

## Geração de Chave de Negócio

A chave de negócio é gerada pela função `gerarChaveNegocio()`:

```typescript
chave_negocio = dt_referencia|cpf|proposta|tipo_movimentacao|operadora|entidade|parcela
```

Esta chave garante unicidade dentro de uma `dt_referencia`.

## Regras de Negócio

### Proibições

1. **NUNCA** fazer `DELETE` em registros `finalizado`
2. **NUNCA** alterar `finalizado` diretamente
3. **NUNCA** excluir staging de outros `run_id`

### Permissões

1. Cancelar apenas staging do `run_id` corrente
2. Promover staging para finalizado apenas via endpoint `/finalizar`
3. Ajustes via compensação (ledger)

## Consultas e Relatórios

Todas as consultas devem filtrar apenas:
```sql
WHERE status = 'finalizado' AND is_active = TRUE
```

Isso garante que:
- Staging não aparece em relatórios
- Cancelados não aparecem
- Apenas registros válidos são considerados

## Exemplo de Fluxo Completo

### Cenário 1: Primeira Execução

1. Usuário inicia cálculo → `run_id = "abc123"`
2. Script Python insere 10 descontos em staging
3. Usuário finaliza → 10 descontos promovidos para finalizado
4. Resultado: 10 descontos ativos

### Cenário 2: Reexecução Idêntica

1. Usuário inicia novo cálculo → `run_id = "def456"`
2. Script Python insere 10 descontos (mesmos valores) em staging
3. Usuário finaliza → 10 staging ignorados (idempotente)
4. Resultado: 10 descontos ativos (mesmos do cenário 1)

### Cenário 3: Reexecução com Ajuste

1. Usuário inicia novo cálculo → `run_id = "ghi789"`
2. Script Python insere 10 descontos, 2 com valores diferentes
3. Usuário finaliza:
   - 8 staging ignorados (valores iguais)
   - 2 compensações criadas + 2 novos finalizados
   - 2 antigos desativados
4. Resultado: 10 descontos ativos (8 originais + 2 novos)

### Cenário 4: Cancelamento

1. Usuário inicia cálculo → `run_id = "jkl012"`
2. Script Python insere 10 descontos em staging
3. Usuário cancela → 10 staging marcados como cancelado
4. Resultado: 0 novos descontos (staging cancelado, finalizados intactos)

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/bonificacoes/calculo/iniciar` | Inicia execução e retorna `run_id` |
| POST | `/api/bonificacoes/calculo/finalizar` | Promove staging para finalizado |
| POST | `/api/bonificacoes/calculo/cancelar` | Cancela staging do `run_id` |
| GET | `/api/bonificacoes/calculo/status?run_id=...` | Status e heartbeat |
| POST | `/api/bonificacoes/calculo/cleanup-staging` | Limpeza automática (cron) |

## Migração

Execute o arquivo `migrations/001_add_staging_fields_to_descontos.sql` no banco MySQL.

**Importante:**
- Registros existentes serão marcados como `finalizado` e `is_active=TRUE`
- Campos novos serão adicionados à tabela existente
- Nenhum dado será perdido

## Testes Recomendados

1. ✅ Rodar, sair da tela → staging cancelado, finalizados intactos
2. ✅ Rodar, finalizar → finaliza e ativa
3. ✅ Reexecutar com mesmo resultado → não duplica (ignora staging)
4. ✅ Reexecutar com diferença → compensa antigo e cria novo
5. ✅ Concorrência: 2 usuários no mesmo `dt_referencia` → um bloqueia o outro
6. ✅ Timeout de sessão → staging auto-cancelado por job

## Segurança

- Todas as operações auditam `usuario_id`
- Locks previnem concorrência
- Transações garantem consistência
- Heartbeat previne timeout acidental

## Notas Técnicas

- MySQL não suporta índices únicos parciais, então a unicidade é garantida pela lógica da aplicação
- Locks são adquiridos via `SELECT ... FOR UPDATE` na tabela `locks_calculo`
- Transações usam isolamento `REPEATABLE READ`
- Compensações mantêm histórico completo via `parent_id`

