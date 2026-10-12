/*
  api/reserva.js — Vercel Serverless Function
  1. Valida token, honeypot y rate-limit
  2. Guarda en Firestore
  3. Envía email de confirmación al cliente y notificación al admin (Nodemailer + Gmail)
  4. Agrega evento al Google Calendar del negocio (service account)
*/
const admin      = require('firebase-admin');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// ── Firebase Admin ─────────────────────────────────────────────────────────
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (e) { console.error('Firebase Admin init error:', e.message); }
}
const db = admin.apps.length ? admin.firestore() : null;

// ── Nodemailer (Gmail SMTP) ────────────────────────────────────────────────
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

// ── Google Calendar (service account) ─────────────────────────────────────
let calendarClient = null;
if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const auth = new google.auth.JWT({
      email: process.env.FIREBASE_CLIENT_EMAIL,
      key:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    calendarClient = google.calendar({ version: 'v3', auth });
  } catch (e) { console.error('Google Calendar auth error:', e.message); }
}

// ── Descuentos ─────────────────────────────────────────────────────────────
const DISCOUNT_CODES = {
  'CASAPARQUELORETO':        10,
  'DIARIOPARAUNANOVIA':      10,
  'IBANDRA&CRISTOBAL':       15,
  'MIMATRIMONIO':            30,
  'MATRIMONIOSPORMANCAVADA': 15,
  'MATRIFRAN&FABRI':         10,
  'MATRIMACA&JOACO':         15,
  'MATRIV&V':                10,
};

const ipCounts       = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX       = 5;
const normalizeCode  = (c) => (c || '').toUpperCase().replace(/\s+/g, '');
const fmt            = (n) => n != null ? `$${Math.round(n).toLocaleString('es-CL')}` : '';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const formToken = process.env.FORM_TOKEN;
  const params = new URLSearchParams(
    typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString()
  );

  if (params.get('_hp')) return res.status(200).send('✅');

  if (formToken && params.get('_token') !== formToken) {
    console.warn('Token inválido desde IP:', req.headers['x-forwarded-for']);
    return res.status(403).send('⛔');
  }

  const ip    = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now   = Date.now();
  const entry = ipCounts.get(ip) || { count: 0, since: now };
  if (now - entry.since > RATE_WINDOW_MS) { entry.count = 0; entry.since = now; }
  entry.count++;
  ipCounts.set(ip, entry);
  if (entry.count > RATE_MAX) return res.status(429).send('⛔');

  const rawCode     = normalizeCode(params.get('codigoDescuento') || '');
  const discountPct = DISCOUNT_CODES[rawCode] || 0;

  let cotizacion = null;
  try { cotizacion = JSON.parse(params.get('cotizacion-data') || 'null'); } catch { /* noop */ }

  const nombre       = params.get('nombre')       || '';
  const email        = params.get('email')        || '';
  const telefono     = params.get('telefono')     || '';
  const fecha        = params.get('fecha')        || '';
  const hora         = params.get('hora')         || '';
  const tipoServicio = params.get('tipoServicio') || '';
  const origen       = params.get('centroEvento') || '';
  const destino      = params.get('destino')      || '';
  const paradas      = params.get('paradas')      || '0';
  const comentarios  = params.get('comentarios')  || '';

  // ── 1. Guardar en Firestore ──────────────────────────────────────────────
  if (!db) {
    console.error('Firestore no disponible');
    return res.status(500).send('❌ Error al procesar la reserva.');
  }

  let docId;
  try {
    const ref = await db.collection('reservations').add({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status:    'pending',
      driverId:  null, driverName: null,
      nombre, email, telefono,
      fecha, hora, tipoServicio,
      origen, destino, paradas, comentarios,
      codigoDescuento: rawCode, descuentoPct, cotizacion, ip,
    });
    docId = ref.id;
  } catch (e) {
    console.error('Error guardando en Firestore:', e.message);
    return res.status(500).send('❌ Error al procesar la reserva.');
  }

  // ── 2. Emails ────────────────────────────────────────────────────────────
  if (transporter) {
    const precio = cotizacion?.total != null ? fmt(cotizacion.total) : (cotizacion?.precio != null ? fmt(cotizacion.precio) : '');
    const fechaFmt = fecha ? new Date(fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : fecha;

    // Email al cliente
    try {
      await transporter.sendMail({
        from:    `"TeLlevo a Tu Casa" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: '¡Recibimos tu reserva! 🚗 TeLlevo a Tu Casa',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0A1628;color:#E8EAF0;padding:32px;border-radius:12px">
            <h1 style="color:#C9A84C;margin-bottom:8px">¡Reserva recibida!</h1>
            <p style="color:#8892A4;margin-top:0">Te confirmamos que recibimos tu solicitud. Te contactaremos pronto para coordinar los detalles.</p>
            <hr style="border:1px solid #1B3A6B;margin:24px 0">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#8892A4;width:40%">Nombre</td><td style="color:#E8EAF0">${nombre}</td></tr>
              <tr><td style="padding:8px 0;color:#8892A4">Fecha</td><td style="color:#E8EAF0">${fechaFmt}</td></tr>
              <tr><td style="padding:8px 0;color:#8892A4">Hora</td><td style="color:#E8EAF0">${hora}</td></tr>
              <tr><td style="padding:8px 0;color:#8892A4">Tipo de servicio</td><td style="color:#E8EAF0">${tipoServicio}</td></tr>
              <tr><td style="padding:8px 0;color:#8892A4">Origen</td><td style="color:#E8EAF0">${origen}</td></tr>
              <tr><td style="padding:8px 0;color:#8892A4">Destino</td><td style="color:#E8EAF0">${destino}</td></tr>
              ${paradas !== '0' ? `<tr><td style="padding:8px 0;color:#8892A4">Paradas</td><td style="color:#E8EAF0">${paradas}</td></tr>` : ''}
              ${precio ? `<tr><td style="padding:8px 0;color:#8892A4">Precio estimado</td><td style="color:#C9A84C;font-weight:bold">${precio}</td></tr>` : ''}
              ${rawCode ? `<tr><td style="padding:8px 0;color:#8892A4">Código descuento</td><td style="color:#E8EAF0">${rawCode} (${discountPct}%)</td></tr>` : ''}
            </table>
            <hr style="border:1px solid #1B3A6B;margin:24px 0">
            <p style="color:#8892A4;font-size:14px">Para consultas, escríbenos por WhatsApp o responde este correo.</p>
            <p style="color:#C9A84C;font-weight:bold;font-size:16px">TeLlevo a Tu Casa</p>
          </div>`,
      });
    } catch (e) { console.error('Error enviando email cliente:', e.message); }

    // Email al admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
      await transporter.sendMail({
        from:    `"TeLlevo — Reservas" <${process.env.GMAIL_USER}>`,
        to:      adminEmail,
        subject: `🆕 Nueva reserva — ${nombre} (${fecha} ${hora})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <h2>Nueva reserva recibida</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr style="background:#f5f5f5"><td style="padding:8px;font-weight:bold;width:40%">Campo</td><td style="padding:8px">Valor</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Nombre</td><td style="padding:8px;border-bottom:1px solid #eee">${nombre}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Email</td><td style="padding:8px;border-bottom:1px solid #eee"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Teléfono</td><td style="padding:8px;border-bottom:1px solid #eee">${telefono}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Fecha</td><td style="padding:8px;border-bottom:1px solid #eee">${fecha}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Hora</td><td style="padding:8px;border-bottom:1px solid #eee">${hora}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Tipo servicio</td><td style="padding:8px;border-bottom:1px solid #eee">${tipoServicio}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Origen</td><td style="padding:8px;border-bottom:1px solid #eee">${origen}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Destino</td><td style="padding:8px;border-bottom:1px solid #eee">${destino}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee">Paradas</td><td style="padding:8px;border-bottom:1px solid #eee">${paradas}</td></tr>
              ${precio ? `<tr><td style="padding:8px;border-bottom:1px solid #eee">Precio estimado</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#C9A84C">${precio}</td></tr>` : ''}
              ${rawCode ? `<tr><td style="padding:8px;border-bottom:1px solid #eee">Código descuento</td><td style="padding:8px;border-bottom:1px solid #eee">${rawCode} (${discountPct}%)</td></tr>` : ''}
              ${comentarios ? `<tr><td style="padding:8px;border-bottom:1px solid #eee">Comentarios</td><td style="padding:8px;border-bottom:1px solid #eee">${comentarios}</td></tr>` : ''}
              <tr><td style="padding:8px;color:#888">ID Firestore</td><td style="padding:8px;color:#888;font-size:12px">${docId}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://www.tellevoatucasa.cl/admin/" style="background:#C9A84C;color:#0A1628;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Abrir panel admin →</a></p>
          </div>`,
      });
    } catch (e) { console.error('Error enviando email admin:', e.message); }
  }

  // ── 3. Google Calendar ───────────────────────────────────────────────────
  if (calendarClient && process.env.GOOGLE_CALENDAR_ID && fecha && hora) {
    try {
      const [h, m] = hora.split(':').map(Number);
      const startDT = `${fecha}T${hora}:00`;
      const endH    = String(h + 2).padStart(2, '0');
      const endDT   = `${fecha}T${endH}:${String(m).padStart(2, '0')}:00`;

      await calendarClient.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        requestBody: {
          summary:     `TeLlevo — ${nombre}`,
          description: `Cliente: ${nombre}\nTeléfono: ${telefono}\nEmail: ${email}\nTipo: ${tipoServicio}\nOrigen: ${origen}\nDestino: ${destino}\nParadas: ${paradas}\n${precio ? `Precio: ${precio}\n` : ''}${rawCode ? `Descuento: ${rawCode}\n` : ''}${comentarios ? `Comentarios: ${comentarios}` : ''}`,
          start: { dateTime: startDT, timeZone: 'America/Santiago' },
          end:   { dateTime: endDT,   timeZone: 'America/Santiago' },
          colorId: '5', // amarillo
        },
      });
    } catch (e) { console.error('Error agregando evento al calendario:', e.message); }
  }

  return res.status(200).setHeader('Content-Type', 'text/plain').send('✅');
};
