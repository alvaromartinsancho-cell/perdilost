export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { code, language } = req.query || {};
    const idioma = language === 'en' ? 'en' : 'es';

    const textos = {
      es: {
        missingFields: 'Faltan datos obligatorios',
        invalidFormat: 'Formato de datos no válido',
        dataTooLong: 'Los datos enviados son demasiado largos',
        invalidCode: 'No se ha encontrado un objeto asociado a este código.',
        serverConfig: 'Error de configuración del servidor'
      },
      en: {
        missingFields: 'Required data is missing',
        invalidFormat: 'Invalid data format',
        dataTooLong: 'The submitted data is too long',
        invalidCode: 'No item was found for this code.',
        serverConfig: 'Server configuration error'
      }
    };

    if (!code) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (typeof code !== 'string') {
      return res.status(400).json({
        error: textos[idioma].invalidFormat
      });
    }

    if (code.length > 100) {
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

    if (!codeNormalizado) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    const respuestaItem = await fetch(
      `${supabaseUrl}/rest/v1/items?code=eq.${encodeURIComponent(codeNormalizado)}&select=code,description,preferred_language`,
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

    return res.status(200).json({
      ok: true,
      code: item.code,
      description: item.description || null,
      preferred_language: item.preferred_language === 'en' ? 'en' : 'es'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno'
    });
  }
}
