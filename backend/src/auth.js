import express from "express";
import { pool } from "./db.js";
const router = express.Router();
/* =========================
   VERIFICAÇÃO DO BANCO
========================= */
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
/* =========================
   CADASTRO DE USUÁRIO
========================= */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }
    if (username.length < 3) {
      return res.status(400).json({
        message: "O usuário deve ter pelo menos 3 caracteres."
      });
    }
    if (password.length < 4) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 4 caracteres."
      });
    }
    const existingUser = await pool.query(
      `SELECT id FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Esse usuário já existe."
      });
    }
    const result = await pool.query(
      `INSERT INTO users
       (username, password_hash, balance)
       VALUES ($1, $2, 0)
       RETURNING id, username, balance`,
      [username, password]
    );
    res.status(201).json({
      ok: true,
      message: "Usuário criado com sucesso.",
      user: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});
/* =========================
   LOGIN DE USUÁRIO
========================= */
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
/* =========================
   LOGIN ADMINISTRATIVO
========================= */
router.post("/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      `SELECT id, username, password_hash
       FROM admins
       WHERE username = $1
       LIMIT 1`,
      [username]
    );
    if (result.rows.length > 0) {
      const admin = result.rows[0];
      if (admin.password_hash === password) {
        return res.json({
          ok: true,
          admin: true,
          username: admin.username
        });
      }
    }
    /* Mantém o administrador antigo funcionando */
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (
      adminPassword &&
      username === adminUser &&
      password === adminPassword
    ) {
      return res.json({
        ok: true,
        admin: true,
        username: adminUser
      });
    }
    return res.status(401).json({
      message: "Credenciais administrativas inválidas."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});
/* =========================
   CADASTRAR ADMINISTRADOR
========================= */
router.post("/admin-register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        message: "Informe usuário e senha."
      });
    }
    if (username.length < 3) {
      return res.status(400).json({
        message: "O usuário deve ter pelo menos 3 caracteres."
      });
    }
    if (password.length < 4) {
      return res.status(400).json({
        message: "A senha deve ter pelo menos 4 caracteres."
      });
    }
    const existingAdmin = await pool.query(
      `SELECT id FROM admins
       WHERE username = $1
       LIMIT 1`,
      [username]
    );
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        message: "Esse administrador já existe."
      });
    }
    const result = await pool.query(
      `INSERT INTO admins
       (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, created_at`,
      [username, password]
    );
    res.status(201).json({
      ok: true,
      message: "Administrador criado com sucesso.",
      admin: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  }
});
export default router;
