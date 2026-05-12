'use strict';

// apps/compliance/pages/dashboard.page.js
// Page Object — Dashboard Compliance for Business v2
// Couvre les tests ACC_01 à ACC_10

const { ajouterLog } = require('../../../shared/utils/logger');

class DashboardPage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // --- Header ---
    this.champRechercheHeader = page.locator('[data-cy="header.search"]');
    this.btnEvaluerTiers      = page.locator('[data-cy="search.header.evaluate"]');

    // --- Menu profil (haut droite) ---
    this.btnMenuProfil   = page.locator('[data-cy="profil.menu.dropdown"]');
    this.rowEmail        = page.locator('[data-cy="profil.menu.currentUserEmail"]');
    this.rowProfil       = page.locator('[data-cy="profil.menu.currentUserProfile"]');
    this.rowID           = page.locator('[data-cy="profil.menu.id"]');
    this.rowContrat      = page.locator('[data-cy="profil.menu.contrat"]');
    this.labelBonjourUser = page.locator('[data-cy="user.name"]');

    // --- Menu latéral ---
    this.lienAccueil        = page.locator('[data-cy="sidebarMenu.home"]');
    this.lienTaches         = page.locator('[data-cy="sidebarMenu.tasks"]');
    this.lienPortefeuille   = page.locator('[data-cy="sidebarMenu.wallet"]');
    this.lienAdministration = page.locator('[data-cy="sidebarMenu.administration"]');
    this.lienHistorique     = page.locator('[data-cy="sidebarMenu.history"]');
    this.lienStatistiques   = page.locator('[data-cy="sidebarMenu.statistics"]');
    this.lienEllipro        = page.locator('[data-cy="sidebarMenu.elliproRedirect"]');

    // --- Blocs dashboard ---
    this.blocTaches          = page.locator('[data-cy="home.tasks.todo"]');
    this.blocDossiersRecents = page.locator('[data-cy="home.folder.recentlyViewed"]');

    // --- Page non configurée ---
    this.titreAbsenceParametrage = page.locator('app-not-configured h2');
    this.messageAbsenceParametrage = page.locator('app-not-configured p');
    this.btnSeDeconnecter = page.locator('app-not-configured button');
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async allerAuDashboard(baseURL) {
    await this.page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
    ajouterLog('Navigation vers le Dashboard', 'Dashboard', 'info');
  }

  // ---------------------------------------------------------------------------
  // Menu profil — ouvre le dropdown et retourne les infos
  // ---------------------------------------------------------------------------

  async ouvrirMenuProfil() {
    await this.btnMenuProfil.click();
    await this.rowEmail.waitFor({ state: 'visible', timeout: 5000 });
    ajouterLog('Ouverture menu profil', 'Dashboard', 'info');
  }

  async fermerMenuProfil() {
    await this.btnMenuProfil.click();
  }

  async getNomUser() {
    return (await this.labelBonjourUser.innerText()).trim();
  }

  async getProfilUser() {
    return (await this.rowProfil.innerText()).trim();
  }

  async getEmailUser() {
    return (await this.rowEmail.innerText()).trim();
  }

  async getIDUser() {
    return (await this.rowID.innerText()).trim();
  }

  async getContratUser() {
    return (await this.rowContrat.innerText()).trim();
  }
}

module.exports = { DashboardPage };
