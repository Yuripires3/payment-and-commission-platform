# Análise Forense - Dashboard de Bonificações

## Data de Corte: 01/10/2025

## Problemas Identificados

### 1. **Dupla Filtragem no Cálculo de Valores Separados**
   - **Local**: `app/api/dashboard/kpis/route.ts` linha 229-236
   - **Problema**: Ao calcular valores separados (corretores/supervisores), estava aplicando o filtro de papel no WHERE E na função `construirCampoValorPorData`, causando dupla filtragem
   - **Correção**: Removido filtro de papel do WHERE ao calcular valores separados, deixando apenas a lógica interna das funções

### 2. **Lógica de Filtro de Papel para 'Geral'**
   - **Local**: `lib/dashboard-helpers.ts` função `construirFiltroPapel`
   - **Status**: Parece correto - permite registros antigos OU novos com papel válido
   - **Observação**: Filtro exclui corretamente "indefinido" no novo modelo

### 3. **Data de Corte**
   - **Definição**: `2025-10-01`
   - **Lógica**: 
     - `< '2025-10-01'` = Modelo Antigo (até 30/09/2025)
     - `>= '2025-10-01'` = Modelo Novo (a partir de 01/10/2025)
   - **Status**: ✅ Correto

### 4. **Cálculo de Valores no Novo Modelo**
   - **Regra**: Todos os valores vêm de `vlr_bruto_corretor`
   - **Filtragem por papel**: Via `nome_supervisor` ('corretor' ou 'supervisor')
   - **Exclusão**: Registros com papel "indefinido" são excluídos
   - **Status**: ✅ Lógica correta nas funções `construirCampoValorPorData`

### 5. **Pontos de Atenção**

#### Modelo Antigo (< 2025-10-01)
- Usa `vlr_bruto_corretor` para corretores
- Usa `vlr_bruto_supervisor` para supervisores
- Identificação: via `cpf_corretor` ou `cpf_supervisor`

#### Modelo Novo (>= 2025-10-01)
- Usa `vlr_bruto_corretor` como fonte única
- Filtragem: via `nome_supervisor` = 'corretor' ou 'supervisor'
- Nome exibido: sempre de `nome_corretor`

## Correções Aplicadas

1. ✅ Removido filtro de papel duplicado no cálculo de valores separados
2. ✅ Adicionado espaço antes do filtro de papel em todas as queries WHERE
3. ✅ Tabelas Top 10 agora ignoram filtro de papel (sempre mostram ambos separados)

## Próximos Passos para Validação

1. Testar com período apenas anterior a 01/10/2025
2. Testar com período apenas posterior a 01/10/2025
3. Testar com período misto (antes e depois de 01/10/2025)
4. Validar que valores separados (corretor + supervisor) somam o total quando papel='geral'
5. Verificar se registros com papel "indefinido" são excluídos corretamente

## Queries de Validação Sugeridas

```sql
-- Verificar estrutura dos dados no novo modelo (>= 2025-10-01)
SELECT 
  DATE(COALESCE(dt_pagamento, dt_analise)) as data_pagamento,
  LOWER(TRIM(COALESCE(nome_supervisor, ''))) as papel,
  COUNT(*) as qtd,
  SUM(vlr_bruto_corretor) as total
FROM unificado_bonificacao
WHERE COALESCE(dt_pagamento, dt_analise) >= '2025-10-01'
GROUP BY DATE(COALESCE(dt_pagamento, dt_analise)), papel
ORDER BY data_pagamento, papel;

-- Verificar valores separados
SELECT 
  'Corretor' as tipo,
  SUM(CASE 
    WHEN COALESCE(dt_pagamento, dt_analise) < '2025-10-01' THEN vlr_bruto_corretor
    WHEN COALESCE(dt_pagamento, dt_analise) >= '2025-10-01' 
         AND LOWER(TRIM(COALESCE(nome_supervisor, ''))) = 'corretor' THEN vlr_bruto_corretor
    ELSE 0
  END) as valor
FROM unificado_bonificacao
WHERE COALESCE(dt_pagamento, dt_analise) >= '2025-10-01' 
  AND COALESCE(dt_pagamento, dt_analise) <= '2025-10-31'
UNION ALL
SELECT 
  'Supervisor' as tipo,
  SUM(CASE 
    WHEN COALESCE(dt_pagamento, dt_analise) < '2025-10-01' THEN vlr_bruto_supervisor
    WHEN COALESCE(dt_pagamento, dt_analise) >= '2025-10-01' 
         AND LOWER(TRIM(COALESCE(nome_supervisor, ''))) = 'supervisor' THEN vlr_bruto_corretor
    ELSE 0
  END) as valor
FROM unificado_bonificacao
WHERE COALESCE(dt_pagamento, dt_analise) >= '2025-10-01' 
  AND COALESCE(dt_pagamento, dt_analise) <= '2025-10-31';
```

