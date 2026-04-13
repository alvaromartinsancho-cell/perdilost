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

    if (!supabaseUrl || !serviceRoleKey) {
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

const currentHost = req.headers['x-forwarded-host'] || req.headers.host;
const currentProtocol = req.headers['x-forwarded-proto'] || 'https';

if (!currentHost) {
  return res.status(500).json({
    error: textos[idioma].serverConfig
  });
}

const respuestaEmail = await fetch(`${currentProtocol}://${currentHost}/api/send-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: propietario.contact_info,
    language: idiomaPropietario,
    subject,
    text
  })
});
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: propietario.contact_info,
    language: idiomaPropietario,
    subject,
    text
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
