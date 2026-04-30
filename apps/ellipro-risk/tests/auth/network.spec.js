'use strict';

// apps/ellipro-risk/tests/auth/network.spec.js
// Tests réseau sur la page de login Keycloak
// Isolé dans son propre fichier car nécessite un helper spécifique

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Mini network guard inline — à extraire dans shared/utils/ si réutilisé ailleurs
// ---------------------------------------------------------------------------

function installNetworkGuard(page, { includeUrl = [], includeResourceTypes = new Set(), failStatus = new Set([404]) } = {}) {
  const issues = [];

  page.on('response', (response) => {
    const url = response.url();
    const type = response.request().resourceType();
    const status = response.status();

    const urlMatch = includeUrl.length === 0 || includeUrl.some(r => r.test(url));
    const typeMatch = includeResourceTypes.size === 0 || includeResourceTypes.has(type);
    const statusMatch = failStatus.has(status);

    if (urlMatch && typeMatch && statusMatch) {
      issues.push({ url, type, status });
    }
  });

  return {
    assertNoIssues() {
      if (issues.length > 0) {
        const details = issues.map(i => `  [${i.status}] ${i.type} — ${i.url}`).join('\n');
        throw new Error(`Network guard: ${issues.length} requête(s) en erreur :\n${details}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Auth Keycloak - réseau', () => {

  test('[R_013] @tnr @auth - aucune ressource CSS en 404 au chargement', async ({ page, baseURL }, testInfo) => {
    const guard = installNetworkGuard(page, {
      includeUrl: [/fonts\.css(\?|$)/i],
      includeResourceTypes: new Set(['stylesheet']),
      failStatus: new Set([404]),
    });

    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#kc-form-login')).toBeVisible();

    guard.assertNoIssues();
  });

});
