# Otimização de Serialização JSON

## Problema

Quando o script Python fica muito tempo em "Finalizando..." ou "Serializando resultados...", geralmente é porque está convertendo DataFrames pandas muito grandes para JSON.

## Soluções

### 1. Usar `.to_dict('records')` ao invés de converter manualmente

```python
# ❌ EVITE: Conversão manual linha por linha (muito lento)
preview_df5 = []
for idx, row in df5.head(50).iterrows():
    preview_df5.append(row.to_dict())

# ✅ USE: Método otimizado do pandas
preview_df5 = df5.head(50).to_dict('records')
df5_completo = df5.to_dict('records')
```

### 2. Limitar tamanho de DataFrames grandes

```python
# Para preview, use apenas primeiras linhas
preview_df5 = df5.head(50).to_dict('records')

# Para o completo, pode ser grande mas tente limitar se possível
# ou serialize em chunks se muito grande
df5_completo = df5.to_dict('records')
```

### 3. Serializar sem indentação (mais rápido)

```python
# ❌ LENTO: Com indentação (legível mas lento)
json.dumps(resultado, indent=2)

# ✅ RÁPIDO: Sem indentação (menos legível mas muito mais rápido)
json.dumps(resultado, ensure_ascii=False, default=str)
```

### 4. Adicionar etapas intermediárias durante serialização

```python
etapa("Convertendo df5 para JSON...", 92)
resultado['df5'] = df5.to_dict('records')
log_print(f"df5 convertido: {len(resultado['df5'])} linhas")

etapa("Convertendo calc_pag para JSON...", 93)
resultado['calc_pag'] = calc_pag.to_dict('records')
log_print(f"calc_pag convertido: {len(resultado['calc_pag'])} linhas")

etapa("Convertendo df4_com_pix para JSON...", 94)
resultado['df4_com_pix'] = df4_com_pix.to_dict('records')
log_print(f"df4_com_pix convertido: {len(resultado['df4_com_pix'])} linhas")

etapa("Serializando JSON final...", 96)
json_str = json.dumps(resultado, ensure_ascii=False, default=str)
```

### 5. Tratar valores datetime antes de serializar

```python
# Converter datetime para string antes de serializar
def preparar_para_json(df):
    """Prepara DataFrame para serialização JSON"""
    df_dict = df.copy()
    for col in df_dict.columns:
        if df_dict[col].dtype == 'datetime64[ns]':
            df_dict[col] = df_dict[col].dt.strftime('%Y-%m-%d')
    return df_dict.to_dict('records')

# Usar assim:
resultado['df5'] = preparar_para_json(df5)
```

### 6. Se DataFrames forem MUITO grandes, considerar compressão

```python
import gzip
import base64

# Comprimir JSON antes de enviar (se muito grande)
json_str = json.dumps(resultado, ensure_ascii=False, default=str)
if len(json_str) > 10 * 1024 * 1024:  # Se maior que 10MB
    compressed = gzip.compress(json_str.encode('utf-8'))
    encoded = base64.b64encode(compressed).decode('utf-8')
    print(json.dumps({"compressed": True, "data": encoded}))
else:
    print(json_str)
```

## Tempo Estimado de Serialização

- DataFrame pequeno (< 1000 linhas): < 1 segundo
- DataFrame médio (1000-10000 linhas): 1-5 segundos
- DataFrame grande (10000-100000 linhas): 5-30 segundos
- DataFrame muito grande (> 100000 linhas): 30+ segundos

Se estiver demorando mais de 2 minutos em "Serializando...", provavelmente há um DataFrame com mais de 100k linhas ou a serialização não está otimizada.

## Debug

Adicione logs para identificar qual DataFrame está causando lentidão:

```python
import time

inicio = time.time()
etapa("Convertendo df5...", 92)
resultado['df5'] = df5.to_dict('records')
log_print(f"df5 convertido em {time.time() - inicio:.2f}s: {len(resultado['df5'])} linhas")

inicio = time.time()
etapa("Convertendo calc_pag...", 93)
resultado['calc_pag'] = calc_pag.to_dict('records')
log_print(f"calc_pag convertido em {time.time() - inicio:.2f}s: {len(resultado['calc_pag'])} linhas")
```

