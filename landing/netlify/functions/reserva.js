/*
  netlify/functions/reserva.js
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
  'CASAPARQUELORETO':       10,
  'DIARIOPARAUNANOVIA':     10,
  'IBANDRA&CRISTOBAL':      15,
  'MIMATRIMONIO':           30,
  'MATRIMONIOSPORMANCAVADA':15,
  'MATRIMONIOJESU&ALEX':    15,
};

// Rate limiting en memoria (se resetea si la función se recicla, suficiente para Netlify)
const ipCounts = new Map();
const RATE_WINDOW_MS  = 60 * 60 * 1000; // 1 hora
const RATE_MAX        = 5;               // máx 5 reservas por IP por hora

const normalizeCode = (c) => (c || '').toUpperCase().replace(/\s+/g, '');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const scriptUrl  = process.env.APPSCRIPT_URL;
  const formToken  = process.env.FORM_TOKEN;

  if (!scriptUrl) {
    console.error('ERROR: APPSCRIPT_URL no está definida en las variables de entorno.');
    return { statusCode: 500, body: '❌ Configuración incompleta en el servidor.' };
  }

  // Parsear body
  const params = new URLSearchParams(event.body || '');

  // 1. Honeypot — si viene con valor, es un bot
  if (params.get('_hp')) {
    return { statusCode: 200, body: '✅' }; // fingir éxito al bot
  }

  // 2. Validar token del formulario
  if (formToken && params.get('_token') !== formToken) {
    console.warn('Token inválido desde IP:', event.headers['x-forwarded-for']);
    return { statusCode: 403, body: '⛔' };
  }

  // 3. Rate limiting por IP
  const ip  = (event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const entry = ipCounts.get(ip) || { count: 0, since: now };
  if (now - entry.since > RATE_WINDOW_MS) {
    entry.count = 0;
    entry.since = now;
  }
  entry.count++;
  ipCounts.set(ip, entry);
  if (entry.count > RATE_MAX) {
    console.warn(`Rate limit superado para IP ${ip}: ${entry.count} intentos`);
    return { statusCode: 429, body: '⛔' };
  }

  // 4. Aplicar descuento real server-side
  const rawCode    = normalizeCode(params.get('codigoDescuento') || '');
  const discountPct = DISCOUNT_CODES[rawCode] || 0;
  if (discountPct > 0) {
    params.set('descuentoPct', String(discountPct));
    params.set('descuentoAplicado', 'si');
  } else if (rawCode) {
    params.set('descuentoPct', '0');
    params.set('codigoInvalido', 'si');
  }

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

    const text = await response.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text.trim(),
    };
  } catch (error) {
    console.error('Error al reenviar al AppScript:', error.message);
    return { statusCode: 500, body: '❌ Error al procesar la reserva.' };
  }
};
