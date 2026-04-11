export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
const { to, subject, text, language } = req.body;
    if (!to || !subject || !text) {
  return res.status(400).json({
    error: 'Faltan datos obligatorios'
  });
}
    if (typeof to !== 'string' || typeof subject !== 'string' || typeof text !== 'string') {
  return res.status(400).json({
    error: 'Formato de datos no válido'
  });
}
    const idiomaEmail = language === 'en' ? 'en' : 'es';
    const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  return res.status(500).json({
    error: 'Error de configuración del servidor'
  });
}
    if (to.length > 320 || subject.length > 200 || text.length > 10000) {
  return res.status(400).json({
    error: 'Los datos enviados son demasiado largos'
  });
}

    const lineas = text.split('\n').map(l => l.trim());

   const saludo = lineas[0] || 'Hola,';
const indiceMensaje = lineas.findIndex(l =>
  l.toLowerCase().includes('la persona que la ha encontrado nos ha dejado el siguiente mensaje:') ||
  l.toLowerCase().includes('the person who found it left us the following message:')
);
const asuntoNormalizado = subject.toLowerCase();
const textoNormalizado = text.toLowerCase();
const toNormalizado = to.toLowerCase().trim();
    if (!toNormalizado.includes('@') || toNormalizado.startsWith('@') || toNormalizado.endsWith('@')) {
  return res.status(400).json({
    error: 'Email de destino no válido'
  });
}
if (toNormalizado.includes('..') || toNormalizado.includes(' ')) {
  return res.status(400).json({
    error: 'Email de destino no válido'
  });
}
const esEmailRegistro =
  asuntoNormalizado.includes('has registrado correctamente tu código perdilost') ||
  asuntoNormalizado.includes('you have successfully registered your perdilost code') ||
  textoNormalizado.includes('bienvenido a perdilost') ||
  textoNormalizado.includes('welcome to perdilost');

const esEmailRegistroEnIngles =
  idiomaEmail === 'en' ||
  asuntoNormalizado.includes('you have successfully registered your perdilost code') ||
  textoNormalizado.includes('welcome to perdilost') ||
  textoNormalizado.startsWith('hello ');
const indiceDatos = lineas.findIndex(l =>
  l.toLowerCase().includes('datos de contacto') ||
  l.toLowerCase().includes('contact details')
);
const indiceCierre = lineas.findIndex(l =>
  l.toLowerCase().includes('te recomendamos ponerte en contacto') ||
  l.toLowerCase().includes('we recommend that you get in touch')
);

const esEmailEncontradoEnIngles =
  idiomaEmail === 'en' ||
  asuntoNormalizado.includes('someone has found an item linked to your perdilost code') ||
  textoNormalizado.includes('the person who found it left us the following message:') ||
  textoNormalizado.includes('we recommend that you get in touch');

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
  ? lineas.slice(10, 13).filter(Boolean).join('<br>')
  : '';

const descripcionRegistro = esEmailRegistro
  ? (esEmailRegistroEnIngles ? lineas[15] : lineas[15])
  : '';

const funcionamientoRegistro = esEmailRegistro
  ? (esEmailRegistroEnIngles
      ? lineas.slice(17).filter(Boolean).join(' ')
      : lineas.slice(17).filter(Boolean).join(' '))
  : '';

const tituloCodigoRegistrado = esEmailRegistroEnIngles ? 'Registered code' : 'Código registrado';
const tituloDatosContacto = esEmailRegistroEnIngles ? 'Contact details' : 'Datos de contacto';
const tituloDescripcion = esEmailRegistroEnIngles ? 'Message or description provided' : 'Mensaje o descripción indicada';
const textoNoInformado = esEmailRegistroEnIngles ? 'Not provided.' : 'No informado.';
const textoNoInformados = esEmailRegistroEnIngles ? 'Not provided.' : 'No informados.';
const textoNoInformada = esEmailRegistroEnIngles ? 'Not provided.' : 'No informada.';
const textoContactoFooter = esEmailRegistroEnIngles
  ? 'If you have any questions or would like more information about Perdilost, you can write to'
  : 'Para cualquier duda o si quieres más información sobre Perdilost, puedes escribir a';

const textoBajaFooter = esEmailRegistroEnIngles
  ? 'If you wish to unsubscribe from our communications, write the word unsubscribe to the following email address:'
  : 'Si deseas darte de baja de nuestras comunicaciones, escribe la palabra baja a la siguiente dirección de email:';
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
            <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">${tituloCodigoRegistrado}</div>
            <div style="color:#1f2937;line-height:1.7;">${codigoRegistrado || textoNoInformado}</div>
          </div>

          <div style="margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">${tituloDatosContacto}</div>
            <div style="color:#475569;line-height:1.7;">${datosContactoRegistro || textoNoInformados}</div>
          </div>

          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">${tituloDescripcion}</div>
            <div style="color:#475569;line-height:1.7;">${descripcionRegistro || textoNoInformada}</div>
          </div>

          <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">${funcionamientoRegistro}</p>
          ` : `
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;margin:24px 0;">
            <div style="font-weight:bold;color:#1e40af;margin-bottom:10px;">${esEmailEncontradoEnIngles ? 'Message received' : 'Mensaje recibido'}</div>
            <div style="color:#1f2937;line-height:1.7;">${mensaje || (esEmailEncontradoEnIngles ? 'No message.' : 'Sin mensaje.')}</div>
          </div>

          <div style="margin:24px 0;">
            <div style="font-weight:bold;color:#1f2937;margin-bottom:10px;">${esEmailEncontradoEnIngles ? 'Contact details (if provided)' : 'Datos de contacto (si los ha facilitado)'}</div>
            <div style="color:#475569;line-height:1.7;">${datosContacto || (esEmailEncontradoEnIngles ? 'Not provided.' : 'No facilitados.')}</div>
          </div>

          <p style="margin:24px 0 0 0;line-height:1.7;color:#475569;">${cierre}</p>
          `}

<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;color:#475569;font-size:14px;line-height:1.6;">
  ${textoContactoFooter}
  <a href="mailto:infoperdilost@gmail.com" style="color:#1e40af;text-decoration:none;">infoperdilost@gmail.com</a>.
</div>

            <div style="margin-top:14px;font-size:11px;line-height:1.5;color:#94a3b8;">
              ${textoBajaFooter}
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

    let datos = null;
try {
  datos = await respuesta.json();
} catch (e) {
  datos = null;
}

       if (!respuesta.ok) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Perdilost <avisos@perdilost.com>',
          to: ['infoperdilost@gmail.com'],
          subject: 'Incidencia de envío de email en Perdilost',
          text: `No se ha podido entregar un email desde Perdilost.

Asunto original:
${subject}

Se ha producido un error al intentar enviarlo mediante Resend.

Detalle técnico resumido:
${JSON.stringify(datos)}`

Destinatario previsto del propietario: ${to}
Asunto original: ${subject}

Contenido original del mensaje:
${text}

Detalle del error devuelto por Resend:
${JSON.stringify(datos)}`
        })
      });

 return res.status(400).json({
  error: 'Error enviando email'
});
    }

return res.status(200).json({
  ok: true
});
  } catch (error) {
return res.status(500).json({
  error: 'Error interno'
});
  }
}
