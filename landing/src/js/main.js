/*
  main.js — TeLlevo Landing Page
  Navbar · Modal T&C · Calendario personalizado · Formulario 4 pasos · Autocomplete OSM
*/

// Endpoint de reserva: llama directo al AppScript de Google.
// En producción con Netlify se puede usar '/.netlify/functions/reserva' como proxy.
const SUBMIT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbztsumZG3dqedxZsateHQx3cKnf8t6CKm0qtYtjAbRXcbIrnUssIzSedD44kkK9az5o/exec';

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
const initNavbar = () => {
  const navbar  = document.getElementById('navbar');
  const toggle  = navbar.querySelector('.navbar__toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('navbar--scrolled', window.scrollY > 20);
  }, { passive: true });

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.classList.toggle('navbar__toggle--open', !open);
    mobileMenu.hidden = open;
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('navbar__toggle--open');
      mobileMenu.hidden = true;
    });
  });
};

// ─── SMOOTH SCROLL ────────────────────────────────────────────────────────────
const initSmoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id = anchor.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    });
  });
};

// ─── MODAL TÉRMINOS Y CONDICIONES ────────────────────────────────────────────
const initModal = () => {
  const modal     = document.getElementById('tyc-modal');
  const openConfirm = document.getElementById('open-tyc-confirm');
  const openFooter  = document.getElementById('open-tyc-footer');
  const cancelBtn   = document.getElementById('cancel-tyc');
  const acceptBtn   = document.getElementById('accept-tyc');

  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    cancelBtn.focus();
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  // "Confirmar reserva" en step 4: valida primero, luego abre modal
  openConfirm?.addEventListener('click', () => {
    if (!stepValidators[4]()) {
      const firstErr = document.querySelector('.form-group__input--invalid');
      firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    open();
  });

  // Abrir desde footer (solo muestra T&C, sin submit)
  openFooter?.addEventListener('click', open);

  // Cancelar: cierra sin enviar
  cancelBtn?.addEventListener('click', close);

  // Aceptar: cierra modal y envía el formulario
  acceptBtn?.addEventListener('click', () => {
    close();
    document.getElementById('booking-form').requestSubmit();
  });

  // Cerrar con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
};

// ─── CALENDARIO PERSONALIZADO ─────────────────────────────────────────────────
const initCalendar = () => {
  const widget    = document.getElementById('calendar-widget');
  const daysEl    = document.getElementById('cal-days');
  const titleEl   = document.getElementById('cal-title');
  const selectedEl = document.getElementById('cal-selected');
  const hiddenInput = document.getElementById('fechaViaje');

  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const days   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = new Date(today.getFullYear(), today.getMonth(), 1);

  const fmt = (d) => {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const render = () => {
    const year  = current.getFullYear();
    const month = current.getMonth();

    titleEl.textContent = `${months[month]} ${year}`;
    daysEl.innerHTML = '';

    const firstDow  = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Celdas vacías antes del primer día
    for (let i = 0; i < firstDow; i++) {
      const el = document.createElement('div');
      el.className = 'calendar-day calendar-day--empty';
      el.setAttribute('aria-hidden', 'true');
      daysEl.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(year, month, d);
      const dateStr = fmt(date);
      const isPast  = date < today;
      const isToday = date.getTime() === today.getTime();
      const isSel   = hiddenInput.value === dateStr;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar-day';
      btn.textContent = d;
      btn.setAttribute('aria-label', `${d} de ${months[month]} de ${year}`);

      if (isPast) {
        btn.disabled = true;
        btn.classList.add('calendar-day--past');
      } else {
        if (isToday)  btn.classList.add('calendar-day--today');
        if (isSel)    btn.classList.add('calendar-day--selected');

        btn.addEventListener('click', () => {
          hiddenInput.value = dateStr;
          document.getElementById('fechaViaje-error').textContent = '';

          // Mostrar horas y resetear selección previa
          const horaSection = document.getElementById('hora-section');
          horaSection.hidden = false;
          document.getElementById('horaViaje').value = '';
          document.querySelectorAll('.hora-btn').forEach(b => b.classList.remove('hora-btn--active'));

          // Actualizar texto de fecha seleccionada
          const [y, m, dd2] = dateStr.split('-');
          selectedEl.textContent = `Fecha seleccionada: ${parseInt(dd2)} de ${months[parseInt(m) - 1]} de ${y}`;

          render();

          horaSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }

      daysEl.appendChild(btn);
    }
  };

  document.getElementById('cal-prev').addEventListener('click', () => {
    // No retroceder más allá del mes actual
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (current <= minMonth) return;
    current.setMonth(current.getMonth() - 1);
    render();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    current.setMonth(current.getMonth() + 1);
    render();
  });

  render();
};

// ─── HORAS ────────────────────────────────────────────────────────────────────
const initHoras = () => {
  const track = document.getElementById('hora-track');
  if (!track) return;

  track.querySelectorAll('.hora-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      track.querySelectorAll('.hora-btn').forEach(b => b.classList.remove('hora-btn--active'));
      btn.classList.add('hora-btn--active');
      document.getElementById('horaViaje').value = btn.dataset.hora;
      document.getElementById('horaViaje-error').textContent = '';
    });
  });
};



// ─── PASOS ────────────────────────────────────────────────────────────────────
const stepValidators = {
  1: () => {
    let ok = true;
    if (!document.getElementById('fechaViaje').value) {
      document.getElementById('fechaViaje-error').textContent = 'Selecciona la fecha del evento.';
      ok = false;
    }
    if (!document.getElementById('horaViaje').value) {
      document.getElementById('horaViaje-error').textContent = 'Selecciona la hora de recogida.';
      ok = false;
    }
    return ok;
  },
  2: () => {
    let ok = true;
    const checks = {
      centroEvento: 'Ingresa la dirección de origen.',
      destino:      'Ingresa la dirección de destino.',
    };
    Object.entries(checks).forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        document.getElementById(`${id}-error`).textContent = msg;
        el.classList.add('form-group__input--invalid');
        ok = false;
      }
    });
    // Validar todas las paradas dinámicas si el checkbox está marcado
    if (document.getElementById('parada-check')?.checked) {
      document.querySelectorAll('#paradas-list .parada-item').forEach((item, i) => {
        const input = item.querySelector('input[type="text"]');
        const errEl = item.querySelector('.form-group__error');
        if (input && !input.value.trim()) {
          if (errEl) errEl.textContent = `Ingresa la dirección de la parada ${i + 1}.`;
          input.classList.add('form-group__input--invalid');
          ok = false;
        }
      });
    }
    return ok;
  },
  3: () => {
    let ok = true;
    const checks = {
      nombre:   { msg: 'Ingresa tu nombre completo.',    test: v => v.trim().length >= 2 },
      telefono: { msg: 'Ingresa tu número de teléfono.', test: v => v.trim().length >= 7 },
      correo:   { msg: 'Ingresa un correo válido.',       test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    };
    Object.entries(checks).forEach(([id, { msg, test }]) => {
      const el = document.getElementById(id);
      const errEl = document.getElementById(`${id}-error`);
      if (!test(el.value)) {
        if (errEl) errEl.textContent = msg;
        el.classList.add('form-group__input--invalid');
        ok = false;
      }
    });
    return ok;
  },
  4: () => {
    let ok = true;
    const checks = {
      marcaModelo: { msg: 'Ingresa la marca y modelo del auto.', test: v => v.trim().length >= 2 },
      patente:     { msg: 'Ingresa la patente del vehículo.',    test: v => v.trim().length >= 4 },
      transmision: { msg: 'Selecciona el tipo de transmisión.',  test: v => !!v },
      seguro:      { msg: 'Indica si el auto tiene seguro.',     test: v => !!v },
      personas:    { msg: 'Indica cuántos pasajeros van.',        test: v => !!v },
    };
    Object.entries(checks).forEach(([id, { msg, test }]) => {
      const el = document.getElementById(id);
      const errEl = document.getElementById(`${id}-error`);
      if (!test(el.value)) {
        if (errEl) errEl.textContent = msg;
        el.classList.add('form-group__input--invalid');
        ok = false;
      }
    });
    return ok;
  },
};

const goToStep = (to) => {
  document.querySelectorAll('.form-step').forEach(s => {
    const isTarget = parseInt(s.dataset.step) === to;
    s.hidden = !isTarget;
    if (isTarget) {
      s.classList.remove('form-step--enter');
      s.offsetHeight;
      s.classList.add('form-step--enter');
    }
  });

  document.querySelectorAll('.booking-progress__step').forEach((s, i) => {
    const n = i + 1;
    s.classList.remove('booking-progress__step--active', 'booking-progress__step--done');
    if (n === to) s.classList.add('booking-progress__step--active');
    if (n < to)   s.classList.add('booking-progress__step--done');
  });

  document.querySelectorAll('.booking-progress__line').forEach((l, i) => {
    l.classList.toggle('booking-progress__line--done', i + 1 < to);
  });

  window.scrollTo({ top: document.getElementById('reserva').getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
};

const initSteps = () => {
  document.querySelectorAll('.step-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = parseInt(btn.closest('.form-step').dataset.step);
      if (stepValidators[current]()) goToStep(parseInt(btn.dataset.next));
      else {
        const firstErr = document.querySelector('.form-group__input--invalid, [role="alert"]:not(:empty)');
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  document.querySelectorAll('.step-prev').forEach(btn => {
    btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.prev)));
  });
};

// ─── ENVÍO ────────────────────────────────────────────────────────────────────

// Fallback: envía datos mediante un form oculto hacia un iframe (evita CORS)
const sendViaForm = (data) => new Promise((resolve) => {
  const iframe = document.createElement('iframe');
  iframe.name = '_submit_frame';
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px';
  document.body.appendChild(iframe);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action  = SUBMIT_ENDPOINT;
  form.target  = '_submit_frame';

  Object.entries(data).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();

  // Esperamos 2 segundos para que el form se envíe, luego asumimos éxito
  setTimeout(() => {
    document.body.removeChild(form);
    document.body.removeChild(iframe);
    resolve('✅');
  }, 2000);
});

const sendReservation = async (data) => {
  const params = new URLSearchParams(data);
  try {
    const res  = await fetch(SUBMIT_ENDPOINT, { method: 'POST', body: params, redirect: 'follow' });
    const text = await res.text().then(t => t.trim());
    if (text.startsWith('⛔')) return '⛔';
    // Cualquier otra respuesta (✅ o ❌ post-guardado) se trata como éxito
    // porque el AppScript guarda en el sheet antes de cualquier error secundario
    return '✅';
  } catch {
    // CORS block — enviar vía form y asumir éxito
    return sendViaForm(data);
  }
};

const setLoading = (on) => {
  const acceptBtn = document.getElementById('accept-tyc');
  if (!acceptBtn) return;
  acceptBtn.disabled = on;
  acceptBtn.textContent = on ? 'Enviando…' : 'Aceptar y confirmar reserva';
  document.getElementById('booking-form').hidden = on;
  document.getElementById('booking-loading').hidden = !on;
  if (on) document.getElementById('booking-loading').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const showResult = (type) => {
  document.getElementById('booking-form').hidden = true;
  ['success', 'full', 'error'].forEach(t => {
    document.getElementById(`result-${t}`).hidden = t !== type;
  });

  if (type === 'success') {
    try {
      const q = JSON.parse(document.getElementById('cotizacion-data').value || '{}');
      const quoteEl = document.getElementById('result-quote');
      if (!quoteEl) return;

      if (q.sinCobertura) {
        // Viaje largo: mostrar aviso personalizado
        quoteEl.innerHTML = `
          <p class="result-quote__title">Viaje de larga distancia</p>
          <div class="result-quote__long-distance">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/></svg>
            <p>Tu viaje es de <strong>${q.distanciaKm} km</strong>. Nuestro equipo te contactará a la brevedad para entregarte una cotización personalizada.</p>
          </div>`;
        quoteEl.hidden = false;
      } else if (q.total) {
        const fmt = n => '$' + Number(n).toLocaleString('es-CL');
        document.getElementById('rq-km').textContent    = `${q.distanciaKm} km`;
        document.getElementById('rq-base').textContent  = fmt(q.precioBase);

        const discRow = document.getElementById('rq-discount-row');
        discRow.hidden = !q.descuento;
        if (q.descuento) {
          document.getElementById('rq-discount').textContent = `-${fmt(q.descuento)}`;
          const lbl = document.getElementById('rq-discount-label');
          if (lbl) lbl.textContent = `Descuento código${q.descuentoPct ? ` (${q.descuentoPct}%)` : ''}`;
        }

        const stopsEl = document.getElementById('rq-stops');
        if (q.paradasPagas === 0) {
          stopsEl.textContent = q.paradasGratis === 1 ? 'Incluida (1 gratis)' : 'Incluidas (2 gratis)';
        } else {
          stopsEl.textContent = `${fmt(q.costoParadas)} (${q.paradasPagas} extra)`;
        }

        document.getElementById('rq-total').textContent = fmt(q.total);
        quoteEl.hidden = false;
      }
    } catch {}
  }

  const resultEl = document.getElementById(`result-${type}`);
  if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const resetForm = () => {
  document.getElementById('booking-form').reset();
  document.getElementById('booking-form').hidden = false;
  document.getElementById('booking-loading').hidden = true;
  document.querySelectorAll('.booking-result').forEach(el => { el.hidden = true; });
  document.querySelectorAll('.form-group__input').forEach(el => {
    el.classList.remove('form-group__input--invalid', 'form-group__input--valid');
  });
  document.querySelectorAll('[role="alert"]').forEach(el => { el.textContent = ''; });
  document.getElementById('hora-section').hidden = true;
  document.getElementById('horaViaje').value = '';
  document.getElementById('fechaViaje').value = '';
  document.getElementById('cal-selected').textContent = '';
  document.querySelectorAll('.hora-btn').forEach(b => b.classList.remove('hora-btn--active'));
  document.querySelectorAll('.calendar-day--selected').forEach(b => b.classList.remove('calendar-day--selected'));
  const paradaCheck = document.getElementById('parada-check');
  if (paradaCheck) {
    paradaCheck.checked = false;
    document.getElementById('paradas-list').innerHTML = '';
    paradaCount = 0;
    paradaSeq   = 0;
    document.getElementById('paradas').value = '0';
    document.getElementById('paradas-container').hidden = true;
  }
  goToStep(1);
};

const initForm = () => {
  document.getElementById('booking-form').addEventListener('submit', async e => {
    e.preventDefault();
    setLoading(true);
    const result = await sendReservation({
      codigoDescuento: (document.getElementById('codigoDescuento')?.value || '').trim().toUpperCase(),
      fechaViaje:   document.getElementById('fechaViaje').value,
      horaViaje:    document.getElementById('horaViaje').value,
      nombre:       document.getElementById('nombre').value.trim(),
      telefono:     document.getElementById('telefono').value.trim(),
      telefono2:    document.getElementById('telefono2').value.trim(),
      correo:       document.getElementById('correo').value.trim(),
      centroEvento: document.getElementById('centroEvento').value.trim(),
      paradaAdicional: (() => {
        const stops = [];
        document.querySelectorAll('#paradas-list .parada-item input[type="text"]').forEach(input => {
          if (input.value.trim()) stops.push(input.value.trim());
        });
        return stops.length ? stops.join(' | ') : 'Sin parada adicional';
      })(),
      destino: document.getElementById('destino').value.trim(),
      personas:     document.getElementById('personas').value,
      paradas:      document.getElementById('paradas').value,
      marcaModelo:  document.getElementById('marcaModelo').value.trim(),
      patente:      document.getElementById('patente').value.trim().toUpperCase(),
      transmision:  document.getElementById('transmision').value,
      seguro:       document.getElementById('seguro').value,
      cotizacionData: document.getElementById('cotizacion-data').value,
    });
    setLoading(false);
    showResult(result === '✅' ? 'success' : result === '⛔' ? 'full' : 'error');
  });

  document.getElementById('new-booking-btn')?.addEventListener('click', resetForm);
  document.getElementById('retry-btn')?.addEventListener('click', resetForm);
  document.getElementById('error-retry-btn')?.addEventListener('click', resetForm);
};

// ─── PARADAS MÚLTIPLES ────────────────────────────────────────────────────────
let paradaCount = 0; // cantidad actual de paradas visibles
let paradaSeq   = 0; // secuencia única para IDs — nunca decrementa

const updateParadasInput = () => {
  const el = document.getElementById('paradas');
  el.value = paradaCount;
  el.dispatchEvent(new Event('change'));
};

const removeParada = (id) => {
  const item = document.getElementById(`parada-item-${id}`);
  if (item) item.remove();
  paradaCount--;
  updateParadasInput();

  // Renumerar etiquetas visibles
  document.querySelectorAll('.parada-item').forEach((el, i) => {
    const label = el.querySelector('.parada-item__label');
    if (label) label.textContent = `Parada ${i + 1}${i === 0 ? ' (gratis)' : ' (+$5.000)'}`;
  });

  // Si no hay paradas, desmarcar checkbox y ocultar container
  if (paradaCount === 0) {
    document.getElementById('parada-check').checked = false;
    document.getElementById('paradas-container').hidden = true;
  }
};

const addParada = () => {
  paradaCount++;
  paradaSeq++;
  updateParadasInput();
  const seq   = paradaSeq;
  const pos   = paradaCount;
  const id    = `parada-${seq}`;
  const errId = `${id}-error`;
  const label = pos === 1 ? 'Parada 1 (gratis)' : `Parada ${pos} (+$5.000)`;

  const item = document.createElement('div');
  item.className = 'parada-item';
  item.id = `parada-item-${seq}`;
  item.innerHTML = `
    <div class="parada-item__header">
      <span class="parada-item__label">${label}</span>
      <button type="button" class="parada-item__remove" aria-label="Eliminar parada ${pos}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <input class="form-group__input" type="text" id="${id}" name="${id}"
      placeholder="Ej: Av. Providencia 123, Providencia"
      aria-describedby="${errId}">
    <span class="form-group__error" id="${errId}" role="alert" aria-live="polite"></span>
  `;

  item.querySelector('.parada-item__remove').addEventListener('click', () => removeParada(seq));

  document.getElementById('paradas-list').appendChild(item);

  // Enfocar el nuevo campo
  setTimeout(() => document.getElementById(id)?.focus(), 50);
};

const initParadaToggle = () => {
  const check     = document.getElementById('parada-check');
  const container = document.getElementById('paradas-container');
  const addBtn    = document.getElementById('add-parada-btn');
  if (!check) return;

  check.addEventListener('change', () => {
    if (check.checked) {
      container.hidden = false;
      if (paradaCount === 0) addParada();
    } else {
      // Limpiar todas las paradas
      document.getElementById('paradas-list').innerHTML = '';
      paradaCount = 0;
      updateParadasInput();
      container.hidden = true;
    }
  });

  addBtn?.addEventListener('click', addParada);
};

// ─── CARRUSEL TESTIMONIOS ─────────────────────────────────────────────────────
const initCarousel = () => {
  const track  = document.getElementById('carousel-track');
  const dotsEl = document.getElementById('carousel-dots');
  if (!track) return;

  const slides = track.querySelectorAll('.carousel__slide');
  const total  = slides.length;
  let current  = 0;
  let autoTimer = null;

  // Crear dots
  slides.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'carousel__dot' + (i === 0 ? ' carousel__dot--active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `Testimonio ${i + 1}`);
    btn.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(btn);
  });

  const goTo = (idx) => {
    current = (idx + total) % total;
    // Desplazamiento simple: cada slide ocupa exactamente el 100% del wrapper
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll('.carousel__dot').forEach((d, i) => {
      d.classList.toggle('carousel__dot--active', i === current);
    });
  };

  const startAuto = () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 4000);
  };

  document.getElementById('carousel-prev')?.addEventListener('click', () => { goTo(current - 1); startAuto(); });
  document.getElementById('carousel-next')?.addEventListener('click', () => { goTo(current + 1); startAuto(); });

  // Swipe táctil
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { goTo(diff > 0 ? current + 1 : current - 1); startAuto(); }
  }, { passive: true });

  // Pausar al hacer hover
  track.addEventListener('mouseenter', () => clearInterval(autoTimer));
  track.addEventListener('mouseleave', startAuto);

  startAuto();
};

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
const initReveal = () => {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
};

// ─── FAQ ACCORDION ────────────────────────────────────────────────────────────
const initFAQ = () => {
  document.querySelectorAll('.faq__question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer  = btn.nextElementSibling;
      const isOpen  = btn.getAttribute('aria-expanded') === 'true';

      // Cierra todos primero
      document.querySelectorAll('.faq__question').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        b.nextElementSibling.hidden = true;
      });

      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
      }
    });
  });
};

// ─── CÓDIGOS DE DESCUENTO ─────────────────────────────────────────────────────
// Para agregar un código: 'CODIGO': porcentaje  (ej. 'MATEO&LEONOR': 15)
const DISCOUNT_CODES = {
  'CASAPARQUELORETO':  10,   // Casa Parque Loreto  — 10%
  'DIARIOPARAUNANOVIA': 10,  // Diario para una novia — 10%
};
const normalizeCode = (c) => c.toUpperCase().replace(/\s+/g, '');

// ─── COTIZADOR CON GOOGLE MAPS ────────────────────────────────────────────────
const initCotizador = () => {
  const originInput = document.getElementById('centroEvento');
  const destInput   = document.getElementById('destino');
  if (!originInput || !destInput || typeof google === 'undefined') return;

  const PRICE_TABLE = [
    { max: 19, price: 35000 },
    { max: 34, price: 45000 },
    { max: 44, price: 55000 },
    { max: 54, price: 60000 },
    { max: 64, price: 68000 },
    { max: 70, price: 75000 },
  ];
  const STOP_COST = 5000;

  const placesOpts = {
    componentRestrictions: { country: 'cl' },
    fields: ['formatted_address', 'geometry'],
  };

  const originAC = new google.maps.places.Autocomplete(originInput, placesOpts);
  const destAC   = new google.maps.places.Autocomplete(destInput,   placesOpts);

  let originPlace = null;
  let destPlace   = null;
  let distanceKm  = null;

  const fmt = (n) => '$' + n.toLocaleString('es-CL');

  const getBasePrice = (km) => {
    for (const r of PRICE_TABLE) if (km <= r.max) return r.price;
    return null;
  };

  const getFreeStops = (km) => (km < 35 ? 1 : 2);

  const updateQuote = () => {
    if (distanceKm === null) return;

    const basePrice  = getBasePrice(distanceKm);
    if (!basePrice) return;

    const freeStops  = getFreeStops(distanceKm);
    const totalStops = parseInt(document.getElementById('paradas').value) || 0;
    const paidStops  = Math.max(0, totalStops - freeStops);
    const stopsCost  = paidStops * STOP_COST;
    const subtotal   = basePrice + stopsCost;

    const rawCode     = document.getElementById('codigoDescuento')?.value || '';
    const discountPct = DISCOUNT_CODES[normalizeCode(rawCode)] || 0;
    const discountAmt = discountPct > 0 ? Math.round(subtotal * discountPct / 100) : 0;
    const total       = subtotal - discountAmt;

    // Solo serializa — el desglose se muestra en la pantalla de confirmación
    document.getElementById('cotizacion-data').value = JSON.stringify({
      origen:        originPlace?.formatted_address || originInput.value,
      destino:       destPlace?.formatted_address   || destInput.value,
      distanciaKm:   distanceKm,
      precioBase:    basePrice,
      paradasGratis: freeStops,
      paradasPagas:  paidStops,
      costoParadas:  stopsCost,
      codigoCupon:   rawCode.trim().toUpperCase(),
      descuentoPct:  discountPct,
      descuento:     discountAmt,
      total:         total,
    });

    // Feedback visual del código en el Step 2
    const feedbackEl = document.getElementById('codigoDescuento-feedback');
    if (feedbackEl) {
      if (rawCode.trim() && discountPct > 0) {
        feedbackEl.textContent = `✓ Código válido — ${discountPct}% de descuento aplicado`;
        feedbackEl.className = 'codigo-feedback codigo-feedback--valid';
      } else if (rawCode.trim()) {
        feedbackEl.textContent = 'Código no reconocido';
        feedbackEl.className = 'codigo-feedback codigo-feedback--invalid';
      } else {
        feedbackEl.textContent = '';
        feedbackEl.className = 'codigo-feedback';
      }
    }
  };

  const calculateDistance = () => {
    if (!originPlace?.geometry || !destPlace?.geometry) return;

    const svc = new google.maps.DistanceMatrixService();
    svc.getDistanceMatrix({
      origins:      [originPlace.geometry.location],
      destinations: [destPlace.geometry.location],
      travelMode:   google.maps.TravelMode.DRIVING,
      unitSystem:   google.maps.UnitSystem.METRIC,
    }, (response, status) => {
      if (status !== 'OK') return;
      const el = response.rows[0].elements[0];
      if (el.status !== 'OK') return;

      distanceKm = Math.round(el.distance.value / 1000);

      const fueraEl    = document.getElementById('fuera-cobertura');
      const paradaSection = document.getElementById('parada-section');

      if (distanceKm > 70) {
        // Viaje fuera de tabla — ocultar paradas, mostrar aviso
        if (paradaSection) paradaSection.hidden = true;
        if (fueraEl) {
          document.getElementById('fuera-km').textContent = `${distanceKm} km`;
          fueraEl.hidden = false;
        }
        document.getElementById('cotizacion-data').value = JSON.stringify({
          sinCobertura: true,
          distanciaKm:  distanceKm,
          origen:  originPlace?.formatted_address || originInput.value,
          destino: destPlace?.formatted_address   || destInput.value,
        });
        return;
      }

      // Viaje dentro de cobertura — ocultar aviso, mostrar paradas
      if (fueraEl) fueraEl.hidden = true;

      const freeStops = getFreeStops(distanceKm);
      const hintEl = document.getElementById('parada-hint');
      if (hintEl) {
        hintEl.textContent = freeStops === 1
          ? '1ª parada gratis · $5.000 por cada parada adicional'
          : '2 primeras paradas gratis · $5.000 por cada parada adicional';
      }
      if (paradaSection) paradaSection.hidden = false;

      updateQuote();
    });
  };

  originAC.addListener('place_changed', () => {
    originPlace = originAC.getPlace();
    if (destPlace?.geometry) calculateDistance();
  });

  destAC.addListener('place_changed', () => {
    destPlace = destAC.getPlace();
    if (originPlace?.geometry) calculateDistance();
  });

  // Recalcula cuando cambian paradas o código de descuento
  document.getElementById('paradas')?.addEventListener('change', updateQuote);
  document.getElementById('codigoDescuento')?.addEventListener('input', updateQuote);
};

// Callback invocado por el script de Google Maps una vez cargado
window.initGoogleMaps = () => { initCotizador(); };

// ─── HERO TEXT ROTATOR ────────────────────────────────────────────────────────
const initHeroRotator = () => {
  const el = document.getElementById('hero-rotating-text');
  if (!el) return;

  const phrases = [
    '¿Necesitas chofer de <em class="hero__title-accent">reemplazo?</em>',
    '¿<em class="hero__title-accent">Te casas?</em> Tenemos el plan perfecto.',
    '<em class="hero__title-accent">Valet Parking</em> para tu evento.',
    'Celebra sin límites. <em class="hero__title-accent">Nosotros manejamos.</em>',
  ];

  let current = 0;

  const rotate = () => {
    el.classList.add('hero-rotate-out');
    setTimeout(() => {
      current = (current + 1) % phrases.length;
      el.innerHTML = phrases[current];
      el.classList.remove('hero-rotate-out');
      el.classList.add('hero-rotate-in');
      setTimeout(() => el.classList.remove('hero-rotate-in'), 450);
    }, 350);
  };

  setInterval(rotate, 3500);
};

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
const initThemeToggle = () => {
  const btn  = document.getElementById('theme-toggle');
  if (!btn) return;

  const moonIcon = btn.querySelector('.theme-toggle__icon--moon');
  const sunIcon  = btn.querySelector('.theme-toggle__icon--sun');

  const applyTheme = (isLight) => {
    document.body.classList.toggle('light-mode', isLight);
    sunIcon.style.display  = isLight ? 'none' : '';
    moonIcon.style.display = isLight ? '' : 'none';
    btn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    localStorage.setItem('tellevo-theme', isLight ? 'light' : 'dark');
  };

  const saved = localStorage.getItem('tellevo-theme');
  if (saved === 'light') applyTheme(true);

  btn.addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('light-mode'));
  });
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
  initModal();
  initCalendar();
  initHoras();
  initSteps();
  initParadaToggle();
  initForm();
  initCarousel();
  initReveal();
  initHeroRotator();
  initThemeToggle();
  initFAQ();

  // Retira el globo del hero del layout al terminar su animación
  const bubble = document.getElementById('hero-bubble');
  if (bubble) {
    bubble.addEventListener('animationend', () => { bubble.hidden = true; }, { once: true });
  }
});
