/*
  main.js — TeLlevo Landing Page
  Navbar · Modal T&C · Calendario personalizado · Formulario 3 pasos · Mapa Leaflet + OSM
*/

// La URL de AppScript vive en una variable de entorno del servidor.
// El cliente solo llama al endpoint local — nunca expone la API key.
const SUBMIT_ENDPOINT = '/.netlify/functions/reserva';

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

  // "Confirmar reserva" en step 3: valida primero, luego abre modal
  openConfirm?.addEventListener('click', () => {
    if (!stepValidators[3]()) {
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
  document.querySelectorAll('.hora-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hora-btn').forEach(b => b.classList.remove('hora-btn--active'));
      btn.classList.add('hora-btn--active');
      document.getElementById('horaViaje').value = btn.dataset.hora;
      document.getElementById('horaViaje-error').textContent = '';
    });
  });
};

// ─── MAPA ─────────────────────────────────────────────────────────────────────
let mapInstance = null, originMarker = null, destMarker = null, routeLayer = null;
let originCoords = null, destCoords = null;

const createIcon = (type) => L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #060C18;${type === 'origin' ? 'background:#C9A84C;color:#060C18' : 'background:#f87171;color:#fff'}">${type === 'origin' ? 'A' : 'B'}</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16]
});

const initMap = () => {
  if (mapInstance) return;
  mapInstance = L.map('route-map', { zoomControl: true }).setView([-33.45, -70.65], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(mapInstance);
};

const updateMap = async () => {
  if (!originCoords || !destCoords) return;
  if (originMarker) mapInstance.removeLayer(originMarker);
  if (destMarker)   mapInstance.removeLayer(destMarker);
  if (routeLayer)   mapInstance.removeLayer(routeLayer);

  originMarker = L.marker(originCoords, { icon: createIcon('origin') }).addTo(mapInstance).bindPopup('Origen');
  destMarker   = L.marker(destCoords,   { icon: createIcon('dest')   }).addTo(mapInstance).bindPopup('Destino');

  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    routeLayer = L.polyline(coords, { color: '#C9A84C', weight: 4, opacity: .85 }).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
  } catch {
    mapInstance.fitBounds(L.latLngBounds([originCoords, destCoords]), { padding: [60, 60] });
  }
};

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────
const createAutocomplete = (inputEl, listEl, onSelect) => {
  let timer = null;

  const hide = () => { listEl.hidden = true; listEl.innerHTML = ''; };

  const show = (results) => {
    listEl.innerHTML = '';
    if (!results.length) { hide(); return; }
    results.forEach(r => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.setAttribute('role', 'option');
      li.textContent = r.display_name;
      li.addEventListener('click', () => {
        inputEl.value = r.display_name;
        onSelect({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
        hide();
      });
      listEl.appendChild(li);
    });
    listEl.hidden = false;
  };

  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inputEl.value.trim();
    if (q.length < 4) { hide(); return; }

    listEl.innerHTML = '<li class="autocomplete-item autocomplete-item--loading">Buscando…</li>';
    listEl.hidden = false;

    timer = setTimeout(async () => {
      try {
        const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Chile')}&format=json&limit=5&countrycodes=cl&accept-language=es`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'TeLlevo-Landing/1.0' } });
        const data = await res.json();
        show(data);
      } catch { hide(); }
    }, 600);
  });

  document.addEventListener('click', e => {
    if (!inputEl.closest('.autocomplete-wrapper').contains(e.target)) hide();
  });
};

const initAutocomplete = () => {
  const mapSection = document.getElementById('map-section');

  createAutocomplete(
    document.getElementById('centroEvento'),
    document.getElementById('centroEvento-list'),
    ({ lat, lng }) => {
      originCoords = [lat, lng];
      document.getElementById('centroEvento-error').textContent = '';
      if (mapInstance) { updateMap(); }
      else if (destCoords) { mapSection.hidden = false; initMap(); setTimeout(updateMap, 150); }
    }
  );

  createAutocomplete(
    document.getElementById('destino'),
    document.getElementById('destino-list'),
    ({ lat, lng }) => {
      destCoords = [lat, lng];
      document.getElementById('destino-error').textContent = '';
      mapSection.hidden = false;
      if (!mapInstance) { initMap(); setTimeout(updateMap, 150); }
      else updateMap();
    }
  );
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
      personas:     'Indica cuántos pasajeros van.',
    };
    Object.entries(checks).forEach(([id, msg]) => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        document.getElementById(`${id}-error`).textContent = msg;
        el.classList.add('form-group__input--invalid');
        ok = false;
      }
    });
    return ok;
  },
  3: () => {
    let ok = true;
    const checks = {
      nombre:      { msg: 'Ingresa tu nombre completo.',        test: v => v.trim().length >= 2 },
      correo:      { msg: 'Ingresa un correo válido.',           test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
      telefono:    { msg: 'Ingresa tu número de teléfono.',     test: v => v.trim().length >= 7 },
      marcaModelo: { msg: 'Ingresa la marca y modelo del auto.', test: v => v.trim().length >= 2 },
      patente:     { msg: 'Ingresa la patente del vehículo.',   test: v => v.trim().length >= 4 },
      transmision: { msg: 'Selecciona el tipo de transmisión.',  test: v => !!v },
      seguro:      { msg: 'Indica si el auto tiene seguro.',    test: v => !!v },
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
  document.querySelectorAll('.form-step').forEach(s => { s.hidden = parseInt(s.dataset.step) !== to; });

  document.querySelectorAll('.booking-progress__step').forEach((s, i) => {
    const n = i + 1;
    s.classList.remove('booking-progress__step--active', 'booking-progress__step--done');
    if (n === to) s.classList.add('booking-progress__step--active');
    if (n < to)   s.classList.add('booking-progress__step--done');
  });

  document.querySelectorAll('.booking-progress__line').forEach((l, i) => {
    l.classList.toggle('booking-progress__line--done', i + 1 < to);
  });

  if (to === 2) setTimeout(() => { if (!mapInstance && !document.getElementById('map-section').hidden) initMap(); }, 200);

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
const sendReservation = async (data) => {
  const params = new URLSearchParams(data);
  try {
    const res  = await fetch(SUBMIT_ENDPOINT, { method: 'POST', body: params });
    const text = await res.text();
    if (text.trim().startsWith('⛔')) return '⛔';
    if (text.trim().startsWith('❌')) return '❌';
    return '✅';
  } catch {
    return '❌';
  }
};

const setLoading = (on) => {
  const acceptBtn = document.getElementById('accept-tyc');
  if (!acceptBtn) return;
  acceptBtn.disabled = on;
  acceptBtn.textContent = on ? 'Enviando…' : 'Aceptar y confirmar reserva';
};

const showResult = (type) => {
  document.getElementById('booking-form').hidden = true;
  ['success', 'full', 'error'].forEach(t => {
    document.getElementById(`result-${t}`).hidden = t !== type;
  });
};

const resetForm = () => {
  document.getElementById('booking-form').reset();
  document.getElementById('booking-form').hidden = false;
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
  originCoords = null; destCoords = null;
  document.getElementById('map-section').hidden = true;
  goToStep(1);
};

const initForm = () => {
  document.getElementById('booking-form').addEventListener('submit', async e => {
    e.preventDefault();
    setLoading(true);
    const result = await sendReservation({
      alianza:      document.getElementById('alianza').value || 'Ninguno',
      fechaViaje:   document.getElementById('fechaViaje').value,
      horaViaje:    document.getElementById('horaViaje').value,
      nombre:       document.getElementById('nombre').value.trim(),
      telefono:     document.getElementById('telefono').value.trim(),
      telefono2:    document.getElementById('telefono2').value.trim(),
      correo:       document.getElementById('correo').value.trim(),
      centroEvento: document.getElementById('centroEvento').value.trim(),
      destino:      document.getElementById('destino').value.trim(),
      personas:     document.getElementById('personas').value,
      paradas:      document.getElementById('paradas').value,
      marcaModelo:  document.getElementById('marcaModelo').value.trim(),
      patente:      document.getElementById('patente').value.trim().toUpperCase(),
      transmision:  document.getElementById('transmision').value,
      seguro:       document.getElementById('seguro').value,
    });
    setLoading(false);
    showResult(result === '✅' ? 'success' : result === '⛔' ? 'full' : 'error');
    window.scrollTo({ top: document.getElementById('reserva').getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  });

  document.getElementById('new-booking-btn')?.addEventListener('click', resetForm);
  document.getElementById('retry-btn')?.addEventListener('click', resetForm);
  document.getElementById('error-retry-btn')?.addEventListener('click', resetForm);
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
  initModal();
  initCalendar();
  initHoras();
  initSteps();
  initAutocomplete();
  initForm();
});
