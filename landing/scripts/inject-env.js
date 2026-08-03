const fs   = require('fs');
const path = require('path');

// Carga .env local si existe (desarrollo local)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  });
}

const mapsKey   = process.env.GOOGLE_MAPS_KEY;
const formToken = process.env.FORM_TOKEN;

if (!mapsKey) {
  console.error('ERROR: GOOGLE_MAPS_KEY no está definida en las variables de entorno de Netlify.');
  process.exit(1);
}
if (!formToken) {
  console.error('ERROR: FORM_TOKEN no está definida en las variables de entorno de Netlify.');
  process.exit(1);
}

// Inyectar en index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replaceAll('%%GOOGLE_MAPS_KEY%%', mapsKey);
fs.writeFileSync(indexPath, html);
console.log('OK: GOOGLE_MAPS_KEY inyectada en index.html');

// Inyectar en main.js
const jsPath = path.join(__dirname, '..', 'src', 'js', 'main.js');
let js = fs.readFileSync(jsPath, 'utf8');
js = js.replaceAll('%%FORM_TOKEN%%', formToken);
fs.writeFileSync(jsPath, js);
console.log('OK: FORM_TOKEN inyectado en main.js');
