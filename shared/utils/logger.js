'use strict';

// shared/utils/logger.js
// Logger centralisé — horodatage Paris, console + fichier txt
// Le fichier log est écrit dans playwright-report/ pour rester avec les artifacts de run

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.resolve(__dirname, '../../test-output');
const LOG_FILE = path.join(LOG_DIR, 'log_tests.txt');

function getHorodatageParis() {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(',', '');
}

/**
 * Ajoute une entrée de log console + fichier txt
 * @param {string} message
 * @param {string} step    - libellé de l'étape (ex: 'Auth-TNR')
 * @param {'info'|'success'|'failure'|'warning'} status
 */
function ajouterLog(message, step = 'Info', status = 'info') {
  const icones = { success: '✅', failure: '❌', warning: '⚠️', info: 'ℹ️' };
  const ts = getHorodatageParis();

  console.log(`${icones[status] || 'ℹ️'} [${step}] ${message}`);

  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${ts}] [${step}] [${status}] ${message}\n`);
  } catch {
    // Ne pas faire planter un test à cause du logger
  }
}

module.exports = { ajouterLog };
