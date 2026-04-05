export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { to, subject, text } = req.body;
const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  return res.status(500).json({
    error: 'Falta RESEND_API_KEY en Vercel'
  });
}
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Perdilost <avisos@perdilost.com>',
        to: [to],
        subject: subject,
        text: text
      })
    });

    const datos = await respuesta.json();

if (!respuesta.ok) {
  return res.status(400).json({
    error: 'Error enviando email',
    detalle: datos,
    apiKeyPrimeros5: apiKey.slice(0, 5),
    apiKeyLongitud: apiKey.length
  });
}

    return res.status(200).json({
      ok: true,
      resultado: datos
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error interno',
      detalle: error.message
    });
  }
}
