import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? {
        rejectUnauthorized: false
      }
    : false
});

pool.on("error", (error) => {
  console.error(
    "Erro inesperado no pool do PostgreSQL:",
    error
  );
});


/* =========================
   ATUALIZAÇÃO AUTOMÁTICA DO BANCO
========================= */

export async function garantirEstruturaBanco() {
  try {

    /*
      Garante que a tabela users exista.
      Caso ela já exista, não altera os
      dados existentes.
    */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        bonus_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        cash_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        reserved_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        bonus_wager_progress NUMERIC(12,2) NOT NULL DEFAULT 0,
        roulette_free_spins INTEGER NOT NULL DEFAULT 0,
        roulette_free_spin_bet NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);


    /*
      Campos financeiros
    */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS balance
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bonus_balance
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS cash_balance
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reserved_balance
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bonus_wager_progress
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);


    /*
      Campos da roleta
    */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS roulette_free_spins
      INTEGER NOT NULL DEFAULT 0;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS roulette_free_spin_bet
      NUMERIC(12,2) NOT NULL DEFAULT 0;
    `);


    /*
      Garante created_at para contas/tabelas
      criadas anteriormente.
    */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);


    /*
      =========================
      TABELA DE GIROS DA ROLETA
      =========================

      Essa tabela registra cada giro
      realizado pelo jogador.
    */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS roulette_spins (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL,

        bet_amount NUMERIC(12,2)
          NOT NULL DEFAULT 0,

        result_index INTEGER,

        result_label TEXT,

        multiplier NUMERIC(12,2)
          NOT NULL DEFAULT 0,

        prize_amount NUMERIC(12,2)
          NOT NULL DEFAULT 0,

        free_spin BOOLEAN
          NOT NULL DEFAULT false,

        created_at TIMESTAMP
          NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);


    /*
      Índice para localizar rapidamente
      os giros de cada usuário.
    */

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
      roulette_spins_user_id_idx
      ON roulette_spins (user_id);
    `);


    console.log(
      "Estrutura do banco verificada com sucesso."
    );

  } catch (error) {

    console.error(
      "Erro ao atualizar a estrutura do banco:",
      error
    );

    throw error;
  }
}


export default pool;
