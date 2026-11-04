/*
  git-guard.js — Claude Code hook que evita dejar cambios sin desplegar.
  Vercel solo despliega lo que está en origin/main, así que cualquier cambio
  local sin commit/push es invisible en producción.

  Uso:
    node git-guard.js stop     → bloquea el fin de turno si hay cambios pendientes
    node git-guard.js session  → avisa al iniciar sesión si quedaron cambios pendientes
*/
const { execSync } = require('child_process');

const mode = process.argv[2];

const readStdin = () => {
  try { return JSON.parse(require('fs').readFileSync(0, 'utf8') || '{}'); }
  catch { return {}; }
};

const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

const input = readStdin();
const dirty = git('status --porcelain');
const unpushed = git('log origin/main..HEAD --oneline');

if (!dirty && !unpushed) process.exit(0);

const details = [
  dirty && `Archivos sin commit:\n${dirty}`,
  unpushed && `Commits sin push a origin/main:\n${unpushed}`,
].filter(Boolean).join('\n\n');

if (mode === 'stop') {
  if (input.stop_hook_active) process.exit(0);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `Hay cambios que NO están en producción (Vercel despliega solo origin/main).\n\n${details}\n\n`
      + 'Revisa los cambios, haz commit, push a main y verifica que el deploy de Vercel termine en success. '
      + 'Si los cambios son intencionalmente locales o el usuario pidió no subirlos, explícaselo al usuario en vez de subirlos.',
  }));
} else if (mode === 'session') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `⚠️ Una sesión anterior dejó cambios sin desplegar (no están en Vercel).\n\n${details}\n\n`
        + 'Avisa al usuario al comienzo y ofrece revisarlos, hacer commit, push a main y verificar el deploy.',
    },
    systemMessage: '⚠️ Hay cambios locales sin desplegar en Vercel.',
  }));
}
