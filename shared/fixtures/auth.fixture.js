'use strict';

// shared/fixtures/auth.fixture.js
// Fixture Playwright étendue — setup d'authentification mutualisé
// Usage dans les specs : const { test } = require('../../shared/fixtures/auth.fixture');

const { test: base } = require('@playwright/test');
const { openLoginForm, submitCredentials } = require('../pages/keycloak.page');
const { acceptAnyCookieBanner } = require('../pages/consent.page');
const { ajouterLog } = require('../utils/logger');

/**
 * Fixture "authenticatedPage" :
 * Fournit une page déjà connectée via Keycloak.
 * Les credentials sont lus depuis les variables d'environnement.
 *
 * Usage :
 *   const { test } = require('../../shared/fixtures/auth.fixture');
 *   test('mon test', async ({ authenticatedPage }) => { ... });
 */
const test = base.extend({
  authenticatedPage: async ({ page, baseURL }, use) => {
    const username = process.env.TNR_USERNAME;
    const password = process.env.TNR_PASSWORD;

    if (!username || !password) {
      throw new Error(
        '[auth.fixture] TNR_USERNAME ou TNR_PASSWORD non défini.\n' +
        'Vérifiez votre fichier .env ou les credentials Jenkins.'
      );
    }

    await acceptAnyCookieBanner(page);
    await openLoginForm(page, baseURL);
    await submitCredentials(page, { username, password });

    ajouterLog(`Connecté en tant que ${username}`, 'auth.fixture', 'success');

    await use(page);
  },
});

const { expect } = base;

module.exports = { test, expect };
