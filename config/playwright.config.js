// config/playwright.config.js
// Configuration principale Playwright
// La matrice browsers/envs/apps est dans apps.matrix.js

'use strict';

const path           = require('path');
const { defineConfig } = require('@playwright/test');
const { matrix }     = require('./apps.matrix');
const { dossierRun } = require('./sorties');
const RUN_DIR        = dossierRun();   // test-output\runs\run-xxx (NAS ou local, cf. sorties.js)

module.exports = defineConfig({

  // Point d'entrée : playwright cherche les tests via la matrice
  // (chaque projet définit son propre testDir)
  testDir: './apps',

  timeout: 60_000,

  // En CI : 1 retry pour absorber les faux positifs visuels
  retries: process.env.CI ? 1 : 0,

  // Parallélisme : désactivé par défaut pour la stabilité TNR
  // Activer en CI si les envs le permettent
  workers: process.env.CI ? 2 : 1,

  // Reporter : HTML natif Playwright + reporter TNR custom
  reporter: [
    // --list : pas de rapport HTML (sinon dossier de run fantôme sur le NAS)
    ...(process.argv.includes('--list') ? [] : [['html', { open: 'never', outputFolder: path.join(RUN_DIR, 'rapport-html') }]]),
    ['list'],
    [require.resolve('../shared/reporter/tnr-reporter.js')],
  ],

  globalSetup: require.resolve('./global-setup.js'),

  // Traces / screenshots d'échec : un dossier par run (plus écrasés au run suivant)
  outputDir: path.join(RUN_DIR, 'test-results'),

  // Options screenshot/assertions
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    },
    timeout: 10_000,
  },

  use: {
    // Screenshots uniquement en cas d'échec
    screenshot: 'only-on-failure',
    // Trace uniquement en cas d'échec (ouvrable dans Playwright Trace Viewer)
    trace: 'retain-on-failure',
    // Vidéo désactivée par défaut (trop lourd)
    video: 'off',
  },

  // Projets générés depuis la matrice apps.matrix.js
  projects: matrix,

});
