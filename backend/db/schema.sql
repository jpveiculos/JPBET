-- =========================================================
-- JPBET - ESTRUTURA PRINCIPAL DO BANCO
-- =========================================================

-- =========================================================
-- USUÁRIOS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    balance NUMERIC(12,2) DEFAULT 0,
    reserved_balance NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Garante a coluna caso a tabela users já exista
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12,2) DEFAULT 0;

-- =========================================================
-- GIROS / ROLETA
-- =========================================================

CREATE TABLE IF NOT EXISTS spins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    result VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TRANSAÇÕES FINANCEIRAS
-- =========================================================

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- ADMINISTRADORES
-- =========================================================

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- DEPÓSITOS
-- =========================================================

CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(30) DEFAULT 'pix',
    player_note TEXT,
    admin_note TEXT,
    approved_by INTEGER REFERENCES admins(id),
    approved_at TIMESTAMP,
    rejected_by INTEGER REFERENCES admins(id),
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- SAQUES
-- =========================================================

CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(12,2) NOT NULL,

    -- pending = aguardando análise
    -- approved = aprovado
    -- paid = pagamento concluído / baixa realizada
    -- rejected = rejeitado
    -- refunded = valor devolvido ao saldo disponível
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    withdrawal_method VARCHAR(30) DEFAULT 'pix',
    pix_key TEXT,
    player_note TEXT,
    admin_note TEXT,
    rejection_reason TEXT,

    approved_by INTEGER REFERENCES admins(id),
    approved_at TIMESTAMP,

    paid_by INTEGER REFERENCES admins(id),
    paid_at TIMESTAMP,

    rejected_by INTEGER REFERENCES admins(id),
    rejected_at TIMESTAMP,

    refunded_by INTEGER REFERENCES admins(id),
    refunded_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- AUDITORIA ADMINISTRATIVA
-- =========================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    description TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_spins_user_id
ON spins(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
ON transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id
ON deposits(user_id);

CREATE INDEX IF NOT EXISTS idx_deposits_status
ON deposits(status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id
ON withdrawals(user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status
ON withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
ON admin_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
ON admin_audit_logs(created_at);

-- =========================================================
-- GARANTIR VALORES PADRÃO
-- =========================================================

UPDATE users
SET reserved_balance = 0
WHERE reserved_balance IS NULL;

-- =========================================================
-- ADMIN PADRÃO
-- =========================================================

INSERT INTO admins (username, password_hash)
VALUES ('admin', '123456')
ON CONFLICT (username) DO NOTHING;

-- =========================================================
-- USUÁRIO ADMINISTRATIVO DE TESTE
-- =========================================================

INSERT INTO users (username, password_hash, balance)
VALUES ('admin', '123456', 1000.00)
ON CONFLICT (username) DO NOTHING;
