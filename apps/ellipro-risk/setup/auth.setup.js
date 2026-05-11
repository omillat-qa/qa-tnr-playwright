'use strict';

// apps/ellipro-risk/setup/auth.setup.js
// Login unique Ellipro Risk — session sauvegardée dans .auth/
// Fonctionne pour UA et PROD via les variables d'env TNR_ELLIPRO_[ENV]_USERNAME/PASSWORD

const { test: setup } = require('@playwright/test');
const path = require('path');
const { openLoginForm, submitCredentials } = require('../../../shared/pages/keycloak.page');
const { acceptAnyCookieBanner } = require('../../../shared/pages/consent.page');

setup('authentification Ellipro Risk', async ({ page, baseURL }, testInfo) => {
  const env = (testInfo.project.metadata.env || 'ua').toUpperCase();

  const username = process.env[`TNR_ELLIPRO_${env}_USERNAME`];
  const password = process.env[`TNR_ELLIPRO_${env}_PASSWORD`];

  if (!username || !password)
    throw new Error(
      `[auth.setup] TNR_ELLIPRO_${env}_USERNAME ou TNR_ELLIPRO_${env}_PASSWORD non défini dans .env`
    );

  const SESSION_FILE = path.resolve(__dirname, `../../../.auth/ellipro-risk-${env.toLowerCase()}.json`);

  await acceptAnyCookieBanner(page);
  await openLoginForm(page, baseURL);
  await submitCredentials(page, { username, password });

  await page.waitForURL('**/AppEllipro/navigation/**', { timeout: 15000 });

  await page.context().storageState({ path: SESSION_FILE });
  console.log(`[auth.setup] Session Ellipro Risk ${env} sauvegardée : ${SESSION_FILE}`);
});
