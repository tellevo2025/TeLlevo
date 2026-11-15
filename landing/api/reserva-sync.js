/*
  api/reserva-sync.js — Vercel Serverless Function
  Lleva a la hoja y a Google Calendar (vía Apps Script) el estado vigente de una
  reserva después de que el panel la modifica. Lee la reserva desde Firestore en
  vez de confiar en datos del navegador, y solo acepta sesiones del panel.
*/
const admin = require('firebase-admin');

const GAS_URL = process.env.APPSCRIPT_URL || process.env.appscritp || '';
// Solo esta versión del Apps Script entiende "accion=actualizar"; una anterior
// trataría la actualización como reserva nueva y reenviaría correos al cliente.
const REQUIRED_GAS_VERSION = 'v2';
const VERSION_RECHECK_MS = 60 * 1000;

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

let gasReady = false;
let gasCheckedAt = 0;

async function isGasReady() {
  if (gasReady) return true;
  if (Date.now() - gasCheckedAt < VERSION_RECHECK_MS) return false;
  gasCheckedAt = Date.now();
  try {
    const text = await fetch(GAS_URL).then(r => r.text());
    gasReady = text.includes(`TeLlevo ${REQUIRED_GAS_VERSION}`);
  } catch (e) { console.error('GAS version check error:', e.message); }
  return gasReady;
}

const toISODate = (fecha) => {
  const text = String(fecha || '').trim();
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : text;
};

/** Lo último que conoce el calendario: sirve para ubicar el evento de reservas antiguas. */
const lastSynced = (r) => r.calendarSync || {
  fecha:  r.fechaCliente || r.fecha,
  hora:   r.horaCliente  || r.hora,
  nombre: r.nombre,
};

function buildGasParams(id, r) {
  const previous = lastSynced(r);
  const price = r.precioManual ?? r.cotizacion?.total ?? r.cotizacion?.precio ?? '';
  const entries = {
    accion:          'actualizar',
    reservaId:       id,
    fechaViaje:      toISODate(r.fecha),
    horaViaje:       r.hora,
    nombre:          r.nombre,
    telefono:        r.telefono,
    telefono2:       r.telefono2,
    correo:          r.email,
    centroEvento:    r.origen,
    destino:         r.destino,
    personas:        r.personas,
    paradas:         r.paradas,
    paradaAdicional: r.paradaAdicional,
    marcaModelo:     r.marcaModelo,
    patente:         r.patente,
    transmision:     r.transmision,
    seguro:          r.seguro,
    alianza:         r.codigoDescuento,
    estado:          r.status,
    chofer:          r.driverName,
    precio:          price,
    distanciaKm:     r.cotizacion?.distanciaKm,
    precioBase:      r.cotizacion?.precioBase,
    descuento:       r.cotizacion?.descuento,
    descuentoPct:    r.cotizacion?.descuentoPct,
    fechaAnterior:   toISODate(previous.fecha),
    horaAnterior:    previous.hora,
    nombreAnterior:  previous.nombre,
  };
  const params = new URLSearchParams();
  Object.entries(entries).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  return params;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, reason: 'method' });
  if (!db) return res.status(500).json({ ok: false, reason: 'db' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    await admin.auth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ ok: false, reason: 'auth' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const id = String(body?.id || '');
  if (!/^[\w-]{1,128}$/.test(id)) return res.status(400).json({ ok: false, reason: 'id' });

  if (!GAS_URL || !(await isGasReady())) {
    return res.status(200).json({ ok: false, reason: 'apps-script-pendiente' });
  }

  try {
    const ref = db.collection('reservations').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, reason: 'not-found' });
    const reservation = snap.data();

    const gasText = await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    buildGasParams(id, reservation).toString(),
    }).then(r => r.text());

    if (!gasText.trim().startsWith('✅')) {
      console.error('GAS update rejected:', gasText.slice(0, 200));
      return res.status(502).json({ ok: false, reason: 'apps-script' });
    }

    // Sin updatedAt: registrar la sincronización no es un cambio de la reserva.
    await ref.update({
      calendarSync: { fecha: reservation.fecha || '', hora: reservation.hora || '', nombre: reservation.nombre || '' },
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Reserva sync error:', e.message);
    return res.status(500).json({ ok: false, reason: 'error' });
  }
};
