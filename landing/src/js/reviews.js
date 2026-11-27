/*
  reviews.js — TeLlevo Landing Page
  Muestra la calificación y las reseñas reales de la ficha de Google de TeLlevo.
  Los datos llegan desde /api/google-reviews; si Google no responde, la sección
  conserva los enlaces para ver y dejar reseñas, sin mostrar cifras inventadas.
*/

const REVIEWS_ENDPOINT = '/api/google-reviews';
const MAX_STARS = 5;

const formatRating = (rating) => rating.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const reviewWord = (count) => (count === 1 ? 'reseña' : 'reseñas');

/** Estrellas como texto para lectores de pantalla y como glifos para la vista. */
const buildStars = (rating) => {
  const stars = document.createElement('span');
  stars.className = 'google-stars';
  stars.setAttribute('role', 'img');
  stars.setAttribute('aria-label', `${rating} de ${MAX_STARS} estrellas`);
  stars.textContent = '★'.repeat(Math.round(rating)).padEnd(MAX_STARS, '☆');
  return stars;
};

const buildAvatar = (review) => {
  if (review.photo) {
    const img = document.createElement('img');
    img.className = 'google-review__avatar';
    img.src = review.photo;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    return img;
  }
  const initial = document.createElement('span');
  initial.className = 'google-review__avatar google-review__avatar--initial';
  initial.setAttribute('aria-hidden', 'true');
  initial.textContent = review.author.charAt(0).toUpperCase();
  return initial;
};

const buildReviewCard = (review) => {
  const card = document.createElement('li');
  card.className = 'google-review';

  const head = document.createElement('div');
  head.className = 'google-review__head';
  const who = document.createElement('div');
  const name = document.createElement(review.authorUrl ? 'a' : 'span');
  name.className = 'google-review__name';
  name.textContent = review.author;
  if (review.authorUrl) {
    name.href = review.authorUrl;
    name.target = '_blank';
    name.rel = 'noopener';
  }
  const when = document.createElement('span');
  when.className = 'google-review__when';
  when.textContent = review.when;
  who.append(name, when);
  head.append(buildAvatar(review), who);

  const text = document.createElement('blockquote');
  text.className = 'google-review__text';
  text.textContent = review.text;

  const foot = document.createElement('div');
  foot.className = 'google-review__foot';
  foot.append(buildStars(review.rating));
  if (review.url) {
    const link = document.createElement('a');
    link.className = 'google-review__link';
    link.href = review.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Ver en Google';
    foot.append(link);
  }

  card.append(head, text, foot);
  return card;
};

const fillSummary = ({ rating, count }) => {
  document.querySelectorAll('[data-google="rating"]').forEach(el => { el.textContent = formatRating(rating); });
  document.querySelectorAll('[data-google="count"]').forEach(el => { el.textContent = `${count} ${reviewWord(count)}`; });
  document.querySelectorAll('[data-google="stars"]').forEach(el => el.replaceChildren(buildStars(rating)));
  document.querySelectorAll('[data-google-pill]').forEach(el => { el.hidden = false; });
};

const setState = (section, state) => { section.dataset.state = state; };

async function loadGoogleReviews() {
  const section = document.getElementById('google-reviews');
  const track = document.getElementById('google-reviews-track');
  if (!section || !track) return;

  try {
    const response = await fetch(REVIEWS_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok || !data.rating) throw new Error(data.reason || 'sin datos');

    fillSummary(data);
    track.replaceChildren(...data.reviews.map(buildReviewCard));
    setState(section, data.reviews.length ? 'ready' : 'empty');
  } catch (err) {
    console.error('Reseñas de Google no disponibles:', err.message);
    track.replaceChildren();
    setState(section, 'unavailable');
  }
}

/*
  Cada consulta a Google descuenta del cupo diario y las condiciones de Places no permiten
  guardar las reseñas en caché. Por eso se piden una sola vez y solo cuando el visitante se
  acerca a la sección (unos 600 px antes): quien no llega hasta ahí no gasta cupo.
*/
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('google-reviews');
  if (!section) return;

  if (!('IntersectionObserver' in window)) {
    loadGoogleReviews();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    loadGoogleReviews();
  }, { rootMargin: '600px 0px' });
  observer.observe(section);
});
