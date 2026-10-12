/*
  api/reserva.js — Vercel Serverless Function
  1. Guarda la reserva en Firestore (para el panel admin)
  2. Reenvía al GAS para emails + Google Calendar (flujo original)
*/
const admin = require('firebase-admin');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwF2yM80mDIwnEv_fLiz35fvKSl4KgF2og5QU4zRA11kN7Ou0Mu7BeYCL__6FpUYqzG/exec';

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

  // ── 1. Guardar en Firestore ──────────────────────────────────────────────
  if (db) {
    try {
      await db.collection('reservations').add({
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
        status:       'pending',
        driverId:     null,
        driverName:   null,
        nombre:       params.get('nombre')       || '',
        email:        params.get('email')        || '',
        telefono:     params.get('telefono')     || '',
        fecha:        params.get('fecha')        || '',
        hora:         params.get('hora')         || '',
        tipoServicio: params.get('tipoServicio') || '',
        origen:       params.get('centroEvento') || '',
        destino:      params.get('destino')      || '',
        paradas:      params.get('paradas')      || '0',
        comentarios:  params.get('comentarios')  || '',
        codigoDescuento: rawCode,
        descuentoPct,
        cotizacion,
        ip,
      });
    } catch (e) { console.error('Error guardando en Firestore:', e.message); }
  }

  // ── 2. Reenviar al GAS (emails + calendario) ────────────────────────────
  // Fire-and-forget: no bloqueamos la respuesta al usuario
  fetch(GAS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  }).catch(e => console.error('GAS forward error:', e.message));

  return res.status(200).setHeader('Content-Type', 'text/plain').send('✅');
};
