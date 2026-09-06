import express from "express";

import {
  criarSessaoAdmin,
  validarSessaoAdmin,
  removerSessaoAdmin
} from "./adminSession.js";

const router = express.Router();

const COOKIE_NAME = "jpbet_admin_session";

const ADMIN_USER =
  process.env.ADMIN_USER;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

/* =========================
   COOKIE
========================= */

function obterCookie(req) {
  const cookies =
    req.headers.cookie || "";

  const partes =
    cookies.split(";");

  for (const parte of partes) {
    const separador =
      parte.indexOf("=");

    if (separador === -1) {
      continue;
    }

    const nome =
      parte
        .substring(0, separador)
        .trim();

    const valor =
      parte
        .substring(separador + 1)
        .trim();

    if (nome === COOKIE_NAME) {
      try {
        return decodeURIComponent(
          valor
        );
      } catch {
        return valor;
      }
    }
  }

  return null;
}

function criarCookie(
  token
) {
  const secure =
    process.env.NODE_ENV ===
    "production"
      ? "; Secure"
      : "";

  return (
    `${COOKIE_NAME}=${encodeURIComponent(token)}` +
    `; Path=/` +
    `; HttpOnly` +
    `; SameSite=Lax` +
    secure
  );
}

function expirarCookie() {
  const secure =
    process.env.NODE_ENV ===
    "production"
      ? "; Secure"
      : "";

  return (
    `${COOKIE_NAME}=` +
    `; Path=/` +
    `; HttpOnly` +
    `; SameSite=Lax` +
    secure +
    `; Max-Age=0`
  );
}

/* =========================
   LOGIN ADMIN
========================= */

router.post(
  "/admin-login",
  async (req, res) => {
    try {
      const username =
        String(
          req.body?.username ||
          ""
        ).trim();

      const password =
        String(
          req.body?.password ||
          ""
        );

      if (
        !username ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Usuário e senha são obrigatórios."
        });
      }

      if (
        !ADMIN_USER ||
        !ADMIN_PASSWORD
      ) {
        console.error(
          "ADMIN_USER ou ADMIN_PASSWORD não configurados no ambiente."
        );

        return res.status(500).json({
          success: false,
          message:
            "Credenciais administrativas não configuradas no servidor."
        });
      }

      if (
        username !==
          String(ADMIN_USER) ||
        password !==
          String(ADMIN_PASSWORD)
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Usuário ou senha de administrador inválidos."
        });
      }

      const token =
        criarSessaoAdmin({
          adminId:
            "env-admin",

          username
        });

      res.setHeader(
        "Set-Cookie",
        criarCookie(token)
      );

      return res.json({
        success: true,
        authenticated: true,

        admin: {
          id: "env-admin",
          username
        },

        message:
          "Login administrativo realizado com sucesso."
      });

    } catch (error) {
      console.error(
        "Erro no login administrativo:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Erro interno ao realizar login administrativo."
      });
    }
  }
);

/* =========================
   VERIFICAR SESSÃO
========================= */

router.get(
  "/admin-session",
  (req, res) => {
    try {
      const token =
        obterCookie(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Sessão administrativa não encontrada."
        });
      }

      const sessao =
        validarSessaoAdmin(
          token
        );

      if (!sessao) {
        res.setHeader(
          "Set-Cookie",
          expirarCookie()
        );

        return res.status(401).json({
          success: false,
          authenticated: false,
          message:
            "Sessão administrativa inválida ou expirada."
        });
      }

      return res.json({
        success: true,
        authenticated: true,

        admin: {
          id:
            sessao.adminId,

          username:
            sessao.username
        }
      });

    } catch (error) {
      console.error(
        "Erro ao verificar sessão:",
        error
      );

      res.setHeader(
        "Set-Cookie",
        expirarCookie()
      );

      return res.status(401).json({
        success: false,
        authenticated: false,
        message:
          "Sessão administrativa inválida."
      });
    }
  }
);

/* =========================
   LOGOUT ADMIN
========================= */

router.post(
  "/admin-logout",
  (req, res) => {
    try {
      const token =
        obterCookie(req);

      if (token) {
        removerSessaoAdmin(
          token
        );
      }

      res.setHeader(
        "Set-Cookie",
        expirarCookie()
      );

      return res.json({
        success: true,
        authenticated: false,
        message:
          "Logout administrativo realizado com sucesso."
      });

    } catch (error) {
      console.error(
        "Erro no logout:",
        error
      );

      res.setHeader(
        "Set-Cookie",
        expirarCookie()
      );

      return res.json({
        success: true,
        authenticated: false
      });
    }
  }
);

export default router;
