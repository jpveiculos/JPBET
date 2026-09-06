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

export default pool;
