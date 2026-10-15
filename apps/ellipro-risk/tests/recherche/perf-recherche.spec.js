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
  // Racine de l'app : Angular redirige vers l'accueil (route renommée en v1.36.17.1)
  await page.goto(`${baseURL}/AppEllipro/`,
    { waitUntil: 'domcontentloaded' });

  // Bandeau cookies : il s'affiche après la redirection Keycloak, on attend donc
  // le premier élément visible (bandeau OU champ). isVisible() n'attend pas.
  const recherche  = new RecherchePage(page);
  const btnCookies = page.getByTestId('acceptCookiesBtn')
    .or(page.locator('#acceptCookiesBtn, button:has-text("J\'ACCEPTE")')).first();
  await btnCookies.or(recherche.champRecherche).first().waitFor({ state: 'visible', timeout: 15000 });
  if (await btnCookies.isVisible()) {
    await btnCookies.click();
    await page.waitForTimeout(300);
  }

  await recherche.champRecherche.waitFor({ state: 'visible', timeout: 15000 });
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
