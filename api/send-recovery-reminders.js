export default async function handler(req, res) {
  const supabaseUrl = 'https://ihpwcqkmqdlmowqkjamq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel'
    });
  }

  return res.status(200).json({
    ok: true,
    message: 'Función lista para conectar con Supabase',
    supabaseUrl
  });
}
