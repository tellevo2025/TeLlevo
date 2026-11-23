/*
  api/google-reviews.js — Vercel Serverless Function
  Entrega la calificación y las reseñas públicas de la ficha de TeLlevo en Google
  (Places API New, Place Details). Google devuelve como máximo 5 reseñas.
  La clave queda en el servidor y la respuesta no se almacena: las políticas de
  Places solo permiten guardar el place ID.

  Tope de gasto: Google regala 1.000 consultas al mes de este tipo. Cada consulta
  se cuenta en Firestore y se deja de consultar al llegar a cualquiera de estos topes:
    · MONTHLY_LIMIT al mes
    · DAILY_LIMIT al día (igual a la cuota diaria configurada en Google Cloud, para
      no gastar el cupo mensual en consultas que Google igual rechazaría)
    · VISITOR_LIMIT por visitante y hora, para que nadie agote el cupo a propósito
  La landing muestra entonces solo los enlaces a Google.
*/
const crypto = require('crypto');
const admin = require('firebase-admin');

const PLACE_ID = 'ChIJmaX7hBxiDgARkS2rsDLSgQI';
// Algunas terminales anteponen una marca BOM invisible al guardar la variable; Google la rechaza.
const API_KEY  = (process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_MAPS_KEY || '').replace(/^﻿/, '').trim();
const FIELDS   = 'rating,userRatingCount,reviews,googleMapsUri';
const TIMEOUT_MS = 6000;
const MAX_TEXT_LENGTH = 420;
const MONTHLY_LIMIT = 999;
// Debe coincidir con "GetPlaceRequest per day" de Places API (New) en Google Cloud.
const DAILY_LIMIT = 32;
const VISITOR_LIMIT = 5;
const USAGE_COLLECTION = 'apiUsage';
// Google cierra el día y el mes de facturación en hora del Pacífico, no de Chile.
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

/** Fecha y hora de facturación de Google como { month: '2026-11', day: '2026-11-23', hour: '2026-11-23T14' }. */
function billingClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const month = `${parts.year}-${parts.month}`;
  const day = `${month}-${parts.day}`;
  return { month, day, hour: `${day}T${parts.hour}` };
}

// Se guarda una huella de la IP, nunca la IP: basta para contar y no identifica a nadie.
const visitorKey = (ip) => crypto.createHash('sha256').update(`${PLACE_ID}:${ip}`).digest('hex').slice(0, 24);

const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida')
  .split(',')[0].trim();

/**
 * Reserva de forma atómica una consulta, respetando los topes por visitante, día y mes.
 * @returns {Promise<string>} '' si se reservó; si no, el motivo del rechazo.
 */
async function reserveCall(ip) {
  const clock = billingClock();
  const usageRef = db.collection(USAGE_COLLECTION).doc(`google-reviews-${clock.month}`);
  const visitorRef = db.collection(USAGE_COLLECTION).doc(`google-reviews-visitor-${visitorKey(ip)}`);

  return db.runTransaction(async (tx) => {
    const [usageSnap, visitorSnap] = await Promise.all([tx.get(usageRef), tx.get(visitorRef)]);
    const usage = usageSnap.exists ? usageSnap.data() : {};
    const visitor = visitorSnap.exists ? visitorSnap.data() : {};

    const visitorCount = visitor.hour === clock.hour ? Number(visitor.count) || 0 : 0;
    const dayCount = usage.day === clock.day ? Number(usage.dayCount) || 0 : 0;
    const monthCount = Number(usage.count) || 0;

    if (visitorCount >= VISITOR_LIMIT) return 'limite-visitante';
    if (monthCount >= MONTHLY_LIMIT) return 'cupo-mensual';
    if (dayCount >= DAILY_LIMIT) return 'cupo-diario';

    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(usageRef, {
      month: clock.month, count: monthCount + 1, limit: MONTHLY_LIMIT,
      day: clock.day, dayCount: dayCount + 1, dailyLimit: DAILY_LIMIT,
      updatedAt: now,
    }, { merge: true });
    tx.set(visitorRef, { hour: clock.hour, count: visitorCount + 1, updatedAt: now });
    return '';
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
    const refusal = await reserveCall(clientIp(req));
    if (refusal) return res.status(200).json({ ok: false, reason: refusal });
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
