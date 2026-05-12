'use strict';

// shared/utils/metrics.js
// Helper pour mesurer et enregistrer des métriques de performance
// Écrit dans test-output/runs/run-[timestamp]/metrics.json
// Le chemin est passé via la variable d'env TNR_RUN_DIR (positionné par le reporter)
// Si TNR_RUN_DIR n'est pas défini, fallback sur test-output/metrics.json

const fs   = require('fs');
const path = require('path');

function getMetricsFile() {
  const runDir = process.env.TNR_RUN_DIR;
  if (runDir && fs.existsSync(runDir)) {
    return path.join(runDir, 'metrics.json');
  }
  return path.resolve(__dirname, '../../test-output/metrics.json');
}

/**
 * Mesure la durée d'une action et l'enregistre dans metrics.json
 */
async function mesurer(nom, action, context = {}) {
  const debut = Date.now();
  let statut = 'ok';
  let resultat;
  try {
    resultat = await action();
  } catch (e) {
    statut = 'erreur';
    throw e;
  } finally {
    const duree = Date.now() - debut;
    _enregistrer({ nom, duree, statut, ...context });
  }
  return resultat;
}

/**
 * Enregistre directement une métrique sans mesurer une action
 */
function enregistrer(nom, valeurs = {}) {
  _enregistrer({ nom, ...valeurs });
}

function _enregistrer(entree) {
  try {
    const metricsFile = getMetricsFile();
    const dir = path.dirname(metricsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let data = [];
    if (fs.existsSync(metricsFile)) {
      try { data = JSON.parse(fs.readFileSync(metricsFile, 'utf8')); } catch {}
    }
    data.push({ timestamp: new Date().toISOString(), ...entree });
    fs.writeFileSync(metricsFile, JSON.stringify(data, null, 2));
  } catch {
    // Ne jamais faire planter un test à cause des métriques
  }
}

module.exports = { mesurer, enregistrer };
