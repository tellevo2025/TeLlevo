/*
  api/quote.js — Guarda una cotización en Firestore para analytics.
  Se llama fire-and-forget desde la landing al hacer clic en "Continuar".
*/
const admin = require('firebase-admin');

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!db) return res.status(500).send('DB unavailable');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).send('Invalid JSON'); }
  }

  const { quoteId, distanciaKm, precioTotal, precioBase, descuento, descuentoPct,
          paradasPagas, origen, destino, sinCobertura } = body || {};

  if (!quoteId) return res.status(400).send('Missing quoteId');

  try {
    await db.collection('quotes').doc(quoteId).set({
      quoteId,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      distanciaKm:  Number(distanciaKm)  || 0,
      precioTotal:  Number(precioTotal)  || 0,
      precioBase:   Number(precioBase)   || 0,
      descuento:    Number(descuento)    || 0,
      descuentoPct: Number(descuentoPct) || 0,
      paradasPagas: Number(paradasPagas) || 0,
      origen:       origen  || '',
      destino:      destino || '',
      sinCobertura: !!sinCobertura,
    });
    return res.status(200).send('✅');
  } catch (e) {
    console.error('Error saving quote:', e.message);
    return res.status(500).send('Error');
  }
};
