import { createRecoveryToken } from './_recovery-token.js';

export default async function handler(req, res) {
  const idioma = req.query?.language === 'en' ? 'en' : 'es';

  try {
    const textos = {
      es: {
        methodNotAllowed: 'Método no permitido',
        serverConfig: 'Error de configuración del servidor',
        unauthorized: 'No autorizado',
        readFoundReportsError: 'Error al leer found_reports',
        readItemsError: 'Error al leer items',
        noPendingReminders: 'No hay recordatorios pendientes de envío',
        noValidEmail: 'No se ha encontrado un email válido para el recordatorio',
        readItemDetailError: 'Error al leer el detalle del item',
        sendReminderError: 'Error al enviar el recordatorio',
        updateItemsError: 'Email enviado, pero no se pudo actualizar items',
        success: 'Recordatorios procesados correctamente'
      },
      en: {
        methodNotAllowed: 'Method not allowed',
        serverConfig: 'Server configuration error',
        unauthorized: 'Unauthorized',
        readFoundReportsError: 'Error reading found_reports',
        readItemsError: 'Error reading items',
        noPendingReminders: 'There are no pending reminders to send',
        noValidEmail: 'No valid email was found for the reminder',
        readItemDetailError: 'Error reading the item details',
        sendReminderError: 'Error sending the reminder',
        updateItemsError: 'Email sent, but items could not be updated',
        success: 'Reminders processed correctly'
      }
    };

    if (req.method !== 'GET') {
      return res.status(405).json({
        ok: false,
        error: textos[idioma].methodNotAllowed
      });
    }

    const cronSecret = process.env.CRON_SECRET;

    const secretRecibidoPorQuery =
      typeof req.query?.secret === 'string' ? req.query.secret : '';

    const authorizationHeader =
      typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';

    const bearerPrefix = 'Bearer ';
    const secretRecibidoPorHeader = authorizationHeader.startsWith(bearerPrefix)
      ? authorizationHeader.slice(bearerPrefix.length).trim()
      : '';

    if (!cronSecret) {
      return res.status(500).json({
        ok: false,
        error: textos[idioma].serverConfig
      });
    }

    const autorizado =
      secretRecibidoPorQuery === cronSecret ||
      secretRecibidoPorHeader === cronSecret;

    if (!autorizado) {
      return res.status(401).json({
        ok: false,
        error: textos[idioma].unauthorized
      });
    }

    const supabaseUrl = 'https://ihpwcqkmqdlmowqkjamq.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseKey) {
      return res.status(500).json({
        ok: false,
        error: textos[idioma].serverConfig
      });
    }

    if (!resendApiKey) {
      return res.status(500).json({
        ok: false,
        error: textos[idioma].serverConfig
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

    let datos = [];

    try {
      datos = await respuesta.json();
    } catch (e) {
      datos = [];
    }

    if (!respuesta.ok) {
      return res.status(500).json({
        ok: false,
        error: textos[idioma].readFoundReportsError
      });
    }

    const ahora = new Date();
    const haceUnDia = new Date(ahora.getTime() - 1 * 24 * 60 * 60 * 1000);

    const avisosCandidatos = datos.filter(aviso => {
      return new Date(aviso.created_at) <= haceUnDia;
    });

    const codigosCandidatos = [...new Set(avisosCandidatos.map(aviso => aviso.code))];

    if (codigosCandidatos.length === 0) {
      return res.status(200).json({
        ok: true,
        total_found_reports: datos.length,
        total_candidatos_1_dia: 0,
        total_items_validos_recordatorio: 0,
        enviados: 0,
        fallidos: 0,
        sin_email_valido: 0,
        codigos_enviados: [],
        codigos_fallidos: [],
        codigos_sin_email: [],
        message: textos[idioma].noPendingReminders
      });
    }

    const respuestaItems = await fetch(
      `${supabaseUrl}/rest/v1/items?select=code,is_recovered,recovery_reminder_sent&code=in.(${codigosCandidatos.map(code => `"${code}"`).join(',')})`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    let items = [];

    try {
      items = await respuestaItems.json();
    } catch (e) {
      items = [];
    }

    if (!respuestaItems.ok) {
      return res.status(500).json({
        ok: false,
        error: textos[idioma].readItemsError
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
        enviados: 0,
        fallidos: 0,
        sin_email_valido: 0,
        codigos_enviados: [],
        codigos_fallidos: [],
        codigos_sin_email: [],
        message: textos[idioma].noPendingReminders
      });
    }

    let enviados = 0;
    let fallidos = 0;
    let sinEmailValido = 0;

    const codigosEnviados = [];
    const codigosFallidos = [];
    const codigosSinEmail = [];

    for (const itemObjetivo of itemsValidos) {
      const respuestaItemDetalle = await fetch(
        `${supabaseUrl}/rest/v1/items?select=code,owner_name,contact_info,description,preferred_language&code=eq.${itemObjetivo.code}`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`
          }
        }
      );

      let itemDetalleArray = [];

      try {
        itemDetalleArray = await respuestaItemDetalle.json();
      } catch (e) {
        itemDetalleArray = [];
      }

      if (!respuestaItemDetalle.ok) {
        fallidos += 1;
        codigosFallidos.push(itemObjetivo.code);
        continue;
      }

      const itemDetalle = Array.isArray(itemDetalleArray) && itemDetalleArray.length > 0
        ? itemDetalleArray[0]
        : null;

      const idiomaReminder = itemDetalle?.preferred_language === 'en' ? 'en' : 'es';

      if (!itemDetalle || !itemDetalle.contact_info) {
        sinEmailValido += 1;
        codigosSinEmail.push(itemObjetivo.code);
        continue;
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

We have detected that the Perdilost code linked to your item (${itemDetalle.code}) has been used recently.

For this reason, we would like to ask whether you have already recovered it or whether you have arranged with the person who found it to recover it soon.

Registered description:
${itemDetalle.description || 'Not provided'}

If you have already recovered it, or if you have arranged to recover it soon, we would appreciate it if you could confirm it here so we can improve the service and keep a record that you were able to recover it:
${recoveryUrl}

Thank you for using Perdilost.`
            : `Hola ${itemDetalle.owner_name || ''},

Hemos detectado que el código de tu objeto asociado a Perdilost (${itemDetalle.code}) ha sido utilizado recientemente.

Por eso, queríamos preguntarte si ya has podido recuperarlo o si has quedado con la persona que lo encontró para recuperarlo próximamente.

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
                    ? `We have detected that the Perdilost code linked to your item (<strong>${itemDetalle.code}</strong>) has been used recently.`
                    : `Hemos detectado que el código de tu objeto asociado a Perdilost (<strong>${itemDetalle.code}</strong>) ha sido utilizado recientemente.`}
                </p>

                <p style="margin:0 0 20px 0;line-height:1.7;">
                  ${idiomaReminder === 'en'
                    ? 'For this reason, we would like to ask whether you have already recovered it or whether you have arranged with the person who found it to recover it soon.'
                    : 'Por eso, queríamos preguntarte si ya has podido recuperarlo o si has quedado con la persona que lo encontró para recuperarlo próximamente.'}
                </p>

                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
                  <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">${idiomaReminder === 'en' ? 'Registered description' : 'Descripción registrada'}</div>
                  <div style="color:#1f2937;line-height:1.7;">${itemDetalle.description || (idiomaReminder === 'en' ? 'Not provided' : 'No informada')}</div>
                </div>

                <p style="margin:24px 0;line-height:1.7;color:#475569;">
                  ${idiomaReminder === 'en'
                    ? 'If you have already recovered it, or if you have arranged to recover it soon, we would appreciate it if you could confirm it so we can improve the service and keep a record that you were able to recover it.'
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
        fallidos += 1;
        codigosFallidos.push(itemDetalle.code);
        continue;
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
        fallidos += 1;
        codigosFallidos.push(itemDetalle.code);
        continue;
      }

      enviados += 1;
      codigosEnviados.push(itemDetalle.code);
    }

    if (enviados === 0 && fallidos === 0 && sinEmailValido > 0) {
      return res.status(200).json({
        ok: true,
        total_found_reports: datos.length,
        total_candidatos_1_dia: avisosCandidatos.length,
        total_items_validos_recordatorio: itemsValidos.length,
        enviados,
        fallidos,
        sin_email_valido: sinEmailValido,
        codigos_enviados: [],
        codigos_fallidos: [],
        codigos_sin_email: codigosSinEmail,
        recovery_reminder_sent: false,
        message: textos[idioma].noValidEmail
      });
    }

    return res.status(200).json({
      ok: true,
      total_found_reports: datos.length,
      total_candidatos_1_dia: avisosCandidatos.length,
      total_items_validos_recordatorio: itemsValidos.length,
      enviados,
      fallidos,
      sin_email_valido: sinEmailValido,
      codigos_enviados: codigosEnviados,
      codigos_fallidos: codigosFallidos,
      codigos_sin_email: codigosSinEmail,
      recovery_reminder_sent: enviados > 0,
      message: enviados > 0 ? textos[idioma].success : textos[idioma].noPendingReminders
    });
  } catch (error) {
    const idiomaError = req.query?.language === 'en' ? 'en' : 'es';

    return res.status(500).json({
      ok: false,
      error: idiomaError === 'en' ? 'Internal error' : 'Error interno'
    });
  }
}
