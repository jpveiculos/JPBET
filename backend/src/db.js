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
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bonus_balance
      NUMERIC(12,2) NOT NULL DEFAULT 0;
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
