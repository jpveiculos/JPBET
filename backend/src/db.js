import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function inicializarBanco() {
  try {
    /* Base completa e compatível com as migrações existentes. */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        balance NUMERIC(12,2) DEFAULT 0,
        bonus_balance NUMERIC(12,2) DEFAULT 0,
        cash_balance NUMERIC(12,2) DEFAULT 0,
        reserved_balance NUMERIC(12,2) DEFAULT 0,
        bonus_wager_progress NUMERIC(12,2) DEFAULT 0,
        roulette_free_spins INTEGER DEFAULT 0,
        roulette_free_spin_bet NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        result VARCHAR(50) NOT NULL,
        amount NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(30) NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        module VARCHAR(50),
        target_type VARCHAR(50),
        target_id VARCHAR(100),
        old_value JSONB,
        new_value JSONB,
        details TEXT,
        result VARCHAR(30) DEFAULT 'SUCCESS',
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12,2) NOT NULL,
        pix_key TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        processed_by VARCHAR(100) NULL
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount NUMERIC(12,2) NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
      CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
      CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
    `);

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_wager_progress NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS roulette_free_spins INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS roulette_free_spin_bet NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      UPDATE users
      SET bonus_balance = COALESCE(bonus_balance, 0),
          cash_balance = CASE
            WHEN COALESCE(cash_balance, 0) = 0 AND COALESCE(bonus_balance, 0) = 0
            THEN COALESCE(balance, 0)
            ELSE COALESCE(cash_balance, 0)
          END,
          reserved_balance = COALESCE(reserved_balance, 0),
          bonus_wager_progress = COALESCE(bonus_wager_progress, 0),
          roulette_free_spins = COALESCE(roulette_free_spins, 0),
          roulette_free_spin_bet = COALESCE(roulette_free_spin_bet, 0),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

      UPDATE users
      SET balance = ROUND((COALESCE(bonus_balance,0) + COALESCE(cash_balance,0))::numeric, 2)
      WHERE balance IS NULL
         OR balance <> ROUND((COALESCE(bonus_balance,0) + COALESCE(cash_balance,0))::numeric, 2);
    `);

    console.log("Banco MyBets inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    throw error;
  }
}

inicializarBanco();
