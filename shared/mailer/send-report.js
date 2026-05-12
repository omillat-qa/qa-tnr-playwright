'use strict';

// shared/mailer/send-report.js
// Envoi email HTML récap TNR après un run Playwright
// Usage : node shared/mailer/send-report.js --projet=tnr-chromium-ua-compliance-v2 --rapport=\\nas\...
//      ou node shared/mailer/send-report.js --app=compliance-v2 --env=ua (rétrocompat)

const nodemailer = require('nodemailer');
const fs         = require('fs');
const path       = require('path');

// Chargement .env.local en priorité — DOIT être fait avant tout accès à process.env
(function chargerEnv() {
  const dotenv = require('dotenv');
  const envFiles = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      dotenv.config({ path: f });
      break;
    }
  }
})();

// ---------------------------------------------------------------------------
// Config SMTP (sans auth — relay interne Ellisphere)
// ---------------------------------------------------------------------------
const SMTP = {
  host: process.env.SMTP_HOST || 'smtp.int.dns',
  port: parseInt(process.env.SMTP_PORT || '25', 10),
  secure: false,
  tls: { rejectUnauthorized: false },
};

const FROM = process.env.SMTP_FROM || 'devqtp02@ellisphere.com';

// ---------------------------------------------------------------------------
// Config par app — destinataires et libellés
// ---------------------------------------------------------------------------
const APPS_CONFIG = {
  'compliance-v2': {
    label:        'Compliance for Business v2',
    destinataires: (process.env.MAIL_COMPLIANCE_V2 || '').split(',').filter(Boolean),
  },
  'compliance-v1': {
    label:        'Compliance v1',
    destinataires: (process.env.MAIL_COMPLIANCE_V1 || '').split(',').filter(Boolean),
  },
  'ellipro-risk': {
    label:        'Ellipro Risk',
    destinataires: (process.env.MAIL_ELLIPRO_RISK || '').split(',').filter(Boolean),
  },
  'ellipro-mod-dec': {
    label:        'Ellipro Modulaire / Décisionnel',
    destinataires: (process.env.MAIL_ELLIPRO_MOD_DEC || '').split(',').filter(Boolean),
  },
  'orange': {
    label:        'Web Orange',
    destinataires: (process.env.MAIL_ORANGE || '').split(',').filter(Boolean),
  },
};

// ---------------------------------------------------------------------------
// Parse les arguments CLI
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, val] = arg.replace('--', '').split('=');
    args[key] = val;
  });
  return args;
}

// ---------------------------------------------------------------------------
// Génère le HTML de l'email
// ---------------------------------------------------------------------------
function genererHTML(results, { app, env, rapportUrl }) {
  const appConfig = APPS_CONFIG[app] || { label: app };
  const run       = results.run;
  const modules   = results.recap_modules.filter(m => m.module !== 'Setup');

  const couleurStatut = run.echecs === 0 ? '#16a34a' : '#dc2626';
  const labelStatut   = run.echecs === 0 ? '✅ SUCCÈS' : `❌ ${run.echecs} ÉCHEC(S)`;
  const dureeMin      = (run.duree_ms / 60000).toFixed(1);
  const dateRun       = new Date(run.debut).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const nomProjet     = run.projet || `${app} ${env}`;

  const lignesModules = modules.map(m => {
    const ok      = m.echecs === 0;
    const couleur = ok ? '#dcfce7' : '#fee2e2';
    const icone   = ok ? '✅' : '❌';
    const pct     = Math.round(((m.total - m.echecs) / m.total) * 100);
    return `
      <tr style="background:${couleur}">
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${icone} ${m.module}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${m.total - m.echecs}/${m.total}</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${pct}%</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:${m.echecs > 0 ? '#dc2626' : '#16a34a'};font-weight:bold">
          ${m.echecs > 0 ? m.echecs + ' erreur(s)' : 'OK'}
        </td>
      </tr>`;
  }).join('');

  const testsEchec = results.tests.filter(t => t.statut !== 'passed' && t.module !== 'Setup');
  const blocEchecs = testsEchec.length > 0 ? `
    <h3 style="color:#dc2626;margin-top:24px">Détail des échecs</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="background:#fee2e2">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">ID</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Test</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Erreur</th>
        </tr>
      </thead>
      <tbody>
        ${testsEchec.map(t => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold">${t.id || '-'}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb">${t.titre}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#dc2626;font-size:12px">${t.erreur || '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : '';

  const lienRapport = rapportUrl
    ? `<p style="margin-top:20px">
        <a href="${rapportUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
          📊 Voir le rapport complet
        </a>
      </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1f2937">

  <div style="background:#1e40af;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
    <h1 style="margin:0;font-size:20px">TNR Playwright — ${appConfig.label}</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">Projet : ${nomProjet} | ${dateRun}</p>
  </div>

  <div style="background:#f8fafc;border:1px solid #e5e7eb;padding:16px 24px">

    <div style="display:flex;gap:24px;margin-bottom:20px">
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center;min-width:100px">
        <div style="font-size:28px;font-weight:bold;color:${couleurStatut}">${labelStatut}</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:24px;font-weight:bold">${run.passes}/${run.total}</div>
        <div style="font-size:12px;color:#6b7280">Tests passés</div>
      </div>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center">
        <div style="font-size:24px;font-weight:bold">${dureeMin} min</div>
        <div style="font-size:12px;color:#6b7280">Durée du run</div>
      </div>
    </div>

    <h3 style="margin-top:0;color:#1e40af">Résultats par module</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead>
        <tr style="background:#1e40af;color:white">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left">Module</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Passés</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Taux</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">Statut</th>
        </tr>
      </thead>
      <tbody>${lignesModules}</tbody>
    </table>

    ${blocEchecs}
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
  const rapportUrl = args.rapport || '';

  // Accepte --projet=tnr-chromium-ua-compliance-v2
  // ou --app=compliance-v2 --env=ua (rétrocompatibilité)
  let app, env, resultsFile;

  if (args.projet) {
    // Nouveau mode : --projet=tnr-chromium-ua-compliance-v2
    resultsFile = path.resolve(__dirname, `../../test-output/results-${args.projet}.json`);
    // Extrait app depuis le nom projet (dernier segment)
    const parts = args.projet.split('-');
    env = parts[parts.length - 2] || 'ua';
    // App = tout après tnr-[browser]-[env]- ou perf-recherche-[env]-
    app = args.app || parts.slice(3).join('-') || 'compliance-v2';
  } else {
    // Ancien mode : --app=compliance-v2 --env=ua
    app = args.app || 'compliance-v2';
    env = args.env || 'ua';
    // Cherche le fichier results le plus récent pour cette app+env
    const pattern = `results-tnr-chromium-${env}-${app}.json`;
    resultsFile = path.resolve(__dirname, `../../test-output/${pattern}`);
    // Fallback sur l'ancien nom
    if (!fs.existsSync(resultsFile)) {
      resultsFile = path.resolve(__dirname, '../../test-output/tnr-results.json');
    }
  }

  if (!fs.existsSync(resultsFile)) {
    console.error(`[mailer] Fichier résultats introuvable : ${resultsFile}`);
    console.error('[mailer] Lancez d\'abord le run Playwright correspondant');
    process.exit(1);
  }

  const results   = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const appConfig = APPS_CONFIG[app] || { label: app, destinataires: [] };

  if (appConfig.destinataires.length === 0) {
    console.warn(`[mailer] Aucun destinataire pour ${app} — vérifiez MAIL_${app.toUpperCase().replace(/-/g, '_')} dans .env`);
    process.exit(0);
  }

  const sujet = results.run.echecs === 0
    ? `✅ TNR ${appConfig.label} ${env.toUpperCase()} — ${results.run.passes}/${results.run.total} OK`
    : `❌ TNR ${appConfig.label} ${env.toUpperCase()} — ${results.run.echecs} échec(s) sur ${results.run.total}`;

  const html = genererHTML(results, { app, env, rapportUrl });
  const transporter = nodemailer.createTransport(SMTP);

  await transporter.sendMail({
    from:    FROM,
    to:      appConfig.destinataires.join(', '),
    subject: sujet,
    html,
  });

  console.log(`[mailer] Email envoyé → ${appConfig.destinataires.join(', ')}`);
  console.log(`[mailer] Sujet : ${sujet}`);
}

main().catch(err => {
  console.error('[mailer] Erreur :', err.message);
  process.exit(1);
});
