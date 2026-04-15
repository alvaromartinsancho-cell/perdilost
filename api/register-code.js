export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const {
      code,
      owner_name,
      owner_phone,
      contact_info,
      contact_info_repeat,
      description,
      language,
      privacy_accepted
    } = req.body || {};

    const idioma = language === 'en' ? 'en' : 'es';

    const textos = {
      es: {
        missingFields: 'Debes completar todos los campos para registrar tu código.',
        invalidFormat: 'Formato de datos no válido.',
        dataTooLong: 'Los datos enviados son demasiado largos.',
        invalidCode: 'Este código no es válido',
        alreadyRegistered: 'Este código ya está registrado',
        privacyRequired: 'Debes aceptar la información de protección de datos para registrar tu código.',
        emailsDoNotMatch: 'Los emails no coinciden. Revisa ambos campos.',
        serverConfig: 'Error de configuración del servidor',
        saveError: 'Error al guardar el registro.',
        emailSendError: 'Código activado correctamente, pero no hemos podido enviarte el email de confirmación.',
        success: 'Código activado correctamente. Te hemos enviado un email de confirmación con los datos del registro.'
      },
      en: {
        missingFields: 'You must complete all fields to register your code.',
        invalidFormat: 'Invalid data format.',
        dataTooLong: 'The submitted data is too long.',
        invalidCode: 'This code is not valid',
        alreadyRegistered: 'This code is already registered',
        privacyRequired: 'You must accept the data protection information to register your code.',
        emailsDoNotMatch: 'The email addresses do not match. Please check both fields.',
        serverConfig: 'Server configuration error',
        saveError: 'Error saving the registration.',
        emailSendError: 'Code activated correctly, but we could not send you the confirmation email.',
        success: 'Code activated correctly. We have sent you a confirmation email with the registration details.'
      }
    };

    if (
      !code ||
      !owner_name ||
      !contact_info ||
      !contact_info_repeat ||
      !description
    ) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (
      typeof code !== 'string' ||
      typeof owner_name !== 'string' ||
      typeof contact_info !== 'string' ||
      typeof contact_info_repeat !== 'string' ||
      typeof description !== 'string' ||
      (owner_phone !== undefined && owner_phone !== null && typeof owner_phone !== 'string') ||
      typeof privacy_accepted !== 'boolean'
    ) {
      return res.status(400).json({
        error: textos[idioma].invalidFormat
      });
    }

    if (
      code.length > 100 ||
      owner_name.length > 200 ||
      contact_info.length > 320 ||
      contact_info_repeat.length > 320 ||
      description.length > 5000 ||
      (owner_phone && owner_phone.length > 100)
    ) {
      return res.status(400).json({
        error: textos[idioma].dataTooLong
      });
    }

    if (!privacy_accepted) {
      return res.status(400).json({
        error: textos[idioma].privacyRequired
      });
    }

    const codeNormalizado = code.trim();
    const ownerNameNormalizado = owner_name.trim();
    const ownerPhoneNormalizado = owner_phone ? owner_phone.trim() : null;
    const contactInfoNormalizado = contact_info.trim();
    const contactInfoRepeatNormalizado = contact_info_repeat.trim();
    const descriptionNormalizada = description.trim();

    if (
      !codeNormalizado ||
      !ownerNameNormalizado ||
      !contactInfoNormalizado ||
      !contactInfoRepeatNormalizado ||
      !descriptionNormalizada
    ) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (contactInfoNormalizado !== contactInfoRepeatNormalizado) {
      return res.status(400).json({
        error: textos[idioma].emailsDoNotMatch
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: textos[idioma].serverConfig
      });
    }

    const respuestaItem = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}&select=code,owner_name,contact_info`,
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
        error: textos[idioma].serverConfig
      });
    }

    const items = await respuestaItem.json();
    const item = Array.isArray(items) && items.length > 0 ? items[0] : null;

    if (!item) {
      return res.status(400).json({
        error: textos[idioma].invalidCode
      });
    }

    if (item.owner_name || item.contact_info) {
      return res.status(400).json({
        error: textos[idioma].alreadyRegistered
      });
    }

    const respuestaUpdate = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner_name: ownerNameNormalizado,
          owner_phone: ownerPhoneNormalizado || null,
          contact_info: contactInfoNormalizado,
          description: descriptionNormalizada,
          preferred_language: idioma,
          privacy_accepted: true,
          privacy_accepted_at: new Date().toISOString(),
          privacy_version: 'v1',
          activated_at: new Date().toISOString()
        })
      }
    );

    if (!respuestaUpdate.ok) {
      return res.status(500).json({
        error: textos[idioma].saveError
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return res.status(200).json({
        ok: false,
        emailSent: false,
        message: textos[idioma].emailSendError
      });
    }

    const subject = idioma === 'en'
      ? 'You have successfully registered your Perdilost code'
      : 'Has registrado correctamente tu código Perdilost';

    const text = idioma === 'en'
      ? `Hello ${ownerNameNormalizado},

Welcome to Perdilost and thank you for trusting our service.

Your Perdilost code registration has been completed successfully.

Registered code:
${codeNormalizado}

Contact details:
Name: ${ownerNameNormalizado}
Phone: ${ownerPhoneNormalizado || 'Not provided'}
Email: ${contactInfoNormalizado}

Message or description provided:
${descriptionNormalizada || 'Not provided'}

How your code works:
If someone finds your item and uses this code on our website to notify us, they will not have access to your personal data. We will send you their message to this same email address so you can contact them and recover your item.

Thank you for using Perdilost.`
      : `Hola ${ownerNameNormalizado},

Bienvenido a Perdilost y gracias por confiar en nuestro servicio.

El registro de tu código en Perdilost se ha completado correctamente.

Código registrado:
${codeNormalizado}

Datos de contacto:
Nombre: ${ownerNameNormalizado}
Teléfono: ${ownerPhoneNormalizado || 'No informado'}
Email: ${contactInfoNormalizado}

Mensaje o descripción indicada:
${descriptionNormalizada || 'No informada'}

Funcionamiento de tu código:
Si en algún momento alguien encuentra tu objeto y utiliza este código en nuestra web para comunicarlo, esa persona no tendrá acceso a tus datos personales. Nosotros te enviaremos a este mismo correo el mensaje que nos haya dejado para que puedas ponerte en contacto y recuperarlo.

Gracias por utilizar Perdilost.`;

    const html = idioma === 'en'
      ? `
        <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
            <div style="margin-bottom:24px;">
              <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
              <p style="margin:8px 0 0 0;color:#475569;">${subject}</p>
            </div>

            <p style="margin:0 0 16px 0;">Hello ${ownerNameNormalizado},</p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              Welcome to Perdilost and thank you for trusting our service.
            </p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              Your Perdilost code registration has been completed successfully.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Registered code</div>
              <div style="color:#1f2937;line-height:1.7;">${codeNormalizado}</div>
            </div>

            <div style="margin:24px 0;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Contact details</div>
              <div style="color:#475569;line-height:1.7;">
                Name: ${ownerNameNormalizado}<br>
                Phone: ${ownerPhoneNormalizado || 'Not provided'}<br>
                Email: ${contactInfoNormalizado}
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Message or description provided</div>
              <div style="color:#475569;line-height:1.7;white-space:pre-line;">${descriptionNormalizada || 'Not provided'}</div>
            </div>

            <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">
              If someone finds your item and uses this code on our website to notify us, they will not have access to your personal data. We will send you their message to this same email address so you can contact them and recover your item.
            </p>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
              If you have any questions or would like more information about Perdilost, you can write to
              <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.
            </div>

            <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
              If you wish to unsubscribe from our communications, write the word unsubscribe to the following email address:
              <a href="mailto:infoperdilost@gmail.com" style="color:#64748b;text-decoration:none;">infoperdilost@gmail.com</a>
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

            <p style="margin:0 0 16px 0;">Hola ${ownerNameNormalizado},</p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              Bienvenido a Perdilost y gracias por confiar en nuestro servicio.
            </p>

            <p style="margin:0 0 20px 0;line-height:1.7;">
              El registro de tu código en Perdilost se ha completado correctamente.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Código registrado</div>
              <div style="color:#1f2937;line-height:1.7;">${codeNormalizado}</div>
            </div>

            <div style="margin:24px 0;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Datos de contacto</div>
              <div style="color:#475569;line-height:1.7;">
                Nombre: ${ownerNameNormalizado}<br>
                Teléfono: ${ownerPhoneNormalizado || 'No informado'}<br>
                Email: ${contactInfoNormalizado}
              </div>
            </div>

            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:24px 0;">
              <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Mensaje o descripción indicada</div>
              <div style="color:#475569;line-height:1.7;white-space:pre-line;">${descriptionNormalizada || 'No informada'}</div>
            </div>

            <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">
              Si en algún momento alguien encuentra tu objeto y utiliza este código en nuestra web para comunicarlo, esa persona no tendrá acceso a tus datos personales. Nosotros te enviaremos a este mismo correo el mensaje que nos haya dejado para que puedas ponerte en contacto y recuperarlo.
            </p>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
              Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a
              <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.
            </div>

            <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
              Si deseas darte de baja de nuestras comunicaciones, escribe la palabra baja a la siguiente dirección de email:
              <a href="mailto:infoperdilost@gmail.com" style="color:#64748b;text-decoration:none;">infoperdilost@gmail.com</a>
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
        to: [contactInfoNormalizado],
        subject,
        text,
        html
      })
    });

    try {
      await respuestaEmail.json();
    } catch (e) {}

    if (!respuestaEmail.ok) {
      return res.status(200).json({
        ok: false,
        emailSent: false,
        message: textos[idioma].emailSendError
      });
    }

    return res.status(200).json({
      ok: true,
      emailSent: true,
      message: textos[idioma].success
    });
  } catch (error) {
    const idiomaError = req.body?.language === 'en' ? 'en' : 'es';

    return res.status(500).json({
      error: idiomaError === 'en' ? 'Internal error' : 'Error interno'
    });
  }
}
