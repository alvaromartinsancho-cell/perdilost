import { createRecoveryToken } from './_recovery-token.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Método no permitido'
    });
  }

  const cronSecret = process.env.RECOVERY_REMINDER_CRON_SECRET;
  const secretRecibido = typeof req.query?.secret === 'string' ? req.query.secret : '';

  if (!cronSecret) {
    return res.status(500).json({
      ok: false,
      error: 'Error de configuración del servidor'
    });
  }

  if (!secretRecibido || secretRecibido !== cronSecret) {
    return res.status(401).json({
      ok: false,
      error: 'No autorizado'
    });
  }

  const supabaseUrl = 'https://ihpwcqkmqdlmowqkjamq.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Error de configuración del servidor'
    });
  }

  if (!resendApiKey) {
    return res.status(500).json({
      ok: false,
      error: 'Error de configuración del servidor'
    });
  }

  const respuesta = await fetch(
    `${supabaseUrl}/rest/v1/found_reports?select=id,code,created_at&order=created_at.asc`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al leer found_reports'
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
      error: 'Error al leer items'
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
    `${supabaseUrl}/rest/v1/items?select=code,owner_name,contact_info,description,preferred_language&code=eq.${itemObjetivo.code}`,
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
      error: 'Error al leer el detalle del item'
    });
  }

  const itemDetalle = itemDetalleArray && itemDetalleArray.length > 0 ? itemDetalleArray[0] : null;
  const idiomaReminder = itemDetalle?.preferred_language === 'en' ? 'en' : 'es';

  if (!itemDetalle || !itemDetalle.contact_info) {
    return res.status(200).json({
      ok: true,
      total_found_reports: datos.length,
      total_candidatos_1_dia: avisosCandidatos.length,
      total_items_validos_recordatorio: itemsValidos.length,
      message: 'No se ha encontrado un email válido para el recordatorio'
    });
  }

  const recoveryToken = createRecoveryToken(itemDetalle.code);
  const recoveryUrl = `https://perdilost.com/recuperado.html?token=${encodeURIComponent(recoveryToken)}`;

  const respuestaEmail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Perdilost <avisos@perdilost.com>',
      to: [itemDetalle.contact_info],
      subject: idiomaReminder === 'en'
        ? 'Have you already recovered your item with Perdilost?'
        : '¿Has recuperado ya tu objeto en Perdilost?',
      text: idiomaReminder === 'en'
        ? `Hello ${itemDetalle.owner_name || ''},

We are writing to ask whether you have already recovered the item associated with code ${itemDetalle.code}.

Registered description:
${itemDetalle.description || 'Not provided'}

If you have already recovered it, or you have arranged to recover it soon, please confirm it here so we can improve the service and keep a record that you were able to recover it:
${recoveryUrl}

Thank you for using Perdilost.`
        : `Hola ${itemDetalle.owner_name || ''},

Te escribimos para saber si finalmente has recuperado tu objeto asociado al código ${itemDetalle.code}.

Descripción registrada:
${itemDetalle.description || 'No informada'}

Si ya lo has recuperado, o has quedado con la persona para recuperarlo próximamente, te rogamos que nos lo confirmes para ayudarnos a mejorar el servicio y para que quede registrado que has podido recuperarlo:
${recoveryUrl}

Gracias por utilizar Perdilost.`,
      html: `
        <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
            <div style="margin-bottom:24px;">
              <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
              <p style="margin:8px 0 0 0;color:#475569;">${idiomaReminder === 'en' ? 'Have you already recovered your item with Perdilost?' : '¿Has recuperado ya tu objeto en Perdilost?'}</p>
            </div>

            <p style="margin:0 0 16px 0;">${idiomaReminder === 'en' ? 'Hello' : 'Hola'} ${itemDetalle.owner_name || ''},</p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              ${idiomaReminder === 'en'
                ? `We are writing to ask whether you have already recovered the item associated with code <strong>${itemDetalle.code}</strong>.`
                : `Te escribimos para saber si finalmente has recuperado tu objeto asociado al código <strong>${itemDetalle.code}</strong>.`}
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">${idiomaReminder === 'en' ? 'Registered description' : 'Descripción registrada'}</div>
              <div style="color:#1f2937;line-height:1.7;">${itemDetalle.description || (idiomaReminder === 'en' ? 'Not provided' : 'No informada')}</div>
            </div>

            <p style="margin:24px 0;line-height:1.7;color:#475569;">
              ${idiomaReminder === 'en'
                ? 'If you have already recovered it, or you have arranged to recover it soon, please confirm it so we can improve the service and keep a record that you were able to recover it.'
                : 'Si ya lo has recuperado, o has quedado con la persona para recuperarlo próximamente, te rogamos que nos lo confirmes para ayudarnos a mejorar el servicio y para que quede registrado que has podido recuperarlo.'}
            </p>

            <div style="margin:28px 0;">
              <a href="${recoveryUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;">
                ${idiomaReminder === 'en' ? 'Confirm whether you have recovered it' : 'Confirmar si lo has recuperado'}
              </a>
            </div>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
              ${idiomaReminder === 'en'
                ? 'If you have any questions or would like more information about Perdilost, you can write to'
                : 'Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a'}
              <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.

              <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
                ${idiomaReminder === 'en'
                  ? 'If you wish to unsubscribe from our communications, write the word unsubscribe to the following email address:'
                  : 'Si deseas darte de baja de nuestras comunicaciones, escribe la palabra baja a la siguiente dirección de email:'}
                <a href="mailto:infoperdilost@gmail.com" style="color:#64748b;text-decoration:none;">infoperdilost@gmail.com</a>
              </div>
            </div>
          </div>
        </div>
      `
    })
  });

  try {
    await respuestaEmail.json();
  } catch (e) {}

  if (!respuestaEmail.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Error al enviar el recordatorio'
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

  await respuestaUpdateItem.text();

  if (!respuestaUpdateItem.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Email enviado, pero no se pudo actualizar items'
    });
  }

  return res.status(200).json({
    ok: true,
    total_found_reports: datos.length,
    total_candidatos_1_dia: avisosCandidatos.length,
    total_items_validos_recordatorio: itemsValidos.length,
    recovery_reminder_sent: true,
    message: 'Recordatorio enviado correctamente'
  });
}
