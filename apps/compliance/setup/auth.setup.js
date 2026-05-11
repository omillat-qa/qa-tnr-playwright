'use strict';

// apps/compliance/setup/auth.setup.js
// Login unique Compliance for Business v2 — session sauvegardée dans .auth/
// Ce fichier est exécuté UNE SEULE FOIS avant tous les tests compliance-v2

const { test: setup } = require('@playwright/test');
const path = require('path');
const { openLoginForm, submitCredentials } = require('../../../shared/pages/keycloak.page');
const { acceptAnyCookieBanner, closeAnnouncementPopup } = require('../../../shared/pages/consent.page');

// Chemin du fichier de session — dans .auth/ à la racine du projet
const SESSION_FILE = path.resolve(__dirname, '../../../.auth/cfb-v2.json');

setup('authentification CFB v2', async ({ page, baseURL }) => {
  const username = process.env.TNR_CFB_USERNAME;
  const password = process.env.TNR_CFB_PASSWORD;

  if (!username || !password)
    throw new Error('[auth.setup] TNR_CFB_USERNAME ou TNR_CFB_PASSWORD non défini dans .env');

  // Login Keycloak
  await openLoginForm(page, baseURL);
  await submitCredentials(page, { username, password });

  // Attendre le dashboard
  await page.waitForURL('**/dashboard**', { timeout: 15000 });

  // Gérer cookies et popup
  await acceptAnyCookieBanner(page);
  await closeAnnouncementPopup(page);

  // Sauvegarder la session (cookies + localStorage)
  await page.context().storageState({ path: SESSION_FILE });

  console.log(`[auth.setup] Session CFB v2 sauvegardée : ${SESSION_FILE}`);
});
