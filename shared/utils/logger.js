'use strict';

// shared/utils/logger.js
// Logger centralisé — horodatage Paris, console + fichier log.txt
// Écrit dans test-output/runs/run-[timestamp]/log.txt via TNR_RUN_DIR

const fs   = require('fs');
const path = require('path');

function getLogFile() {
  const runDir = process.env.TNR_RUN_DIR;
  if (runDir && fs.existsSync(runDir)) {
    return path.join(runDir, 'log.txt');
  }
  return path.resolve(__dirname, '../../test-output/log_tests.txt');
}

function getHorodatageParis() {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(',', '');
}

function ajouterLog(message, contexte = '', niveau = 'info') {
  const horodatage = getHorodatageParis();
  const icone = niveau === 'success' ? '✅' : niveau === 'warning' ? '⚠️' : 'ℹ️';
  const ligne = `[${horodatage}] ${icone} [${contexte}] ${message}`;

  console.info(`ℹ️ [${contexte}] ${message}`);

  try {
    const logFile = getLogFile();
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, ligne + '\n');
  } catch {}
}

module.exports = { ajouterLog };
