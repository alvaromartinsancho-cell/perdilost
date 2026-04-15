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
        expiredToken: 'El enlace de recuperación ha caducado.'
      },
      en: {
        missingFields: 'Required data is missing',
        invalidFormat: 'Invalid data format',
        invalidToken: 'The recovery link is not valid.',
        expiredToken: 'The recovery link has expired.'
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

    return res.status(200).json({
      ok: true,
      code: resultado.code
    });
  } catch (error) {
    const idiomaError = req.query?.language === 'en' ? 'en' : 'es';

    return res.status(500).json({
      error: idiomaError === 'en' ? 'Internal error' : 'Error interno'
    });
  }
}
