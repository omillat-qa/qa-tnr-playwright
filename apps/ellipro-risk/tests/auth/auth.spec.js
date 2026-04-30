'use strict';

// apps/ellipro-risk/tests/auth/auth.spec.js
// TNR Authentification Keycloak — Ellipro (Risk + Mod + Déc)
// Migré depuis auth_tnr.spec.js — CommonJS, sans Allure, IDs fonctionnels ajoutés

const { test, expect } = require('@playwright/test');
const {
  openLoginForm,
  ensureLanguage,
  submitCredentials,
  expectInvalidCredentialsMessage,
  expectFormErrors,
  goToForgotPassword,
  expectLoginLabels,
  expectLoginLabelsStrict,
  expectFooterLinksFR,
  getCurrentLocale,
  attachScreenshot,
} = require('../../../../shared/pages/keycloak.page');

test.describe('Auth Keycloak', () => {

  test.beforeEach(async ({ page, baseURL }, testInfo) => {
    await openLoginForm(page, baseURL, testInfo);
  });

  // -------------------------------------------------------------------------
  // Identifiants / erreurs
  // -------------------------------------------------------------------------

  test('[R_001] @tnr @auth - identifiants invalides : message erreur FR/EN', async ({ page }, testInfo) => {
    const login = process.env.TNR_USERNAME;
    await submitCredentials(page, { username: login, password: 'wrong-password-123!' });
    await expectInvalidCredentialsMessage(page, testInfo);
  });

  test('[R_002] @tnr @auth - langue EN : message erreur en anglais', async ({ page }, testInfo) => {
    const login = process.env.TNR_USERNAME;
    await ensureLanguage(page, 'en', testInfo);
    await submitCredentials(page, { username: login, password: 'wrong-password-123!' });
    const enMsg = page.locator('text=/Invalid username or password/i').first();
    try {
      await enMsg.waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      await attachScreenshot(page, testInfo, 'invalid-credentials-EN-not-found');
      throw e;
    }
  });

  test('[R_003] @tnr @auth - champs vides : erreurs visibles', async ({ page }, testInfo) => {
    await submitCredentials(page, { username: '', password: '' });
    await expectFormErrors(page, testInfo);
  });

  // -------------------------------------------------------------------------
  // Mot de passe oublié
  // -------------------------------------------------------------------------

  test('[R_004] @tnr @auth - mot de passe oublié : navigation vers page reset', async ({ page }, testInfo) => {
    await goToForgotPassword(page, testInfo);
    const submitBtn = page.locator('button:has-text("Envoyer"), button:has-text("Submit")').first();
    try {
      await expect(submitBtn).toBeVisible({ timeout: 10000 });
    } catch (e) {
      await attachScreenshot(page, testInfo, 'forgot-submit-not-found');
      throw e;
    }
  });

  test('[R_005] @tnr @auth - lien retour connexion : libellé FR strict', async ({ page }, testInfo) => {
    await goToForgotPassword(page, testInfo);
    await ensureLanguage(page, 'fr', testInfo);
    const link = page.locator('a:has-text("Retour à la connexion")').first();
    try {
      await expect(link).toHaveText('Retour à la connexion');
    } catch (e) {
      await attachScreenshot(page, testInfo, 'retour-label-incorrect');
      throw e;
    }
  });

  test('[R_006] @tnr @auth - lien retour connexion : libellé EN strict', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'en', testInfo);
    await goToForgotPassword(page, testInfo);
    const link = page.locator('a:has-text("Back to Login")').first();
    try {
      await expect(link).toHaveText('Back to Login');
    } catch (e) {
      await attachScreenshot(page, testInfo, 'back-label-en-incorrect');
      throw e;
    }
  });

  // -------------------------------------------------------------------------
  // Libellés i18n (tolérants)
  // -------------------------------------------------------------------------

  test('[R_007] @tnr @auth - libellés FR (bascule au besoin)', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'fr', testInfo);
    await expectLoginLabels(page, 'fr', testInfo);
  });

  test('[R_008] @tnr @auth - libellés EN (bascule au besoin)', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'en', testInfo);
    await expectLoginLabels(page, 'en', testInfo);
  });

  // -------------------------------------------------------------------------
  // Libellés i18n (stricts NR)
  // -------------------------------------------------------------------------

  test('[R_009] @tnr @auth - libellés FR STRICTS (détecte Email vs E-mail)', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'fr', testInfo);
    await expectLoginLabelsStrict(page, 'fr', testInfo);
  });

  test('[R_010] @tnr @auth - libellés EN STRICTS', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'en', testInfo);
    await expectLoginLabelsStrict(page, 'en', testInfo);
  });

  // -------------------------------------------------------------------------
  // Footer
  // -------------------------------------------------------------------------

  test('[R_011] @tnr @auth - footer FR : ordre et href exacts', async ({ page }, testInfo) => {
    await ensureLanguage(page, 'fr', testInfo);
    await expectFooterLinksFR(page, testInfo);
  });

  // -------------------------------------------------------------------------
  // Bascule de langue dynamique
  // -------------------------------------------------------------------------

  test('[R_012] @tnr @auth - bascule langue FR ⇄ EN ⇄ FR', async ({ page }, testInfo) => {
    const before = (await getCurrentLocale(page)) || 'fr';
    const target = before.startsWith('fr') ? 'en' : 'fr';
    await ensureLanguage(page, target, testInfo);
    await expectLoginLabels(page, target, testInfo);
    await ensureLanguage(page, before, testInfo);
    await expectLoginLabels(page, before, testInfo);
  });

});
