# Guia de Implementação - Sistema de Staging

## Resumo da Implementação

Foi implementado um sistema idempotente e transacional para gerenciamento de descontos de bonificação, seguindo os requisitos especificados.

## Arquivos Criados/Modificados

### Migrações
- `migrations/001_add_staging_fields_to_descontos.sql` - Migração SQL para MySQL

### Novos Endpoints
- `app/api/bonificacoes/calculo/iniciar/route.ts` - Inicia execução e retorna run_id
- `app/api/bonificacoes/calculo/finalizar/route.ts` - Finaliza com lógica de compensação
- `app/api/bonificacoes/calculo/cancelar/route.ts` - Cancela staging
- `app/api/bonificacoes/calculo/status/route.ts` - Status e heartbeat
- `app/api/bonificacoes/calculo/cleanup-staging/route.ts` - Limpeza automática (cron)

### Utilitários
- `lib/descontos-utils.ts` - Funções auxiliares (gerarChaveNegocio, etc.)

### Scripts
- `scripts/exemplo_inserir_staging.py` - Exemplo de integração Python

### Documentação
- `docs/FLUXO_DESCONTOS_IDEMPOTENTE.md` - Documentação completa do fluxo
- `docs/IMPLEMENTACAO_STAGING.md` - Este arquivo

### Queries Atualizadas
Todos os endpoints de consulta foram atualizados para filtrar apenas:
```sql
WHERE status = 'finalizado' AND is_active = TRUE
```

**Endpoints atualizados:**
- `app/api/bonificacoes/extrato-descontos/route.ts`
- `app/api/bonificacoes/registrar/route.ts`
- `app/api/dashboard/kpis/route.ts`
- `app/api/dashboard/evolucao/route.ts`
- `app/api/dashboard/impacto-descontos/route.ts`
- `app/api/dashboard/top-supervisores/route.ts`
- `app/api/dashboard/top-corretores/route.ts`
- `app/api/dashboard/status-mensal/route.ts`
- `app/api/dashboard/por-operadora/route.ts`
- `app/api/dashboard/por-entidade/route.ts`

## Próximos Passos

### 1. Executar Migração
```bash
# Conectar ao MySQL e executar:
mysql -u usuario -p database < migrations/001_add_staging_fields_to_descontos.sql
```

### 2. Integrar Script Python
O script Python precisa ser modificado para:
1. Chamar `/api/bonificacoes/calculo/iniciar` antes de calcular
2. Usar o `run_id` retornado
3. Inserir descontos com campos de staging (ver `scripts/exemplo_inserir_staging.py`)

### 3. Configurar Cron Job
Configurar cron para executar cleanup a cada 15 minutos:
```bash
*/15 * * * * curl -X POST http://localhost:3000/api/bonificacoes/calculo/cleanup-staging \
  -H "Authorization: Bearer ${CLEANUP_TOKEN}"
```

### 4. Atualizar Frontend
O frontend precisa:
1. Chamar `/calculo/iniciar` antes de executar cálculo
2. Passar `run_id` para o script Python
3. Chamar `/calculo/finalizar` ao invés de `/registrar`
4. Chamar `/calculo/cancelar` ao cancelar
5. Enviar heartbeat via `/calculo/status?run_id=...` periodicamente

## Notas Importantes

### MySQL vs PostgreSQL
- A implementação foi adaptada para MySQL
- Índices únicos parciais não são suportados, então a unicidade é garantida pela lógica da aplicação
- Locks são implementados via tabela `locks_calculo` com `SELECT ... FOR UPDATE`

### Compatibilidade
- Registros existentes serão automaticamente marcados como `finalizado` e `is_active=TRUE`
- Nenhum dado será perdido na migração
- O sistema é retrocompatível: queries antigas continuam funcionando (mas devem ser atualizadas)

### Segurança
- Todos os endpoints validam `usuario_id`
- Locks previnem concorrência
- Transações garantem consistência
- Heartbeat previne timeout acidental

## Testes

Execute os testes recomendados (ver `docs/FLUXO_DESCONTOS_IDEMPOTENTE.md`):

1. ✅ Rodar, sair da tela → staging cancelado, finalizados intactos
2. ✅ Rodar, finalizar → finaliza e ativa
3. ✅ Reexecutar com mesmo resultado → não duplica
4. ✅ Reexecutar com diferença → compensa antigo e cria novo
5. ✅ Concorrência → um bloqueia o outro
6. ✅ Timeout → staging auto-cancelado

## Suporte

Para dúvidas ou problemas, consulte:
- `docs/FLUXO_DESCONTOS_IDEMPOTENTE.md` - Documentação completa
- `scripts/exemplo_inserir_staging.py` - Exemplo de integração Python

