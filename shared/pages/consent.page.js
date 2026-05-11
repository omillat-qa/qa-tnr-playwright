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
    'button:has-text("J\'ACCEPTE")',   // Compliance for Business (majuscules)
    'button:has-text("J\'accepte")',
    'button:has-text("Accepter")',
    'button:has-text("Accept")',
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      // Silencieux — pas de bandeau = normal
    }
  }
}

/**
 * Ferme la popup d'annonce si présente (bouton FERMER)
 * Compliance for Business affiche parfois une popup d'actualité après login
 * @param {import('@playwright/test').Page} page
 */
async function closeAnnouncementPopup(page) {
  try {
    const btn = page.getByRole('button', { name: 'FERMER' }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  } catch {
    // Silencieux — pas de popup = normal
  }
}

module.exports = { acceptAnyCookieBanner, closeAnnouncementPopup };
