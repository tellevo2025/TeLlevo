/*
  api/reserva.js — Vercel Serverless Function
  Proxy seguro hacia Google Apps Script.
  - Oculta la URL del AppScript al cliente
  - Valida token de formulario (anti-spam)
  - Detecta honeypot (anti-bots)
  - Valida y aplica códigos de descuento
  - Rate limiting básico por IP
*/

// Códigos de descuento — solo en el servidor, nunca en el cliente.
// Para agregar: 'CODIGO': porcentaje
const DISCOUNT_CODES = {
  'CASAPARQUELORETO':        10,
  'DIARIOPARAUNANOVIA':      10,
  'IBANDRA&CRISTOBAL':       15,
  'MIMATRIMONIO':            30,
  'MATRIMONIOSPORMANCAVADA': 15,
  'MATRIFRAN&FABRI':         10,
};

// Rate limiting en memoria (suficiente para Vercel serverless)
const ipCounts = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_MAX       = 5;               // máx 5 reservas por IP por hora

const normalizeCode = (c) => (c || '').toUpperCase().replace(/\s+/g, '');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const scriptUrl = process.env.APPSCRIPT_URL;
  const formToken = process.env.FORM_TOKEN;

  if (!scriptUrl) {
    console.error('ERROR: APPSCRIPT_URL no definida.');
    return res.status(500).send('❌ Configuración incompleta.');
  }

  // Parsear body (viene como application/x-www-form-urlencoded)
  const params = new URLSearchParams(
    typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString()
  );

  // 1. Honeypot — si viene con valor, es un bot
  if (params.get('_hp')) {
    return res.status(200).send('✅'); // fingir éxito al bot
  }

  // 2. Validar token del formulario
  if (formToken && params.get('_token') !== formToken) {
    console.warn('Token inválido desde IP:', req.headers['x-forwarded-for']);
    return res.status(403).send('⛔');
  }

  // 3. Rate limiting por IP
  const ip    = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now   = Date.now();
  const entry = ipCounts.get(ip) || { count: 0, since: now };
  if (now - entry.since > RATE_WINDOW_MS) { entry.count = 0; entry.since = now; }
  entry.count++;
  ipCounts.set(ip, entry);
  if (entry.count > RATE_MAX) {
    console.warn(`Rate limit superado para IP ${ip}: ${entry.count} intentos`);
    return res.status(429).send('⛔');
  }

  // 4. Aplicar descuento real server-side
  const rawCode     = normalizeCode(params.get('codigoDescuento') || '');
  const discountPct = DISCOUNT_CODES[rawCode] || 0;
  params.set('descuentoPct', String(discountPct));
  if (rawCode && discountPct === 0) params.set('codigoInvalido', 'si');

  // 5. Limpiar campos internos antes de reenviar al AppScript
  params.delete('_token');
  params.delete('_hp');

  try {
    const response = await fetch(scriptUrl, {
      method:  'POST',
      body:    params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'follow',
    });

    const text = (await response.text()).trim();
    // El AppScript guarda los datos antes de cualquier error secundario.
    // Solo ⛔ indica rechazo real (sin cupo). Todo lo demás es éxito.
    const result = text.startsWith('⛔') ? '⛔' : '✅';
    return res.status(200).setHeader('Content-Type', 'text/plain').send(result);
  } catch (error) {
    console.error('Error al reenviar al AppScript:', error.message);
    return res.status(500).send('❌ Error al procesar la reserva.');
  }
}
