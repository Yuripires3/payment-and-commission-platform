# Script de Cálculo de Bonificação

## Instruções para Integração Completa

O arquivo `calculo_bonificacao_completo.py` é um wrapper que precisa ser preenchido com o código Python completo fornecido pelo usuário.

### Passos para Integração:

1. **Copiar o código Python original** fornecido pelo usuário para dentro da função `main()` em `calculo_bonificacao_completo.py`

2. **Fazer as seguintes modificações no código original**:

   a. **Captura de prints**: 
   - Substituir todos os `print(...)` por `log_print(...)` (já definido no wrapper)
   - Isso garante que todos os prints sejam capturados e retornados em `logs`

   b. **Override de datas**:
   - O código já recebe `data_inicial` e `data_final` calculados
   - Use essas variáveis diretamente em vez de calcular internamente quando `modo == "periodo"`
   - Mantenha a lógica original quando `modo == "automatico"`

   c. **Retorno em JSON**:
   - Ao invés de gerar CSVs diretamente, acumule os DataFrames finais em variáveis
   - Ao invés de fazer `to_sql()` diretamente, prepare os dados para retorno
   - No final, retorne um dicionário Python com:
     ```python
     {
         "sucesso": True,
         "logs": "\n".join(logs_parts),  # Todos os prints capturados
         "preview_df5": df5.head(50).to_dict('records'),  # Primeiras 50 linhas
         "df5": df5.to_dict('records'),  # DataFrame completo
         "indicadores": {
             "vlr_bruto_total": vlr_bruto_total,
             "vlr_bruto_cor": vlr_bruto_cor,
             # ... etc
         },
         "filtros": filtros,
         "sem_registro": sem_registro,
         "merges": merges,
         "calc_pag": calc_pag.to_dict('records'),
         "df4_sem_pix": df4_sem_pix.to_dict('records'),
         "df4_com_pix": df4_com_pix.to_dict('records'),
         "desc": desc.to_dict('records'),
         "unif_bonif": unif_bonif.to_dict('records')
     }
     ```

   d. **Serialização de DataFrames**:
   - Use `.to_dict('records')` para converter DataFrames pandas em listas de dicionários
   - Isso permite serialização JSON automática
   - Para valores datetime, use `.isoformat()` antes de serializar

   e. **Modo dry-run**:
   - Não execute `to_sql()` nem `to_csv()` durante o cálculo
   - Apenas prepare os dados para retorno
   - A gravação será feita pelo endpoint `/registrar`

3. **Configurar variáveis de ambiente**:
   - As credenciais do banco devem estar em variáveis de ambiente acessíveis ao Python
   - O caminho do Excel de migrações é calculado automaticamente:
     - Localização: `faturas_migracao/faturas_migracao.xlsx` (relativo à raiz do projeto)
     - O script já define a variável `migracoes_path` automaticamente
     - No código original, substitua:
       ```python
       migracoes_raw = pd.read_excel(r'H:\Financeiro\02. EQP_INTELIGÊNCIA_BI\projetos_prontos\comissao_externa\faturas_migracao\faturas_migracao.xlsx', ...)
       ```
       Por:
       ```python
       migracoes_raw = pd.read_excel(migracoes_path, ...)
       ```

4. **Testar**:
   - Execute o script manualmente passando JSON via stdin:
     ```bash
     echo '{"modo": "automatico"}' | python scripts/calculo_bonificacao_completo.py
     ```
   - Verifique se retorna JSON válido com todos os campos esperados

### Estrutura Esperada do Retorno JSON:

```json
{
  "sucesso": true,
  "logs": "string com todos os prints",
  "preview_df5": [array de objetos],
  "df5": [array de objetos completo],
  "indicadores": {
    "vlr_bruto_total": "R$ 1.234,56",
    "vlr_bruto_cor": "R$ 987,65",
    "vlr_bruto_sup": "R$ 246,91",
    "desc_total": "R$ 123,45",
    "desc_cor": "R$ 98,76",
    "desc_sup": "R$ 0,00",
    "vlr_liquido_total": "R$ 1.111,11",
    "vlr_liquido_cor": "R$ 888,89",
    "vlr_liquido_sup": "R$ 246,91",
    "prop_inicial": 1000,
    "ticket_medio": "R$ 1.300,00",
    "vidas_pagas": 950
  },
  "filtros": {},
  "sem_registro": {},
  "merges": {},
  "calc_pag": [],
  "df4_sem_pix": [],
  "df4_com_pix": [],
  "desc": [],
  "unif_bonif": []
}
```

### Notas Importantes:

- Preserve toda a lógica de negócio do código original
- Apenas adapte a captura de saída e serialização
- Não altere cálculos, filtros ou regras de negócio
- Mantenha a compatibilidade com as máscaras especiais (NOVA SAUDE + ABRAE, dependentes ≤18)

