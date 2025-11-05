# Estrutura da Tabela `registro_bonificacao_descontos`

## Colunas Obrigatórias

### Colunas Principais (Dados do Desconto)

| Coluna | Tipo | Null | Descrição |
|--------|------|------|-----------|
| `id` | BIGINT | NOT NULL | Chave primária (auto-increment) |
| `dt_movimentacao` | DATE | NULL | Data da movimentação do desconto |
| `cpf` | VARCHAR(20) | NULL | CPF da pessoa que recebeu o desconto |
| `nome` | VARCHAR(255) | NULL | Nome da pessoa |
| `valor` | DECIMAL(16,2) | NULL | Valor do desconto (geralmente negativo) |
| `dt_apuracao` | DATE | NULL | Data de apuração do desconto |
| `tipo_movimentacao` | VARCHAR(100) | NULL | Tipo da movimentação (ex: "desconto realizado") |
| `proposta` | VARCHAR(100) | NULL | Número da proposta (opcional) |
| `dt_exclusao_proposta` | DATE | NULL | Data de exclusão da proposta (opcional) |
| `registro` | TIMESTAMP | NULL | Data/hora de registro (legado) |

### Colunas de Staging (Sistema Idempotente)

| Coluna | Tipo | Null | Default | Descrição |
|--------|------|------|---------|-----------|
| `run_id` | VARCHAR(36) | NULL | NULL | UUID da execução do cálculo |
| `session_id` | VARCHAR(64) | NULL | NULL | ID da sessão/UI atual |
| `usuario_id` | BIGINT | NULL | NULL | ID do usuário que criou/finalizou |
| `dt_referencia` | DATE | NULL | NULL | Data de referência do cálculo (escopo do dia) |
| `status` | ENUM('staging','finalizado','cancelado') | NULL | 'staging' | Status do registro |
| `is_active` | BOOLEAN | NULL | FALSE | Ativo apenas após finalização |
| `chave_negocio` | TEXT | NULL | NULL | Chave natural única do desconto para evitar duplicatas |
| `motivo` | TEXT | NULL | NULL | Motivo do desconto |
| `origem` | TEXT | NULL | NULL | Origem do desconto (ex: 'script_python', 'manual', 'sistema') |
| `parent_id` | BIGINT | NULL | NULL | ID do lançamento anterior (para compensações/ledger) |
| `finalizado_at` | TIMESTAMP | NULL | NULL | Data/hora da finalização |
| `canceled_at` | TIMESTAMP | NULL | NULL | Data/hora do cancelamento |
| `created_at` | TIMESTAMP | NULL | CURRENT_TIMESTAMP | Data/hora de criação |

## Índices Recomendados

```sql
-- Índices básicos
CREATE INDEX idx_descontos_run_id ON registro_bonificacao_descontos(run_id);
CREATE INDEX idx_descontos_session_id ON registro_bonificacao_descontos(session_id);
CREATE INDEX idx_descontos_dt_referencia ON registro_bonificacao_descontos(dt_referencia);
CREATE INDEX idx_descontos_status ON registro_bonificacao_descontos(status);
CREATE INDEX idx_descontos_is_active ON registro_bonificacao_descontos(is_active);
CREATE INDEX idx_descontos_chave_negocio ON registro_bonificacao_descontos(chave_negocio(255));
CREATE INDEX idx_descontos_parent_id ON registro_bonificacao_descontos(parent_id);

-- Índice composto para performance nas consultas de finalizados ativos
CREATE INDEX idx_descontos_finalizado_ativo 
  ON registro_bonificacao_descontos(dt_referencia, chave_negocio(255), status, is_active);
```

## Script SQL de Criação Completo

```sql
CREATE TABLE registro_bonificacao_descontos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  
  -- Dados principais
  dt_movimentacao DATE NULL COMMENT 'Data da movimentação do desconto',
  cpf VARCHAR(20) NULL COMMENT 'CPF da pessoa',
  nome VARCHAR(255) NULL COMMENT 'Nome da pessoa',
  valor DECIMAL(16,2) NULL COMMENT 'Valor do desconto',
  dt_apuracao DATE NULL COMMENT 'Data de apuração',
  tipo_movimentacao VARCHAR(100) NULL COMMENT 'Tipo da movimentação',
  proposta VARCHAR(100) NULL COMMENT 'Número da proposta',
  dt_exclusao_proposta DATE NULL COMMENT 'Data de exclusão da proposta',
  registro TIMESTAMP NULL COMMENT 'Data/hora de registro (legado)',
  
  -- Sistema de staging
  run_id VARCHAR(36) NULL COMMENT 'UUID da execução do cálculo',
  session_id VARCHAR(64) NULL COMMENT 'ID da sessão/UI atual',
  usuario_id BIGINT NULL COMMENT 'ID do usuário que criou/finalizou',
  dt_referencia DATE NULL COMMENT 'Data de referência do cálculo (escopo do dia)',
  status ENUM('staging','finalizado','cancelado') DEFAULT 'staging' COMMENT 'Status do registro',
  is_active BOOLEAN DEFAULT FALSE COMMENT 'Ativo apenas após finalização',
  chave_negocio TEXT NULL COMMENT 'Chave natural única do desconto',
  motivo TEXT NULL COMMENT 'Motivo do desconto',
  origem TEXT NULL COMMENT 'Origem do desconto',
  parent_id BIGINT NULL COMMENT 'ID do lançamento anterior (para compensações)',
  finalizado_at TIMESTAMP NULL COMMENT 'Data/hora da finalização',
  canceled_at TIMESTAMP NULL COMMENT 'Data/hora do cancelamento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data/hora de criação',
  
  -- Índices
  INDEX idx_descontos_run_id (run_id),
  INDEX idx_descontos_session_id (session_id),
  INDEX idx_descontos_dt_referencia (dt_referencia),
  INDEX idx_descontos_status (status),
  INDEX idx_descontos_is_active (is_active),
  INDEX idx_descontos_chave_negocio (chave_negocio(255)),
  INDEX idx_descontos_parent_id (parent_id),
  INDEX idx_descontos_finalizado_ativo (dt_referencia, chave_negocio(255), status, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Migração de Tabela Existente

Se a tabela já existe sem as colunas de staging, execute o arquivo:
`migrations/001_add_staging_fields_to_descontos.sql`

Este script:
- Adiciona todas as colunas de staging
- Cria os índices necessários
- Atualiza registros existentes para `status = 'finalizado'` e `is_active = TRUE`
- Cria tabelas auxiliares (`locks_calculo` e `calculo_sessions`)

## Uso das Colunas

### Colunas Obrigatórias para Inserção Básica (Legado)
- `dt_movimentacao`
- `cpf`
- `nome`
- `valor`
- `dt_apuracao`
- `tipo_movimentacao`
- `registro`

### Colunas Obrigatórias para Sistema de Staging
- `run_id` (UUID da execução)
- `session_id` (ID da sessão)
- `usuario_id` (ID do usuário)
- `dt_referencia` (Data de referência)
- `chave_negocio` (Chave única do desconto)
- `status` (deve ser 'staging' inicialmente)
- `is_active` (deve ser FALSE inicialmente)
- `origem` (ex: 'script_python', 'manual')

### Colunas para Compensações (Ledger)
- `parent_id` (aponta para o lançamento anterior)
- `motivo` (pode ser 'Ajuste compensatório')

## Consultas Recomendadas

### Buscar apenas descontos ativos
```sql
SELECT * FROM registro_bonificacao_descontos
WHERE status = 'finalizado' AND is_active = TRUE;
```

### Buscar descontos em staging de uma execução
```sql
SELECT * FROM registro_bonificacao_descontos
WHERE run_id = ? AND status = 'staging';
```

### Buscar histórico de compensações
```sql
SELECT * FROM registro_bonificacao_descontos
WHERE parent_id IS NOT NULL
ORDER BY created_at DESC;
```

