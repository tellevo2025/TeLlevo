/*
  effects.js — TeLlevo Landing Page
  Capa de experiencia: progreso de lectura, contadores, foco de luz en tarjetas
  y la secuencia animada de reserva. No contiene lógica de negocio; main.js
  consume playBookingSequence() y fillBookingTicket().
*/

const BOOKING_STAGES = [
  'Recibiendo tu solicitud…',
  'Revisando disponibilidad…',
  'Preparando tu confirmación…',
];
const BOOKING_STAGE_MS = 850;
const COUNT_UP_MS = 1400;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── PROGRESO DE LECTURA ──────────────────────────────────────────────────────
const initScrollProgress = () => {
  const bar = document.querySelector('.scroll-progress');
  if (!bar) return;

  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.setProperty('--scroll-progress', progress.toFixed(4));
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
};

// ─── TONO AMBIENTE SEGÚN EL SCROLL ───────────────────────────────────────────
/**
 * La página recorre la noche del cliente: azul profundo arriba, medianoche al medio
 * y un dorado cálido de "llegaste a casa" al final. Solo se actualiza una variable
 * en la capa fija del fondo; el CSS decide la opacidad de cada tono.
 */
const initScrollAmbient = () => {
  const ambient = document.querySelector('.scroll-ambient');
  if (!ambient) return;

  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    ambient.style.setProperty('--ambient', progress.toFixed(3));
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
};

// ─── CONTADORES ───────────────────────────────────────────────────────────────
/**
 * Anima un número desde 0 hasta data-count-to al entrar en pantalla.
 * El HTML ya trae el valor final, así que sin JS el dato sigue visible.
 */
const initCountUp = () => {
  const counters = document.querySelectorAll('[data-count-to]');
  if (!counters.length || prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const animate = (el) => {
    const target   = parseFloat(el.dataset.countTo);
    const decimals = parseInt(el.dataset.countDecimals || '0', 10);
    const prefix   = el.dataset.countPrefix || '';
    const suffix   = el.dataset.countSuffix || '';
    if (Number.isNaN(target)) return;

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${prefix}${(target * eased).toFixed(decimals)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.6 });

  counters.forEach(el => observer.observe(el));
};

// ─── FOCO DE LUZ EN TARJETAS ──────────────────────────────────────────────────
const initSpotlight = () => {
  if (!window.matchMedia('(hover: hover)').matches) return;

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('[data-spotlight]');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, { passive: true });
};

// ─── SECUENCIA DE RESERVA ─────────────────────────────────────────────────────
/**
 * Recorre los mensajes de la pantalla de carga mientras se envía la reserva.
 * @returns {Promise<void>} Se resuelve al mostrar el último mensaje, para que
 *   la animación se alcance a ver aunque el servidor responda al instante.
 */
const playBookingSequence = () => new Promise((resolve) => {
  const loading = document.getElementById('booking-loading');
  const textEl  = document.getElementById('booking-loading-text');
  if (!loading || !textEl) { resolve(); return; }

  const showStage = (stage) => {
    loading.dataset.stage = String(stage);
    textEl.textContent = BOOKING_STAGES[stage];
    textEl.classList.remove('booking-loading__text--swap');
    void textEl.offsetWidth;
    textEl.classList.add('booking-loading__text--swap');
  };

  showStage(0);
  if (prefersReducedMotion()) { resolve(); return; }

  let stage = 0;
  const timer = setInterval(() => {
    stage += 1;
    if (stage >= BOOKING_STAGES.length) {
      clearInterval(timer);
      resolve();
      return;
    }
    showStage(stage);
  }, BOOKING_STAGE_MS);
});

// ─── TICKET DE CONFIRMACIÓN ───────────────────────────────────────────────────
const formatTicketDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day)
    .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
};

/** Completa el ticket de la pantalla de éxito con los datos del formulario. */
const fillBookingTicket = () => {
  const ticket = document.getElementById('booking-ticket');
  if (!ticket) return;

  const read = (id) => (document.getElementById(id)?.value || '').trim();
  const time = read('horaViaje');
  const passengers = read('personas');

  const fields = {
    origin:      read('centroEvento'),
    destination: read('destino'),
    date:        formatTicketDate(read('fechaViaje')),
    time:        time ? `${time} hrs` : '',
    vehicle:     [read('marcaModelo'), read('patente').toUpperCase()].filter(Boolean).join(' · '),
    passengers:  passengers ? `${passengers} ${passengers === '1' ? 'pasajero' : 'pasajeros'}` : '',
  };

  ticket.querySelectorAll('[data-ticket]').forEach(el => {
    el.textContent = fields[el.dataset.ticket] || '—';
  });
  ticket.hidden = !fields.origin && !fields.destination;
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initScrollProgress();
  initScrollAmbient();
  initCountUp();
  initSpotlight();
});

// ─── CÓMO FUNCIONA: PROGRESO ──────────────────────────────────────────────────
/** El auto avanza por la línea a medida que la sección cruza la pantalla y enciende cada paso. */
const initStepsProgress = () => {
  const list = document.querySelector('[data-steps]');
  const track = list?.querySelector('.steps__progress');
  if (!list || !track) return;
  const steps = [...list.querySelectorAll('.step')];

  if (prefersReducedMotion()) {
    list.style.setProperty('--steps-progress', '1');
    list.style.setProperty('--steps-width', `${track.offsetWidth}px`);
    steps.forEach(step => step.classList.add('step--lit'));
    return;
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const rect = list.getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = Math.min(1, Math.max(0, (viewport * 0.85 - rect.top) / (viewport * 0.6)));
    list.style.setProperty('--steps-progress', progress.toFixed(3));
    list.style.setProperty('--steps-width', `${track.offsetWidth}px`);
    const lastIndex = Math.max(1, steps.length - 1);
    steps.forEach((step, i) => step.classList.toggle('step--lit', progress > 0 && progress >= i / lastIndex - 0.001));
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
};

// ─── ANIMACIONES SOLO EN PANTALLA ─────────────────────────────────────────────
/**
 * Pausa las animaciones de cada sección mientras no se ve. En celular esto evita que
 * decenas de escenas sigan dibujándose fuera de la vista y bajen los cuadros por segundo.
 */
const initOffscreenPause = () => {
  if (!('IntersectionObserver' in window)) return;
  const scopes = document.querySelectorAll('.hero, main > section, .footer, .booking-loading');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => target.classList.toggle('is-offscreen', !isIntersecting));
  }, { rootMargin: '120px 0px' });
  scopes.forEach(scope => observer.observe(scope));
};

// ─── HERO: PROFUNDIDAD CON EL MOUSE ───────────────────────────────────────────
/** La escena del hero se inclina y sus capas se desplazan según la posición del puntero. */
const initHeroParallax = () => {
  const stage = document.querySelector('[data-parallax]');
  const hero = stage?.closest('.hero');
  if (!hero || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return;

  let frame = 0;
  let point = { x: 0, y: 0 };
  const apply = () => {
    frame = 0;
    stage.style.setProperty('--px', point.x.toFixed(3));
    stage.style.setProperty('--py', point.y.toFixed(3));
  };
  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    point = { x: ((e.clientX - rect.left) / rect.width - 0.5) * 2, y: ((e.clientY - rect.top) / rect.height - 0.5) * 2 };
    frame ||= requestAnimationFrame(apply);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => {
    point = { x: 0, y: 0 };
    frame ||= requestAnimationFrame(apply);
  });
};

// ─── COTIZADOR: EL AUTO ACELERA AL CALCULAR ───────────────────────────────────
const COT_DRIVE_MS = 1800;

const initCotizadorCar = () => {
  const emblem = document.querySelector('[data-cot-car]');
  const button = document.getElementById('cot-calc-btn');
  if (!emblem || !button) return;
  let timer = null;
  button.addEventListener('click', () => {
    clearTimeout(timer);
    emblem.classList.remove('is-driving');
    void emblem.offsetWidth;
    emblem.classList.add('is-driving');
    timer = setTimeout(() => emblem.classList.remove('is-driving'), COT_DRIVE_MS);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initOffscreenPause();
  initHeroParallax();
  initCotizadorCar();
  initStepsProgress();
});
