import crypto from "crypto";

const sessoes = new Map();

const TEMPO_SESSAO = 1000 * 60 * 60 * 24;

export function criarSessaoAdmin(username) {
  const token = crypto.randomBytes(32).toString("hex");

  sessoes.set(token, {
    username,
    criadoEm: Date.now()
  });

  return token;
}

export function validarSessaoAdmin(token) {
  if (!token) {
    return null;
  }

  const sessao = sessoes.get(token);

  if (!sessao) {
    return null;
  }

  if (Date.now() - sessao.criadoEm > TEMPO_SESSAO) {
    sessoes.delete(token);
    return null;
  }

  return sessao;
}

export function removerSessaoAdmin(token) {
  if (token) {
    sessoes.delete(token);
  }
}
