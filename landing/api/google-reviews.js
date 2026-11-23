/*
  api/google-reviews.js — Vercel Serverless Function
  Entrega la calificación y las reseñas públicas de la ficha de TeLlevo en Google
  (Places API New, Place Details). Google devuelve como máximo 5 reseñas.
  La clave queda en el servidor y la respuesta no se almacena: las políticas de
  Places solo permiten guardar el place ID.

  Tope de gasto: Google regala 1.000 consultas al mes de este tipo. Cada consulta
  se cuenta en Firestore y, al llegar a MONTHLY_LIMIT, se deja de consultar hasta
  el mes siguiente; la landing muestra entonces solo los enlaces a Google.
*/
const admin = require('firebase-admin');

const PLACE_ID = 'ChIJmaX7hBxiDgARkS2rsDLSgQI';
// Algunas terminales anteponen una marca BOM invisible al guardar la variable; Google la rechaza.
const API_KEY  = (process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_MAPS_KEY || '').replace(/^﻿/, '').trim();
const FIELDS   = 'rating,userRatingCount,reviews,googleMapsUri';
const TIMEOUT_MS = 6000;
const MAX_TEXT_LENGTH = 420;
const MONTHLY_LIMIT = 999;
const USAGE_COLLECTION = 'apiUsage';
// Google cierra el mes de facturación en hora del Pacífico, no de Chile.
const BILLING_TIME_ZONE = 'America/Los_Angeles';

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

const billingMonth = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: BILLING_TIME_ZONE, year: 'numeric', month: '2-digit',
}).format(date);

/**
 * Reserva una consulta del cupo mensual de forma atómica.
 * @returns {Promise<boolean>} true si quedaba cupo y se descontó.
 */
async function reserveMonthlyCall() {
  const month = billingMonth();
  const ref = db.collection(USAGE_COLLECTION).doc(`google-reviews-${month}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data().count) || 0 : 0;
    if (used >= MONTHLY_LIMIT) return false;
    tx.set(ref, {
      month,
      count: used + 1,
      limit: MONTHLY_LIMIT,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

const trimText = (text) => {
  const clean = String(text || '').trim();
  return clean.length > MAX_TEXT_LENGTH ? `${clean.slice(0, MAX_TEXT_LENGTH).trimEnd()}…` : clean;
};

const toReview = (review) => ({
  author:   review.authorAttribution?.displayName || 'Cliente de Google',
  authorUrl: review.authorAttribution?.uri || '',
  photo:    review.authorAttribution?.photoUri || '',
  rating:   Number(review.rating) || 0,
  when:     review.relativePublishTimeDescription || '',
  text:     trimText(review.text?.text || review.originalText?.text),
  url:      review.googleMapsUri || '',
});

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  if (!API_KEY) return res.status(200).json({ ok: false, reason: 'sin-clave' });
  // Sin base de datos no hay forma de garantizar el tope, así que no se consulta a Google.
  if (!db) return res.status(200).json({ ok: false, reason: 'sin-contador' });

  try {
    if (!(await reserveMonthlyCall())) return res.status(200).json({ ok: false, reason: 'cupo-mensual' });
  } catch (e) {
    console.error('Google reviews quota error:', e.message);
    return res.status(200).json({ ok: false, reason: 'sin-contador' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=es&regionCode=CL`,
      { headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': FIELDS }, signal: controller.signal },
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('Google reviews error:', response.status, data?.error?.status, data?.error?.message);
      return res.status(200).json({ ok: false, reason: 'google' });
    }
    return res.status(200).json({
      ok:      true,
      rating:  Number(data.rating) || null,
      count:   Number(data.userRatingCount) || 0,
      mapsUrl: data.googleMapsUri || '',
      reviews: (data.reviews || []).map(toReview).filter(r => r.text),
    });
  } catch (e) {
    console.error('Google reviews fetch error:', e.message);
    return res.status(200).json({ ok: false, reason: 'error' });
  } finally {
    clearTimeout(timer);
  }
};
