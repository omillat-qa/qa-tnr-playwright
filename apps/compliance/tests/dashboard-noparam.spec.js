'use strict';

// apps/compliance/tests/dashboard-noparam.spec.js
// Tests ACC_NOPARAM — compte non paramétré Compliance for Business v2
// Projet : tnr-chromium-ua-noparam-compliance-v2

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/dashboard.page');

// ---------------------------------------------------------------------------
// Setup : session chargée via storageState noparam
// Le compte noparam atterrit sur /notconfigured après login
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page, baseURL }) => {
  // Naviguer vers dashboard — sera redirigé vers /notconfigured
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
});

// ===========================================================================
// TESTS COMPTE NON PARAMÉTRÉ
// ===========================================================================

test.describe('Dashboard non paramétré', () => {

  test('[ACC_NOPARAM_01] @tnr @dashboard - compte non paramétré : redirige vers /notconfigured', async ({ page }) => {
    await expect(page).toHaveURL(/notconfigured/, { timeout: 10000 });
  });

  test('[ACC_NOPARAM_02] @tnr @dashboard - compte non paramétré : message "Absence de paramétrage" présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.titreAbsenceParametrage).toBeVisible({ timeout: 10000 });
    const texte = await dashboard.titreAbsenceParametrage.innerText();
    expect(texte).toContain('Absence de paramétrage');
  });

  test('[ACC_NOPARAM_03] @tnr @dashboard - compte non paramétré : message explicatif présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.messageAbsenceParametrage).toBeVisible();
    const texte = await dashboard.messageAbsenceParametrage.innerText();
    expect(texte).toContain('pas encore paramétré');
  });

  test('[ACC_NOPARAM_04] @tnr @dashboard - compte non paramétré : bouton "Se déconnecter" présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.btnSeDeconnecter).toBeVisible();
  });

});
