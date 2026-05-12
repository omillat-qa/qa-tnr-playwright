'use strict';

// apps/compliance/tests/perf-recherche.spec.js
// Tests de performance recherche Solr — Compliance for Business v2
// URL cible : /evaluation/new

const { test, expect } = require('@playwright/test');
const { RechercheCompliancePage } = require('../pages/recherche.page');
const { closeAnnouncementPopup } = require('../../../shared/pages/consent.page');
const motscles = require('../../../test-data/motscles-recherche.json');

// ---------------------------------------------------------------------------
// Setup : session déjà chargée via storageState (auth.setup.js)
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page, baseURL }) => {
  // Aller directement sur la page de recherche d'évaluation
  await page.goto(`${baseURL}/evaluation/new`, { waitUntil: 'domcontentloaded' });

  // Fermer la popup d'annonce si présente
  await closeAnnouncementPopup(page);

  // Attendre le champ de recherche
  await page.locator('[data-cy="evaluation.search.pm"]').waitFor({ state: 'visible', timeout: 15000 });
});

// ---------------------------------------------------------------------------
// Tests de performance — un test par mot-clé
// ---------------------------------------------------------------------------

test.describe('Performance Recherche Solr', () => {

  for (const motCle of motscles.motscles) {

    test(`[PERF] recherche "${motCle}"`, async ({ page }, testInfo) => {
      const env = testInfo.project.metadata.env || 'ua';

      const recherche = new RechercheCompliancePage(page);
      const { statut } = await recherche.rechercherEtMesurer(motCle, {
        app: 'compliance-v2',
        env,
      });

      if (statut === 'timeout') {
        console.warn(`⚠️ Timeout pour "${motCle}"`);
      }

      expect(['ok', 'vide']).toContain(statut);

      await page.waitForTimeout(1000);
    });
  }

});
