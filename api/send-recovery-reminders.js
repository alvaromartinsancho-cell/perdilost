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
  const haceUnDia = new Date(ahora.getTime() - 1 * 24 * 60 * 60 * 1000);

  const avisosCandidatos = datos.filter(aviso => {
    return new Date(aviso.created_at) <= haceUnDia;
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
      total_candidatos_1_dia: avisosCandidatos.length,
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
      total_candidatos_1_dia: avisosCandidatos.length,
      total_items_validos_recordatorio: itemsValidos.length,
      message: 'No se ha encontrado un email válido para el recordatorio'
    });
  }

    const respuestaEmail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Perdilost <avisos@perdilost.com>',
      to: [itemDetalle.contact_info],
      subject: '¿Has recuperado ya tu objeto en Perdilost?',
      text: `Hola ${itemDetalle.owner_name || ''},

Te escribimos para saber si finalmente has recuperado tu objeto asociado al código ${itemDetalle.code}.

Descripción registrada:
${itemDetalle.description || 'No informada'}

Si ya lo has recuperado, o has quedado con la persona para recuperarlo próximamente, te rogamos que nos lo confirmes para ayudarnos a mejorar el servicio y para que quede registrado que has podido recuperarlo:
https://perdilost.com/recuperado.html?code=${itemDetalle.code}

Gracias por utilizar Perdilost.`,
      html: `
        <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
            <div style="margin-bottom:24px;">
              <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
              <p style="margin:8px 0 0 0;color:#475569;">¿Has recuperado ya tu objeto en Perdilost?</p>
            </div>

            <p style="margin:0 0 16px 0;">Hola ${itemDetalle.owner_name || ''},</p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              Te escribimos para saber si finalmente has recuperado tu objeto asociado al código <strong>${itemDetalle.code}</strong>.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Descripción registrada</div>
              <div style="color:#1f2937;line-height:1.7;">${itemDetalle.description || 'No informada'}</div>
            </div>

            <p style="margin:24px 0;line-height:1.7;color:#475569;">
              Si ya lo has recuperado, o has quedado con la persona para recuperarlo próximamente, te rogamos que nos lo confirmes para ayudarnos a mejorar el servicio y para que quede registrado que has podido recuperarlo.
            </p>

            <div style="margin:28px 0;">
              <a href="https://perdilost.com/recuperado.html?code=${itemDetalle.code}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">
                Confirmar si lo has recuperado
              </a>
            </div>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
              Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a
              <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.

              <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
                Si deseas darte de baja de nuestras comunicaciones, escribe la palabra baja a la siguiente dirección de email:
                <a href="mailto:infoperdilost@gmail.com" style="color:#64748b;text-decoration:none;">infoperdilost@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      `
    })
  });

  const resultadoEmail = await respuestaEmail.json();

  if (!respuestaEmail.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al enviar el recordatorio',
      email_resultado: resultadoEmail
    });
  }

  const respuestaUpdateItem = await fetch(
    `${supabaseUrl}/rest/v1/items?code=eq.${itemDetalle.code}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recovery_reminder_sent: true,
        recovery_reminder_sent_at: new Date().toISOString()
      })
    }
  );

  const resultadoUpdateItem = await respuestaUpdateItem.text();

  if (!respuestaUpdateItem.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Email enviado, pero no se pudo actualizar items',
      detalle_update: resultadoUpdateItem
    });
  }

  return res.status(200).json({
    ok: true,
    total_found_reports: datos.length,
    total_candidatos_1_dia: avisosCandidatos.length,
    total_items_validos_recordatorio: itemsValidos.length,
    reminder_sent_to: itemDetalle.contact_info,
    reminder_sent_code: itemDetalle.code,
    recovery_reminder_sent: true
  });
}
