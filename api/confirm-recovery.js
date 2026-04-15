export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { code, recovered, comments, language } = req.body || {};

    const idioma = language === 'en' ? 'en' : 'es';

    const textos = {
      es: {
        missingFields: 'Faltan datos obligatorios',
        invalidFormat: 'Formato de datos no válido',
        dataTooLong: 'Los datos enviados son demasiado largos',
        invalidCode: 'No se ha encontrado un objeto asociado a este código.',
        serverConfig: 'Error de configuración del servidor',
        saveError: 'Error al guardar la confirmación.',
        success: 'Confirmación guardada correctamente.'
      },
      en: {
        missingFields: 'Required data is missing',
        invalidFormat: 'Invalid data format',
        dataTooLong: 'The submitted data is too long',
        invalidCode: 'No item was found for this code.',
        serverConfig: 'Server configuration error',
        saveError: 'Error saving the confirmation.',
        success: 'Confirmation saved correctly.'
      }
    };

    if (!code || typeof recovered !== 'boolean') {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (
      typeof code !== 'string' ||
      (comments !== undefined && comments !== null && typeof comments !== 'string')
    ) {
      return res.status(400).json({
        error: textos[idioma].invalidFormat
      });
    }

    if (
      code.length > 100 ||
      (comments && comments.length > 5000)
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
    const commentsNormalizados = comments ? comments.trim() : null;

    if (!codeNormalizado) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    const respuestaItem = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}&select=code`,
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

    const datosActualizar = {
      is_recovered: recovered,
      recovery_comments: commentsNormalizados || null,
      recovered_at: recovered ? new Date().toISOString() : null
    };

    const respuestaUpdate = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datosActualizar)
      }
    );

    if (!respuestaUpdate.ok) {
      return res.status(500).json({
        error: textos[idioma].saveError
      });
    }

    return res.status(200).json({
      ok: true,
      message: textos[idioma].success
    });
  } catch (error) {
    const idiomaError = req.body?.language === 'en' ? 'en' : 'es';

    return res.status(500).json({
      error: idiomaError === 'en' ? 'Internal error' : 'Error interno'
    });
  }
}
