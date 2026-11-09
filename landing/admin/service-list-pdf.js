/*
  service-list-pdf.js — Genera el PDF de la lista de servicios por chofer.
  Cada página se dibuja en un canvas con proporción de celular y se incrusta como
  imagen en un PDF armado a mano, sin librerías y con acentos y colores exactos.
  Se carga solo al descargar, para no afectar el inicio del panel.
*/

const PAGE = { width: 1080, height: 1920, margin: 48 };
const PIXELS_PER_POINT = 3;
const JPEG_QUALITY = 0.92;

const COLORS = {
  page: '#0A1628',
  card: '#112240',
  border: '#1B3A6B',
  gold: '#C9A84C',
  goldPale: '#F5DFA0',
  blue: '#4A9EFF',
  orange: '#F5A623',
  white: '#FFFFFF',
  text: '#E8EAF0',
  muted: '#8892A4',
  onAccent: '#0A1628',
};

const CARD = { padding: 36, accent: 10, timeColumn: 190, gap: 24 };
const CHIP = { height: 52, paddingX: 16, radius: 10, gapToAddress: 16 };
const HEADER_HEIGHT = { first: 300, following: 120 };
const FOOTER_HEIGHT = 80;
const MAX_ADDRESS_LINES = 3;

const FONT_FAMILY = 'Inter, "Helvetica Neue", Arial, sans-serif';
const font = (size, weight = 400) => `${weight} ${size}px ${FONT_FAMILY}`;

const encoder = new TextEncoder();

function roundedRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end).trimEnd()}…`).width > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

/**
 * Corta un texto en líneas que caben en maxWidth; lo que excede maxLines termina en "…".
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.map(line => truncateToWidth(ctx, line, maxWidth));
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = truncateToWidth(ctx, `${visible[maxLines - 1]} ${lines[maxLines]}`, maxWidth - 1);
  if (!visible[maxLines - 1].endsWith('…')) visible[maxLines - 1] += '…';
  return visible;
}

function fitFontSize(ctx, text, maxWidth, startSize, weight) {
  let size = startSize;
  ctx.font = font(size, weight);
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size, weight);
  }
  return size;
}

function drawChip(ctx, text, x, y, maxWidth, color, isMissing) {
  ctx.font = font(30, isMissing ? 400 : 700);
  const label = truncateToWidth(ctx, text, maxWidth - CHIP.paddingX * 2);
  const width = ctx.measureText(label).width + CHIP.paddingX * 2;
  roundedRectPath(ctx, x, y, width, CHIP.height, CHIP.radius);
  if (isMissing) {
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = COLORS.muted;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.fillStyle = isMissing ? COLORS.muted : COLORS.onAccent;
  ctx.fillText(label, x + CHIP.paddingX, y + 12);
  return width;
}

function measureChipWidth(ctx, text, maxWidth, isMissing) {
  ctx.font = font(30, isMissing ? 400 : 700);
  return ctx.measureText(truncateToWidth(ctx, text, maxWidth - CHIP.paddingX * 2)).width + CHIP.paddingX * 2;
}

/** Dibuja (o solo mide, si draw es false) un tramo; devuelve su altura. */
function layoutStop(ctx, { label, color, stop, missingLabel }, x, y, width, draw) {
  let cursor = y;
  if (draw) {
    ctx.font = font(24, 700);
    ctx.fillStyle = color;
    ctx.fillText(label.toUpperCase(), x, cursor);
  }
  cursor += 36;

  const isMissing = !stop.comuna;
  const chipText = stop.comuna || missingLabel;
  const chipWidth = draw
    ? drawChip(ctx, chipText, x, cursor, width, color, isMissing)
    : measureChipWidth(ctx, chipText, width, isMissing);

  if (!stop.street) return cursor + CHIP.height - y;

  ctx.font = font(30);
  ctx.fillStyle = COLORS.text;
  const inlineX = chipWidth + CHIP.gapToAddress;
  if (inlineX + ctx.measureText(stop.street).width <= width) {
    if (draw) ctx.fillText(stop.street, x + inlineX, cursor + 12);
    return cursor + CHIP.height - y;
  }

  cursor += CHIP.height + 12;
  const lines = wrapText(ctx, stop.street, width, MAX_ADDRESS_LINES);
  lines.forEach((line, index) => { if (draw) ctx.fillText(line, x, cursor + index * 40); });
  return cursor + lines.length * 40 - y;
}

/** Dibuja (o solo mide) la tarjeta de un servicio; devuelve su altura. */
function layoutCard(ctx, service, y, draw, height = 0) {
  const x = PAGE.margin;
  const width = PAGE.width - PAGE.margin * 2;
  const accentColor = service.isUnassigned ? COLORS.orange : COLORS.gold;
  const timeX = x + CARD.accent + CARD.padding;
  const bodyX = timeX + CARD.timeColumn;
  const bodyWidth = width - (bodyX - x) - CARD.padding;

  if (draw) {
    ctx.save();
    roundedRectPath(ctx, x, y, width, height, 20);
    ctx.clip();
    ctx.fillStyle = COLORS.card;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = accentColor;
    ctx.fillRect(x, y, CARD.accent, height);
    ctx.restore();
    roundedRectPath(ctx, x, y, width, height, 20);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    const timeSize = fitFontSize(ctx, service.time, CARD.timeColumn - 16, 64, 700);
    ctx.font = font(timeSize, 700);
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(service.time, timeX, y + CARD.padding);
  }

  let cursor = y + CARD.padding;
  ctx.font = font(44, 700);
  const driverLines = wrapText(ctx, service.driver, bodyWidth, 2);
  driverLines.forEach((line, index) => {
    if (!draw) return;
    ctx.fillStyle = service.isUnassigned ? COLORS.orange : COLORS.white;
    ctx.fillText(line, bodyX, cursor + index * 54);
  });
  cursor += driverLines.length * 54 + 16;

  cursor += layoutStop(ctx, { label: 'Inicio', color: COLORS.gold, stop: service.origin, missingLabel: service.missingLabel }, bodyX, cursor, bodyWidth, draw);
  cursor += CARD.gap;
  cursor += layoutStop(ctx, { label: 'Destino', color: COLORS.blue, stop: service.destination, missingLabel: service.missingLabel }, bodyX, cursor, bodyWidth, draw);

  return cursor + CARD.padding - y;
}

function paginate(ctx, services) {
  const cards = services.map(service => ({ service, height: layoutCard(ctx, service, 0, false) }));
  const pages = [[]];
  let used = HEADER_HEIGHT.first;
  for (const card of cards) {
    if (used + card.height + FOOTER_HEIGHT > PAGE.height && pages[pages.length - 1].length) {
      pages.push([]);
      used = HEADER_HEIGHT.following;
    }
    pages[pages.length - 1].push(card);
    used += card.height + CARD.gap;
  }
  return pages;
}

function drawHeader(ctx, { dayLabel, total }, isFirstPage) {
  const x = PAGE.margin;
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(0, 0, PAGE.width, 8);

  if (!isFirstPage) {
    ctx.font = font(32, 700);
    ctx.fillStyle = COLORS.goldPale;
    ctx.fillText(truncateToWidth(ctx, dayLabel, PAGE.width - PAGE.margin * 2), x, 56);
    return;
  }

  ctx.font = font(40, 700);
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('TeLlevo', x, 52);
  ctx.font = font(64, 700);
  ctx.fillStyle = COLORS.white;
  ctx.fillText('Servicios del día', x, 110);
  ctx.font = font(36, 700);
  ctx.fillStyle = COLORS.goldPale;
  ctx.fillText(truncateToWidth(ctx, dayLabel, PAGE.width - PAGE.margin * 2), x, 192);
  ctx.font = font(30);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`${total} ${total === 1 ? 'servicio' : 'servicios'}`, x, 240);
}

function drawPage(ctx, cards, details, pageIndex, pageCount) {
  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  ctx.textBaseline = 'top';
  drawHeader(ctx, details, pageIndex === 0);

  let y = pageIndex === 0 ? HEADER_HEIGHT.first : HEADER_HEIGHT.following;
  for (const { service, height } of cards) {
    layoutCard(ctx, service, y, true, height);
    y += height + CARD.gap;
  }

  ctx.font = font(26);
  ctx.fillStyle = COLORS.muted;
  const footer = `Página ${pageIndex + 1} de ${pageCount}`;
  ctx.fillText(footer, PAGE.width - PAGE.margin - ctx.measureText(footer).width, PAGE.height - 56);
}

async function canvasToJpeg(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('El navegador no pudo generar la página del PDF');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Arma un PDF con una imagen JPEG por página.
 * @param {Uint8Array[]} jpegPages
 * @returns {Blob}
 */
function assemblePdf(jpegPages) {
  const chunks = [];
  const offsets = [];
  let position = 0;
  const write = (data) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    position += bytes.length;
  };
  const beginObject = (id) => {
    offsets[id] = position;
    write(`${id} 0 obj\n`);
  };

  const widthPoints = PAGE.width / PIXELS_PER_POINT;
  const heightPoints = PAGE.height / PIXELS_PER_POINT;
  const pageObjectId = (index) => 3 + index * 3;
  const objectCount = 2 + jpegPages.length * 3;

  write('%PDF-1.4\n');
  beginObject(1);
  write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  beginObject(2);
  const kids = jpegPages.map((_, index) => `${pageObjectId(index)} 0 R`).join(' ');
  write(`<< /Type /Pages /Kids [${kids}] /Count ${jpegPages.length} >>\nendobj\n`);

  jpegPages.forEach((jpeg, index) => {
    const pageId = pageObjectId(index);
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q ${widthPoints} 0 0 ${heightPoints} 0 0 cm /Im0 Do Q`;

    beginObject(pageId);
    write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPoints} ${heightPoints}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>\nendobj\n`);
    beginObject(contentId);
    write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    beginObject(imageId);
    write(`<< /Type /XObject /Subtype /Image /Width ${PAGE.width} /Height ${PAGE.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    write(jpeg);
    write('\nendstream\nendobj\n');
  });

  const xrefPosition = position;
  const entries = Array.from({ length: objectCount }, (_, index) =>
    `${String(offsets[index + 1]).padStart(10, '0')} 00000 n \n`).join('');
  write(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n${entries}`);
  write(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}

/**
 * Genera el PDF de la lista de servicios.
 * @param {{ dayLabel: string, services: Array<{ time: string, driver: string, isUnassigned: boolean,
 *   origin: { street: string, comuna: string }, destination: { street: string, comuna: string },
 *   missingLabel: string }> }} details
 * @returns {Promise<Blob>}
 */
export async function buildServiceListPdf({ dayLabel, services }) {
  // Sin esperar a Inter, el canvas dibujaría con la fuente de respaldo.
  await Promise.allSettled([400, 700].map(weight => document.fonts.load(`${weight} 40px Inter`)));

  const canvas = document.createElement('canvas');
  canvas.width = PAGE.width;
  canvas.height = PAGE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite generar el PDF');
  ctx.textBaseline = 'top';

  const pages = paginate(ctx, services);
  const jpegPages = [];
  for (let index = 0; index < pages.length; index++) {
    drawPage(ctx, pages[index], { dayLabel, total: services.length }, index, pages.length);
    jpegPages.push(await canvasToJpeg(canvas));
  }
  return assemblePdf(jpegPages);
}
