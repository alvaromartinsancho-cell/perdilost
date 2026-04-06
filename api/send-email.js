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

    const lineas = text.split('\n').map(l => l.trim());

   const saludo = lineas[0] || 'Hola,';
const indiceMensaje = lineas.findIndex(l => l.toLowerCase().includes('la persona que la ha encontrado nos ha dejado el siguiente mensaje:'));
const esEmailRegistro = subject.toLowerCase().includes('has registrado correctamente tu código perdilost');
const indiceDatos = lineas.findIndex(l => l.toLowerCase().includes('datos de contacto'));
const indiceCierre = lineas.findIndex(l => l.toLowerCase().includes('te recomendamos ponerte en contacto'));

const intro = indiceMensaje > 1
  ? lineas.slice(1, indiceMensaje).filter(Boolean).join(' ')
  : '';

    const mensaje = indiceMensaje >= 0 && indiceDatos > indiceMensaje
      ? lineas.slice(indiceMensaje + 1, indiceDatos).filter(Boolean).join('<br>')
      : '';

    const datosContacto = indiceDatos >= 0 && indiceCierre > indiceDatos
      ? lineas.slice(indiceDatos + 1, indiceCierre).filter(Boolean).join('<br>')
      : '';

    const cierre = indiceCierre >= 0
      ? lineas.slice(indiceCierre).filter(Boolean).join(' ')
      : '';
const codigoRegistrado = esEmailRegistro && lineas[7] ? lineas[7] : '';
const datosContactoRegistro = esEmailRegistro
  ? lineas.slice(10, 12).filter(Boolean).join('<br>')
  : '';
const descripcionRegistro = esEmailRegistro && lineas[14]
  ? lineas[14]
  : '';
const funcionamientoRegistro = esEmailRegistro
  ? lineas.slice(16).filter(Boolean).join(' ')
  : '';
    const html = `
      <div style="background:#f4f7fb;padding:30px 15px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
          <div style="margin-bottom:24px;">
            <h1 style="margin:0;font-size:26px;color:#1e3a8a;">Perdilost</h1>
            <p style="margin:8px 0 0 0;color:#475569;">${subject}</p>
          </div>

          <p style="margin:0 0 16px 0;">${saludo}</p>
          <p style="margin:0 0 20px 0;line-height:1.7;">${intro}</p>

          ${esEmailRegistro ? `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
            <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Código registrado</div>
            <div style="color:#1f2937;line-height:1.7;">${codigoRegistrado || 'No informado.'}</div>
          </div>

          <div style="margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Datos de contacto</div>
            <div style="color:#475569;line-height:1.7;">${datosContactoRegistro || 'No informados.'}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Mensaje o descripción indicada</div>
            <div style="color:#475569;line-height:1.7;">${descripcionRegistro || 'No informada.'}</div>
          </div>

          <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">${funcionamientoRegistro}</p>
          ` : `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
            <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">Mensaje recibido</div>
            <div style="color:#1f2937;line-height:1.7;">${mensaje || 'Sin mensaje.'}</div>
          </div>

          <div style="margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">Datos de contacto (si los ha facilitado)</div>
            <div style="color:#475569;line-height:1.7;">${datosContacto || 'No facilitados.'}</div>
          </div>

          <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">${cierre}</p>
          `}

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
            Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a
            <a href="mailto:avisos@perdilost.com" style="color:#1e40af;text-decoration:none;">avisos@perdilost.com</a>.

            <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
              Si deseas darte de baja de nuestras comunicaciones, escribe la palabra baja a la siguiente dirección de email:
              <a href="mailto:infoperdilost@gmail.com" style="color:#64748b;text-decoration:none;">infoperdilost@gmail.com</a>
            </div>
          </div>
        </div>
      </div>
    `;

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
        text: text,
        html: html
      })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Perdilost <avisos@perdilost.com>',
          to: ['avisos@perdilost.com'],
          subject: 'Fallo al enviar email a propietario en Perdilost',
          text: `No se ha podido enviar un email al propietario.

Destinatario previsto: ${to}
Asunto: ${subject}

Detalle del error devuelto por Resend:
${JSON.stringify(datos)}`
        })
      });

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
