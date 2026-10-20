'use strict';

// config/sorties.js
// Dossier racine des sorties (runs, data, historiques perf, rapport HTML, traces)
//   TNR_SORTIES défini (.env.local) → <TNR_SORTIES>\<machine>\test-output\  (un sous-dossier par VM)
//   absent ou inaccessible          → test-output\ local du projet (avertissement)
// Chargé avant global-setup (config + reporter) → lit .env.local lui-même.
// Résolu une fois dans le process principal puis transmis aux workers par l'environnement.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const LOCAL = path.join(ROOT, 'test-output');

(function chargerEnv() {
  const dotenv = require('dotenv');
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '.env')]) {
    if (fs.existsSync(f)) { dotenv.config({ path: f, quiet: true }); break; }
  }
})();

function resoudreSorties() {
  const racine = process.env.TNR_SORTIES;
  if (!racine) return LOCAL;
  const dossier = path.join(racine, os.hostname().toLowerCase(), 'test-output');
  try {
    fs.mkdirSync(dossier, { recursive: true });
    fs.accessSync(dossier, fs.constants.W_OK);
    return dossier;
  } catch (e) {
    console.warn(`[sorties] ⚠ ${dossier} inaccessible (${e.code || e.message}) → sorties locales : ${LOCAL}`);
    return LOCAL;
  }
}

// Workers : hérités du process principal → même dossier, pas de second accès réseau
process.env.TNR_OUTPUT_DIR = process.env.TNR_OUTPUT_DIR || resoudreSorties();
const OUTPUT_DIR = process.env.TNR_OUTPUT_DIR;

// Identifiant du run : calculé une fois au chargement de la config (rapport HTML, traces et reporter dans le même dossier)
function dossierRun() {
  if (!process.env.TNR_RUN_ID) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    process.env.TNR_RUN_ID = `run-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }
  return path.join(OUTPUT_DIR, 'runs', process.env.TNR_RUN_ID);
}

module.exports = { OUTPUT_DIR, dossierRun };
