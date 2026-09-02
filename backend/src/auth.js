import express from "express";
import { pool } from "./db.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      database: "connected"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      database: "error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }

    const result = await pool.query(
      `SELECT id, username, password_hash, balance
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Usuário ou senha inválidos."
      });
    }

    const user = result.rows[0];

    if (user.password_hash !== password) {
      return res.status(401).json({
        message: "Usuário ou senha inválidos."
      });
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});

export default router;
