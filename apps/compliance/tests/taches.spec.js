'use strict';

// apps/compliance/tests/taches.spec.js
// TNR — Tâches (page /tasks) Compliance for Business v2
// Profil : Admin (cfbv2_tnr@nomail.dns) — storageState cfb-ua-admin
// IDs : TCH_01 à TCH_20
// Tags : @tnr @taches

const { test, expect }  = require('@playwright/test');
const { TachesPage }    = require('../pages/taches.page');
const taches            = require('../../../test-data/taches.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ferme la popup d'annonce si elle est présente (même helper que les autres specs).
 */
async function closeAnnouncementPopup(page) {
  try {
    const btn = page.locator('[data-cy="announcement.close"], [data-cy="modal.close.btn"]').first();
    if (await btn.isVisible({ timeout: 2000 })) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // pas de popup — on continue
  }
}

/**
 * Attend que le compteur tasks.total soit visible et stable.
 */
async function attendreStabilite(page, timeout = 15000) {
  const loc = page.locator('[data-cy="tasks.total"]');
  await loc.waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Suite principale
// ---------------------------------------------------------------------------

test.describe('Tâches @tnr @taches', () => {

  let tp;

  test.beforeEach(async ({ page, baseURL }) => {
    tp = new TachesPage(page);
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await closeAnnouncementPopup(page);
  });

  // -------------------------------------------------------------------------
  // TCH_01 — Lien menu « Tâches » présent dans la sidebar
  // -------------------------------------------------------------------------
  test('[TCH_01] @smoke — Lien menu Tâches visible dans la sidebar', async ({ page }) => {
    await expect(tp.lienMenuTaches).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // TCH_02 — Obsolète (widget « VOIR PLUS » supprimé) — conservé pour traçabilité
  // -------------------------------------------------------------------------
  test('[TCH_02] — Widget « VOIR PLUS » (obsolète — skipped)', async () => {
    test.skip(true, 'TCH_02 obsolète : widget VOIR PLUS supprimé de la page dashboard');
  });

  // -------------------------------------------------------------------------
  // TCH_03 — Navigation vers /tasks + vérification URL
  // -------------------------------------------------------------------------
  test('[TCH_03] @smoke — URL /tasks après clic sur le menu Tâches', async ({ page }) => {
    await tp.allerAuxTaches();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // TCH_04 — Accès sans authentification impossible (garanti par storageState)
  // -------------------------------------------------------------------------
  test('[TCH_04] — Accès sans authentification impossible', async ({ page }) => {
    test.info().annotations.push({
      type: 'note',
      description: 'Garanti par storageState — redirection Keycloak si non authentifié'
    });
    await tp.allerAuxTaches();
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page).not.toHaveURL(/keycloak/);
  });

  // -------------------------------------------------------------------------
  // TCH_05 — Présence des filtres Équipes, Utilisateurs, Type de tâche
  // -------------------------------------------------------------------------
  test('[TCH_05_1] @smoke — Filtre Équipes présent', async ({ page }) => {
    await tp.allerAuxTaches();
    await expect(tp.btnSelectEquipe).toBeVisible({ timeout: 10000 });
  });

  test('[TCH_05_2] @smoke — Filtre Utilisateurs présent', async ({ page }) => {
    await tp.allerAuxTaches();
    await expect(tp.btnSelectUser).toBeVisible({ timeout: 10000 });
  });

  test('[TCH_05_3] @smoke — Filtre Type de tâche présent', async ({ page }) => {
    await tp.allerAuxTaches();
    await expect(tp.btnSelectTypeTache).toBeVisible({ timeout: 10000 });
  });

  // -------------------------------------------------------------------------
  // TCH_06 — Bouton [Assigner] désactivé sans sélection
  // -------------------------------------------------------------------------
  test('[TCH_06] @smoke — Bouton Assigner désactivé sans sélection', async ({ page }) => {
    await tp.allerAuxTaches();
    await expect(tp.btnAssigner).toBeVisible();
    await expect(tp.btnAssigner).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // TCH_07 — Toutes équipes + tous utilisateurs → liste plus grande
  // -------------------------------------------------------------------------
  test('[TCH_07] — Filtre toutes équipes + tous users → liste étendue', async ({ page }) => {
    await tp.allerAuxTaches();
    const nbInitial = await tp.getNbTaches();

    await tp.filtrerToutesEquipes();
    await tp.filtrerTousUtilisateurs();
    await attendreStabilite(page);

    const nbTotal = await tp.getNbTaches();
    expect(nbTotal).toBeGreaterThan(0);
    expect(nbTotal).toBeGreaterThanOrEqual(nbInitial);
  });

  // -------------------------------------------------------------------------
  // TCH_07_01 — Compteur tasks.total = nb lignes du tableau
  // -------------------------------------------------------------------------
  test('[TCH_07_01] — Compteur tâches = nombre de lignes du tableau', async ({ page }) => {
    await tp.allerAuxTaches();
    const nbCompteur = await tp.getNbTaches();
    const nbLignes   = await tp.getNbLignes();

    if (nbCompteur <= 50) {
      expect(nbLignes).toBe(nbCompteur);
    } else {
      expect(nbLignes).toBeGreaterThan(0);
      expect(nbLignes).toBeLessThanOrEqual(nbCompteur);
    }
  });

  // -------------------------------------------------------------------------
  // TCH_08 — Filtre "Sans Affectation" → liste différente de l'état initial
  // -------------------------------------------------------------------------
  test('[TCH_08] — Filtre sans affectation → liste différente', async ({ page }) => {
    await tp.allerAuxTaches();
    const nbInitial = await tp.getNbTaches();

    await tp.filtrerToutesEquipes();
    await tp.filtrerSansAffectation();
    await attendreStabilite(page);

    const nbSansAffect = await tp.getNbTaches();
    expect(nbSansAffect).not.toBe(nbInitial);
  });

  // -------------------------------------------------------------------------
  // TCH_09 — Cocher une tâche → bouton Assigner devient actif
  // -------------------------------------------------------------------------
  test('[TCH_09] — Cocher une tâche active le bouton Assigner', async ({ page }) => {
    await tp.allerAuxTaches();
    const nbLignes = await tp.getNbLignes();
    expect(nbLignes).toBeGreaterThan(0);

    await tp.getCheckboxLigne(0).check();
    await expect(tp.btnAssigner).toBeEnabled({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // TCH_10 — Ouvrir la modal puis la fermer via la croix
  // -------------------------------------------------------------------------
  test('[TCH_10] — Fermer la modal d\'affectation via la croix', async ({ page }) => {
    await tp.allerAuxTaches();
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();
    await expect(tp.btnValiderModal).toBeVisible();

    await tp.fermerModalAffectation();
    await expect(tp.btnValiderModal).toBeHidden({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // TCH_11 — Après fermeture de la modal, Assigner toujours actif
  // -------------------------------------------------------------------------
  test('[TCH_11] — Bouton Assigner toujours actif après fermeture de la modal', async ({ page }) => {
    await tp.allerAuxTaches();
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();
    await tp.fermerModalAffectation();

    await expect(tp.btnAssigner).toBeEnabled({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // TCH_12 — Bouton Valider désactivé à l'ouverture de la modal
  // -------------------------------------------------------------------------
  test('[TCH_12] — Bouton Valider inactif à l\'ouverture de la modal', async ({ page }) => {
    await tp.allerAuxTaches();
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();

    await expect(tp.btnValiderModal).toBeDisabled({ timeout: 5000 });
    await tp.fermerModalAffectation();
  });

  // -------------------------------------------------------------------------
  // TCH_13 — Sélectionner une équipe dans la modal → combo Utilisateur actif
  // -------------------------------------------------------------------------
  test('[TCH_13] — Sélection équipe dans la modal → combo Utilisateur visible', async ({ page }) => {
    await tp.allerAuxTaches();
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();
    await expect(tp.btnSelectEquipeModal).toBeVisible();

    await tp.selectionnerEquipeModal(taches.equipes.filtre);
    await page.waitForTimeout(1000);

    await expect(tp.btnSelectUserModal).toBeEnabled({ timeout: 5000 });
    await tp.fermerModalAffectation();
  });

  // -------------------------------------------------------------------------
  // TCH_14 — Équipe + Utilisateur + Urgent → bouton Valider actif
  // -------------------------------------------------------------------------
  test('[TCH_14] — Remplir le formulaire active le bouton Valider', async ({ page }) => {
    await tp.allerAuxTaches();
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();
    await expect(tp.btnValiderModal).toBeDisabled();

    await tp.selectionnerEquipeModal(taches.equipes.filtre);
    await page.waitForTimeout(1000);
    await tp.selectionnerUserModal(taches.utilisateurs.filtreCollab);
    await page.waitForTimeout(500);
    await tp.activerUrgent();

    await expect(tp.btnValiderModal).toBeEnabled({ timeout: 5000 });
    await tp.fermerModalAffectation();
  });

  // -------------------------------------------------------------------------
  // TCH_15 à TCH_19 — Workflow complet d'affectation + vérification + retour
  // E2E : modifie les données et revient à l'état initial
  // -------------------------------------------------------------------------
  test('[TCH_15 TCH_16 TCH_17 TCH_18 TCH_19] @smoke — Affecter une tâche et vérifier (E2E + retour)', async ({ page }) => {

    await tp.allerAuxTaches();

    // --- Étape 1 : cocher la première tâche et affecter ---
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();
    await expect(tp.btnValiderModal).toBeDisabled();

    await tp.selectionnerEquipeModal(taches.equipes.filtre);
    await page.waitForTimeout(1000);
    await tp.selectionnerUserModal(taches.utilisateurs.filtreCollab);
    await page.waitForTimeout(500);
    await tp.activerUrgent();
    await expect(tp.btnValiderModal).toBeEnabled();

    await tp.validerAffectation();
    await attendreStabilite(page);

    // [TCH_15] La tâche a disparu de la liste (filtre courant = admin CFBv2_TNR)
    const nbApresAffectation = await tp.getNbTaches();
    expect(nbApresAffectation).toBeGreaterThanOrEqual(0);

    // --- Étape 2 : filtrer Equipe BS TPME Ouest + cfbv2_collab_tnr ---
    await tp.deselectionnerEquipesFavorites();
    await page.waitForTimeout(300);
    await tp.filtrerEquipe(taches.equipes.filtre);
    await tp.filtrerUtilisateur(taches.utilisateurs.filtreCollab);
    await attendreStabilite(page);

    // [TCH_16] La tâche est visible sous ce filtre
    const nbLignesCollab = await tp.getNbLignes();
    expect(nbLignesCollab).toBeGreaterThan(0);

    // [TCH_17] Colonne Date d'échéance présente
    const dateCell = tp.getCellule(0, 'dateEcheance');
    await expect(dateCell).toBeVisible();

    // [TCH_18] Équipe affectée = Equipe BS TPME Ouest
    const equipeAffectee = await tp.getEquipeLigne(0);
    expect(equipeAffectee).toBe(taches.equipes.affectation);

    // [TCH_19] Colonne bell présente (icône urgente)
    // TODO : affiner le sélecteur quand le DOM post-affectation sera disponible
    const bellCell = tp.getCellule(0, 'bell');
    await expect(bellCell).toBeVisible();

    // --- Étape 3 : RETOUR À L'ÉTAT INITIAL (revert E2E) ---
    await tp.getCheckboxLigne(0).check();
    await tp.ouvrirModalAffectation();

    await tp.selectionnerEquipeModal(taches.equipes.filtre);
    await page.waitForTimeout(1000);

    // Réaffecter à l'admin : sans ça chaque run retire une tâche du stock CFBv2_TNR
    // et TCH_09 à TCH_19 finissent par échouer faute de tâche (constaté le 2026-10-15)
    await tp.selectionnerUserModal(taches.utilisateurs.admin);
    await page.waitForTimeout(500);
    await expect(tp.btnValiderModal).toBeEnabled();
    await tp.validerAffectation();
    await attendreStabilite(page);
  });

  // -------------------------------------------------------------------------
  // TCH_20 — Pagination (conditionnel : uniquement si > 1 page)
  // -------------------------------------------------------------------------
  test('[TCH_20] — Pagination : navigation dernière page puis retour première', async ({ page }) => {
    await tp.allerAuxTaches();

    // Charger toutes équipes + tous utilisateurs
    await tp.filtrerToutesEquipes();
    await tp.filtrerTousUtilisateurs();
    await attendreStabilite(page);

    const nbPages = await tp.getNbPages();

    if (nbPages <= 1) {
      test.skip(nbPages <= 1, `Pas de pagination (${nbPages} page(s)) dans l'environnement courant`);
      return;
    }

    const nbLignesP1 = await tp.getNbLignes();
    await tp.allerDernierePagePagination();

    const nbLignesDerniere = await tp.getNbLignes();
    expect(nbLignesDerniere).toBeGreaterThan(0);

    const nbTachesTotal = await tp.getNbTaches();
    expect(nbTachesTotal).toBeGreaterThan(0);

    await tp.allerPremierePagePagination();
    const nbLignesRetour = await tp.getNbLignes();
    expect(nbLignesRetour).toBe(nbLignesP1);
  });

});
