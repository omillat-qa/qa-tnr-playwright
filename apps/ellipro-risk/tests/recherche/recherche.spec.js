'use strict';

// apps/ellipro-risk/tests/recherche/recherche.spec.js
// TNR Recherche QUI / OÙ — Ellipro Risk (session du setup-ellipro-risk-ua)
// Migré depuis bac-a-sable-playwright/tests/ellipro-recherche.spec.ts — CommonJS, POM, données externalisées
// Un test par règle de la matrice de recherche, l'identifiant R_xxx est celui du référentiel

const { test, expect } = require('@playwright/test');
const { RecherchePage, libelle, valeur } = require('../../pages/recherche.page');
const data = require('../../../../test-data/ellipro.json').recherche;

const { microsoft: MICROSOFT, ellisphere: ELLISPHERE, carrefour: CARREFOUR } = data;

test.describe('Recherche', () => {

  /** @type {RecherchePage} */
  let rp;

  test.beforeEach(async ({ page, baseURL }) => {
    rp = new RecherchePage(page);
    await rp.ouvrirAccueil(baseURL);
  });

  // -------------------------------------------------------------------------
  // QUI
  // -------------------------------------------------------------------------

  test('[R_001] @tnr @recherche - Recherche QUI : lancement de la recherche possible dès le second caractère saisi', async () => {
    await rp.champRecherche.click();
    await rp.champRecherche.pressSequentially('M');
    await expect(rp.loupe).toBeDisabled();
    await rp.champRecherche.pressSequentially('I');
    await expect(rp.loupe).toBeEnabled();
    await rp.champRecherche.press('Backspace');
    await expect(rp.loupe).toBeDisabled();
  });

  test('[R_002] @tnr @recherche - Recherche QUI : déclenchement autocomplétion au troisième caractère saisi', async ({ page }) => {
    await rp.saisirQui('MI');
    // Vérification d'absence : on laisse à l'autocomplétion le temps de répondre
    await page.waitForTimeout(2_000);
    await expect(rp.suggestions).toHaveCount(0);

    await rp.champRecherche.pressSequentially('C');
    await expect(rp.suggestions.first()).toBeVisible();
    for (const s of await rp.libelles()) expect.soft(s, 'suggestion').toMatch(/^MIC/i);
  });

  test("[R_003] @tnr @recherche - Recherche QUI : maj de l'autocomplétion suite à l'ajout ou suppression d'un caractère", async () => {
    await rp.saisirQui('MIC');
    await expect(rp.suggestions.first()).toBeVisible();
    const avecTrois = await rp.libelles();

    await rp.champRecherche.pressSequentially('RO');
    await expect.poll(() => rp.libelles(), 'ajout de caractères').not.toEqual(avecTrois);
    const avecCinq = await rp.libelles();
    for (const s of avecCinq) expect.soft(s, 'suggestion').toMatch(/^MICRO/i);

    await rp.champRecherche.press('Backspace');
    await expect.poll(() => rp.libelles(), "suppression d'un caractère").not.toEqual(avecCinq);
    for (const s of await rp.libelles()) expect.soft(s, 'suggestion').toMatch(/^MICR/i);
  });

  test("[R_004] @tnr @recherche - Recherche QUI : déplacement possible dans la liste d'autocomplétion", async () => {
    await rp.saisirQui('MICRO');
    await expect(rp.suggestions.nth(1)).toBeVisible();
    const [premiere, seconde] = await rp.libelles();

    await rp.champRecherche.press('ArrowDown');
    await expect(rp.optionActive).toContainText(premiere);
    await rp.champRecherche.press('ArrowDown');
    await expect(rp.optionActive).toContainText(seconde);
    await rp.champRecherche.press('ArrowUp');
    await expect(rp.optionActive).toContainText(premiere);
  });

  test("[R_005] @tnr @recherche - Recherche QUI : validation possible dans liste d'autocomplétion par la touche tabulation", async () => {
    await rp.saisirQui('MICRO');
    await expect(rp.suggestions.nth(1)).toBeVisible();
    await rp.champRecherche.press('ArrowDown');
    await rp.champRecherche.press('ArrowDown');
    const choix = libelle(await rp.optionActive.innerText());

    await rp.champRecherche.press('Tab');
    await expect.poll(() => valeur(rp.champRecherche)).toBe(choix);
    await expect(rp.champOu).toBeFocused();
  });

  // -------------------------------------------------------------------------
  // OÙ
  // -------------------------------------------------------------------------

  test('[R_006] @tnr @recherche - Recherche OU : déclenchement autocomplétion dès le premier caractère alphanumérique', async () => {
    await rp.preparerOu(MICROSOFT.nom);
    await rp.champOu.pressSequentially('I');
    await expect(rp.suggestions.first()).toBeVisible();
  });

  test('[R_007] @tnr @recherche - Recherche OU : autocomplétion propose uniquement les villes possibles pour le QUI', async () => {
    await rp.preparerOu(MICROSOFT.nom);
    await rp.champOu.pressSequentially('I');
    await expect.poll(() => rp.libelles()).toEqual([MICROSOFT.ville]);

    // La ville proposée donne bien des résultats, tous situés dans cette ville
    await rp.champOu.press('ArrowDown');
    await rp.champOu.press('Tab');
    await expect(rp.champOu).toHaveValue(MICROSOFT.ville);
    await rp.loupe.click();
    const resultats = await rp.attendreResultats();
    for (const resultat of await resultats.all()) {
      await expect.soft(resultat).toContainText(MICROSOFT.ville);
    }
  });

  test('[R_008] @tnr @recherche - Recherche OU : deux chiffres (département) ou cinq chiffres (code postal), sinon la loupe est grisée', async () => {
    await rp.preparerOu(MICROSOFT.nom);
    const cas = [
      ['9', false],
      ['92', true],
      ['921', false],
      ['9213', false],
      ['92130', true],
      ['921301', false],
    ];
    for (const [saisie, active] of cas) {
      await rp.champOu.fill(saisie);
      if (active) await expect.soft(rp.loupe, `OÙ = ${saisie} : loupe active`).toBeEnabled();
      else await expect.soft(rp.loupe, `OÙ = ${saisie} : loupe grisée`).toBeDisabled();
    }
  });

  test("[R_009] @tnr @recherche - Recherche OU : maj de l'autocomplétion suite à l'ajout ou suppression d'un caractère", async () => {
    await rp.preparerOu(MICROSOFT.nom);
    await rp.champOu.pressSequentially('A');
    await expect(rp.suggestions.first()).toBeVisible();

    await rp.champOu.pressSequentially('Z');
    await expect(rp.suggestions, 'ajout : plus aucune ville en « AZ »').toHaveCount(0);

    await rp.champOu.press('Backspace');
    await expect(rp.suggestions.first(), 'suppression : villes en « A » de nouveau proposées').toBeVisible();
  });

  test("[R_010] @tnr @recherche - Recherche OU : déplacement possible dans la liste d'autocomplétion", async () => {
    await rp.preparerOu(CARREFOUR.nom);
    await rp.champOu.pressSequentially('PA');
    await expect(rp.suggestions.nth(1)).toBeVisible();
    const [premiere, seconde] = await rp.libelles();

    await rp.champOu.press('ArrowDown');
    await expect(rp.optionActive).toContainText(premiere);
    await rp.champOu.press('ArrowDown');
    await expect(rp.optionActive).toContainText(seconde);
    await rp.champOu.press('ArrowUp');
    await expect(rp.optionActive).toContainText(premiere);
  });

  test("[R_011] @tnr @recherche - Recherche OU : validation possible dans liste d'autocomplétion par la touche tabulation", async () => {
    await rp.preparerOu(CARREFOUR.nom);
    await rp.champOu.pressSequentially('PA');
    await expect(rp.suggestions.nth(1)).toBeVisible();
    await rp.champOu.press('ArrowDown');
    await rp.champOu.press('ArrowDown');
    const choix = libelle(await rp.optionActive.innerText());

    await rp.champOu.press('Tab');
    await expect.poll(() => valeur(rp.champOu)).toBe(choix);
    await expect(rp.suggestions).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Lancement de la recherche
  // -------------------------------------------------------------------------

  test('[R_012] @tnr @recherche - Lancement de la recherche possible par la touche entrée', async () => {
    await rp.saisirQui(CARREFOUR.nom);
    await rp.champRecherche.press('Enter');
    await rp.attendreResultats();
  });

  test('[R_013] @tnr @recherche - Lancement de la recherche possible par un clic sur la loupe', async () => {
    await rp.preparerOu(CARREFOUR.nom);
    await rp.champOu.fill(CARREFOUR.codePostal);
    await expect(rp.loupe).toBeEnabled();
    await rp.loupe.click();
    const resultats = await rp.attendreResultats();
    for (const resultat of await resultats.all()) {
      await expect.soft(resultat).toContainText(CARREFOUR.codePostal);
    }
  });

  // -------------------------------------------------------------------------
  // Recherche unique : accès direct à la fiche
  // -------------------------------------------------------------------------

  test("[R_014] @tnr @recherche - Recherche unique, j'accède directement au Company profile si l'entreprise n'est pas sous surveillance", async ({ page }) => {
    await rp.saisirQui(MICROSOFT.siret);
    await rp.champRecherche.press('Enter');
    await expect(page).toHaveURL(/\/navigation\/report-nav\/report\/company-profile$/);
    await expect(rp.nomEntreprise).toHaveText(MICROSOFT.nom);
    await expect(rp.libelleSurveillance).toHaveCount(0);
  });

  test("[R_015] @tnr @recherche - Recherche unique, j'accède directement au Business profile si l'entreprise est sous surveillance", async ({ page }) => {
    await rp.saisirQui(ELLISPHERE.siret);
    await rp.champRecherche.press('Enter');
    await expect(page).toHaveURL(/\/navigation\/report-nav\/report\/keys-indicator$/);
    await expect(rp.nomEntreprise).toHaveText(ELLISPHERE.nom);
    await expect(rp.libelleSurveillance).toBeVisible();
  });

  test('[R_016] @tnr @recherche - Recherche avancée unique téléphone', async ({ page }) => {
    await rp.rechercheAvancee('téléphone', ELLISPHERE.telephone);

    // Un seul résultat : accès direct à la fiche (ELLISPHERE est surveillée → Business profile)
    await expect(page).toHaveURL(/\/navigation\/report-nav\/report\/keys-indicator$/);
    await expect(rp.nomEntreprise).toHaveText(ELLISPHERE.nom);
  });

  // R_017 Recherche avancée unique personne (pp pm) : en attente d'un jeu de données

});
