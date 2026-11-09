/*
  service-list-pdf.js — Genera la planilla PDF de servicios por chofer.
  Es una tabla A4 horizontal cuyo contenido es texto real, para poder seleccionar y
  copiar las direcciones. El PDF se arma a mano con Helvetica, fuente incluida en todo
  lector de PDF, así que no requiere librerías ni descargas.
  Se carga solo al descargar, para no afectar el inicio del panel.
*/

const PAGE = { width: 842, height: 595, margin: 24 };

const COLORS = {
  band: '#0A1628',
  gold: '#C9A84C',
  goldPale: '#F5DFA0',
  white: '#FFFFFF',
  tableHeader: '#1B3A6B',
  rowAlternate: '#F1F4F9',
  rowUnassigned: '#FFF1DC',
  rowLine: '#D3DBE8',
  text: '#0A1628',
  secondary: '#55617A',
  unassigned: '#B4560A',
  originChip: '#F5DFA0',
  destinationChip: '#BFDBFF',
};

const BAND_HEIGHT = 58;
const TABLE_HEADER_HEIGHT = 24;
const FOOTER_HEIGHT = 24;
const ROW_PADDING = { x: 8, y: 7 };
const CHIP = { height: 16, paddingX: 5, radius: 3 };
const ADDRESS = { size: 10, lineHeight: 14 };
const DETAIL_SIZE = 8.5;

const COLUMNS = [
  { key: 'time', title: 'Hora', width: 56 },
  { key: 'driver', title: 'Chofer', width: 128 },
  { key: 'origin', title: 'Inicio', width: 243 },
  { key: 'destination', title: 'Destino', width: 243 },
  { key: 'arrival', title: 'Llegada aprox.', width: 124 },
];

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

const num = (value) => value.toFixed(2);

/** Acumula las instrucciones de dibujo de una página; recibe coordenadas desde arriba. */
class PdfPage {
  commands = [];

  #y = (top) => num(PAGE.height - top);

  #roundedRectPath(x, y, width, height, radius) {
    const k = radius * 0.4477;
    const right = x + width, bottom = y + height;
    const X = num, Y = this.#y;
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
    this.commands.push(`${hexToPdfColor(color)} rg ${num(x)} ${this.#y(y + height)} ${num(width)} ${num(height)} re f`);
  }

  fillRoundedRect(x, y, width, height, radius, color) {
    this.commands.push(`${hexToPdfColor(color)} rg`);
    this.#roundedRectPath(x, y, width, height, radius);
    this.commands.push('f');
  }

  strokeRoundedRect(x, y, width, height, radius, color) {
    this.commands.push(`${hexToPdfColor(color)} RG 0.75 w [2 1.5] 0 d`);
    this.#roundedRectPath(x, y, width, height, radius);
    this.commands.push('S', '[] 0 d');
  }

  text(content, x, baseline, size, weight, color) {
    this.commands.push(`BT ${hexToPdfColor(color)} rg /${PDF_FONT_NAME[weight]} ${num(size)} Tf ${num(x)} ${this.#y(baseline)} Td <${toWinAnsiHex(content)}> Tj ET`);
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

const chipBaseline = (y, size) => y + (CHIP.height + size * 0.72) / 2;

function drawChip(page, { text, size, weight, width, fill, isMissing }, x, y) {
  if (isMissing) {
    page.strokeRoundedRect(x, y, width, CHIP.height, CHIP.radius, COLORS.secondary);
  } else {
    page.fillRoundedRect(x, y, width, CHIP.height, CHIP.radius, fill);
  }
  page.text(text, x + CHIP.paddingX, chipBaseline(y, size), size, weight, isMissing ? COLORS.secondary : COLORS.text);
}

/** Dibuja una dirección con su comuna o, si page es null, solo calcula su altura. */
function layoutPlace(page, stop, fill, missingLabel, x, y, width) {
  const isMissing = !stop.comuna;
  const text = stop.comuna || missingLabel;
  const weight = isMissing ? REGULAR : BOLD;
  const size = isMissing ? DETAIL_SIZE : ADDRESS.size;
  const chip = { text, size, weight, fill, isMissing, width: Math.min(textWidth(text, size, weight) + CHIP.paddingX * 2, width) };

  // La dirección va antes que la comuna para copiarla como "Calle 123, Comuna".
  const streetText = stop.street ? `${stop.street}${isMissing ? '' : ','}` : '';
  const lines = streetText ? wrapText(streetText, width, ADDRESS.size, REGULAR) : [];
  let cursor = y;

  lines.slice(0, -1).forEach((line) => {
    page?.text(line, x, cursor + 10, ADDRESS.size, REGULAR, COLORS.text);
    cursor += ADDRESS.lineHeight;
  });

  const lastLine = lines[lines.length - 1];
  if (!lastLine) {
    if (page) drawChip(page, chip, x, cursor);
    return cursor + CHIP.height - y;
  }

  // El espacio final y la misma línea base hacen que al copiar salga "Calle 123, Comuna" seguido.
  const inlineLine = `${lastLine} `;
  const inlineWidth = textWidth(inlineLine, ADDRESS.size, REGULAR);
  if (!isMissing && inlineWidth + chip.width <= width) {
    page?.text(inlineLine, x, chipBaseline(cursor, ADDRESS.size), ADDRESS.size, REGULAR, COLORS.text);
    if (page) drawChip(page, chip, x + inlineWidth, cursor);
    return cursor + CHIP.height - y;
  }

  page?.text(lastLine, x, cursor + 10, ADDRESS.size, REGULAR, COLORS.text);
  cursor += ADDRESS.lineHeight + 1;
  if (page) drawChip(page, chip, x, cursor);
  return cursor + CHIP.height - y;
}

const columnContentWidth = (column) => column.width - ROW_PADDING.x * 2;

function layoutWrapped(page, text, x, y, width, size, weight, color, lineHeight) {
  const lines = wrapText(text, width, size, weight);
  lines.forEach((line, index) => page?.text(line, x, y + size * 0.85 + index * lineHeight, size, weight, color));
  return lines.length * lineHeight;
}

/** Dibuja una fila o, si page es null, solo calcula su altura. */
function layoutRow(page, service, y, height, isAlternate) {
  const { missingLabel } = service;
  const left = PAGE.margin;
  const tableWidth = PAGE.width - PAGE.margin * 2;
  const top = y + ROW_PADDING.y;

  if (page) {
    if (service.isUnassigned) page.fillRect(left, y, tableWidth, height, COLORS.rowUnassigned);
    else if (isAlternate) page.fillRect(left, y, tableWidth, height, COLORS.rowAlternate);
    page.fillRect(left, y + height - 0.5, tableWidth, 0.5, COLORS.rowLine);
  }

  const cellHeights = [];
  let x = left;
  for (const column of COLUMNS) {
    const cellX = x + ROW_PADDING.x;
    const width = columnContentWidth(column);
    if (column.key === 'time') {
      cellHeights.push(layoutWrapped(page, service.time, cellX, top, width, 13, BOLD, COLORS.text, 16));
    } else if (column.key === 'driver') {
      const color = service.isUnassigned ? COLORS.unassigned : COLORS.text;
      cellHeights.push(layoutWrapped(page, service.driver, cellX, top, width, 11, BOLD, color, 14));
    } else if (column.key === 'origin') {
      cellHeights.push(layoutPlace(page, service.origin, COLORS.originChip, missingLabel, cellX, top, width));
    } else if (column.key === 'destination') {
      cellHeights.push(layoutPlace(page, service.destination, COLORS.destinationChip, missingLabel, cellX, top, width));
    } else {
      let arrivalHeight = 0;
      if (service.arrivalTime) arrivalHeight = layoutWrapped(page, service.arrivalTime, cellX, top, width, 13, BOLD, COLORS.text, 16);
      arrivalHeight += layoutWrapped(page, service.arrivalDetail, cellX, top + arrivalHeight, width, DETAIL_SIZE, REGULAR, COLORS.secondary, 11);
      cellHeights.push(arrivalHeight);
    }
    x += column.width;
  }
  return Math.max(...cellHeights) + ROW_PADDING.y * 2;
}

function paginate(services) {
  const available = PAGE.height - BAND_HEIGHT - TABLE_HEADER_HEIGHT - FOOTER_HEIGHT;
  const pages = [[]];
  let used = 0;
  for (const service of services) {
    const height = layoutRow(null, service, 0, 0, false);
    if (used + height > available && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push({ service, height });
    used += height;
  }
  return pages;
}

function drawBand(page, { dayLabel, total }) {
  const x = PAGE.margin;
  page.fillRect(0, 0, PAGE.width, BAND_HEIGHT, COLORS.band);
  page.fillRect(0, BAND_HEIGHT - 2, PAGE.width, 2, COLORS.gold);
  page.text('TeLlevo', x, 25, 12, BOLD, COLORS.gold);
  page.text(`Servicios del día · ${dayLabel}`, x, 45, 15, BOLD, COLORS.white);
  const count = `${total} ${total === 1 ? 'servicio' : 'servicios'}`;
  page.text(count, PAGE.width - PAGE.margin - textWidth(count, 12, BOLD), 45, 12, BOLD, COLORS.goldPale);
}

function drawTableHeader(page) {
  const left = PAGE.margin;
  page.fillRect(left, BAND_HEIGHT, PAGE.width - PAGE.margin * 2, TABLE_HEADER_HEIGHT, COLORS.tableHeader);
  let x = left;
  for (const column of COLUMNS) {
    page.text(column.title.toUpperCase(), x + ROW_PADDING.x, BAND_HEIGHT + 16, 9, BOLD, COLORS.white);
    x += column.width;
  }
}

function renderPage(rows, details, pageIndex, pageCount) {
  const page = new PdfPage();
  drawBand(page, details);
  drawTableHeader(page);

  let y = BAND_HEIGHT + TABLE_HEADER_HEIGHT;
  rows.forEach(({ service, height }, index) => {
    layoutRow(page, service, y, height, index % 2 === 1);
    y += height;
  });

  const footer = `Página ${pageIndex + 1} de ${pageCount}`;
  page.text(footer, PAGE.width - PAGE.margin - textWidth(footer, 8.5, REGULAR), PAGE.height - 9, 8.5, REGULAR, COLORS.secondary);
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
  const mediaBox = `[0 0 ${PAGE.width} ${PAGE.height}]`;
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
 * Genera la planilla PDF de servicios.
 * @param {{ dayLabel: string, services: Array<{ time: string, driver: string, isUnassigned: boolean,
 *   origin: { street: string, comuna: string }, destination: { street: string, comuna: string },
 *   missingLabel: string, arrivalTime: string, arrivalDetail: string }> }} details
 * @returns {Blob}
 */
export function buildServiceListPdf({ dayLabel, services }) {
  const pages = paginate(services);
  const details = { dayLabel, total: services.length };
  return assemblePdf(pages.map((rows, index) => renderPage(rows, details, index, pages.length)));
}
