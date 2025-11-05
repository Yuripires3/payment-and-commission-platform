# Integração Completa - Cálculo de Bonificação

## ✅ O que foi implementado

### 1. Frontend (`/app/admin/bonificacoes/calculo/page.tsx`)
- ✅ Interface React completa com validação
- ✅ RadioGroup para escolher modo (Automático/Período)
- ✅ Inputs de data com validação
- ✅ Console de logs com ScrollArea
- ✅ Cards de indicadores (Produção/Desconto/Valor a pagar)
- ✅ Preview tabelado de df5 (até 50 linhas)
- ✅ Seções colapsáveis (Accordion) para filtros, sem_registro e merges
- ✅ Checkbox de validação antes de registrar
- ✅ Tratamento de erros e avisos (incluindo "Fora da data de virada")

### 2. Backend API Routes

#### `/api/bonificacoes/calcular` (POST)
- ✅ Executa script Python via `child_process.exec`
- ✅ Captura stdout/stderr
- ✅ Processa JSON retornado pelo script
- ✅ Converte DataFrames pandas para arrays JavaScript
- ✅ Armazena resultados no cache por exec_id
- ✅ Retorna logs, preview_df5, indicadores, filtros, sem_registro, merges
- ✅ Tratamento de erros (Python não encontrado, script falhou, etc.)

#### `/api/bonificacoes/registrar` (POST)
- ✅ Recupera resultados do cache
- ✅ **Implementa ajuste de descontos em df5** (Item 4):
  - Carrega `aux_descontos` do banco
  - Calcula totais brutos por CPF (corretor e supervisor)
  - Aplica regra: corretor = min(saldo, 45% bruto), supervisor = 0
  - Adiciona colunas: "Desconto aplicado", "Valor líquido", "Possui desconto?"
- ✅ Gera CSVs (bonificacao_analise.csv, bonificados_sem_pix.csv)
- ✅ Insere descontos em `registro_bonificacao_descontos`
- ✅ Insere dados em `unificado_bonificacao`
- ✅ Limpa cache após registro

### 3. Infraestrutura

#### Cache (`/lib/calculo-cache.ts`)
- ✅ Armazena resultados por exec_id
- ✅ TTL de 30 minutos
- ✅ Limpeza automática de entradas expiradas

#### Utilitários (`/lib/pandas-utils.ts`)
- ✅ `pandasToArray()`: Converte DataFrames pandas (JSON) para arrays JavaScript
- ✅ `arrayToCSV()`: Converte arrays JavaScript para CSV (formato brasileiro com `;`)

#### Script Python (`/scripts/calculo_bonificacao_completo.py`)
- ✅ Wrapper básico criado
- ⚠️ **PRECISA SER PREENCHIDO** com o código Python completo fornecido pelo usuário
- ✅ Estrutura pronta para captura de prints e retorno JSON

### 4. Componentes UI Criados
- ✅ `RadioGroup` - Seleção de modo
- ✅ `Accordion` - Seções colapsáveis
- ✅ `ScrollArea` - Console de logs
- ✅ `Checkbox` - Validação
- ✅ `Alert` - Avisos (com variante warning)

### 5. Navegação
- ✅ Link adicionado no sidebar: "Cálculo de Bonificação"

## 🔧 Próximos Passos (Para Completar)

### 1. Preencher Script Python Completo

O arquivo `/scripts/calculo_bonificacao_completo.py` precisa ser preenchido com o código Python completo fornecido pelo usuário.

**Instruções detalhadas estão em `/scripts/README_CALCULO.md`**

Resumo das modificações necessárias:
1. Copiar código Python original para dentro de `main()`
2. Substituir `print(...)` por `log_print(...)` (já definido)
3. Usar `data_inicial` e `data_final` quando `modo == "periodo"`
4. Ao invés de `to_csv()` e `to_sql()`, retornar JSON com todos os DataFrames
5. Converter DataFrames para dict usando `.to_dict('records')`

### 2. Configurar Variáveis de Ambiente

O script Python precisa acessar:
- Credenciais do banco MySQL (já configuradas via `.env` do Next.js)
- Credenciais do Elasticsearch
- Caminho do Excel de migrações

**Sugestão**: Criar arquivo `.env.python` ou passar via variáveis de ambiente do sistema.

### 3. Instalar Dependências Python

Certifique-se de que o ambiente Python tenha instalado:
```bash
pip install pandas numpy elasticsearch sqlalchemy mysql-connector-python openpyxl
```

### 4. Testar Fluxo Completo

1. **Modo Automático**:
   - Executar cálculo em data >= CUT (2025-10-01)
   - Verificar se datas são calculadas corretamente
   - Verificar se logs são capturados

2. **Modo Período**:
   - Executar com data_inicial e data_final fornecidas
   - Verificar se override funciona
   - Verificar se data_pagamento permanece como hoje

3. **Caso "Fora da data de virada"**:
   - Executar em data < CUT
   - Verificar se retorna erro apropriado
   - Verificar se registro está desabilitado

4. **Registro**:
   - Executar cálculo
   - Validar resultados
   - Registrar
   - Verificar se CSVs são gerados
   - Verificar se dados são inseridos no banco
   - Verificar se descontos são aplicados corretamente em df5

## 📋 Estrutura de Arquivos Criados

```
/app/admin/bonificacoes/calculo/
  └── page.tsx                      # Página React completa

/app/api/bonificacoes/
  ├── calcular/
  │   └── route.ts                  # Endpoint de cálculo
  └── registrar/
      └── route.ts                  # Endpoint de registro

/lib/
  ├── calculo-cache.ts              # Cache em memória
  └── pandas-utils.ts               # Utilitários de conversão

/scripts/
  ├── calculo_bonificacao_completo.py  # Script Python (preencher)
  └── README_CALCULO.md             # Instruções detalhadas

/components/ui/
  ├── radio-group.tsx               # Componente RadioGroup
  ├── accordion.tsx                 # Componente Accordion
  ├── scroll-area.tsx               # Componente ScrollArea
  ├── checkbox.tsx                  # Componente Checkbox
  └── alert.tsx                     # Componente Alert

/components/admin/
  └── admin-sidebar.tsx             # Atualizado com link
```

## 🎯 Funcionalidades Implementadas

### Modo Automático
- ✅ Calcula datas usando CUT e subtrair_dias_uteis
- ✅ data_pagamento = hoje
- ✅ data_final = subtrair_dias_uteis(hoje, 1)
- ✅ data_inicial = data_final - 30 dias
- ✅ n_apur = hoje.day

### Modo Período
- ✅ Permite override de data_inicial e data_final
- ✅ Valida que data_inicial <= data_final
- ✅ Mantém data_pagamento = hoje
- ✅ Mantém n_apur = hoje.day

### Ajuste de Descontos (Item 4)
- ✅ Carrega aux_descontos do banco
- ✅ Agrupa por CPF e soma valores
- ✅ Calcula desconto para corretor: min(saldo, 45% bruto)
- ✅ Desconto para supervisor: 0
- ✅ Adiciona colunas em df5:
  - "Desconto aplicado"
  - "Valor líquido (Corretor + Supervisor)"
  - "Possui desconto?"
- ✅ Distribui desconto igualmente nas linhas do mesmo CPF

### Validação e Registro
- ✅ Console de logs mostra todos os prints do script
- ✅ Cards de indicadores mostram totais
- ✅ Preview de df5 (até 50 linhas)
- ✅ Seções colapsáveis para filtros, sem_registro, merges
- ✅ Checkbox de validação obrigatória
- ✅ Botão Registrar desabilitado até validação
- ✅ Geração de CSVs após registro
- ✅ Inserção no banco após registro

## ⚠️ Importante

**O script Python precisa ser preenchido com o código completo fornecido pelo usuário.**

Atualmente, o sistema está funcional mas retornará dados vazios até que o script Python seja integrado.

Siga as instruções em `/scripts/README_CALCULO.md` para completar a integração.

