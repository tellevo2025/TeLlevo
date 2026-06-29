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

// Diagnóstico — ayuda a detectar por qué falta la variable en CI
console.log('Variables disponibles:', Object.keys(process.env)
  .filter(k => !k.startsWith('npm_') && !k.startsWith('PATH') && !k.startsWith('NODE'))
  .join(', '));

const key = process.env.GOOGLE_MAPS_KEY;
if (!key) {
  console.error('ERROR: GOOGLE_MAPS_KEY no está definida.');
  console.error('Agrégala en Vercel → Project Settings → Environment Variables (scope: Production)');
  process.exit(1);
}

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('%%GOOGLE_MAPS_KEY%%')) {
  console.log('Advertencia: el placeholder %%GOOGLE_MAPS_KEY%% no se encontró en index.html.');
  process.exit(0);
}

fs.writeFileSync(indexPath, html.replaceAll('%%GOOGLE_MAPS_KEY%%', key));
console.log('OK: GOOGLE_MAPS_KEY inyectada en index.html');
