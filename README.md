# Commission Platform Backend

Backend API para plataforma de gestão de comissões e bonificações B2B.

## Tecnologias

- **FastAPI** - Framework web moderno e rápido
- **SQLAlchemy** - ORM para banco de dados
- **PostgreSQL** - Banco de dados relacional
- **Celery** - Processamento assíncrono de tarefas
- **Redis** - Cache e broker para Celery
- **Alembic** - Migrações de banco de dados
- **JWT** - Autenticação via tokens
- **Pydantic** - Validação de dados

## Estrutura do Projeto

\`\`\`
.
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/      # Endpoints da API
│   │       └── router.py       # Router principal
│   ├── core/
│   │   ├── config.py          # Configurações
│   │   ├── database.py        # Conexão com banco
│   │   ├── security.py        # Autenticação e segurança
│   │   └── exceptions.py      # Exceções customizadas
│   ├── models/                # Modelos SQLAlchemy
│   ├── schemas/               # Schemas Pydantic
│   ├── services/              # Lógica de negócio
│   └── tasks/                 # Tarefas Celery
├── alembic/                   # Migrações de banco
├── main.py                    # Ponto de entrada
├── requirements.txt           # Dependências
└── .env.example              # Exemplo de variáveis de ambiente
\`\`\`

## Instalação

1. Clone o repositório
2. Crie um ambiente virtual:
\`\`\`bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
\`\`\`

3. Instale as dependências:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

4. Configure as variáveis de ambiente:
\`\`\`bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
\`\`\`

5. Execute as migrações:
\`\`\`bash
alembic upgrade head
\`\`\`

6. Inicie o servidor:
\`\`\`bash
python main.py
\`\`\`

## Executando com Docker

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentação da API

Acesse a documentação interativa em:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Principais Funcionalidades

### Autenticação
- Login com CNPJ + usuário + senha
- Suporte a MFA (SMS/WhatsApp/Email/App)
- JWT tokens (access + refresh)
- Perfis: Admin, Partner, Financial, Audit

### Gestão de Comissões
- Cadastro de produtos e regras de comissão
- Cálculo automático (fixo, percentual, híbrido)
- Simulador de comissões
- Ajustes manuais com auditoria

### Upload e Processamento
- Upload de faturas (CSV, XLSX, PDF)
- Processamento assíncrono com Celery
- Validação e conciliação automática
- OCR para PDFs

### Pagamentos
- Integração PIX
- Geração de remessa bancária
- Comprovantes automáticos
- Agenda de pagamentos

### Relatórios
- Dashboard com métricas
- Exportação (CSV, XLSX, PDF)
- Analytics e BI

### Auditoria
- Log completo de ações
- Trilha de alterações
- Conformidade LGPD

## Próximos Passos

- [ ] Implementar processamento de arquivos (CSV/XLSX/PDF)
- [ ] Integrar OCR para PDFs
- [ ] Implementar integração PIX
- [ ] Adicionar notificações (Email/WhatsApp)
- [ ] Implementar upload para S3
- [ ] Adicionar testes unitários e de integração
- [ ] Implementar cache com Redis
- [ ] Adicionar rate limiting
- [ ] Implementar webhooks
- [ ] Criar dashboard administrativo
