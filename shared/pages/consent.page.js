'use strict';

// shared/pages/consent.page.js
// Gestion des bandeaux cookies — commun à toutes les apps

/**
 * Accepte le bandeau cookies s'il est visible.
 * Silencieux si aucun bandeau n'est présent.
 * @param {import('@playwright/test').Page} page
 */
async function acceptAnyCookieBanner(page) {
  const selectors = [
    '#acceptCookiesBtn',
    '#qcCmpButtons #acceptCookiesBtn',
    '#qcCmpUi button#acceptCookiesBtn',
    'button:has-text("J\'accepte")',
    'button:has-text("Accepter")',
    'button:has-text("Accept")',
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
        break;
      }
    } catch {
      // Silencieux — pas de bandeau = normal
    }
  }
}

module.exports = { acceptAnyCookieBanner };
