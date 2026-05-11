'use strict';

// apps/ellipro-risk/tests/recherche/perf-recherche.spec.js
// Tests de performance recherche Solr — Ellipro Risk
// Mesure temps UX + temps POST pour chaque mot-clé
// Résultats dans test-output/metrics.json → Grafana

const { test, expect } = require('@playwright/test');
const { RecherchePage } = require('../../pages/recherche.page');
const motscles = require('../../../../test-data/motscles-recherche.json');

// ---------------------------------------------------------------------------
// Setup : session déjà chargée via storageState (auth.setup.js)
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/AppEllipro/navigation/main-nav/(sideRouter:dashboard)`,
    { waitUntil: 'domcontentloaded' });

  // Gérer le bandeau cookies s'il apparaît
  const btnCookies = page.locator('#acceptCookiesBtn, button:has-text("J\'ACCEPTE")').first();
  if (await btnCookies.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btnCookies.click();
    await page.waitForTimeout(300);
  }

  await page.waitForSelector(
    'input[placeholder="Recherche par raison sociale ou identifiant"]',
    { timeout: 15000 }
  );
});

// ---------------------------------------------------------------------------
// Tests de performance — un test par mot-clé
// ---------------------------------------------------------------------------

test.describe('Performance Recherche Solr', () => {

  // Génère dynamiquement un test par mot-clé
  for (const motCle of motscles.motscles) {

    test(`[PERF] recherche "${motCle}"`, async ({ page }, testInfo) => {
      const env = testInfo.project.metadata.env || 'ua';

      const recherche = new RecherchePage(page);
      const { statut } = await recherche.rechercherEtMesurer(motCle, {
        app: 'ellipro-risk',
        env,
      });

      if (statut === 'timeout') {
        console.warn(`⚠️ Timeout pour "${motCle}" — métrique collectée`);
      }

      expect(['ok', 'vide']).toContain(statut);

      await page.waitForTimeout(1000);
    });
  }

});
