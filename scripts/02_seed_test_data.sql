-- Insert test admin user
-- Password: Admin@123
INSERT INTO users (cnpj, username, email, hashed_password, full_name, role, is_active)
VALUES 
    ('12.345.678/0001-90', 'admin', 'admin@empresa.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWU7u3oi', 'Administrador Sistema', 'admin', true),
    ('98.765.432/0001-10', 'parceiro1', 'parceiro1@empresa.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWU7u3oi', 'João Silva', 'partner', true),
    ('11.222.333/0001-44', 'parceiro2', 'parceiro2@empresa.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWU7u3oi', 'Maria Santos', 'partner', true)
ON CONFLICT (cnpj, username) DO NOTHING;

-- Insert test partners
INSERT INTO partners (user_id, cnpj, company_name, trade_name, contact_name, contact_email, contact_phone, city, state, bank_name, bank_branch, bank_account, bank_account_type, pix_key, tier)
VALUES 
    (2, '98.765.432/0001-10', 'Empresa Parceira 1 LTDA', 'Parceiro 1', 'João Silva', 'parceiro1@empresa.com', '(11) 98765-4321', 'São Paulo', 'SP', 'Banco do Brasil', '1234', '12345-6', 'Corrente', '98.765.432/0001-10', 'gold'),
    (3, '11.222.333/0001-44', 'Empresa Parceira 2 LTDA', 'Parceiro 2', 'Maria Santos', 'parceiro2@empresa.com', '(21) 91234-5678', 'Rio de Janeiro', 'RJ', 'Itaú', '5678', '98765-4', 'Corrente', 'maria.santos@email.com', 'standard')
ON CONFLICT (cnpj) DO NOTHING;

-- Insert test products
INSERT INTO products (code, name, description, category, base_price, is_active)
VALUES 
    ('PROD-001', 'Produto Premium A', 'Produto de alta qualidade categoria A', 'Premium', 1500.00, true),
    ('PROD-002', 'Produto Standard B', 'Produto padrão categoria B', 'Standard', 800.00, true),
    ('PROD-003', 'Produto Básico C', 'Produto básico categoria C', 'Básico', 350.00, true),
    ('PROD-004', 'Serviço Consultoria', 'Serviço de consultoria especializada', 'Serviços', 5000.00, true),
    ('PROD-005', 'Produto Premium D', 'Produto premium categoria D', 'Premium', 2200.00, true)
ON CONFLICT (code) DO NOTHING;

-- Insert test commission rules
INSERT INTO commission_rules (name, description, rule_type, product_id, partner_tier, percentage, priority, is_active)
VALUES 
    ('Comissão Premium Gold', 'Comissão de 15% para parceiros Gold em produtos Premium', 'percentage', 1, 'gold', 15.00, 10, true),
    ('Comissão Premium Standard', 'Comissão de 10% para parceiros Standard em produtos Premium', 'percentage', 1, 'standard', 10.00, 5, true),
    ('Comissão Standard Gold', 'Comissão de 12% para parceiros Gold em produtos Standard', 'percentage', 2, 'gold', 12.00, 10, true),
    ('Comissão Standard Standard', 'Comissão de 8% para parceiros Standard em produtos Standard', 'percentage', 2, 'standard', 8.00, 5, true),
    ('Comissão Serviços Gold', 'Comissão de 20% para parceiros Gold em serviços', 'percentage', 4, 'gold', 20.00, 10, true),
    ('Comissão Básico', 'Comissão de 5% para produtos básicos', 'percentage', 3, NULL, 5.00, 1, true)
ON CONFLICT DO NOTHING;

-- Insert test invoices
INSERT INTO invoices (invoice_number, partner_id, issue_date, due_date, total_amount, status)
VALUES 
    ('NF-2024-001', 1, '2024-01-15', '2024-02-15', 15000.00, 'verified'),
    ('NF-2024-002', 1, '2024-02-10', '2024-03-10', 8500.00, 'verified'),
    ('NF-2024-003', 2, '2024-01-20', '2024-02-20', 12000.00, 'verified'),
    ('NF-2024-004', 1, '2024-03-05', '2024-04-05', 22000.00, 'pending'),
    ('NF-2024-005', 2, '2024-03-12', '2024-04-12', 6500.00, 'pending')
ON CONFLICT (invoice_number) DO NOTHING;

-- Insert test invoice items
INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, quantity, unit_price, total_price, commission_amount)
VALUES 
    (1, 1, 'PROD-001', 'Produto Premium A', 10, 1500.00, 15000.00, 2250.00),
    (2, 2, 'PROD-002', 'Produto Standard B', 10, 800.00, 8000.00, 960.00),
    (2, 3, 'PROD-003', 'Produto Básico C', 1, 350.00, 350.00, 17.50),
    (3, 1, 'PROD-001', 'Produto Premium A', 8, 1500.00, 12000.00, 1200.00),
    (4, 4, 'PROD-004', 'Serviço Consultoria', 4, 5000.00, 20000.00, 4000.00),
    (4, 5, 'PROD-005', 'Produto Premium D', 1, 2200.00, 2200.00, 330.00),
    (5, 2, 'PROD-002', 'Produto Standard B', 8, 800.00, 6400.00, 512.00)
ON CONFLICT DO NOTHING;

-- Insert test commissions
INSERT INTO commissions (partner_id, invoice_id, invoice_item_id, amount, commission_type, status, period_month, period_year, approved_at, approved_by)
VALUES 
    (1, 1, 1, 2250.00, 'sales', 'approved', 1, 2024, '2024-01-20 10:00:00', 1),
    (1, 2, 2, 960.00, 'sales', 'approved', 2, 2024, '2024-02-15 10:00:00', 1),
    (1, 2, 3, 17.50, 'sales', 'approved', 2, 2024, '2024-02-15 10:00:00', 1),
    (2, 3, 4, 1200.00, 'sales', 'approved', 1, 2024, '2024-01-25 10:00:00', 1),
    (1, 4, 5, 4000.00, 'sales', 'pending', 3, 2024, NULL, NULL),
    (1, 4, 6, 330.00, 'sales', 'pending', 3, 2024, NULL, NULL),
    (2, 5, 7, 512.00, 'sales', 'pending', 3, 2024, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Insert test payments
INSERT INTO payments (partner_id, payment_type, amount, status, scheduled_date, pix_key, created_by)
VALUES 
    (1, 'pix', 2250.00, 'completed', '2024-02-01', '98.765.432/0001-10', 1),
    (1, 'pix', 977.50, 'completed', '2024-03-01', '98.765.432/0001-10', 1),
    (2, 'bank_transfer', 1200.00, 'completed', '2024-02-05', NULL, 1),
    (1, 'pix', 4330.00, 'scheduled', '2024-04-05', '98.765.432/0001-10', 1),
    (2, 'bank_transfer', 512.00, 'scheduled', '2024-04-10', NULL, 1)
ON CONFLICT DO NOTHING;
