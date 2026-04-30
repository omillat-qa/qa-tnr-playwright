// config/apps.matrix.js
// Matrice : quels browsers sur quels envs pour chaque app
// C'est ici qu'on décide la couverture — pas dans playwright.config.js

'use strict';

const { getUrl } = require('./environments');

// Définition des browsers disponibles
const BROWSERS = {
  chromium: { browserName: 'chromium' },
  firefox:  { browserName: 'firefox' },
  edge:     { channel: 'msedge' },
  webkit:   { browserName: 'webkit' },   // WebKit Playwright (émulé sur Windows)
};

// Options communes à tous les projets
const COMMON_USE = {
  headless: true,
  timezoneId: 'Europe/Paris',
  locale: 'fr-FR',
  viewport: { width: 1366, height: 900 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
  deviceScaleFactor: 1,
};

/**
 * Génère les projets Playwright pour une app donnée
 * @param {string} app        - clé app (ex: 'ellipro-risk')
 * @param {string} testDir    - chemin vers les tests de l'app
 * @param {Object} matrix     - { ua: [...browsers], prod: [...browsers], ia: [...browsers], dev: [...browsers] }
 */
function makeProjects(app, testDir, matrix) {
  const projects = [];
  for (const [env, browsers] of Object.entries(matrix)) {
    for (const browser of browsers) {
      projects.push({
        name: `${browser}-${env}-${app}`,
        testDir,
        use: {
          ...COMMON_USE,
          ...BROWSERS[browser],
          baseURL: getUrl(app, env),
        },
        metadata: { app, env, browser },
      });
    }
  }
  return projects;
}

// ============================================================
// MATRICE PAR APP
// Ajouter une app = ajouter un bloc makeProjects() ici
// ============================================================

const matrix = [

  ...makeProjects('ellipro-risk', './apps/ellipro-risk/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'edge'],
    ia:   ['chromium'],
    dev:  ['chromium'],
  }),

  ...makeProjects('ellipro-mod-dec', './apps/ellipro-mod-dec/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'edge'],
    ia:   ['chromium'],
  }),

  ...makeProjects('ellipro-saml', './apps/ellipro-risk/tests/auth', {
    ua:   ['chromium'],
    prod: ['chromium'],
  }),

  ...makeProjects('compliance-v1', './apps/compliance/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'firefox', 'edge'],
    ia:   ['chromium'],
    dev:  ['chromium'],
  }),

  ...makeProjects('compliance-v2', './apps/compliance/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'firefox', 'edge'],
    ia:   ['chromium'],
    dev:  ['chromium'],
  }),

  ...makeProjects('orange', './apps/orange/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'edge'],
    ia:   ['chromium'],
  }),

  ...makeProjects('keycloak', './apps/keycloak/tests', {
    ua:   ['chromium', 'firefox', 'edge'],
    prod: ['chromium'],
  }),

  ...makeProjects('releve-conso', './apps/releve-conso/tests', {
    ua:   ['chromium', 'firefox', 'edge'],
    prod: ['chromium', 'edge'],
    ia:   ['chromium'],
  }),

];

module.exports = { matrix };
