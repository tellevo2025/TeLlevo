const fs   = require('fs');
const path = require('path');

// Carga .env local si existe (solo para desarrollo local)
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

// Inyectar en index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (mapsKey) {
  html = html.replaceAll('%%GOOGLE_MAPS_KEY%%', mapsKey);
  console.log('OK: GOOGLE_MAPS_KEY inyectada en index.html');
} else {
  console.warn('AVISO: GOOGLE_MAPS_KEY no definida — placeholder dejado en index.html');
}
fs.writeFileSync(indexPath, html);

// Inyectar en main.js
const jsPath = path.join(__dirname, '..', 'src', 'js', 'main.js');
let js = fs.readFileSync(jsPath, 'utf8');
if (formToken) {
  js = js.replaceAll('%%FORM_TOKEN%%', formToken);
  console.log('OK: FORM_TOKEN inyectado en main.js');
} else {
  js = js.replaceAll('%%FORM_TOKEN%%', '');
  console.warn('AVISO: FORM_TOKEN no definida — token dejado vacío');
}
fs.writeFileSync(jsPath, js);

// Inyectar config Firebase en admin/index.html
const adminPath = path.join(__dirname, '..', 'admin', 'index.html');
if (fs.existsSync(adminPath)) {
  let adminHtml = fs.readFileSync(adminPath, 'utf8');
  const firebaseVars = {
    '%%FIREBASE_API_KEY%%':           process.env.FIREBASE_API_KEY           || '',
    '%%FIREBASE_AUTH_DOMAIN%%':       process.env.FIREBASE_AUTH_DOMAIN       || '',
    '%%FIREBASE_PROJECT_ID%%':        process.env.FIREBASE_PROJECT_ID        || '',
    '%%FIREBASE_APP_ID%%':            process.env.FIREBASE_APP_ID            || '',
    '%%FIREBASE_MESSAGING_SENDER_ID%%': process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  };
  for (const [k, v] of Object.entries(firebaseVars)) {
    adminHtml = adminHtml.replaceAll(k, v);
  }
  fs.writeFileSync(adminPath, adminHtml);
  console.log('OK: Config Firebase inyectada en admin/index.html');
}
