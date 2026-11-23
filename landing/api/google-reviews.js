/*
  api/google-reviews.js — Vercel Serverless Function
  Entrega la calificación y las reseñas públicas de la ficha de TeLlevo en Google
  (Places API New, Place Details). Google devuelve como máximo 5 reseñas.
  La clave queda en el servidor y la respuesta no se almacena: las políticas de
  Places solo permiten guardar el place ID.
*/

const PLACE_ID = 'ChIJmaX7hBxiDgARkS2rsDLSgQI';
const API_KEY  = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_MAPS_KEY || '';
const FIELDS   = 'rating,userRatingCount,reviews,googleMapsUri';
const TIMEOUT_MS = 6000;
const MAX_TEXT_LENGTH = 420;

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
