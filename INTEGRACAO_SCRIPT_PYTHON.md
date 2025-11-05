# Integração do Script Python de Cálculo de Bonificação

Este documento descreve como integrar o script Python completo fornecido pelo usuário com a interface web criada.

## Estrutura Criada

1. **Frontend**: `/app/admin/bonificacoes/calculo/page.tsx`
   - Interface React completa com validação e preview de resultados
   - Console de logs
   - Cards de indicadores
   - Tabela de preview (df5)
   - Seções colapsáveis para filtros, sem_registro e merges

2. **Backend API Routes**:
   - `/app/api/bonificacoes/calcular/route.ts` - Executa o cálculo (sem gravar)
   - `/app/api/bonificacoes/registrar/route.ts` - Registra os resultados no banco

3. **Cache em Memória**: `/lib/calculo-cache.ts`
   - Armazena resultados temporários por exec_id
   - TTL de 30 minutos

4. **Script Python Wrapper**: `/scripts/calculo_bonificacao_wrapper.py`
   - Wrapper básico para cálculo de datas
   - Precisa ser expandido para executar o script completo

## Como Integrar o Script Python Completo

### Opção 1: Modificar o Script Python Original

1. Crie um novo arquivo `scripts/calculo_bonificacao_completo.py` baseado no código fornecido pelo usuário
2. Adicione uma função `main()` que:
   - Aceita parâmetros via JSON (modo, data_inicial, data_final)
   - Captura todos os `print()` em uma variável
   - Retorna os resultados em formato JSON ao invés de gravar diretamente
   - Permite modo "dry-run" onde não grava nada

3. Modifique o endpoint `/app/api/bonificacoes/calcular/route.ts` para:
   - Executar o script Python completo via `child_process.exec`
   - Capturar stdout/stderr
   - Processar o JSON retornado
   - Armazenar os dataframes serializados no cache

### Opção 2: Criar um Serviço Python Separado (FastAPI)

1. Crie um serviço FastAPI separado que:
   - Expõe endpoint `/calcular` que executa o script
   - Expõe endpoint `/registrar` que grava os resultados
   - Mantém estado em memória/Redis

2. Modifique os endpoints Next.js para chamar o serviço FastAPI

### Opção 3: Usar Python via Node.js (pyodide ou child_process)

Use a abordagem atual, mas execute o script Python completo via `child_process.exec`.

## Estrutura de Dados Esperada

O endpoint `/api/bonificacoes/calcular` deve retornar:

```typescript
{
  exec_id: string
  sucesso: boolean
  erro?: string
  logs: string  // Todos os prints do script
  preview_df5: any[]  // Primeiras 50 linhas de df5
  indicadores: {
    vlr_bruto_total: string
    vlr_bruto_cor: string
    vlr_bruto_sup: string
    desc_total: string
    desc_cor: string
    desc_sup: string
    vlr_liquido_total: string
    vlr_liquido_cor: string
    vlr_liquido_sup: string
    prop_inicial: number
    ticket_medio: string
    vidas_pagas: number
  }
  filtros: Record<string, any[]>
  sem_registro: Record<string, any[]>
  merges: Record<string, string>
}
```

O cache deve armazenar também:
- `calc_pag`: DataFrame completo de cálculos de pagamento
- `df4_sem_pix`: DataFrame de bonificados sem PIX
- `df4_com_pix`: DataFrame de bonificados com PIX
- `df5`: DataFrame completo (não apenas preview)
- `desc`: DataFrame de descontos
- `unif_bonif`: DataFrame unificado de bonificação

## Ajuste de Descontos em df5 (Item 4)

Antes de exportar/gravar, o endpoint `/api/bonificacoes/registrar` deve:

1. Carregar `aux_descontos` do banco
2. Agrupar por CPF e somar valores (saldo)
3. Criar mapas de desconto:
   - Para corretor: `desc_cor = min(saldo, 45% do total bruto do corretor)`
   - Para supervisor: `desc_sup = 0`
4. Adicionar colunas em df5:
   - `Desconto aplicado`: valor de desconto daquela pessoa no período
   - `Valor líquido (Corretor + Supervisor)`: Vlr bruto Corretor + Vlr bruto Supervisor + Desconto aplicado
   - `Possui desconto?`: Sim/Não
5. Distribuir o desconto proporcionalmente ou mostrar o mesmo valor em todas as linhas do mesmo CPF

## Variáveis de Ambiente Necessárias

O script Python precisa acessar:
- Credenciais do banco MySQL (já configuradas em `.env`)
- Credenciais do Elasticsearch
- Caminho do arquivo Excel de migrações: `faturas_migracao/faturas_migracao.xlsx` (relativo à raiz do projeto)
  - Caminho completo: `C:\Users\yuri.oliveira\Desktop\payment-and-commission-platform\faturas_migracao\faturas_migracao.xlsx`
  - O script já calcula esse caminho automaticamente baseado na localização do arquivo Python

## Próximos Passos

1. Criar o script Python completo modificado (`calculo_bonificacao_completo.py`)
2. Implementar captura de stdout no endpoint `/calcular`
3. Implementar serialização/deserialização de DataFrames pandas para JSON
4. Implementar o ajuste de descontos em df5 antes de exportar
5. Testar o fluxo completo

## Notas Importantes

- O script Python original usa muitos prints. Todos devem ser capturados e retornados em `logs`
- A lógica de negócio (filtros, merges, cálculos) deve ser preservada exatamente como está
- O modo "automático" deve seguir exatamente as regras do script original (CUT, subtrair_dias_uteis, etc.)
- O modo "período" permite override de `data_inicial` e `data_final`, mas mantém `data_pagamento = hoje`

