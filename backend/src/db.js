import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        balance NUMERIC(12,2) DEFAULT 0,
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

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
        ON audit_logs(created_at);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
        ON audit_logs(user_id);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_action
        ON audit_logs(action);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_module
        ON audit_logs(module);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id
        ON audit_logs(target_id);


      /* ==========================================
         SOLICITAÇÕES DE SAQUE
         ========================================== */

      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id BIGSERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        amount NUMERIC(12,2) NOT NULL,

        pix_key TEXT NOT NULL,

        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        processed_at TIMESTAMP NULL,

        processed_by VARCHAR(100) NULL
      );

      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
        ON withdrawal_requests(user_id);

      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
        ON withdrawal_requests(status);

      CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at
        ON withdrawal_requests(created_at);
    `);

    console.log("Banco inicializado com sucesso.");

  } catch (error) {

    console.error(
      "Erro ao inicializar banco:",
      error
    );
  }
}

inicializarBanco();
