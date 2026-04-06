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

  const codigosCandidatos = [...new Set(avisosCandidatos.map(aviso => aviso.code))];

  const respuestaItems = await fetch(
    `${supabaseUrl}/rest/v1/items?select=code,is_recovered,recovery_reminder_sent&code=in.(${codigosCandidatos.map(code => `"${code}"`).join(',')})`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const items = await respuestaItems.json();

  if (!respuestaItems.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al leer items',
      detalle: items
    });
  }

  const itemsValidos = items.filter(item =>
    item.is_recovered === null && item.recovery_reminder_sent === false
  );

  if (itemsValidos.length === 0) {
    return res.status(200).json({
      ok: true,
      total_found_reports: datos.length,
      total_candidatos_2_dias: avisosCandidatos.length,
      total_items_validos_recordatorio: 0,
      message: 'No hay recordatorios pendientes de envío'
    });
  }

  const itemObjetivo = itemsValidos[0];

  const respuestaItemDetalle = await fetch(
    `${supabaseUrl}/rest/v1/items?select=code,owner_name,contact_info,description&code=eq.${itemObjetivo.code}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const itemDetalleArray = await respuestaItemDetalle.json();

  if (!respuestaItemDetalle.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al leer el detalle del item',
      detalle: itemDetalleArray
    });
  }

  const itemDetalle = itemDetalleArray && itemDetalleArray.length > 0 ? itemDetalleArray[0] : null;

  if (!itemDetalle || !itemDetalle.contact_info) {
    return res.status(200).json({
      ok: true,
      total_found_reports: datos.length,
      total_candidatos_2_dias: avisosCandidatos.length,
      total_items_validos_recordatorio: itemsValidos.length,
      message: 'No se ha encontrado un email válido para el recordatorio'
    });
  }

  return res.status(200).json({
    ok: true,
    total_found_reports: datos.length,
    total_candidatos_2_dias: avisosCandidatos.length,
    total_items_validos_recordatorio: itemsValidos.length,
    item_recordatorio_prueba: itemDetalle
  });
}
