/*
  trip-format.js — Única fuente de verdad para leer y mostrar una reserva.
  Tarjetas, detalle, lista del día, PDF y mensajes de WhatsApp salen de estas
  funciones, de modo que una reserva se vea igual en todos lados y siempre con
  la fecha y hora vigentes (nunca con la que pidió originalmente el cliente).
*/

export const MISSING_LABEL = 'Por confirmar';

const NO_STOP_PLACEHOLDER = 'sin parada adicional';
const NO_TIME_KEY = '99:99';
const LEGACY_MANUAL_TRANSMISSION = 'Manual';

const clean = (value) => String(value ?? '').trim();
const orMissing = (value) => clean(value) || MISSING_LABEL;

// ── Fecha y hora ───────────────────────────────────────────────────────────
/** Acepta "aaaa-mm-dd" (landing) o "dd/mm/aaaa" (ediciones antiguas) y devuelve ISO. */
export function toISODate(fecha) {
  const text = clean(fecha);
  if (!text) return '';
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(`${text}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export const timeKey = (hora) => {
  const match = clean(hora).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : NO_TIME_KEY;
};

export const hasTime = (hora) => timeKey(hora) !== NO_TIME_KEY;

export const fmtTime = (hora) => (hasTime(hora) ? `${timeKey(hora)} hrs` : MISSING_LABEL);

export function fmtLongDate(fecha) {
  const iso = toISODate(fecha);
  if (!iso) return orMissing(fecha);
  return new Date(`${iso}T12:00:00`)
    .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const fmtWhen = (r) => `${fmtLongDate(r.fecha)} a las ${fmtTime(r.hora)}`;

// ── Paradas ────────────────────────────────────────────────────────────────
/** La landing envía "Sin parada adicional" cuando no hay paradas: no es una dirección. */
export const tripStops = (r) => clean(r.paradaAdicional).split('|')
  .map(stop => stop.trim())
  .filter(stop => stop && stop.toLowerCase() !== NO_STOP_PLACEHOLDER);

export const stopCount = (r) => tripStops(r).length || Number.parseInt(r.paradas, 10) || 0;

// ── Precio ─────────────────────────────────────────────────────────────────
export const fmtMoney = (n) => (n != null
  ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
  : '—');

export const quotedPrice = (r) => r.cotizacion?.total ?? r.cotizacion?.precio ?? null;

export const tripPrice = (r) => (r.precioManual != null ? Number(r.precioManual) : quotedPrice(r));

// ── Vehículo ───────────────────────────────────────────────────────────────
// El panel guardaba "Manual" y la landing "Mecánico": se muestran como un solo valor.
export const transmissionLabel = (value) => (clean(value) === LEGACY_MANUAL_TRANSMISSION ? 'Mecánico' : clean(value));

export const plateLabel = (value) => clean(value).toUpperCase();

export const vehicleSummary = (r) => [clean(r.marcaModelo), plateLabel(r.patente), transmissionLabel(r.transmision)]
  .filter(Boolean)
  .join(' · ');

// ── Mensajes de WhatsApp ───────────────────────────────────────────────────
/** Datos del viaje, cliente y vehículo: idénticos en el mensaje al cliente y al chofer. */
function tripLines(r) {
  const lines = [
    `👤 Cliente: ${orMissing(r.nombre)}`,
    `📞 Teléfono: ${orMissing(r.telefono)}`,
  ];
  if (clean(r.telefono2)) lines.push(`📞 Segundo Tel: ${clean(r.telefono2)}`);
  lines.push(
    `📧 Correo: ${orMissing(r.email)}`,
    `🤝 Alianza: ${clean(r.codigoDescuento) || 'Sin alianza'}`,
    `📅 Fecha: ${fmtWhen(r)}`,
    `🏛 Centro de eventos: ${orMissing(r.origen)}`,
    `🏠 Destino final: ${orMissing(r.destino)}`,
    `👥 Nº personas: ${orMissing(r.personas)}`,
    `🛑 Nº paradas: ${stopCount(r)}`,
  );
  tripStops(r).forEach((stop, index) => lines.push(`   📍 Parada ${index + 1}: ${stop}`));
  lines.push(
    `🚘 Auto: ${orMissing(r.marcaModelo)}`,
    `🔖 Patente: ${plateLabel(r.patente) || MISSING_LABEL}`,
    `⚙️ Transmisión: ${transmissionLabel(r.transmision) || MISSING_LABEL}`,
    `🛡 Seguro: ${orMissing(r.seguro)}`,
  );
  return lines;
}

export function buildDriverMessage(driver, r) {
  return [
    `Hola ${clean(r.nombre) || 'estimado/a'}! `,
    `Soy ${driver.nombre}, tu angelito designado😇`,
    '',
    ...tripLines(r),
    '',
    'Gracias por confiar en TeLlevo,',
    '¡Nos vemos!',
  ].join('\n');
}

export function buildClientMessage(r) {
  const distance = r.cotizacion?.distanciaKm;
  const basePrice = r.cotizacion?.precioBase;
  const finalPrice = tripPrice(r);
  const firstName = (clean(r.nombre) || 'cliente').split(' ')[0];

  const lines = [
    `Hola ${firstName}! ¿Cómo estás?`,
    'Te habla Joaquín de TeLlevo.🚗😇',
    '',
    'Te comparto los datos del viaje que registraste:',
    '',
    ...tripLines(r),
  ];
  if (distance || basePrice || finalPrice) {
    lines.push('', '── COTIZACIÓN ──────────────');
    if (distance)   lines.push(`📏 Distancia: ${distance} km`);
    if (basePrice)  lines.push(`💵 Precio base: ${fmtMoney(basePrice)}`);
    if (finalPrice) lines.push(`💰 TOTAL ESTIMADO: ${fmtMoney(finalPrice)}`);
  }
  lines.push('', '¿Deseas confirmar y realizar el pago para asegurar tu chofer de reemplazo? 🙌');
  return lines.join('\n');
}
