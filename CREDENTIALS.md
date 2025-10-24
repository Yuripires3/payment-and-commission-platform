# Credenciais de Teste

## Acesso Administrativo

**CNPJ:** 12.345.678/0001-90  
**Usuário:** admin  
**Senha:** Admin@123

**Perfil:** Administrador do sistema com acesso total

---

## Acesso Parceiro 1 (Gold)

**CNPJ:** 98.765.432/0001-10  
**Usuário:** parceiro1  
**Senha:** Admin@123

**Perfil:** Parceiro Gold - João Silva  
**Empresa:** Empresa Parceira 1 LTDA  
**Comissões aprovadas:** R$ 3.227,50  
**Comissões pendentes:** R$ 4.330,00

---

## Acesso Parceiro 2 (Standard)

**CNPJ:** 11.222.333/0001-44  
**Usuário:** parceiro2  
**Senha:** Admin@123

**Perfil:** Parceiro Standard - Maria Santos  
**Empresa:** Empresa Parceira 2 LTDA  
**Comissões aprovadas:** R$ 1.200,00  
**Comissões pendentes:** R$ 512,00

---

## Dados de Teste Disponíveis

### Produtos
- PROD-001: Produto Premium A (R$ 1.500,00)
- PROD-002: Produto Standard B (R$ 800,00)
- PROD-003: Produto Básico C (R$ 350,00)
- PROD-004: Serviço Consultoria (R$ 5.000,00)
- PROD-005: Produto Premium D (R$ 2.200,00)

### Faturas
- 5 faturas de teste (3 verificadas, 2 pendentes)
- Total em comissões: R$ 9.269,50

### Pagamentos
- 3 pagamentos concluídos
- 2 pagamentos agendados

---

## Como Executar os Scripts

1. Execute o script de criação de tabelas:
   \`\`\`bash
   # O script 01_create_tables.sql será executado automaticamente
   \`\`\`

2. Execute o script de seed:
   \`\`\`bash
   # O script 02_seed_test_data.sql será executado automaticamente
   \`\`\`

3. Acesse o sistema com qualquer uma das credenciais acima

---

## Observações

- Todos os usuários de teste usam a mesma senha: **Admin@123**
- A senha está hasheada no banco usando bcrypt
- Os dados são apenas para demonstração e testes
- O CNPJ deve ser digitado com ou sem formatação (ambos funcionam)
