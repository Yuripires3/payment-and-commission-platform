-- Migração para adicionar campos de staging e controle transacional
-- na tabela registro_bonificacao_descontos
-- Data: 2024
-- Descrição: Transforma o sistema de descontos em idempotente e transacional
-- 
-- Este script verifica cada coluna individualmente e só adiciona as que não existem
-- Pode ser executado múltiplas vezes sem causar erros

-- Função auxiliar para adicionar coluna se não existir
DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_not_exists$$
CREATE PROCEDURE add_column_if_not_exists(
    IN table_name VARCHAR(64),
    IN column_name VARCHAR(64),
    IN column_definition TEXT
)
BEGIN
    DECLARE column_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name
      AND COLUMN_NAME = column_name;
    
    IF column_count = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', table_name, ' ADD COLUMN ', column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Coluna ', column_name, ' adicionada com sucesso') AS result;
    ELSE
        SELECT CONCAT('Coluna ', column_name, ' já existe, pulando...') AS result;
    END IF;
END$$

DELIMITER ;

-- Verificar e adicionar cada coluna de staging (11-23)
-- 11. run_id
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'run_id', 
    'run_id VARCHAR(36) NULL COMMENT ''UUID da execução do cálculo''');

-- 12. session_id
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'session_id', 
    'session_id VARCHAR(64) NULL COMMENT ''ID da sessão/UI atual''');

-- 13. usuario_id
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'usuario_id', 
    'usuario_id BIGINT NULL COMMENT ''ID do usuário que criou/finalizou''');

-- 14. dt_referencia
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'dt_referencia', 
    'dt_referencia DATE NULL COMMENT ''Data de referência do cálculo (escopo do dia)''');

-- 15. status
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'status', 
    'status ENUM(''staging'',''finalizado'',''cancelado'') DEFAULT ''staging'' COMMENT ''Status do registro''');

-- 16. is_active
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'is_active', 
    'is_active BOOLEAN DEFAULT FALSE COMMENT ''Ativo apenas após finalização''');

-- 17. chave_negocio
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'chave_negocio', 
    'chave_negocio TEXT NULL COMMENT ''Chave natural única do desconto para evitar duplicatas''');

-- 18. motivo
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'motivo', 
    'motivo TEXT NULL COMMENT ''Motivo do desconto''');

-- 19. origem
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'origem', 
    'origem TEXT NULL COMMENT ''Origem do desconto (ex: script_python, manual)''');

-- 20. parent_id
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'parent_id', 
    'parent_id BIGINT NULL COMMENT ''ID do lançamento anterior (para compensações)''');

-- 21. finalizado_at
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'finalizado_at', 
    'finalizado_at TIMESTAMP NULL COMMENT ''Data/hora da finalização''');

-- 22. canceled_at
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'canceled_at', 
    'canceled_at TIMESTAMP NULL COMMENT ''Data/hora do cancelamento''');

-- 23. created_at
CALL add_column_if_not_exists('registro_bonificacao_descontos', 'created_at', 
    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT ''Data/hora de criação''');

-- Limpar procedure auxiliar
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- Criar índices para performance (verificar se já existem antes)
DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_not_exists$$
CREATE PROCEDURE add_index_if_not_exists(
    IN table_name VARCHAR(64),
    IN index_name VARCHAR(64),
    IN index_definition TEXT
)
BEGIN
    DECLARE index_count INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_count
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name
      AND INDEX_NAME = index_name;
    
    IF index_count = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', index_name, ' ON ', table_name, ' ', index_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Índice ', index_name, ' criado com sucesso') AS result;
    ELSE
        SELECT CONCAT('Índice ', index_name, ' já existe, pulando...') AS result;
    END IF;
END$$

DELIMITER ;

-- Criar índices para performance
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_run_id', '(run_id)');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_session_id', '(session_id)');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_dt_referencia', '(dt_referencia)');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_status', '(status)');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_is_active', '(is_active)');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_chave_negocio', '(chave_negocio(255))');
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_parent_id', '(parent_id)');

-- Índice composto para performance nas consultas de finalizados ativos
-- MySQL não suporta índices únicos parciais, então a unicidade é garantida pela lógica da aplicação
CALL add_index_if_not_exists('registro_bonificacao_descontos', 'idx_descontos_finalizado_ativo', 
    '(dt_referencia, chave_negocio(255), status, is_active)');

DROP PROCEDURE IF EXISTS add_index_if_not_exists;

-- Nota: Como MySQL não suporta índices únicos parciais com WHERE, 
-- a unicidade será garantida pela lógica da aplicação no endpoint finalizar

-- Atualizar registros existentes para status 'finalizado' e is_active = true
-- (assumindo que registros existentes são finais)
-- Só executa se a coluna status já existir (pode não existir em bancos muito antigos)
SET @status_exists = 0;
SELECT COUNT(*) INTO @status_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'registro_bonificacao_descontos'
  AND COLUMN_NAME = 'status';

SET @sql_update = IF(@status_exists > 0,
  'UPDATE registro_bonificacao_descontos
   SET status = ''finalizado'',
       is_active = TRUE,
       finalizado_at = COALESCE(registro, NOW()),
       dt_referencia = COALESCE(DATE(dt_apuracao), DATE(dt_movimentacao), CURDATE()),
       created_at = COALESCE(registro, NOW())
   WHERE status IS NULL OR status = ''staging''',
  'SELECT ''Coluna status não existe ainda, pulando atualização...'' AS result');
PREPARE stmt_update FROM @sql_update;
EXECUTE stmt_update;
DEALLOCATE PREPARE stmt_update;

-- Criar tabela de locks para controle de concorrência (se não existir)
CREATE TABLE IF NOT EXISTS locks_calculo (
  dt_referencia DATE PRIMARY KEY,
  locked_by BIGINT NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_locks_expires (expires_at)
) ENGINE=InnoDB COMMENT='Locks para controle de concorrência em cálculos';

-- Criar tabela de sessões ativas para heartbeat (se não existir)
CREATE TABLE IF NOT EXISTS calculo_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL,
  usuario_id BIGINT NOT NULL,
  dt_referencia DATE NOT NULL,
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_run_id (run_id),
  INDEX idx_sessions_heartbeat (last_heartbeat)
) ENGINE=InnoDB COMMENT='Sessões ativas de cálculo para controle de timeout';

-- Migração concluída
SELECT 'Migração concluída com sucesso! Todas as colunas de staging foram verificadas e adicionadas conforme necessário.' AS resultado;

