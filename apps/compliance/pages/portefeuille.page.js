'use strict';

// apps/compliance/pages/portefeuille.page.js
// Page Object — Portefeuille (page /folders) Compliance for Business v2

const { ajouterLog } = require('../../../shared/utils/logger');

class PortefeuillePage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // --- Navigation ---
    // Compliance for Business utilise data-cy (pas data-testid)
    this.lienMenuPortefeuille = page.locator('[data-cy="sidebarMenu.wallet"]');

    // --- Filtres ---
    this.btnStatutEval        = page.locator('[data-cy="select.evaluationStatus.selectBtn"]');
    this.optStatutTous        = page.locator('[data-cy="filter.evaluationStatus.option.all"]');
    this.optStatutEnCours     = page.locator('[data-cy="filter.evaluationStatus.option.inProgress"]');
    this.optStatutTraite      = page.locator('[data-cy="filter.evaluationStatus.option.done"]');
    this.optStatutArchive     = page.locator('[data-cy="filter.evaluationStatus.option.archived"]');

    this.btnTypeRelation      = page.locator('[data-cy="select.relationType.selectBtn"]');
    this.optTypePMClient      = page.locator('[data-cy="filter.relationType.option.PMCLIENT"]');
    this.optTypePMFournisseur = page.locator('[data-cy="filter.relationType.option.PMFOURNISSEUR"]');
    this.optTypePPClient      = page.locator('[data-cy="filter.relationType.option.PPCLIENT"]');

    this.btnRisque            = page.locator('[data-cy="select.risk.selectBtn"]');
    this.optRisqueFort        = page.locator('[data-cy="filter.risk.option.high"]');
    this.optRisqueMoyen       = page.locator('[data-cy="filter.risk.option.medium"]');
    this.optRisqueFaible      = page.locator('[data-cy="filter.risk.option.low"]');

    this.btnEffacerFiltres    = page.getByRole('button', { name: 'Effacer les filtres' });
    this.btnVueCarte          = page.locator('[data-cy="wallet.cardView"]');

    // --- Recherche ---
    this.champRecherche       = page.locator('[data-cy="wallet.search"]');

    // --- Contenu ---
    this.titrePortefeuille    = page.getByRole('heading', { name: 'Portefeuille' });
    // Vue liste : dd[data-cy="wallet.listView.evals.total"]
    // Vue carte : dd[data-cy="wallet.cardView.folders.total"]
    // On garde les deux pour getNbDossiers()
    this.labelNbDossiersListe = page.locator('dd[data-cy="wallet.listView.evals.total"]');
    this.labelNbDossiersCarte = page.locator('dd[data-cy="wallet.cardView.folders.total"]');
    this.messageAucunResultat = page.getByRole('heading', { name: 'Aucun résultat' });
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async allerAuPortefeuille() {
    await this.lienMenuPortefeuille.click();
    await this.page.waitForURL('**/folders**');
    ajouterLog('Navigation vers le Portefeuille', 'Portefeuille', 'info');
  }

  // ---------------------------------------------------------------------------
  // Nombre de dossiers — fonctionne en vue liste ET vue carte
  // ---------------------------------------------------------------------------

  async getNbDossiers() {
    // Attend l'un ou l'autre selon la vue active
    const locator = this.page.locator(
      'dd[data-cy="wallet.listView.evals.total"], dd[data-cy="wallet.cardView.folders.total"]'
    ).first();
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    const texte = await locator.innerText();
    return parseInt(texte.trim(), 10);
  }

  // ---------------------------------------------------------------------------
  // Filtres
  // ---------------------------------------------------------------------------

  async ouvrirFiltreStatut() {
    await this.btnStatutEval.click();
    await this.optStatutTous.waitFor({ state: 'visible', timeout: 5000 });
  }

  async fermerFiltreStatut() {
    // Escape ferme le dropdown Angular Material sans être bloqué par le cdk-overlay-backdrop
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async selectionnerStatutEnCours() {
    await this.btnStatutEval.click();
    await this.optStatutEnCours.waitFor({ state: 'visible', timeout: 5000 });
    await this.optStatutEnCours.click();
    await this.getNbDossiers(); // attend le rechargement
  }

  async ouvrirFiltreTypeRelation() {
    await this.btnTypeRelation.click();
    await this.optTypePMClient.waitFor({ state: 'visible', timeout: 5000 });
  }

  async ouvrirFiltreRisque() {
    await this.btnRisque.click();
    await this.optRisqueFort.waitFor({ state: 'visible', timeout: 5000 });
  }

  async effacerFiltres() {
    if (await this.btnEffacerFiltres.isVisible().catch(() => false)) {
      await this.btnEffacerFiltres.click();
      // Attend le rechargement de la liste via getNbDossiers
      await this.getNbDossiers();
    }
  }

  // ---------------------------------------------------------------------------
  // Recherche
  // ---------------------------------------------------------------------------

  async rechercher(terme) {
    await this.champRecherche.click();
    await this.champRecherche.fill(terme);
    await this.champRecherche.press('Enter');
    ajouterLog(`Recherche : "${terme}"`, 'Portefeuille', 'info');
  }

  async viderRecherche() {
    await this.champRecherche.fill('');
    await this.champRecherche.press('Enter');
    await this.effacerFiltres();
  }

  // ---------------------------------------------------------------------------
  // Cards entreprises
  // ---------------------------------------------------------------------------

  /**
   * Retourne le locator de la card d'une entreprise par dénomination
   * @param {string} denomination
   */
  getCardEntreprise(denomination) {
    return this.page.getByRole('link', { name: new RegExp(denomination, 'i') }).first();
  }

  async getInnerHTMLCard(denomination) {
    const card = this.getCardEntreprise(denomination);
    await card.waitFor({ state: 'visible', timeout: 10000 });
    return card.innerHTML();
  }

}

module.exports = { PortefeuillePage };
