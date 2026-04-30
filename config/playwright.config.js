// config/playwright.config.js
// Configuration principale Playwright
// La matrice browsers/envs/apps est dans apps.matrix.js

'use strict';

const { defineConfig } = require('@playwright/test');
const { matrix } = require('./apps.matrix');

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

  // Reporter : HTML natif Playwright uniquement
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],   // output console lisible pour Jenkins
  ],

  globalSetup: './config/global-setup.js',

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
