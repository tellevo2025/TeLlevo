/**
 * Inyecta variables de entorno en index.html antes del deploy.
 * Reemplaza %%NOMBRE_VAR%% con el valor de process.env.NOMBRE_VAR.
 * En Netlify: las variables se definen en Site Settings → Environment variables.
 * En local:   se definen en landing/.env (ignorado por git).
 */
const fs   = require('fs');
const path = require('path');

// Cargador .env minimalista (sin dependencias npm)
const loadDotEnv = () => {
  const envFile = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envFile)) return;
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    });
};

loadDotEnv();

const REQUIRED = ['GOOGLE_MAPS_KEY'];

const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌  Faltan variables de entorno: ${missing.join(', ')}`);
  console.error('   → En Netlify: Site Settings → Environment variables');
  console.error('   → En local:   crea landing/.env con GOOGLE_MAPS_KEY=tu_clave\n');
  process.exit(1);
}

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

let replacements = 0;
html = html.replace(/%%([A-Z0-9_]+)%%/g, (match, varName) => {
  if (process.env[varName]) {
    replacements++;
    return process.env[varName];
  }
  console.warn(`⚠️  Placeholder ${match} no tiene variable de entorno definida — se dejó sin cambios.`);
  return match;
});

fs.writeFileSync(indexPath, html);
console.log(`✅  ${replacements} placeholder(s) inyectado(s) en index.html`);
