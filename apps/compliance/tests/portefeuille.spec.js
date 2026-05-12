'use strict';

// apps/compliance/tests/portefeuille.spec.js
// TNR Portefeuille — Compliance for Business v2
// Migré depuis script UFT PTF_01 à PTF_10 + PTF_061/062 mode carte & liste

const { test, expect } = require('@playwright/test');
const { PortefeuillePage } = require('../pages/portefeuille.page');
const { closeAnnouncementPopup } = require('../../../shared/pages/consent.page');
const data = require('../../../test-data/compliance.json');

// ---------------------------------------------------------------------------
// Setup : session déjà chargée via storageState (auth.setup.js)
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page, baseURL }) => {
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

  test('[PTF_06_2] @tnr @portefeuille - champ filtre type relation présent', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
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

  // -------------------------------------------------------------------------
  // PTF_061 — Card ARTHEMIS
  //
  // PTF_061_1  : id évaluation #xxxxx visible     → carte uniquement
  //              (absent du DOM en mode liste)
  // PTF_061_2  : CLIENT ou FOURNISSEUR présent    → carte
  // PTF_061_2L : CLIENT ou FOURNISSEUR présent    → liste
  // PTF_061_3  : pastille RED/GREEN/ORANGE         → carte
  // PTF_061_3L : pastille RED/GREEN/ORANGE         → liste
  // -------------------------------------------------------------------------

  test('[PTF_061_1] @tnr @portefeuille - (carte) id évaluation #xxxxx affiché', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueCarte();

    const idEval = ptf.getIdEvaluationCarte(data.arthemis.denomination);
    await expect(idEval).toBeVisible();

    const texte = await idEval.textContent();
    expect(texte.trim()).toMatch(/^#\d+$/);
  });

  test('[PTF_061_2] @tnr @portefeuille - (carte) libellé CLIENT ou FOURNISSEUR affiché', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueCarte();

    const relation = ptf.getRelationTypeCarte(data.arthemis.denomination);
    await expect(relation).toBeVisible();

    const texte = await relation.textContent();
    expect(texte.trim()).toMatch(/^(CLIENT|FOURNISSEUR)$/);
  });

  test('[PTF_061_2L] @tnr @portefeuille - (liste) libellé CLIENT ou FOURNISSEUR affiché', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueListe();

    const relation = ptf.getRelationTypeListe(data.arthemis.denomination);
    await expect(relation).toBeVisible();

    const texte = await relation.textContent();
    expect(texte.trim()).toMatch(/^(CLIENT|FOURNISSEUR)$/);
  });

  test('[PTF_061_3] @tnr @portefeuille - (carte) pastille risque RED/GREEN/ORANGE affichée', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueCarte();

    const pastille = ptf.getPastilleCarte(data.arthemis.denomination);
    await expect(pastille).toBeVisible();

    const classe = await pastille.getAttribute('class');
    expect(classe).toMatch(/\b(RED|GREEN|ORANGE)\b/);
  });

  test('[PTF_061_3L] @tnr @portefeuille - (liste) pastille risque RED/GREEN/ORANGE affichée', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueListe();

    const pastille = ptf.getPastilleListe(data.arthemis.denomination);
    await expect(pastille).toBeVisible();

    const classe = await pastille.getAttribute('class');
    expect(classe).toMatch(/\b(RED|GREEN|ORANGE)\b/);
  });

  // -------------------------------------------------------------------------
  // PTF_062 — Colonnes spécifiques au mode liste
  //
  // PTF_062_1 : colonne Statut affiche "En cours"
  // PTF_062_2 : colonne Date mise à jour affiche une date JJ/MM/AAAA
  //
  // Pas d'équivalent mode carte : ces colonnes n'existent qu'en vue liste.
  // -------------------------------------------------------------------------

  test('[PTF_062_1] @tnr @portefeuille - (liste) colonne statut affiche "En cours"', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueListe();

    const statut = ptf.getStatutListe(data.arthemis.denomination);
    await expect(statut).toBeVisible();

    const texte = await statut.textContent();
    expect(texte.trim()).toBe('En cours');
  });

  test('[PTF_062_2] @tnr @portefeuille - (liste) colonne date mise à jour affiche une date valide', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueListe();

    const dateMaj = ptf.getDateMajListe(data.arthemis.denomination);
    await expect(dateMaj).toBeVisible();

    const texte = await dateMaj.textContent();
    // Format attendu : JJ/MM/AAAA  ex: 03/03/2026
    expect(texte.trim()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  // -------------------------------------------------------------------------
  // PTF_07 à PTF_10
  // -------------------------------------------------------------------------

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

    const filtreActif = page.locator('[data-cy="filter.evaluationStatus.selected.inProgress"]');
    await expect(filtreActif).toBeVisible({ timeout: 5000 });

    await ptf.effacerFiltres();
  });

  test('[PTF_09] @tnr @portefeuille - recherche "ARTHEMIS" affiche la card ARTHEMIS', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueCarte();

    await ptf.rechercher(data.arthemis.denomination);

    const card = ptf.getCardEntreprise(data.arthemis.denomination);
    await expect(card).toBeVisible({ timeout: 15000 });

    const nb = await ptf.getNbDossiers();
    expect(nb).toBeGreaterThanOrEqual(1);
  });

  test('[PTF_10] @tnr @portefeuille - clic sur ARTHEMIS redirige vers page évaluations', async ({ page }) => {
    const ptf = new PortefeuillePage(page);
    await ptf.allerAuPortefeuille();
    await ptf.forcerVueCarte();

    await ptf.rechercher(data.arthemis.denomination);

    const card = ptf.getCardEntreprise(data.arthemis.denomination);
    await card.click();

    await expect(page).toHaveURL(/relations|evaluations|folders/, { timeout: 10000 });
  });

});
