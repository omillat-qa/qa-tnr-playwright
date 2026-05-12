'use strict';

// config/apps.matrix.js
// Matrice : quels browsers sur quels envs pour chaque app
// Convention de nommage des projets :
//   setup-[app]-[env]              → ex: setup-compliance-v2-ua
//   tnr-[browser]-[env]-[app]      → ex: tnr-chromium-ua-compliance-v2
//   perf-recherche-[env]-[app]     → ex: perf-recherche-ua-ellipro-risk

const path   = require('path');
const ROOT   = path.resolve(__dirname, '..');
const { getUrl } = require('./environments');

// Fichiers de session storageState
const AUTH = {
  'cfb-ua':              path.join(ROOT, '.auth/cfb-ua-admin.json'),
  'cfb-prod':            path.join(ROOT, '.auth/cfb-prod-admin.json'),
  'cfb-ua-admin':        path.join(ROOT, '.auth/cfb-ua-admin.json'),
  'cfb-prod-admin':      path.join(ROOT, '.auth/cfb-prod-admin.json'),
  'cfb-ua-collab':       path.join(ROOT, '.auth/cfb-ua-collab.json'),
  'cfb-ua-referent':     path.join(ROOT, '.auth/cfb-ua-referent.json'),
  'cfb-ua-noparam':      path.join(ROOT, '.auth/cfb-ua-noparam.json'),
  'ellipro-risk-ua':     path.join(ROOT, '.auth/ellipro-risk-ua.json'),
  'ellipro-risk-prod':   path.join(ROOT, '.auth/ellipro-risk-prod.json'),
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
 * Génère les projets TNR pour une app donnée
 * Nom généré : tnr-[browser]-[env]-[app]
 * @param {string} app        - clé app (ex: 'ellipro-risk')
 * @param {string} testDir    - chemin vers les tests de l'app
 * @param {Object} matrix     - { ua: [...browsers], prod: [...browsers], ... }
 * @param {string} [testMatch] - pattern optionnel pour filtrer les specs
 */
function makeProjects(app, testDir, matrix, testMatch) {
  const projects = [];
  for (const [env, browsers] of Object.entries(matrix)) {
    for (const browser of browsers) {
      const project = {
        name: `tnr-${browser}-${env}-${app}`,
        testDir: path.join(ROOT, testDir),
        use: {
          ...COMMON_USE,
          ...BROWSERS[browser],
          baseURL: getUrl(app, env),
        },
        metadata: { app, env, browser },
      };
      if (testMatch) project.testMatch = testMatch;
      projects.push(project);
    }
  }
  return projects;
}

const matrix = [

  // ----------------------------------------------------------
  // SETUP COMPLIANCE v2 — multi-profil
  // ----------------------------------------------------------

  {
    name: 'setup-compliance-v2-ua',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: { ...COMMON_USE, browserName: 'chromium', baseURL: getUrl('compliance-v2', 'ua') },
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'admin' },
  },
  {
    name: 'setup-compliance-v2-prod',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: { ...COMMON_USE, browserName: 'chromium', baseURL: getUrl('compliance-v2', 'prod') },
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'chromium', profil: 'admin' },
  },
  {
    name: 'setup-compliance-v2-ua-collab',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: { ...COMMON_USE, browserName: 'chromium', baseURL: getUrl('compliance-v2', 'ua') },
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'collab' },
  },
  {
    name: 'setup-compliance-v2-ua-referent',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: { ...COMMON_USE, browserName: 'chromium', baseURL: getUrl('compliance-v2', 'ua') },
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'referent' },
  },
  {
    name: 'setup-compliance-v2-ua-noparam',
    testDir: path.join(ROOT, 'apps/compliance/setup'),
    testMatch: '**/*.setup.js',
    use: { ...COMMON_USE, browserName: 'chromium', baseURL: getUrl('compliance-v2', 'ua') },
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'noparam' },
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
  // tnr-[browser]-[env]-ellipro-risk
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
  // perf-recherche-[env]-ellipro-risk
  // ----------------------------------------------------------

  {
    name: 'perf-recherche-ua-ellipro-risk',
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
    name: 'perf-recherche-prod-ellipro-risk',
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
  // COMPLIANCE v1 — TODO : specs à migrer depuis UFT
  // À décommenter quand les specs v1 seront dans apps/compliance-v1/tests/
  // ----------------------------------------------------------
  // ...makeProjects('compliance-v1', './apps/compliance-v1/tests', { ... })

  // ----------------------------------------------------------
  // COMPLIANCE v2 — TNR DASHBOARD (multi-profil)
  // tnr-chromium-[env]-[profil]-compliance-v2
  // ----------------------------------------------------------

  {
    name: 'tnr-chromium-ua-admin-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/dashboard.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua-admin'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'admin' },
  },
  {
    name: 'tnr-chromium-ua-collab-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/dashboard.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua-collab'],
    },
    dependencies: ['setup-compliance-v2-ua-collab'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'collab' },
  },
  {
    name: 'tnr-chromium-ua-referent-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/dashboard.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua-referent'],
    },
    dependencies: ['setup-compliance-v2-ua-referent'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'referent' },
  },
  {
    name: 'tnr-chromium-ua-noparam-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/dashboard-noparam.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua-noparam'],
    },
    dependencies: ['setup-compliance-v2-ua-noparam'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium', profil: 'noparam' },
  },

  // ----------------------------------------------------------
  // COMPLIANCE v2 — TNR PORTEFEUILLE
  // tnr-[browser]-[env]-compliance-v2
  // ----------------------------------------------------------

  {
    name: 'tnr-chromium-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium' },
  },
  {
    name: 'tnr-firefox-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'firefox',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'firefox' },
  },
  {
    name: 'tnr-edge-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      channel: 'msedge',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'edge' },
  },
  {
    name: 'tnr-webkit-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'webkit',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'webkit' },
  },
  {
    name: 'tnr-chromium-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-compliance-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'chromium' },
  },
  {
    name: 'tnr-firefox-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'firefox',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-compliance-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'firefox' },
  },
  {
    name: 'tnr-edge-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/portefeuille.spec.js',
    use: {
      ...COMMON_USE,
      channel: 'msedge',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-compliance-v2-prod'],
    metadata: { app: 'compliance-v2', env: 'prod', browser: 'edge' },
  },

  // ----------------------------------------------------------
  // COMPLIANCE v2 — PERF RECHERCHE SOLR
  // perf-recherche-[env]-compliance-v2
  // ----------------------------------------------------------

  {
    name: 'perf-recherche-ua-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'ua'),
      storageState: AUTH['cfb-ua'],
    },
    dependencies: ['setup-compliance-v2-ua'],
    metadata: { app: 'compliance-v2', env: 'ua', browser: 'chromium' },
  },

  {
    name: 'perf-recherche-prod-compliance-v2',
    testDir: path.join(ROOT, 'apps/compliance/tests'),
    testMatch: '**/perf-recherche.spec.js',
    use: {
      ...COMMON_USE,
      browserName: 'chromium',
      baseURL: getUrl('compliance-v2', 'prod'),
      storageState: AUTH['cfb-prod'],
    },
    dependencies: ['setup-compliance-v2-prod'],
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
