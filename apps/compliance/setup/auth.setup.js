'use strict';

// apps/compliance/setup/auth.setup.js
// Login unique Compliance for Business — session sauvegardée dans .auth/
// Fonctionne pour UA et PROD via les variables d'env TNR_CFB_[ENV]_USERNAME/PASSWORD

const { test: setup } = require('@playwright/test');
const path = require('path');
const { openLoginForm, submitCredentials } = require('../../../shared/pages/keycloak.page');
const { acceptAnyCookieBanner, closeAnnouncementPopup } = require('../../../shared/pages/consent.page');

setup('authentification CFB', async ({ page, baseURL }, testInfo) => {
  const env = (testInfo.project.metadata.env || 'ua').toUpperCase();

  const username = process.env[`TNR_CFB_${env}_USERNAME`];
  const password = process.env[`TNR_CFB_${env}_PASSWORD`];

  if (!username || !password)
    throw new Error(
      `[auth.setup] TNR_CFB_${env}_USERNAME ou TNR_CFB_${env}_PASSWORD non défini dans .env`
    );

  // Chemin du fichier de session — un par env
  const SESSION_FILE = path.resolve(__dirname, `../../../.auth/cfb-${env.toLowerCase()}.json`);

  // Login Keycloak
  await openLoginForm(page, baseURL);
  await submitCredentials(page, { username, password });

  // Attendre le dashboard
  await page.waitForURL('**/dashboard**', { timeout: 15000 });

  // Gérer cookies et popup
  await acceptAnyCookieBanner(page);
  await closeAnnouncementPopup(page);

  // Sauvegarder la session
  await page.context().storageState({ path: SESSION_FILE });
  console.log(`[auth.setup] Session CFB ${env} sauvegardée : ${SESSION_FILE}`);
});
