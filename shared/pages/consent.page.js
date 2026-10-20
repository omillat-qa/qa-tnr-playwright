'use strict';

// shared/pages/consent.page.js
// Gestion des bandeaux cookies — commun à toutes les apps

/**
 * Accepte le bandeau cookies s'il est visible.
 * Silencieux si aucun bandeau n'est présent.
 * @param {import('@playwright/test').Page} page
 */
async function acceptAnyCookieBanner(page, { timeout = 5000 } = {}) {
  // Le bandeau s'affiche souvent après une redirection (Keycloak → app) : on attend son apparition.
  // isVisible() n'attend pas (son option timeout est ignorée) → waitFor sur un locator combiné.
  const bouton = page.getByTestId('acceptCookiesBtn')
    .or(page.locator('#acceptCookiesBtn'))
    .or(page.getByRole('button', { name: /^\s*(j['’]accepte|accepter|accept)\s*$/i }))
    .first();
  try {
    await bouton.waitFor({ state: 'visible', timeout });
    await bouton.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;   // pas de bandeau = normal
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
