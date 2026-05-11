module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método não permitido" });
  }

  const expected = (process.env.ADMIN_PASSWORD || "").trim();
  if (!expected) {
    return response.status(503).json({
      error: "Painel administrativo não configurado (defina ADMIN_PASSWORD no servidor).",
    });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const password = typeof body.password === "string" ? body.password.trim() : "";

    if (!password) {
      return response.status(400).json({ error: "Informe a senha." });
    }

    if (password !== expected) {
      return response.status(401).json({ error: "Senha incorreta." });
    }

    return response.status(200).json({ ok: true });
  } catch (err) {
    console.error("[admin-login] erro:", err);
    return response.status(400).json({ error: "Corpo da requisição inválido." });
  }
};
