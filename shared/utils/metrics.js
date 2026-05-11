'use strict';

// shared/utils/metrics.js
// Helper pour mesurer des actions spécifiques dans les Page Objects
// Usage : const duree = await mesurer(page, 'portefeuille.chargement', async () => { ... });
// Les métriques sont écrites dans playwright-report/metrics.json

const fs   = require('fs');
const path = require('path');

const METRICS_FILE = path.resolve(__dirname, '../../playwright-report/metrics.json');

/**
 * Mesure la durée d'une action et l'enregistre dans metrics.json
 * @param {string} nom        - identifiant de la métrique (ex: 'portefeuille.chargement')
 * @param {Function} action   - fonction async à mesurer
 * @param {Object} context    - contexte optionnel { app, env, test }
 * @returns {*} le résultat de l'action
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

function _enregistrer(entree) {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // On accumule dans le run courant (fichier créé par le reporter au onBegin)
    let data = [];
    if (fs.existsSync(METRICS_FILE)) {
      try { data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); } catch {}
    }

    data.push({
      timestamp: new Date().toISOString(),
      ...entree,
    });

    fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Ne jamais faire planter un test à cause des métriques
  }
}

module.exports = { mesurer };
