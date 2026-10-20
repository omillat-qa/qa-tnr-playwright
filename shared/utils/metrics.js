'use strict';

// shared/utils/metrics.js
// Helper pour mesurer et enregistrer des métriques de performance
// Écrit dans test-output/runs/run-[timestamp]/metrics-w[N].jsonl (un fichier par worker)
// Le reporter fusionne ces fichiers en metrics.json en fin de run
// Le chemin est passé via la variable d'env TNR_RUN_DIR (positionné par le reporter)
// Si TNR_RUN_DIR n'est pas défini, fallback sur test-output/metrics-w[N].jsonl

const fs   = require('fs');
const path = require('path');
const { test } = require('@playwright/test');

function getMetricsFile() {
  // Un fichier par worker (append JSONL) : deux workers ne s'écrasent plus
  const worker = process.env.TEST_PARALLEL_INDEX || '0';
  const runDir = process.env.TNR_RUN_DIR;
  const dir = runDir && fs.existsSync(runDir) ? runDir : require('../../config/sorties').OUTPUT_DIR;
  return path.join(dir, `metrics-w${worker}.jsonl`);
}

// Projet Playwright du test en cours → permet d'archiver par projet
function projetCourant() {
  try { return test.info().project.name; } catch { return undefined; }
}

/**
 * Mesure la durée d'une action et l'enregistre dans le fichier metrics du worker
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
    fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
    const ligne = { timestamp: new Date().toISOString(), projet: projetCourant(), ...entree };
    fs.appendFileSync(metricsFile, JSON.stringify(ligne) + '\n');
  } catch {
    // Ne jamais faire planter un test à cause des métriques
  }
}

module.exports = { mesurer, enregistrer };
