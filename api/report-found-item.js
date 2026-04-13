export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const {
      code,
      finder_name,
      finder_phone,
      finder_contact,
      message,
      language
    } = req.body || {};

    const idioma = language === 'en' ? 'en' : 'es';

    const textos = {
      es: {
        missingFields: 'Faltan datos obligatorios',
        invalidFormat: 'Formato de datos no válido',
        dataTooLong: 'Los datos enviados son demasiado largos',
        invalidCode: 'Este código no está registrado',
        serverConfig: 'Error de configuración del servidor',
        saveNoticeError: 'No se ha podido guardar el aviso',
        updateLastFoundError: 'No se ha podido actualizar la fecha del último hallazgo',
        emailSendError: 'Aviso guardado correctamente. No hemos podido entregar el email al propietario en este momento, pero tu mensaje ha quedado registrado y lo revisaremos para intentar contactar con él. También puedes contactar directamente con nosotros: avisos@perdilost.com',
        markEmailError: 'El email se ha enviado, pero no se ha podido actualizar el estado de envío en la base de datos',
        success: 'Aviso guardado y email enviado correctamente'
      },
      en: {
        missingFields: 'Required data is missing',
        invalidFormat: 'Invalid data format',
        dataTooLong: 'The submitted data is too long',
        invalidCode: 'This code is not registered',
        serverConfig: 'Server configuration error',
        saveNoticeError: 'The notice could not be saved',
        updateLastFoundError: 'The last found date could not be updated',
        emailSendError: 'Notice saved correctly. We could not deliver the email to the owner at this time, but your message has been recorded and we will review the issue to try to contact them. You can also contact us directly at: avisos@perdilost.com',
        markEmailError: 'The email was sent, but the delivery status could not be updated in the database',
        success: 'Notice saved and email sent correctly'
      }
    };

    if (!code || !message) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (
      typeof code !== 'string' ||
      typeof message !== 'string' ||
      (finder_name !== undefined && typeof finder_name !== 'string') ||
      (finder_phone !== undefined && typeof finder_phone !== 'string') ||
      (finder_contact !== undefined && typeof finder_contact !== 'string')
    ) {
      return res.status(400).json({
        error: textos[idioma].invalidFormat
      });
    }

    if (
      code.length > 100 ||
      message.length > 5000 ||
      (finder_name && finder_name.length > 200) ||
      (finder_phone && finder_phone.length > 100) ||
      (finder_contact && finder_contact.length > 320)
    ) {
      return res.status(400).json({
        error: textos[idioma].dataTooLong
      });
    }

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
  return res.status(500).json({
    error: textos[idioma].serverConfig
  });
}

    const codeNormalizado = code.trim();
    const messageNormalizado = message.trim();
    const finderNameNormalizado = finder_name ? finder_name.trim() : null;
    const finderPhoneNormalizado = finder_phone ? finder_phone.trim() : null;
    const finderContactNormalizado = finder_contact ? finder_contact.trim() : null;

    if (!codeNormalizado || !messageNormalizado) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    const respuestaItem = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}&select=code,owner_name,contact_info,preferred_language`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!respuestaItem.ok) {
      return res.status(500).json({
        error: textos[idioma].invalidCode
      });
    }

    const items = await respuestaItem.json();
    const propietario = Array.isArray(items) && items.length > 0 ? items[0] : null;

    if (!propietario || !propietario.contact_info) {
      return res.status(400).json({
        error: textos[idioma].invalidCode
      });
    }

    const respuestaInsert = await fetch(`${supabaseUrl}/rest/v1/found_reports`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify([
        {
          code: codeNormalizado,
          finder_name: finderNameNormalizado || null,
          finder_phone: finderPhoneNormalizado || null,
          finder_contact: finderContactNormalizado || null,
          message: messageNormalizado,
          email_sent: false
        }
      ])
    });

    if (!respuestaInsert.ok) {
      return res.status(500).json({
        error: textos[idioma].saveNoticeError
      });
    }

    const reportesInsertados = await respuestaInsert.json();
    const reporte = Array.isArray(reportesInsertados) && reportesInsertados.length > 0
      ? reportesInsertados[0]
      : null;

    const respuestaUpdateLastFound = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          last_found_at: new Date().toISOString()
        })
      }
    );

    if (!respuestaUpdateLastFound.ok) {
      return res.status(500).json({
        error: textos[idioma].updateLastFoundError
      });
    }

    const idiomaPropietario = propietario.preferred_language === 'en' ? 'en' : 'es';

    const subject = idiomaPropietario === 'en'
      ? 'Someone has found an item linked to your Perdilost code'
      : 'Han encontrado una pertenencia asociada a tu código Perdilost';

    const text = idiomaPropietario === 'en'
      ? `Hello ${propietario.owner_name || ''},

We would like to let you know that someone has found an item linked to your Perdilost code: ${codeNormalizado}.

The person who found it left us the following message:

${messageNormalizado}

Contact details (if provided):
Name: ${finderNameNormalizado || 'Not provided'}
Phone: ${finderPhoneNormalizado || 'Not provided'}
Email: ${finderContactNormalizado || 'Not provided'}

We recommend that you get in touch as soon as possible so you can recover it.`
      : `Hola ${propietario.owner_name || ''},

Te informamos de que alguien ha encontrado una pertenencia asociada a tu código de Perdilost: ${codeNormalizado}.

La persona que la ha encontrado nos ha dejado el siguiente mensaje:

${messageNormalizado}

Datos de contacto (si los ha facilitado):
Nombre: ${finderNameNormalizado || 'No facilitado'}
Teléfono: ${finderPhoneNormalizado || 'No facilitado'}
Email: ${finderContactNormalizado || 'No facilitado'}

Te recomendamos ponerte en contacto lo antes posible para poder recuperarla.`;

const html = idiomaPropietario === 'en'
  ? `
    <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <div style="margin-bottom:24px;">
          <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
          <p style="margin:8px 0 0 0;color:#475569;">${subject}</p>
        </div>

        <p style="margin:0 0 16px 0;">Hello ${propietario.owner_name || ''},</p>

        <p style="margin:0 0 20px 0;line-height:1.7;">
          We would like to let you know that someone has found an item linked to your Perdilost code: <strong>${codeNormalizado}</strong>.
        </p>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
          <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Message received</div>
          <div style="color:#1f2937;line-height:1.7;white-space:pre-line;">${messageNormalizado}</div>
        </div>

        <div style="margin:24px 0;">
          <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Contact details (if provided)</div>
          <div style="color:#475569;line-height:1.7;">
            Name: ${finderNameNormalizado || 'Not provided'}<br>
            Phone: ${finderPhoneNormalizado || 'Not provided'}<br>
            Email: ${finderContactNormalizado || 'Not provided'}
          </div>
        </div>

        <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">
          We recommend that you get in touch as soon as possible so you can recover it.
        </p>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
          If you have any questions or would like more information about Perdilost, you can write to
          <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.
        </div>
      </div>
    </div>
  `
  : `
    <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <div style="margin-bottom:24px;">
          <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
          <p style="margin:8px 0 0 0;color:#475569;">${subject}</p>
        </div>

        <p style="margin:0 0 16px 0;">Hola ${propietario.owner_name || ''},</p>

        <p style="margin:0 0 20px 0;line-height:1.7;">
          Te informamos de que alguien ha encontrado una pertenencia asociada a tu código de Perdilost: <strong>${codeNormalizado}</strong>.
        </p>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
          <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Mensaje recibido</div>
          <div style="color:#1f2937;line-height:1.7;white-space:pre-line;">${messageNormalizado}</div>
        </div>

        <div style="margin:24px 0;">
          <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Datos de contacto (si los ha facilitado)</div>
          <div style="color:#475569;line-height:1.7;">
            Nombre: ${finderNameNormalizado || 'No facilitado'}<br>
            Teléfono: ${finderPhoneNormalizado || 'No facilitado'}<br>
            Email: ${finderContactNormalizado || 'No facilitado'}
          </div>
        </div>

        <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">
          Te recomendamos ponerte en contacto lo antes posible para poder recuperarla.
        </p>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
          Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a
          <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.
        </div>
      </div>
    </div>
  `;

const respuestaEmail = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: 'Perdilost <avisos@perdilost.com>',
    to: [propietario.contact_info],
    subject,
    text,
    html
  })
});

    if (!respuestaEmail.ok) {
      return res.status(200).json({
        ok: false,
        emailSent: false,
        message: textos[idioma].emailSendError
      });
    }

    if (reporte && reporte.id) {
      const respuestaMarcarEmail = await fetch(
        `${supabaseUrl}/rest/v1/found_reports?id=eq.${reporte.id}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email_sent: true
          })
        }
      );

      if (!respuestaMarcarEmail.ok) {
        return res.status(200).json({
          ok: false,
          emailSent: true,
          message: textos[idioma].markEmailError
        });
      }
    }

    return res.status(200).json({
      ok: true,
      emailSent: true,
      message: textos[idioma].success
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno'
    });
  }
}
