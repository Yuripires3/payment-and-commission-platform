# Instruções para Adicionar Etapas no Script Python

Para que a barra de progresso funcione corretamente e mostre o progresso real do script, você precisa adicionar chamadas `etapa()` após cada operação importante.

## Formato das Etapas

```python
etapa("Mensagem da etapa", percentual)
```

Onde:
- `"Mensagem da etapa"`: Texto descritivo do que está sendo executado
- `percentual`: Número de 0 a 100 indicando o progresso aproximado

## Exemplo de Uso no Código Completo

Quando você inserir o código Python completo, adicione chamadas `etapa()` assim:

```python
# Conectar ao banco
etapa("Conectando ao banco de dados MySQL...", 5)
encoded_password = quote_plus('xEth+vOHltr*c4Eju3+t')
connection_string = f"mysql+mysqldb://Indicadores:{encoded_password}@192.168.1.193:3306/indicadores"
engine = create_engine(connection_string)
conn = engine.connect()

# Carregar tabelas auxiliares
etapa("Carregando tabela auxiliar_entidades...", 10)
aux_entidade_raw = pd.read_sql('SELECT * FROM auxiliar_entidades', engine)
log_print('| - SQL Entidade   (finalizado)')

etapa("Carregando tabela auxiliar_operadoras...", 12)
aux_operadora_raw = pd.read_sql('SELECT * FROM auxiliar_operadoras', engine)
log_print('| - SQL Operadora   (finalizado)')

etapa("Carregando tabela auxiliar_concessionarias...", 14)
aux_concessionarias_raw = pd.read_sql('SELECT * FROM auxiliar_concessionarias_02', engine)
log_print('| - SQL Concessionárias   (finalizado)')

etapa("Carregando tabela auxiliar_planos...", 16)
aux_planos_raw = pd.read_sql('SELECT * FROM auxiliar_planos', engine)
log_print('| - SQL Planos   (finalizado)')

etapa("Carregando faixas de idade...", 18)
aux_faixa_idade_raw = pd.read_sql('SELECT * FROM registro_bonificacao_idades', engine)
log_print('| - SQL Faixas Idades   (finalizado)')

etapa("Carregando valores de bonificação...", 20)
aux_bonificacao_raw = pd.read_sql('SELECT * FROM registro_bonificacao_valores_v2', engine)
log_print('| - SQL Bonificação Valores   (finalizado)')

etapa("Carregando descontos...", 22)
aux_descontos_raw = pd.read_sql('SELECT * FROM registro_bonificacao_descontos', engine)
log_print('| - SQL Bonificação Descontos   (finalizado)')

etapa("Carregando dados unificados...", 24)
unificado = pd.read_sql('SELECT * FROM unificado_bonificacao', engine)
log_print('| - SQL Unificado   (finalizado)')

etapa("Carregando chaves PIX...", 26)
aux_pix_raw = pd.read_sql('SELECT * FROM registro_chave_pix', engine)
log_print('| - SQL Pix   (finalizado)')

# Conectar ao Elasticsearch
etapa("Conectando ao Elasticsearch...", 28)
cloud_id = 'QV_HCommerce_01:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyRkZGViZGRiZGYxY2I0NTc1ODVkYTNjNjg4ODQ1NjU0ZCQwM2FlYzAwYjY1M2M0ZjY3YmVmMmNiMjQ0OTZkMTM4ZQ=='
username = 'indicadores@qvsaude.com.br'
password = '@2023yAt4@pRi&QV1nd1c4d0r35'
es = Elasticsearch(
    cloud_id=cloud_id,
    basic_auth=(username, password),
    request_timeout=1200
)

# Baixar relatórios do Elasticsearch
etapa("Baixando relatório de faturamento...", 35)
faturamento_raw = baixar_relatorio_listagem_cobrancas(es, data_inicial, data_final, "normal")
log_print('| - Faturamento                            (finalizado)')

etapa("Baixando relatório de contratos...", 45)
contratos = baixar_relatorio_contratos(es, faturamento_raw['_source.contratonumero'].drop_duplicates().tolist())
log_print('| - Contratos   (finalizado)')

etapa("Baixando relatório de beneficiários...", 55)
beneficiarios = baixar_relatorio_beneficiario(es, faturamento_raw[pd.isna(faturamento_raw['_source.contratonumeroproposta'])==False]['_source.contratonumeroproposta'].drop_duplicates().tolist())
log_print('| - Beneficiarios                          (finalizado)')

etapa("Baixando relatório de corretores...", 65)
bonificados = baixar_relatorio_corretores(es)
log_print('| - Corretores   (finalizado)')

# Processar dados
etapa("Processando e mesclando dados...", 70)
# ... código de processamento ...
df1 = df_beneficiarios.copy()
# ... merges e transformações ...

etapa("Aplicando filtros e regras de negócio...", 75)
# ... código de filtros ...

etapa("Calculando bonificações...", 80)
# ... código de cálculos ...

etapa("Gerando relatórios e estrutura final...", 85)
# ... código de geração de relatórios ...

etapa("Preparando dados para retorno...", 90)
# ... preparação dos DataFrames finais ...

etapa("Serializando resultados...", 95)
# ... conversão para JSON ...
```

## Distribuição Sugerida de Percentuais

- 0-5%: Inicialização e conexões iniciais
- 5-30%: Carregamento de tabelas auxiliares do banco
- 30-65%: Download de relatórios do Elasticsearch (esta parte costuma demorar mais)
- 65-80%: Processamento e mesclagem de dados
- 80-90%: Aplicação de filtros e cálculos
- 90-100%: Preparação e serialização dos resultados

## Importante

- Adicione `etapa()` ANTES de operações que podem demorar (downloads, queries grandes, processamentos pesados)
- Use `log_print()` para manter os prints originais do script
- O `etapa()` também imprime no stderr para garantir captura
- Não precisa ser exato nos percentuais, apenas distribua de forma lógica

