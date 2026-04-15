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

    return res.status(200).json({
      ok: true,
      emailSent: null,
      message: textos[idioma].success,
      owner_name: ownerNameNormalizado,
      owner_phone: ownerPhoneNormalizado || null,
      contact_info: contactInfoNormalizado,
      description: descriptionNormalizada,
      code: codeNormalizado,
      language: idioma
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno'
    });
  }
}
