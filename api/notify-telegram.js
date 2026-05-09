const labels = {
  "orcamento": "Nova solicitação de orçamento",
  "pre-reserva": "Nova solicitação de pré-reserva",
};

const periodLabels = {
  tarde: "À tarde",
  noite: "À noite",
};

module.exports = async function handler(request, response) {
  if (request.method === "GET") {
    return response.status(200).json({
      ok: true,
      service: "telegram",
      botTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      chatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Método não permitido" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return response.status(500).json({
      error: "Telegram não configurado",
      botTokenConfigured: Boolean(token),
      chatIdConfigured: Boolean(chatId),
    });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const { type, payload } = body;
    const text = buildMessage(type, payload || {});

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!telegramResponse.ok) {
      const error = await telegramResponse.text();
      return response.status(502).json({
        error: "Telegram recusou o envio",
        details: error,
      });
    }

    return response.status(200).json({ ok: true });
} catch (err) {
  console.error("[notify-telegram] erro inesperado:", err);
    return response.status(500).json({ error: "Falha ao enviar notificação" });
  }
};

function buildMessage(type, payload) {
  const title = labels[type] || "Nova solicitação";
  const date = payload.date || "Data a definir";
  const period = periodLabels[payload.period] || "Período a definir";

  const rows = [
    `<b>${escapeHtml(title)}</b>`,
    "",
    `<b>Nome:</b> ${escapeHtml(payload.name || payload.requester || "Não informado")}`,
    `<b>WhatsApp:</b> ${escapeHtml(payload.phone || "Não informado")}`,
    `<b>Evento:</b> ${escapeHtml(payload.type || payload.title || "Não informado")}`,
    `<b>Data:</b> ${escapeHtml(date)}`,
    `<b>Período:</b> ${escapeHtml(period)}`,
    `<b>Cidade:</b> ${escapeHtml(payload.city || "Não informada")}`,
  ];

  if (payload.duration) rows.push(`<b>Duração:</b> ${escapeHtml(payload.duration)}`);
  if (payload.notes) rows.push("", `<b>Observações:</b> ${escapeHtml(payload.notes)}`);

  return rows.join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
