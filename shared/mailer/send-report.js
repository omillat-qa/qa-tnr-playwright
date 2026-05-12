'use strict';

// shared/mailer/send-report.js
// Envoi email HTML récap TNR après un run Playwright
//
// Usage :
//   node shared/mailer/send-report.js --app=compliance-v2
//     → prend le run le plus récent dans test-output/runs/
//
//   node shared/mailer/send-report.js --app=compliance-v2 --run=run-20260512-143000
//     → prend un run spécifique
//
//   node shared/mailer/send-report.js --app=compliance-v2 --rapport=\\nas\...
//     → ajoute un lien vers le rapport

const nodemailer = require('nodemailer');
const fs         = require('fs');
const path       = require('path');

// Chargement .env.local en priorité
(function chargerEnv() {
  const dotenv = require('dotenv');
  const envFiles = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const f of envFiles) {
    if (fs.existsSync(f)) { dotenv.config({ path: f }); break; }
  }
})();

const SMTP = {
  host:   process.env.SMTP_HOST || 'smtp.int.dns',
  port:   parseInt(process.env.SMTP_PORT || '25', 10),
  secure: false,
  tls:    { rejectUnauthorized: false },
};
const FROM = process.env.SMTP_FROM || 'devqtp02@ellisphere.com';

const APPS_CONFIG = {
  'compliance-v2':  { label: 'Compliance for Business v2', destinataires: (process.env.MAIL_COMPLIANCE_V2 || '').split(',').filter(Boolean) },
  'compliance-v1':  { label: 'Compliance v1',              destinataires: (process.env.MAIL_COMPLIANCE_V1 || '').split(',').filter(Boolean) },
  'ellipro-risk':   { label: 'Ellipro Risk',               destinataires: (process.env.MAIL_ELLIPRO_RISK  || '').split(',').filter(Boolean) },
  'ellipro-mod-dec':{ label: 'Ellipro Modulaire/Déc',      destinataires: (process.env.MAIL_ELLIPRO_MOD_DEC || '').split(',').filter(Boolean) },
  'orange':         { label: 'Web Orange',                  destinataires: (process.env.MAIL_ORANGE || '').split(',').filter(Boolean) },
};

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, ...vals] = arg.replace('--', '').split('=');
    args[key] = vals.join('=');
  });
  return args;
}

// ---------------------------------------------------------------------------
// Trouve le run le plus récent dans test-output/runs/
// ---------------------------------------------------------------------------
function trouverDernierRun(runsDir, runId) {
  if (runId) {
    const p = path.join(runsDir, runId, 'results.json');
    if (fs.existsSync(p)) return p;
    throw new Error(`Run introuvable : ${runId}`);
  }
  if (!fs.existsSync(runsDir)) throw new Error(`Dossier runs introuvable : ${runsDir}`);
  const runs = fs.readdirSync(runsDir)
    .filter(d => d.startsWith('run-') && fs.existsSync(path.join(runsDir, d, 'results.json')))
    .sort()
    .reverse();
  if (!runs.length) throw new Error('Aucun run trouvé dans test-output/runs/');
  return path.join(runsDir, runs[0], 'results.json');
}

// ---------------------------------------------------------------------------
// Génère le HTML de l'email
// ---------------------------------------------------------------------------
function genererHTML(results, { app, rapportUrl }) {
  const appConfig = APPS_CONFIG[app] || { label: app };
  const run       = results.run;
  const modules   = results.recap_modules;

  const couleurStatut = run.echecs === 0 ? '#16a34a' : '#dc2626';
  const labelStatut   = run.echecs === 0 ? '✅ SUCCÈS' : `❌ ${run.echecs} ÉCHEC(S)`;
  const dureeMin      = (run.duree_ms / 60000).toFixed(1);
  const dateRun       = new Date(run.debut).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const envLabel      = run.projets?.join(', ') || app;

  const lignesModules = modules.map(m => {
    const ok      = m.echecs === 0;
    const couleur = ok ? '#dcfce7' : '#fee2e2';
    const icone   = ok ? '✅' : '❌';
    const pct     = m.total > 0 ? Math.round((m.passes / m.total) * 100) : 100;
    const infoSkip = m.skips > 0 ? ` <span style="color:#6b7280;font-size:11px">(${m.skips} ignoré(s))</span>` : '';
    return `
      <tr style="background:${couleur}">
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${icone} ${m.module}${infoSkip}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${m.passes}/${m.total}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${pct}%</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:${m.echecs > 0 ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${m.echecs > 0 ? m.echecs + ' erreur(s)' : 'OK'}
        </td>
      </tr>`;
  }).join('');

  const testsEchec = results.tests.filter(t => t.statut === 'failed' || t.statut === 'timedOut');
  const testsSkip  = results.tests.filter(t => t.statut === 'skipped' && t.module !== 'Setup');

  const blocEchecs = testsEchec.length > 0 ? `
    <h3 style="color:#dc2626;margin-top:24px">Détail des échecs</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="background:#fee2e2">
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">ID</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Test</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Erreur</th>
      </tr></thead>
      <tbody>
        ${testsEchec.map(t => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold">${t.id || '-'}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.titre}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#dc2626;font-size:12px">${t.erreur || '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : '';

  const blocSkips = testsSkip.length > 0 ? `
    <h3 style="color:#6b7280;margin-top:16px;font-size:14px">Tests ignorés (fixme / skip)</h3>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <tbody>
        ${testsSkip.map(t => `
          <tr style="background:#f9fafb">
            <td style="padding:6px 12px;border:1px solid #e5e7eb;color:#6b7280;font-weight:bold">${t.id || '-'}</td>
            <td style="padding:6px 12px;border:1px solid #e5e7eb;color:#6b7280">${t.titre}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : '';

  const lienRapport = rapportUrl
    ? `<p style="margin-top:20px">
        <a href="${rapportUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
          📊 Voir le rapport complet
        </a>
      </p>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1f2937">
  <div style="background:#1e40af;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">TNR Playwright — ${appConfig.label}</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">Run : ${run.id} | ${dateRun}</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e5e7eb;padding:16px 24px">
    <div style="display:flex;gap:24px;margin-bottom:20px">
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center;min-width:100px">
        <div style="font-size:24px;font-weight:bold;color:${couleurStatut}">${labelStatut}</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:24px;font-weight:bold">${run.passes}/${run.total}</div>
        <div style="font-size:12px;color:#6b7280">Tests passés</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:24px;font-weight:bold">${dureeMin} min</div>
        <div style="font-size:12px;color:#6b7280">Durée</div>
      </div>
    </div>
    <h3 style="margin-top:0;color:#1e40af">Résultats par module</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr style="background:#1e40af;color:white">
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Module</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Passés</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Taux</th>
        <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Statut</th>
      </tr></thead>
      <tbody>${lignesModules}</tbody>
    </table>
    ${blocEchecs}
    ${blocSkips}
    ${lienRapport}
  </div>
  <div style="background:#e5e7eb;padding:8px 24px;border-radius:0 0 8px 8px;font-size:12px;color:#6b7280">
    Généré automatiquement par qa-tnr-playwright | Ellisphere Cellule de Test
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args       = parseArgs();
  const app        = args.app || 'compliance-v2';
  const rapportUrl = args.rapport || '';
  const runId      = args.run || null;

  const runsDir = path.resolve(__dirname, '../../test-output/runs');
  const resultsFile = trouverDernierRun(runsDir, runId);

  console.log(`[mailer] Lecture : ${resultsFile}`);

  const results   = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const appConfig = APPS_CONFIG[app] || { label: app, destinataires: [] };

  if (appConfig.destinataires.length === 0) {
    console.warn(`[mailer] Aucun destinataire pour ${app} — vérifiez MAIL_${app.toUpperCase().replace(/-/g,'_')} dans .env`);
    process.exit(0);
  }

  const run   = results.run;
  const sujet = run.echecs === 0
    ? `✅ TNR ${appConfig.label} — ${run.passes}/${run.total} OK`
    : `❌ TNR ${appConfig.label} — ${run.echecs} échec(s) sur ${run.total}`;

  const html = genererHTML(results, { app, rapportUrl });
  const transporter = nodemailer.createTransport(SMTP);
  await transporter.sendMail({ from: FROM, to: appConfig.destinataires.join(', '), subject: sujet, html });

  console.log(`[mailer] Email envoyé → ${appConfig.destinataires.join(', ')}`);
  console.log(`[mailer] Sujet : ${sujet}`);
}

main().catch(err => {
  console.error('[mailer] Erreur :', err.message);
  process.exit(1);
});
