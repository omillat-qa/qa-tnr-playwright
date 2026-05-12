'use strict';

// config/apps.matrix.js
// Matrice : quels browsers sur quels envs pour chaque app
// C'est ici qu'on décide la couverture — pas dans playwright.config.js

const path   = require('path');
const ROOT   = path.resolve(__dirname, '..');
const { getUrl } = require('./environments');

// Fichiers de session storageState
const AUTH = {
  'cfb-ua':            path.join(ROOT, '.auth/cfb-ua.json'),
  'cfb-prod':          path.join(ROOT, '.auth/cfb-prod.json'),
  'ellipro-risk-ua':   path.join(ROOT, '.auth/ellipro-risk-ua.json'),
  'ellipro-risk-prod': path.join(ROOT, '.auth/ellipro-risk-prod.json'),
};

// Définition des browsers disponibles
const BROWSERS = {
  chromium: { browserName: 'chromium' },
  firefox:  { browserName: 'firefox' },
  edge:     { channel: 'msedge' },
  webkit:   { browserName: 'webkit' },
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
 */
function makeProjects(app, testDir, matrix) {
  const projects = [];
  for (const [env, browsers] of Object.entries(matrix)) {
    for (const browser of browsers) {
      projects.push({
        name: `${browser}-${env}-${app}`,
        testDir: path.join(ROOT, testDir),
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

const matrix = [

  // ----------------------------------------------------------
  // SETUP COMPLIANCE v2
  // ----------------------------------------------------------

  {
    name: 'setup-cfb-v2-ua',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
    },
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium' },
  },

  {
    name: 'setup-cfb-v2-prod',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'prod'),
    },
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'chromium' },
  },

  // ----------------------------------------------------------
  // SETUP ELLIPRO RISK
  // ----------------------------------------------------------

  {
    name: 'setup-ellipro-risk-ua',
    testDir: path.join(ROOT, 'apps/ellipro-risk/setup'),
    testMatch: '**/*.setup.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('ellipro-risk', 'ua'),
    },
    metadata: { app: 'ellipro-risk', env: 'ua', browser: 'chromium' },
  },

  {
    name: 'setup-ellipro-risk-prod',
    testDir: path.join(ROOT, 'apps/ellipro-risk/setup'),
    testMatch: '**/*.setup.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('ellipro-risk', 'prod'),
    },
    metadata: { app: 'ellipro-risk', env: 'prod', browser: 'chromium' },
  },

  // ----------------------------------------------------------
  // ELLIPRO RISK — TNR
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // ELLIPRO RISK — PERF RECHERCHE SOLR
  // ----------------------------------------------------------

  {
    name: 'perf-recherche-ellipro-risk-ua',
    testDir: path.join(ROOT, 'apps/ellipro-risk/tests/recherche'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('ellipro-risk', 'ua'),
      storageState: AUTH['ellipro-risk-ua'],
    },
    dependencies: ['setup-ellipro-risk-ua'],
    metadata: { app: 'ellipro-risk', env: 'ua', browser: 'chromium' },
  },

  {
    name: 'perf-recherche-ellipro-risk-prod',
    testDir: path.join(ROOT, 'apps/ellipro-risk/tests/recherche'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('ellipro-risk', 'prod'),
      storageState: AUTH['ellipro-risk-prod'],
    },
    dependencies: ['setup-ellipro-risk-prod'],
    metadata: { app: 'ellipro-risk', env: 'prod', browser: 'chromium' },
  },

  // ----------------------------------------------------------
  // COMPLIANCE v1
  // ----------------------------------------------------------

  ...makeProjects('compliance-v1', './apps/compliance/tests', {
    ua:   ['chromium', 'firefox', 'edge', 'webkit'],
    prod: ['chromium', 'firefox', 'edge'],
    ia:   ['chromium'],
    dev:  ['chromium'],
  }),

  // ----------------------------------------------------------
  // COMPLIANCE v2 UA — TNR
  // ----------------------------------------------------------

  {
    name: 'chromium-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-cfb-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium' },
  },
  {
    name: 'firefox-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'firefox',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-cfb-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'firefox' },
  },
  {
    name: 'edge-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      channel: 'msedge',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-cfb-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'edge' },
  },
  {
    name: 'webkit-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'webkit',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-cfb-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'webkit' },
  },

  // ----------------------------------------------------------
  // COMPLIANCE v2 PROD — TNR
  // ----------------------------------------------------------

  {
    name: 'chromium-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-cfb-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'chromium' },
  },
  {
    name: 'firefox-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'firefox',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-cfb-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'firefox' },
  },
  {
    name: 'edge-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      channel: 'msedge',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-cfb-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'edge' },
  },

  // ----------------------------------------------------------
  // COMPLIANCE v2 — PERF RECHERCHE SOLR
  // ----------------------------------------------------------

  {
    name: 'perf-recherche-compliance-v2-ua',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-cfb-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium' },
  },

  {
    name: 'perf-recherche-compliance-v2-prod',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-cfb-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'chromium' },
  },

  // ----------------------------------------------------------
  // ORANGE / KEYCLOAK / RELEVE CONSO
  // ----------------------------------------------------------

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
