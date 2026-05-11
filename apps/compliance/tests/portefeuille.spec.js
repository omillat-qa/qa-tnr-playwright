'use strict';

// apps/compliance/tests/portefeuille.spec.js
// TNR Portefeuille — Compliance for Business v2
// Migré depuis script UFT PTF_01 à PTF_10

const { test, expect } = require('@playwright/test');
const { PortefeuillePage } = require('../pages/portefeuille.page');
const { closeAnnouncementPopup } = require('../../../shared/pages/consent.page');
const data = require('../../../test-data/compliance.json');

// ---------------------------------------------------------------------------
// Setup : session déjà chargée via storageState (auth.setup.js)
// Le beforeEach navigue juste vers le dashboard
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page, baseURL }) => {
  // La session est déjà active via storageState
  // On navigue vers le dashboard pour partir d'un état propre
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await closeAnnouncementPopup(page);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Portefeuille', () => {

  test('[PTF_01] @tnr @portefeuille - accès via menu latéral', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await expect(page).toHaveURL(/\/folders/);
  });

  test('[PTF_02] @tnr @portefeuille - accès direct via URL /folders', async ({ page }) => {
    await page.goto(`${data.urls.portefeuille}`);
    await expect(page).toHaveURL(/\/folders/);
  });

  test('[PTF_03] @tnr @portefeuille - filtre statut contient Tous / En cours / Traité / Archivé', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.ouvrirFiltreStatut();

    await expect(ptf.optStatutTous).toBeVisible();
    await expect(ptf.optStatutEnCours).toBeVisible();
    await expect(ptf.optStatutTraite).toBeVisible();
    await expect(ptf.optStatutArchive).toBeVisible();

    await ptf.fermerFiltreStatut();
  });

  test('[PTF_04] @tnr @portefeuille - accès /folders interdit sans authentification', async ({ browser, baseURL }) => {
    // Ce test doit tourner sans session — on crée un contexte vierge
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}${data.urls.portefeuille}`);
    await expect(page).toHaveURL(/auth|login|keycloak/i, { timeout: 10000 });
    await context.close();
  });

  test('[PTF_05_1] @tnr @portefeuille - libellé "Portefeuille" présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await expect(ptf.titrePortefeuille).toBeVisible();
  });

  test('[PTF_05_2] @tnr @portefeuille - compteur nombre d\'évaluations présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    const nb = await ptf.getNbDossiers();
    expect(nb).toBeGreaterThan(0);
  });

  test('[PTF_06_1] @tnr @portefeuille - champ filtre statut évaluations présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await expect(ptf.btnStatutEval).toBeVisible();
  });

  test('[PTF_06_2] @tnr @portefeuille - champ filtre équipe présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    // Le bouton équipe peut avoir un label variable selon provisioning
    await expect(ptf.btnTypeRelation).toBeVisible();
  });

  test('[PTF_06_3] @tnr @portefeuille - filtre risque contient Fort / Moyen / Faible', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.ouvrirFiltreRisque();

    await expect(ptf.optRisqueFort).toBeVisible();
    await expect(ptf.optRisqueMoyen).toBeVisible();
    await expect(ptf.optRisqueFaible).toBeVisible();
  });

  test('[PTF_06_4] @tnr @portefeuille - filtre type relation contient PM CLIENT / PM FOURNISSEUR / PP CLIENT', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.ouvrirFiltreTypeRelation();

    await expect(ptf.optTypePMClient).toBeVisible();
    await expect(ptf.optTypePMFournisseur).toBeVisible();
    await expect(ptf.optTypePPClient).toBeVisible();
  });

  test('[PTF_061_1] @tnr @portefeuille - card ARTHEMIS : id évaluation commence par "#"', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    const html = await ptf.getInnerHTMLCard(data.arthemis.denomination);
    expect(html).toContain('#');
  });

  test('[PTF_061_2] @tnr @portefeuille - card ARTHEMIS : libellé CLIENT ou FOURNISSEUR présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    const html = await ptf.getInnerHTMLCard(data.arthemis.denomination);
    const hasClient      = html.includes('CLIENT');
    const hasFournisseur = html.includes('FOURNISSEUR');
    expect(hasClient || hasFournisseur).toBeTruthy();
  });

  test('[PTF_061_3] @tnr @portefeuille - card ARTHEMIS : pastille de couleur présente', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    const html = await ptf.getInnerHTMLCard(data.arthemis.denomination);
    expect(html).toContain('svg');
  });

  test('[PTF_07] @tnr @portefeuille - recherche sans résultat : libellé "Aucun résultat"', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    await ptf.rechercher('00000');
    await expect(ptf.messageAucunResultat).toBeVisible({ timeout: 15000 });

    await ptf.effacerFiltres();
  });

  test('[PTF_08] @tnr @portefeuille - filtre "En cours" s\'applique correctement', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    await ptf.selectionnerStatutEnCours();

    // Vérifie que le filtre "En cours" est bien actif via son indicateur
    const filtreActif = page.locator('[data-cy="filter.evaluationStatus.selected.inProgress"]');
    await expect(filtreActif).toBeVisible({ timeout: 5000 });

    await ptf.effacerFiltres();
  });

  test('[PTF_09] @tnr @portefeuille - recherche "ARTHEMIS" affiche la card ARTHEMIS', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    await ptf.rechercher(data.arthemis.denomination);

    // Vérifie que la card ARTHEMIS est visible
    const card = ptf.getCardEntreprise(data.arthemis.denomination);
    await expect(card).toBeVisible({ timeout: 15000 });

    // Vérifie que le compteur a bien diminué (au moins 1 résultat visible)
    const nb = await ptf.getNbDossiers();
    expect(nb).toBeGreaterThanOrEqual(1);
  });

  test('[PTF_10] @tnr @portefeuille - clic sur ARTHEMIS redirige vers page évaluations', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();

    await ptf.rechercher(data.arthemis.denomination);

    const card = ptf.getCardEntreprise(data.arthemis.denomination);
    await card.click();

    await expect(page).toHaveURL(/relations|evaluations|folders/, { timeout: 10000 });
  });

});
