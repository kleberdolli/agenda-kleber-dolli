module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Método não permitido" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseTable = process.env.SUPABASE_TABLE || "agenda_events";

  if (!supabaseUrl || !supabaseAnonKey) {
    return response.status(503).json({
      error: "Supabase não configurado",
      supabaseConfigured: false,
    });
  }

  return response.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    supabaseTable,
  });
};
