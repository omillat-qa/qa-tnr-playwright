'use strict';

// shared/utils/metrics.js
// Helper pour mesurer et enregistrer des métriques de performance
// Les métriques sont écrites dans test-output/metrics.json → Grafana/Pushgateway

const fs   = require('fs');
const path = require('path');

const METRICS_FILE = path.resolve(__dirname, '../../test-output/metrics.json');

/**
 * Mesure la durée d'une action et l'enregistre dans metrics.json
 * @param {string} nom        - identifiant de la métrique (ex: 'portefeuille.chargement')
 * @param {Function} action   - fonction async à mesurer
 * @param {Object} context    - contexte optionnel { app, env, ... }
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
    // Si des métriques custom sont dans le context, on les inclut
    _enregistrer({ nom, duree, statut, ...context });
  }

  return resultat;
}

/**
 * Enregistre directement une métrique sans mesurer une action
 * Usage pour des métriques calculées manuellement (ex: temps POST/UX recherche)
 * @param {string} nom      - identifiant (ex: 'recherche.temps_ux')
 * @param {Object} valeurs  - { app, env, motcle, temps_ux_ms, temps_post_ms, statut, ... }
 */
function enregistrer(nom, valeurs = {}) {
  _enregistrer({ nom, ...valeurs });
}

function _enregistrer(entree) {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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

module.exports = { mesurer, enregistrer };
