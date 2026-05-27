import { verifyRecoveryToken } from './_recovery-token.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { token, language } = req.query || {};
    const idioma = language === 'en' ? 'en' : 'es';

    const textos = {
      es: {
        missingFields: 'Faltan datos obligatorios',
        invalidFormat: 'Formato de datos no válido',
        invalidToken: 'El enlace de recuperación no es válido.',
        expiredToken: 'El enlace de recuperación ha caducado.',
        serverConfig: 'Error de configuración del servidor'
      },
      en: {
        missingFields: 'Required data is missing',
        invalidFormat: 'Invalid data format',
        invalidToken: 'The recovery link is not valid.',
        expiredToken: 'The recovery link has expired.',
        serverConfig: 'Server configuration error'
      }
    };

    if (!token) {
      return res.status(400).json({
        error: textos[idioma].missingFields
      });
    }

    if (typeof token !== 'string') {
      return res.status(400).json({
        error: textos[idioma].invalidFormat
      });
    }

    const resultado = verifyRecoveryToken(token);

    if (!resultado.ok) {
      return res.status(400).json({
        error: resultado.error === 'expired_token'
          ? textos[idioma].expiredToken
          : textos[idioma].invalidToken
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: textos[idioma].serverConfig
      });
    }

    const codeNormalizado = String(resultado.code || '').trim();

    if (!codeNormalizado) {
      return res.status(400).json({
        error: textos[idioma].invalidToken
      });
    }

    const respuestaCode = await fetch(
      `${supabaseUrl}/rest/v1/codes?code=eq.${encodeURIComponent(codeNormalizado)}&select=code,status`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!respuestaCode.ok) {
      return res.status(500).json({
        error: textos[idioma].serverConfig
      });
    }

    const codes = await respuestaCode.json();
    const codeRow = Array.isArray(codes) && codes.length > 0 ? codes[0] : null;

    if (!codeRow || codeRow.status !== 'registered') {
      return res.status(400).json({
        error: textos[idioma].invalidToken
      });
    }

    return res.status(200).json({
      ok: true,
      code: codeNormalizado
    });
  } catch (error) {
    const idiomaError = req.query?.language === 'en' ? 'en' : 'es';

    return res.status(500).json({
      error: idiomaError === 'en' ? 'Internal error' : 'Error interno'
    });
  }
}
