export default async function handler(req, res) {
  const supabaseUrl = 'https://ihpwcqkmqdlmowqkjamq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel'
    });
  }

  const respuesta = await fetch(`${supabaseUrl}/rest/v1/found_reports?select=id,code,created_at&order=created_at.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al leer found_reports',
      detalle: datos
    });
  }

  const ahora = new Date();
  const haceDosDias = new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000);

  const avisosCandidatos = datos.filter(aviso => {
    return new Date(aviso.created_at) <= haceDosDias;
  });

  return res.status(200).json({
    ok: true,
    total_found_reports: datos.length,
    total_candidatos_2_dias: avisosCandidatos.length,
    primer_candidato: avisosCandidatos[0] || null
  });
}
