'use strict';

// apps/compliance/setup/auth.setup.js
// Login unique Compliance for Business — session sauvegardée dans .auth/
// Supporte tous les profils : admin, collab, referent, noparam
// Le profil est défini dans metadata.profil du projet dans apps.matrix.js

const { test: setup } = require('@playwright/test');
const path = require('path');
const { openLoginForm, submitCredentials } = require('../../../shared/pages/keycloak.page');
const { acceptAnyCookieBanner, closeAnnouncementPopup } = require('../../../shared/pages/consent.page');

setup('authentification CFB', async ({ page, baseURL }, testInfo) => {
  const env    = (testInfo.project.metadata.env    || 'ua').toUpperCase();
  const profil = (testInfo.project.metadata.profil || 'admin').toUpperCase();

  const usernameKey = `TNR_CFB_${env}_${profil}_USERNAME`;
  const passwordKey = `TNR_CFB_${env}_${profil}_PASSWORD`;

  const username = process.env[usernameKey];
  const password = process.env[passwordKey];

  if (!username || !password)
    throw new Error(
      `[auth.setup] ${usernameKey} ou ${passwordKey} non défini dans .env`
    );

  const SESSION_FILE = path.resolve(
    __dirname,
    `../../../.auth/cfb-${env.toLowerCase()}-${profil.toLowerCase()}.json`
  );

  await openLoginForm(page, baseURL);
  await submitCredentials(page, { username, password });

  // Profil noparam → redirige vers /notconfigured au lieu de /dashboard
  if (profil === 'NOPARAM') {
    await page.waitForURL('**/notconfigured**', { timeout: 15000 });
  } else {
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await acceptAnyCookieBanner(page);
    await closeAnnouncementPopup(page);
  }

  await page.context().storageState({ path: SESSION_FILE });
  console.log(`[auth.setup] Session CFB ${env} ${profil} sauvegardée : ${SESSION_FILE}`);
});
