'use strict';

// apps/compliance/pages/taches.page.js
// Page Object — Tâches (page /tasks) Compliance for Business v2
// DOM : app-task-list > app-data-table[data-cy="task.table"] table.generic-table
// Colonnes : .column-select, .column-evaluation, .column-dossier, .column-taskType,
//            .column-bell, .column-description, .column-dateEcheance, .column-equipe, .column-affectation
// Sélecteurs data-cy extraits du script UFT TCH_01–TCH_20

const { ajouterLog } = require('../../../shared/utils/logger');
const { mesurer }    = require('../../../shared/utils/metrics');

class TachesPage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // --- Navigation ---
    this.lienMenuTaches     = page.locator('[data-cy="sidebarMenu.tasks"]');

    // --- Filtres ---
    this.btnSelectEquipe    = page.locator('[data-cy="select.team.selectBtn"]');
    this.btnSelectUser      = page.locator('[data-cy="select.linkedUser.selectBtn"]');
    this.btnSelectTypeTache = page.locator('[data-cy="select.taskType.selectBtn"]');

    // Options équipes dans le dropdown équipe
    // task.check.favorites.selectAll = heading "Mes équipes" (sélectionne toutes les favorites)
    // task.check.selectAll           = heading "Autres équipes" (sélectionne toutes les autres)
    this.optEquipesToutes   = page.locator('[data-cy="task.check.selectAll"]');
    this.optEquipesFavorites= page.locator('[data-cy="task.check.favorites.selectAll"]');

    // Options utilisateurs dans le dropdown user
    this.optUserTous        = page.locator('[data-cy="task.checkUser.option.all"]');
    this.optUserSansAffect  = page.locator('[data-cy="task.checkUser.option.none"]');

    // --- Bouton Assigner ---
    this.btnAssigner        = page.locator('[data-cy="task.btn.assign"]');

    // --- Compteur et pagination ---
    this.labelNbTaches      = page.locator('[data-cy="tasks.total"]');
    this.labelPageInfo      = page.locator('[data-cy="tasks.pageInfo"]');
    this.btnPageSuivante    = page.locator('[data-cy="tasks.goToNextPage"]');
    this.btnDernierePage    = page.locator('[data-cy="tasks.goToLastPage"]');
    this.btnPagePrecedente  = page.locator('[data-cy="tasks.goToPreviousPage"]');
    this.btnPremierePageBtn = page.locator('[data-cy="tasks.goToFirstPage"]');

    // --- Tableau ---
    this.tableau            = page.locator('[data-cy="task.table"] table.generic-table');
    this.checkTout          = page.locator('[data-cy="task.checkAll"]');

    // --- Modal d'affectation ---
    this.btnValiderModal    = page.locator('[data-cy="task.assign.valid"]');
    this.btnFermerModal     = page.locator('[data-cy="modal.close.btn"]');
    this.btnSelectEquipeModal  = page.locator('[data-cy="select.teamId.selectBtn"]');
    this.btnSelectUserModal    = page.locator('[data-cy="select.userId.selectBtn"]');
    this.switchUrgent          = page.locator('[data-cy="switch.switchUrgentTask"]');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async allerAuxTaches() {
    await mesurer('taches.chargement', async () => {
      await this.lienMenuTaches.click();
      await this.page.waitForURL('**/tasks**');
      await this.tableau.waitFor({ state: 'visible', timeout: 15000 });
    }, { app: 'compliance-v2' });
    ajouterLog('Navigation vers Tâches', 'Taches', 'info');
  }

  // ---------------------------------------------------------------------------
  // Fermeture des dropdowns (CDK overlay — multi-select ne se ferme pas seul)
  // ---------------------------------------------------------------------------

  /**
   * Ferme le dropdown équipes en appuyant sur Escape et attend que le bouton
   * trigger repasse à aria-expanded="false".
   * À appeler après chaque interaction avec le dropdown équipes.
   */
  async fermerDropdownEquipes() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForFunction(
      sel => {
        const el = document.querySelector(sel);
        return el && el.getAttribute('aria-expanded') === 'false';
      },
      '[data-cy="select.team.selectBtn"]',
      { timeout: 5000 }
    );
    await this.page.waitForTimeout(300);
  }

  /**
   * Ferme le dropdown utilisateurs en appuyant sur Escape et attend que le bouton
   * trigger repasse à aria-expanded="false".
   * À appeler après chaque interaction avec le dropdown user.
   */
  async fermerDropdownUser() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForFunction(
      sel => {
        const el = document.querySelector(sel);
        return el && el.getAttribute('aria-expanded') === 'false';
      },
      '[data-cy="select.linkedUser.selectBtn"]',
      { timeout: 5000 }
    );
    await this.page.waitForTimeout(300);
  }

  // ---------------------------------------------------------------------------
  // Nombre de tâches
  // ---------------------------------------------------------------------------

  async getNbTaches() {
    await this.labelNbTaches.waitFor({ state: 'visible', timeout: 15000 });
    // Attendre que le compteur soit stable (non-zéro après rechargement Angular)
    await this.page.waitForFunction(
      sel => {
        const el = document.querySelector(sel);
        return el && parseInt(el.textContent.trim(), 10) > 0;
      },
      '[data-cy="tasks.total"]',
      { timeout: 10000 }
    ).catch(() => {}); // silencieux si le tableau est réellement vide
    const texte = await this.labelNbTaches.innerText();
    return parseInt(texte.trim(), 10);
  }

  // ---------------------------------------------------------------------------
  // Lignes du tableau
  // ---------------------------------------------------------------------------

  /**
   * Retourne le nombre de lignes tr.hoverable dans le tableau.
   * Attend qu'au moins une ligne soit attachée au DOM avant de compter.
   */
  async getNbLignes() {
    const loc = this.page.locator('[data-cy="task.table"] table.generic-table tr.hoverable');
    // Attendre au moins une ligne (ou timeout silencieux si tableau vide)
    await loc.first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    return loc.count();
  }

  /**
   * Retourne la checkbox de la ligne à l'index donné (0-based).
   * data-cy="tasks.check.{index}" — devient "tasks.uncheck.{index}" une fois cochée
   * (la sélection persiste après une affectation : la ligne 0 peut déjà être cochée)
   */
  getCheckboxLigne(index) {
    return this.page.locator(`[data-cy="tasks.check.${index}"], [data-cy="tasks.uncheck.${index}"]`);
  }

  /**
   * Retourne la ligne tr.hoverable à l'index donné (0-based).
   */
  getLigne(index) {
    return this.page.locator('[data-cy="task.table"] table.generic-table tr.hoverable').nth(index);
  }

  /**
   * Retourne la cellule d'une colonne d'une ligne (0-based).
   * @param {number} index  — index de la ligne
   * @param {string} colonne — ex: 'equipe', 'affectation', 'taskType', 'dateEcheance', 'evaluation', 'description'
   */
  getCellule(index, colonne) {
    return this.getLigne(index).locator(`.column-${colonne}`);
  }

  /**
   * Retourne le texte de la cellule équipe affectée d'une ligne.
   */
  async getEquipeLigne(index) {
    const cell = this.getCellule(index, 'equipe');
    return (await cell.locator('.affectation').innerText()).trim();
  }

  /**
   * Retourne le texte de la cellule utilisateur affecté d'une ligne.
   */
  async getUserLigne(index) {
    const cell = this.getCellule(index, 'affectation');
    return (await cell.locator('.affectation').innerText()).trim();
  }

  /**
   * Vérifie si la ligne index possède l'icône urgente (column-bell non vide).
   */
  async isUrgentLigne(index) {
    const cell = this.getCellule(index, 'bell');
    // L'icône urgente est un app-font-icon ou un span avec classe spécifique
    // En UFT : verif_urgent_ON = "notifications_active Urgent"
    // Dans le DOM : app-font-icon ou span dans .column-bell
    const count = await cell.locator('app-font-icon, .urgent').count();
    return count > 0;
  }

  // ---------------------------------------------------------------------------
  // Filtres équipes
  // ---------------------------------------------------------------------------

  /**
   * Ouvre le filtre équipes et sélectionne TOUTES les équipes.
   * Coche à la fois "Mes équipes" (favorites.selectAll) et "Autres équipes" (selectAll),
   * puis ferme le dropdown pour libérer l'overlay CDK.
   */
  async filtrerToutesEquipes() {
    await this.btnSelectEquipe.click();
    // "Mes équipes" puis "Autres équipes" : ces "tout sélectionner" sont des bascules,
    // on ne clique que si la section n'est pas déjà cochée (aria-checked="true")
    for (const opt of [this.optEquipesFavorites, this.optEquipesToutes]) {
      await opt.waitFor({ state: 'visible', timeout: 5000 });
      if (await opt.getAttribute('aria-checked') !== 'true') {
        await opt.click();
        await this.page.waitForTimeout(300);
      }
    }
    await this.fermerDropdownEquipes();
  }

  /**
   * Ouvre le filtre équipes et décoche toutes les équipes favorites ("Mes équipes"),
   * puis ferme le dropdown. À enchaîner avec filtrerEquipe() pour ne garder qu'une équipe.
   */
  async deselectionnerEquipesFavorites() {
    await this.btnSelectEquipe.click();
    await this.optEquipesFavorites.waitFor({ state: 'visible', timeout: 5000 });
    // Bascule : on ne clique que si la section est cochée (sinon le clic la cocherait)
    if (await this.optEquipesFavorites.getAttribute('aria-checked') === 'true') {
      await this.optEquipesFavorites.click();
      await this.page.waitForTimeout(300);
    }
    await this.fermerDropdownEquipes();
  }

  /**
   * Ouvre le filtre équipes et sélectionne une équipe spécifique par data-cy,
   * puis ferme le dropdown.
   * @param {string} equipeCy — suffixe data-cy, ex: 'EquipeBSTPMEOuest'
   */
  async filtrerEquipe(equipeCy) {
    await this.btnSelectEquipe.click();
    const opt = this.page.locator(`[data-cy="task.check.option.${equipeCy}"]`);
    await opt.waitFor({ state: 'visible', timeout: 5000 });
    await opt.click();
    await this.page.waitForTimeout(300);
    await this.fermerDropdownEquipes();
  }

  // ---------------------------------------------------------------------------
  // Filtres utilisateurs
  // ---------------------------------------------------------------------------

  /**
   * Ouvre le filtre utilisateurs et sélectionne TOUS les utilisateurs,
   * puis ferme le dropdown.
   */
  async filtrerTousUtilisateurs() {
    await this.btnSelectUser.click();
    await this.optUserTous.waitFor({ state: 'visible', timeout: 5000 });
    // Bascule comme les "tout sélectionner" équipes : ne pas décocher si déjà actif
    if (await this.optUserTous.getAttribute('aria-checked') !== 'true') {
      await this.optUserTous.click();
      await this.page.waitForTimeout(300);
    }
    await this.fermerDropdownUser();
  }

  /**
   * Ouvre le filtre utilisateurs et sélectionne "Sans Affectation",
   * puis ferme le dropdown.
   */
  async filtrerSansAffectation() {
    await this.btnSelectUser.click();
    await this.optUserSansAffect.waitFor({ state: 'visible', timeout: 5000 });
    await this.optUserSansAffect.click();
    await this.page.waitForTimeout(300);
    await this.fermerDropdownUser();
  }

  /**
   * Ouvre le filtre utilisateurs et sélectionne un utilisateur spécifique,
   * puis ferme le dropdown.
   * @param {string} userCy — login utilisateur, ex: 'cfbv2_collab_tnr'
   */
  async filtrerUtilisateur(userCy) {
    await this.btnSelectUser.click();
    const opt = this.page.locator(`[data-cy="task.checkUser.option.${userCy}"]`);
    await opt.waitFor({ state: 'visible', timeout: 5000 });
    await opt.click();
    await this.page.waitForTimeout(300);
    await this.fermerDropdownUser();
  }

  // ---------------------------------------------------------------------------
  // Attente de rechargement de la liste
  // ---------------------------------------------------------------------------

  /**
   * Attend que le tableau soit rechargé après un changement de filtre.
   * Attend que le compteur soit visible et stable.
   */
  async attendreRechargement(timeout = 15000) {
    await this.labelNbTaches.waitFor({ state: 'visible', timeout });
    await this.page.waitForTimeout(500);
  }

  // ---------------------------------------------------------------------------
  // Modal d'affectation
  // ---------------------------------------------------------------------------

  /**
   * Ouvre la modal d'affectation (clique sur Assigner).
   */
  async ouvrirModalAffectation() {
    await this.btnAssigner.click();
    await this.btnValiderModal.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Ferme la modal via la croix.
   */
  async fermerModalAffectation() {
    await this.btnFermerModal.click();
    await this.btnValiderModal.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Sélectionne une équipe dans la modal d'affectation.
   * @param {string} equipeCy — ex: 'EquipeBSTPMEOuest'
   */
  async selectionnerEquipeModal(equipeCy) {
    await this.btnSelectEquipeModal.click();
    const opt = this.page.locator(`[data-cy="task.assign.selectTeam.option.${equipeCy}"]`);
    await opt.waitFor({ state: 'visible', timeout: 5000 });
    await opt.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Sélectionne un utilisateur dans la modal d'affectation.
   * @param {string} userCy — ex: 'cfbv2_collab_tnr'
   */
  async selectionnerUserModal(userCy) {
    await this.btnSelectUserModal.click();
    const opt = this.page.locator(`[data-cy="task.assign.selectUser.option.${userCy}"]`);
    await opt.waitFor({ state: 'visible', timeout: 5000 });
    await opt.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Active le switch Urgente dans la modal.
   */
  async activerUrgent() {
    await this.switchUrgent.click();
    ajouterLog('Switch Urgent activé', 'Taches', 'info');
  }

  /**
   * Valide le formulaire d'affectation (bouton Valider).
   */
  async validerAffectation() {
    await this.btnValiderModal.click();
    await this.btnValiderModal.waitFor({ state: 'hidden', timeout: 15000 });
  }

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  async allerDernierePagePagination() {
    await this.btnDernierePage.click();
    await this.attendreRechargement();
  }

  async allerPremierePagePagination() {
    await this.btnPremierePageBtn.click();
    await this.attendreRechargement();
  }

  /**
   * Lit le nb de pages depuis le label pageInfo ("Page X sur Y ...").
   * Retourne 0 si le label est absent ou non parseable.
   */
  async getNbPages() {
    if (!(await this.labelPageInfo.isVisible().catch(() => false))) return 0;
    const texte = await this.labelPageInfo.innerText();
    // Format attendu : "Page X sur Y ..."
    const match = texte.match(/sur\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

}

module.exports = { TachesPage };
