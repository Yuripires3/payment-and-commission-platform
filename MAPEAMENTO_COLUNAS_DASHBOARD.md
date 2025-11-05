# Mapeamento de Colunas - Dashboard de Bonificações

Este documento descreve o mapeamento entre as colunas reais da tabela `unificado_bonificacao` e os papéis semânticos utilizados no Dashboard.

## Tabela: `unificado_bonificacao`

### Mapeamento de Colunas

#### Datas
| Papel Semântico | Coluna Real | Tipo | Observações |
|----------------|-------------|------|-------------|
| `data_pagamento` | `dt_pagamento` | DATE/DATETIME | Data de pagamento da bonificação |
| `vigencia_mes` / `vigencia_ano` | `dt_inicio_vigencia` | DATE | Data de início da vigência (pode ser extraído mês/ano) |
| `data_emissao` | `dt_registro` | DATETIME | Data de registro do cálculo |
| `data_confirmacao` | `dt_analise` | DATETIME | Data de análise/confirmação (opcional) |

#### Identificadores
| Papel Semântico | Coluna Real | Tipo | Observações |
|----------------|-------------|------|-------------|
| `operadora` | `operadora` | VARCHAR | Nome da operadora |
| `entidade` | `entidade` | VARCHAR | Nome da entidade |
| `plano` | `chave_plano` | VARCHAR | Chave do plano (contém informações do plano) |
| `faixa` | - | - | Não disponível diretamente (pode estar em `chave_plano`) |
| `tipo_dependente` | `tipo_beneficiario` | VARCHAR | Tipo de beneficiário (Titular/Dependente) |
| `produto` | - | - | Não disponível diretamente |
| `parcela` | `parcela` | VARCHAR/INT | Número da parcela |
| `chave` | `chave_id` | VARCHAR | Chave única do registro |
| `chave_plano` | `chave_plano` | VARCHAR | Chave do plano |

#### Pessoas/Estruturas
| Papel Semântico | Coluna Real | Tipo | Observações |
|----------------|-------------|------|-------------|
| `beneficiario` | `nome` | VARCHAR | Nome do beneficiário |
| `cpf` | `cpf` | VARCHAR | CPF do beneficiário |
| `corretor` | `nome_corretor` | VARCHAR | Nome do corretor |
| `cpf_corretor` | `cpf_corretor` | VARCHAR | CPF do corretor |
| `supervisor` | `nome_supervisor` | VARCHAR | Nome do supervisor |
| `cpf_supervisor` | `cpf_supervisor` | VARCHAR | CPF do supervisor |
| `parceiro_id` | `cpf_corretor` | VARCHAR | ID do parceiro (usado como CPF do corretor) |

#### Status
| Papel Semântico | Coluna Real | Tipo | Observações |
|----------------|-------------|------|-------------|
| `status_pagamento` | `descontado` | TINYINT(0/1) | 0 = Pago/Aberto, 1 = Descontado |
| `descontado` | `descontado` | TINYINT(0/1) | Flag de desconto aplicado |
| `descontos_valor` | - | - | Não disponível diretamente (calculado como diferença) |
| `situacao` | - | - | Não disponível diretamente |

#### Métricas
| Papel Semântico | Coluna Real | Tipo | Observações |
|----------------|-------------|------|-------------|
| `valor_producao` | `vlr_bruto_corretor` | DECIMAL | Valor bruto de produção (aproximação) |
| `valor_a_pagar` | `vlr_bruto_corretor` | DECIMAL | Valor a pagar ao corretor |
| `valor_desconto` | Calculado | DECIMAL | Calculado como soma quando `descontado = 1` |
| `ticket` | Calculado | DECIMAL | `valor_a_pagar / vidas_pagas` |
| `vidas_faturadas` | Calculado | INT | Contagem distinta de beneficiários (aproximação) |
| `vidas_pagas` | Calculado | INT | Contagem distinta de beneficiários com pagamento |

### Cálculos e Aproximações

#### Vidas Faturadas / Vidas Pagas
Como não há campos explícitos `vidas_faturadas` e `vidas_pagas`, utilizamos:
```sql
COUNT(DISTINCT CONCAT(cpf, '-', COALESCE(id_beneficiario, '')))
```
Isso conta beneficiários únicos considerando CPF e ID do beneficiário.

#### Valor de Desconto
Como não há campo explícito `valor_desconto`, utilizamos:
```sql
SUM(CASE WHEN descontado = 1 THEN vlr_bruto_corretor ELSE 0 END)
```
Isso soma os valores quando o flag `descontado = 1`.

#### Percentual de Desconto
```sql
(SUM(CASE WHEN descontado = 1 THEN vlr_bruto_corretor ELSE 0 END) / 
 SUM(vlr_bruto_corretor)) * 100
```

#### Ticket Médio
```sql
SUM(vlr_bruto_corretor) / NULLIF(COUNT(DISTINCT CONCAT(cpf, '-', COALESCE(id_beneficiario, ''))), 0)
```

### Colunas Adicionais Disponíveis

A tabela também possui as seguintes colunas que podem ser úteis para análises futuras:

- `numero_proposta`: Número da proposta
- `idade`: Idade do beneficiário
- `cnpj_concessionaria`: CNPJ da concessionária
- `id_beneficiario`: ID único do beneficiário

### Notas Importantes

1. **Status de Pagamento**: O campo `status_pagamento` não existe explicitamente. Utilizamos `descontado` como proxy:
   - `descontado = 0`: Considerado como "Pago" ou "Em aberto"
   - `descontado = 1`: Considerado como "Descontado"

2. **Vidas Faturadas vs Vidas Pagas**: Atualmente ambos utilizam a mesma lógica de contagem. Se houver necessidade de diferenciar no futuro, será necessário ajustar a lógica ou adicionar campos específicos.

3. **Valor de Produção**: Assumimos que `vlr_bruto_corretor` representa o valor de produção quando não há campo específico.

4. **Data de Pagamento**: Utilizamos `dt_pagamento` como referência principal para agrupamentos temporais.

### Consultas SQL Utilizadas

#### KPIs
```sql
-- Comissões do mês atual
SELECT COALESCE(SUM(vlr_bruto_corretor), 0) as total
FROM unificado_bonificacao
WHERE dt_pagamento >= :inicio_mes_atual 
  AND dt_pagamento <= :fim_mes_atual
  -- + filtros adicionais
```

#### Evolução Mensal
```sql
SELECT 
  DATE_FORMAT(dt_pagamento, '%Y-%m') as mes,
  COALESCE(SUM(vlr_bruto_corretor), 0) as valor
FROM unificado_bonificacao
WHERE dt_pagamento >= :inicio AND dt_pagamento <= :fim
GROUP BY DATE_FORMAT(dt_pagamento, '%Y-%m')
ORDER BY mes ASC
```

#### Top Corretores
```sql
SELECT 
  COALESCE(nome_corretor, cpf_corretor) as nome,
  COALESCE(SUM(vlr_bruto_corretor), 0) as valor,
  COUNT(DISTINCT CONCAT(cpf, '-', COALESCE(id_beneficiario, ''))) as vidas,
  SUM(vlr_bruto_corretor) / NULLIF(COUNT(DISTINCT CONCAT(cpf, '-', COALESCE(id_beneficiario, ''))), 0) as ticket
FROM unificado_bonificacao
WHERE dt_pagamento >= :inicio AND dt_pagamento <= :fim
GROUP BY cpf_corretor, nome_corretor
ORDER BY valor DESC
LIMIT 10
```

#### Status Mensal
```sql
SELECT 
  DATE_FORMAT(dt_pagamento, '%Y-%m') as mes,
  CASE 
    WHEN descontado = 1 THEN 'Descontado'
    ELSE 'Pago'
  END as status,
  COALESCE(SUM(vlr_bruto_corretor), 0) as valor
FROM unificado_bonificacao
WHERE dt_pagamento >= :inicio AND dt_pagamento <= :fim
GROUP BY DATE_FORMAT(dt_pagamento, '%Y-%m'), descontado
ORDER BY mes ASC, status ASC
```

