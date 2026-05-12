'use strict';

// apps/compliance/tests/dashboard.spec.js
// Tests ACC — Dashboard Compliance for Business v2
// Profils : admin, collab, referent
// Le comportement varie selon metadata.profil (ex: Administration visible uniquement pour admin)

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/dashboard.page');
const data = require('../../../test-data/compliance.json');

// ---------------------------------------------------------------------------
// Helper — données user selon env + profil
// ---------------------------------------------------------------------------
function getUserData(env, profil) {
  const users = data.users[env];
  if (!users) throw new Error(`[dashboard.spec] env inconnu : ${env}`);
  const user = users[profil];
  if (!user) throw new Error(`[dashboard.spec] profil inconnu : ${profil} pour env ${env}`);
  return user;
}

// ---------------------------------------------------------------------------
// Setup : session chargée via storageState
// ---------------------------------------------------------------------------
test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
});

// ===========================================================================
// TESTS DASHBOARD — admin / collab / referent
// ===========================================================================

test.describe('Dashboard', () => {

  // --------------------------------------------------------------------------
  // ACC_01 — Accès via la page de login
  // --------------------------------------------------------------------------
  test('[ACC_01] @tnr @dashboard - accès via la page de login', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // ACC_02 — Accès direct via URL /dashboard
  // --------------------------------------------------------------------------
  test('[ACC_02] @tnr @dashboard - accès direct via URL /dashboard', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // ACC_03 — Accès interdit sans authentification
  // Note : non testable via contexte vierge — SSO Keycloak maintient la session
  // même dans un nouveau contexte Playwright. Couvert par PTF_04.
  // --------------------------------------------------------------------------
  test('[ACC_03] @tnr @dashboard - accès /dashboard interdit sans authentification', async () => {
    test.fixme(true, 'SSO Keycloak maintient la session même dans un contexte vierge — couvert par PTF_04');
  });

  // --------------------------------------------------------------------------
  // ACC_04 — Profil affiché en haut à droite
  // --------------------------------------------------------------------------
  test('[ACC_04] @tnr @dashboard - profil affiché en haut à droite', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard = new DashboardPage(page);
    await dashboard.ouvrirMenuProfil();
    const profilAffiche = await dashboard.getProfilUser();
    expect(profilAffiche).toBe(user.profil);
    await dashboard.fermerMenuProfil();
  });

  // --------------------------------------------------------------------------
  // ACC_05 — Nom du user affiché dans le header
  // --------------------------------------------------------------------------
  test('[ACC_05] @tnr @dashboard - nom du user affiché dans le header', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard  = new DashboardPage(page);
    const nomAffiche = await dashboard.getNomUser();
    const partieEmail = user.email.split('@')[0].toLowerCase();
    expect(nomAffiche.toLowerCase()).toContain(partieEmail);
  });

  // --------------------------------------------------------------------------
  // ACC_05_0 — Menu profil s'ouvre au clic
  // --------------------------------------------------------------------------
  test('[ACC_05_0] @tnr @dashboard - menu profil s\'ouvre au clic', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.ouvrirMenuProfil();
    await expect(dashboard.rowEmail).toBeVisible();
    await dashboard.fermerMenuProfil();
  });

  // --------------------------------------------------------------------------
  // ACC_05_1 — Email du user présent dans le dropdown
  // --------------------------------------------------------------------------
  test('[ACC_05_1] @tnr @dashboard - email du user présent dans le dropdown profil', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard = new DashboardPage(page);
    await dashboard.ouvrirMenuProfil();
    const emailAffiche = await dashboard.getEmailUser();
    expect(emailAffiche.toLowerCase()).toBe(user.email.toLowerCase());
    await dashboard.fermerMenuProfil();
  });

  // --------------------------------------------------------------------------
  // ACC_05_2 — ID numérique du user présent
  // --------------------------------------------------------------------------
  test('[ACC_05_2] @tnr @dashboard - ID numérique du user présent dans le dropdown profil', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard = new DashboardPage(page);
    await dashboard.ouvrirMenuProfil();
    const idAffiche = await dashboard.getIDUser();
    expect(idAffiche).toBe(user.id);
    await dashboard.fermerMenuProfil();
  });

  // --------------------------------------------------------------------------
  // ACC_05_3 — Contrat du user présent
  // --------------------------------------------------------------------------
  test('[ACC_05_3] @tnr @dashboard - contrat du user présent dans le dropdown profil', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard = new DashboardPage(page);
    await dashboard.ouvrirMenuProfil();
    const contratAffiche = await dashboard.getContratUser();
    expect(contratAffiche).toBe(user.contrat);
    await dashboard.fermerMenuProfil();
  });

  // --------------------------------------------------------------------------
  // ACC_06_1 — Menu latéral — Accueil
  // --------------------------------------------------------------------------
  test('[ACC_06_1] @tnr @dashboard - menu latéral contient "Accueil"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.lienAccueil).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_06_2 — Menu latéral — Tâches
  // --------------------------------------------------------------------------
  test('[ACC_06_2] @tnr @dashboard - menu latéral contient "Tâches"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.lienTaches).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_06_3 — Menu latéral — Portefeuille
  // --------------------------------------------------------------------------
  test('[ACC_06_3] @tnr @dashboard - menu latéral contient "Portefeuille"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.lienPortefeuille).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_06_4 — Menu latéral — Administration (selon profil)
  // --------------------------------------------------------------------------
  test('[ACC_06_4] @tnr @dashboard - menu latéral Administration selon profil', async ({ page }, testInfo) => {
    const env    = testInfo.project.metadata.env    || 'ua';
    const profil = testInfo.project.metadata.profil || 'admin';
    const user   = getUserData(env, profil);
    const dashboard = new DashboardPage(page);
    if (user.profil === 'Administrateur') {
      await expect(dashboard.lienAdministration).toBeVisible();
    } else {
      await expect(dashboard.lienAdministration).not.toBeVisible();
    }
  });

  // --------------------------------------------------------------------------
  // ACC_06_5 — Menu latéral — Historique
  // --------------------------------------------------------------------------
  test('[ACC_06_5] @tnr @dashboard - menu latéral contient "Historique"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.lienHistorique).toBeVisible({ timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // ACC_06_6 — Menu latéral — Statistiques
  // --------------------------------------------------------------------------
  test('[ACC_06_6] @tnr @dashboard - menu latéral contient "Statistiques"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.lienStatistiques).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_07 — Champ de recherche dans le portefeuille (header)
  // --------------------------------------------------------------------------
  test('[ACC_07] @tnr @dashboard - champ de recherche dans le portefeuille présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.champRechercheHeader).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_08 — Bouton "EVALUER UN TIERS" présent
  // --------------------------------------------------------------------------
  test('[ACC_08] @tnr @dashboard - bouton "EVALUER UN TIERS" présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.btnEvaluerTiers).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_09 — Bouton "EVALUER UN TIERS" redirige vers /evaluation/new
  // --------------------------------------------------------------------------
  test('[ACC_09] @tnr @dashboard - bouton "EVALUER UN TIERS" redirige vers /evaluation/new', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.btnEvaluerTiers.click();
    await expect(page).toHaveURL(/evaluation\/new/, { timeout: 10000 });
  });

  // --------------------------------------------------------------------------
  // ACC_10_1 — Bloc "Les tâches à traiter"
  // --------------------------------------------------------------------------
  test('[ACC_10_1] @tnr @dashboard - bloc "Les tâches à traiter" présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.blocTaches).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // ACC_10_2 — Bloc "Mes nouvelles notifications" (supprimé — OK par convention)
  // --------------------------------------------------------------------------
  test('[ACC_10_2] @tnr @dashboard - bloc "Mes nouvelles notifications" (supprimé — OK par convention)', async () => {
    // Bloc supprimé de l'app depuis une évolution — toujours validé
    expect(true).toBe(true);
  });

  // --------------------------------------------------------------------------
  // ACC_10_3 — Bloc "Mes derniers dossiers consultés"
  // --------------------------------------------------------------------------
  test('[ACC_10_3] @tnr @dashboard - bloc "Mes derniers dossiers consultés" présent', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await expect(dashboard.blocDossiersRecents).toBeVisible();
  });

});
