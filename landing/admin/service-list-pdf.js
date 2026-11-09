/*
  service-list-pdf.js — Genera el PDF de la lista de servicios por chofer.
  Las páginas tienen proporción de celular y todo el contenido es texto real, para
  poder seleccionar y copiar las direcciones. El PDF se arma a mano con Helvetica,
  fuente incluida en todo lector de PDF, así que no requiere librerías ni descargas.
  Se carga solo al descargar, para no afectar el inicio del panel.
*/

// El diseño se expresa en unidades de una pantalla de 1080 de ancho; el PDF usa un tercio.
const PAGE = { width: 1080, height: 1920, margin: 48 };
const UNITS_PER_POINT = 3;

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

const CARD = { padding: 36, accent: 10, timeColumn: 190, gap: 24, radius: 20 };
const CHIP = { height: 52, paddingX: 12, radius: 10 };
const ADDRESS = { size: 30, lineHeight: 40 };
const DRIVER = { size: 44, lineHeight: 54 };
const HEADER_HEIGHT = { first: 300, following: 120 };
const FOOTER_HEIGHT = 80;

const REGULAR = 'regular';
const BOLD = 'bold';
const PDF_FONT_NAME = { [REGULAR]: 'F1', [BOLD]: 'F2' };

// Anchos oficiales de Helvetica (por 1000 unidades) para los caracteres 32 a 126.
const CHAR_WIDTHS = {
  [REGULAR]: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],
  [BOLD]: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],
};
const DEFAULT_CHAR_WIDTH = 556;

// Caracteres de Windows-1252 que no coinciden con su posición en Unicode.
const WIN_ANSI_SPECIALS = new Map([
  ['€', 0x80], ['‚', 0x82], ['„', 0x84], ['…', 0x85], ['‘', 0x91], ['’', 0x92],
  ['“', 0x93], ['”', 0x94], ['•', 0x95], ['–', 0x96], ['—', 0x97],
]);
const UNSUPPORTED_CHAR_CODE = 0x3F;

const encoder = new TextEncoder();

const charWidth = (char, weight) => {
  const code = char.normalize('NFD').charCodeAt(0);
  return CHAR_WIDTHS[weight][code - 32] ?? DEFAULT_CHAR_WIDTH;
};

const textWidth = (text, size, weight) =>
  [...text].reduce((total, char) => total + charWidth(char, weight), 0) * size / 1000;

function toWinAnsiHex(text) {
  return [...text].map((char) => {
    const code = char.codePointAt(0);
    const isLatin = (code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFF);
    const byte = isLatin ? code : WIN_ANSI_SPECIALS.get(char) ?? UNSUPPORTED_CHAR_CODE;
    return byte.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

const hexToPdfColor = (hex) =>
  [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');

const toPoints = (units) => (units / UNITS_PER_POINT).toFixed(2);

/** Acumula las instrucciones de dibujo de una página; recibe coordenadas desde arriba. */
class PdfPage {
  commands = [];

  #y = (units) => toPoints(PAGE.height - units);

  #roundedRectPath(x, y, width, height, radius) {
    const k = radius * 0.4477;
    const right = x + width, bottom = y + height;
    const X = toPoints, Y = this.#y;
    this.commands.push(
      `${X(x + radius)} ${Y(y)} m`,
      `${X(right - radius)} ${Y(y)} l`,
      `${X(right - k)} ${Y(y)} ${X(right)} ${Y(y + k)} ${X(right)} ${Y(y + radius)} c`,
      `${X(right)} ${Y(bottom - radius)} l`,
      `${X(right)} ${Y(bottom - k)} ${X(right - k)} ${Y(bottom)} ${X(right - radius)} ${Y(bottom)} c`,
      `${X(x + radius)} ${Y(bottom)} l`,
      `${X(x + k)} ${Y(bottom)} ${X(x)} ${Y(bottom - k)} ${X(x)} ${Y(bottom - radius)} c`,
      `${X(x)} ${Y(y + radius)} l`,
      `${X(x)} ${Y(y + k)} ${X(x + k)} ${Y(y)} ${X(x + radius)} ${Y(y)} c`,
      'h',
    );
  }

  fillRect(x, y, width, height, color) {
    this.commands.push(`${hexToPdfColor(color)} rg ${toPoints(x)} ${this.#y(y + height)} ${toPoints(width)} ${toPoints(height)} re f`);
  }

  fillRoundedRect(x, y, width, height, radius, color) {
    this.commands.push(`${hexToPdfColor(color)} rg`);
    this.#roundedRectPath(x, y, width, height, radius);
    this.commands.push('f');
  }

  strokeRoundedRect(x, y, width, height, radius, color, dash = '') {
    this.commands.push(`${hexToPdfColor(color)} RG ${toPoints(2)} w ${dash ? `[${dash}] 0 d` : '[] 0 d'}`);
    this.#roundedRectPath(x, y, width, height, radius);
    this.commands.push('S', '[] 0 d');
  }

  /** Rellena una banda vertical recortada por las esquinas redondeadas de un rectángulo. */
  fillClippedBand(x, y, bandWidth, width, height, radius, color) {
    this.commands.push('q');
    this.#roundedRectPath(x, y, width, height, radius);
    this.commands.push('W n');
    this.fillRect(x, y, bandWidth, height, color);
    this.commands.push('Q');
  }

  text(content, x, baseline, size, weight, color) {
    this.commands.push(`BT ${hexToPdfColor(color)} rg /${PDF_FONT_NAME[weight]} ${toPoints(size)} Tf ${toPoints(x)} ${this.#y(baseline)} Td <${toWinAnsiHex(content)}> Tj ET`);
  }
}

// Una dirección nunca se recorta: debe poder copiarse completa.
function wrapText(text, maxWidth, size, weight) {
  const lines = [];
  let current = '';
  const pushLongWord = (word) => {
    let piece = '';
    for (const char of word) {
      if (piece && textWidth(piece + char, size, weight) > maxWidth) {
        lines.push(piece);
        piece = '';
      }
      piece += char;
    }
    return piece;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, weight) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = textWidth(word, size, weight) > maxWidth ? pushLongWord(word) : word;
  }
  if (current) lines.push(current);
  return lines;
}

function fitFontSize(text, maxWidth, startSize, weight) {
  let size = startSize;
  while (size > 16 && textWidth(text, size, weight) > maxWidth) size -= 2;
  return size;
}

const chipBaseline = (y, size) => y + (CHIP.height + size * 0.72) / 2;

function drawChip(page, { text, size, weight, width, color, isMissing }, x, y) {
  if (isMissing) {
    page.strokeRoundedRect(x, y, width, CHIP.height, CHIP.radius, COLORS.muted, '2.5 2');
  } else {
    page.fillRoundedRect(x, y, width, CHIP.height, CHIP.radius, color);
  }
  page.text(text, x + CHIP.paddingX, chipBaseline(y, size), size, weight, isMissing ? COLORS.muted : COLORS.onAccent);
}

/** Dibuja un tramo o, si page es null, solo calcula su altura. */
function layoutStop(page, { label, color, stop, missingLabel }, x, y, width) {
  let cursor = y;
  page?.text(label.toUpperCase(), x, cursor + 20, 24, BOLD, color);
  cursor += 36;

  const isMissing = !stop.comuna;
  const chipText = stop.comuna || missingLabel;
  const weight = isMissing ? REGULAR : BOLD;
  const size = fitFontSize(chipText, width - CHIP.paddingX * 2, 30, weight);
  const chip = { text: chipText, size, weight, color, isMissing, width: textWidth(chipText, size, weight) + CHIP.paddingX * 2 };

  // La dirección va antes que la comuna para copiarla como "Calle 123, Comuna".
  const streetText = stop.street ? `${stop.street}${isMissing ? '' : ','}` : '';
  const lines = streetText ? wrapText(streetText, width, ADDRESS.size, REGULAR) : [];

  lines.slice(0, -1).forEach((line) => {
    page?.text(line, x, cursor + 30, ADDRESS.size, REGULAR, COLORS.text);
    cursor += ADDRESS.lineHeight;
  });

  const lastLine = lines[lines.length - 1];
  if (!lastLine) {
    if (page) drawChip(page, chip, x, cursor);
    return cursor + CHIP.height - y;
  }

  // El espacio final y la misma línea base hacen que al copiar salga "Calle 123, Comuna" seguido.
  // "Comuna sin indicar" va aparte para no ensuciar la dirección copiada.
  const inlineLine = `${lastLine} `;
  const inlineWidth = textWidth(inlineLine, ADDRESS.size, REGULAR);
  if (!isMissing && inlineWidth + chip.width <= width) {
    page?.text(inlineLine, x, chipBaseline(cursor, chip.size), ADDRESS.size, REGULAR, COLORS.text);
    if (page) drawChip(page, chip, x + inlineWidth, cursor);
  } else {
    page?.text(lastLine, x, cursor + 30, ADDRESS.size, REGULAR, COLORS.text);
    cursor += ADDRESS.lineHeight + 6;
    if (page) drawChip(page, chip, x, cursor);
  }
  return cursor + CHIP.height - y;
}

/** Dibuja la tarjeta de un servicio o, si page es null, solo calcula su altura. */
function layoutCard(page, service, y, height = 0) {
  const x = PAGE.margin;
  const width = PAGE.width - PAGE.margin * 2;
  const accentColor = service.isUnassigned ? COLORS.orange : COLORS.gold;
  const timeX = x + CARD.accent + CARD.padding;
  const bodyX = timeX + CARD.timeColumn;
  const bodyWidth = width - (bodyX - x) - CARD.padding;

  if (page) {
    page.fillRoundedRect(x, y, width, height, CARD.radius, COLORS.card);
    page.fillClippedBand(x, y, CARD.accent, width, height, CARD.radius, accentColor);
    page.strokeRoundedRect(x, y, width, height, CARD.radius, COLORS.border);
    const timeSize = fitFontSize(service.time, CARD.timeColumn - 16, 64, BOLD);
    page.text(service.time, timeX, y + CARD.padding + timeSize * 0.76, timeSize, BOLD, COLORS.gold);
  }

  let cursor = y + CARD.padding;
  wrapText(service.driver, bodyWidth, DRIVER.size, BOLD).forEach((line) => {
    page?.text(line, bodyX, cursor + 38, DRIVER.size, BOLD, service.isUnassigned ? COLORS.orange : COLORS.white);
    cursor += DRIVER.lineHeight;
  });
  cursor += 16;

  const { missingLabel } = service;
  cursor += layoutStop(page, { label: 'Inicio', color: COLORS.gold, stop: service.origin, missingLabel }, bodyX, cursor, bodyWidth);
  cursor += CARD.gap;
  cursor += layoutStop(page, { label: 'Destino', color: COLORS.blue, stop: service.destination, missingLabel }, bodyX, cursor, bodyWidth);

  cursor += CARD.gap;
  const arrivalWeight = service.hasArrival ? BOLD : REGULAR;
  const arrivalColor = service.hasArrival ? COLORS.goldPale : COLORS.muted;
  wrapText(service.arrival, bodyWidth, ADDRESS.size, arrivalWeight).forEach((line) => {
    page?.text(line, bodyX, cursor + 24, ADDRESS.size, arrivalWeight, arrivalColor);
    cursor += ADDRESS.lineHeight;
  });

  return cursor + CARD.padding - y;
}

function paginate(services) {
  const pages = [[]];
  let used = HEADER_HEIGHT.first;
  for (const service of services) {
    const height = layoutCard(null, service, 0);
    if (used + height + FOOTER_HEIGHT > PAGE.height && pages[pages.length - 1].length) {
      pages.push([]);
      used = HEADER_HEIGHT.following;
    }
    pages[pages.length - 1].push({ service, height });
    used += height + CARD.gap;
  }
  return pages;
}

function drawHeader(page, { dayLabel, total }, isFirstPage) {
  const x = PAGE.margin;
  page.fillRect(0, 0, PAGE.width, 8, COLORS.gold);

  if (!isFirstPage) {
    page.text(dayLabel, x, 80, 32, BOLD, COLORS.goldPale);
    return;
  }
  page.text('TeLlevo', x, 84, 40, BOLD, COLORS.gold);
  page.text('Servicios del día', x, 164, 64, BOLD, COLORS.white);
  page.text(dayLabel, x, 224, 36, BOLD, COLORS.goldPale);
  page.text(`${total} ${total === 1 ? 'servicio' : 'servicios'}`, x, 268, 30, REGULAR, COLORS.muted);
}

function renderPage(cards, details, pageIndex, pageCount) {
  const page = new PdfPage();
  page.fillRect(0, 0, PAGE.width, PAGE.height, COLORS.page);
  drawHeader(page, details, pageIndex === 0);

  let y = pageIndex === 0 ? HEADER_HEIGHT.first : HEADER_HEIGHT.following;
  for (const { service, height } of cards) {
    layoutCard(page, service, y, height);
    y += height + CARD.gap;
  }

  const footer = `Página ${pageIndex + 1} de ${pageCount}`;
  page.text(footer, PAGE.width - PAGE.margin - textWidth(footer, 26, REGULAR), PAGE.height - 36, 26, REGULAR, COLORS.muted);
  return page.commands.join('\n');
}

/**
 * Arma el archivo PDF a partir del contenido de cada página.
 * @param {string[]} pageContents
 * @returns {Blob}
 */
function assemblePdf(pageContents) {
  const chunks = [];
  const offsets = [];
  let position = 0;
  const write = (text) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    position += bytes.length;
  };
  const writeObject = (id, body) => {
    offsets[id] = position;
    write(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const FONT_REGULAR_ID = 3;
  const FONT_BOLD_ID = 4;
  const pageObjectId = (index) => 5 + index * 2;
  const objectCount = 4 + pageContents.length * 2;
  const mediaBox = `[0 0 ${toPoints(PAGE.width)} ${toPoints(PAGE.height)}]`;
  const fontDictionary = (baseFont) => `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`;

  write('%PDF-1.4\n');
  writeObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pageContents.map((_, index) => `${pageObjectId(index)} 0 R`).join(' ');
  writeObject(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageContents.length} >>`);
  writeObject(FONT_REGULAR_ID, fontDictionary('Helvetica'));
  writeObject(FONT_BOLD_ID, fontDictionary('Helvetica-Bold'));

  pageContents.forEach((content, index) => {
    const pageId = pageObjectId(index);
    const contentId = pageId + 1;
    writeObject(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Contents ${contentId} 0 R /Resources << /Font << /F1 ${FONT_REGULAR_ID} 0 R /F2 ${FONT_BOLD_ID} 0 R >> >> >>`);
    writeObject(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
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
 *   missingLabel: string, arrival: string, hasArrival: boolean }> }} details
 * @returns {Blob}
 */
export function buildServiceListPdf({ dayLabel, services }) {
  const pages = paginate(services);
  const details = { dayLabel, total: services.length };
  return assemblePdf(pages.map((cards, index) => renderPage(cards, details, index, pages.length)));
}
