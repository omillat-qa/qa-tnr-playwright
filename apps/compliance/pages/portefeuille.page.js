'use strict';

// apps/compliance/pages/portefeuille.page.js
// Page Object — Portefeuille (page /folders) Compliance for Business v2

const { ajouterLog } = require('../../../shared/utils/logger');
const { mesurer }    = require('../../../shared/utils/metrics');

class PortefeuillePage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // --- Navigation ---
    // Compliance for Business utilise data-cy (pas data-testid)
    this.lienMenuPortefeuille = page.locator('[data-cy="sidebarMenu.wallet"]');

    // --- Bascule vue ---
    this.btnVueCarte = page.locator('[data-cy="wallet.cardView"]');
    this.btnVueListe = page.locator('[data-cy="wallet.listView"]');

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

    // --- Recherche ---
    this.champRecherche       = page.locator('[data-cy="wallet.search"]');

    // --- Contenu ---
    this.titrePortefeuille    = page.getByRole('heading', { name: 'Portefeuille' });
    // Vue carte : dd[data-cy="wallet.cardView.folders.total"]
    // Vue liste : dd[data-cy="wallet.listView.evals.total"]
    this.labelNbDossiersCarte = page.locator('dd[data-cy="wallet.cardView.folders.total"]');
    this.labelNbDossiersListe = page.locator('dd[data-cy="wallet.listView.evals.total"]');
    this.messageAucunResultat = page.getByRole('heading', { name: 'Aucun résultat' });
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async allerAuPortefeuille() {
    await mesurer('portefeuille.chargement', async () => {
      await this.lienMenuPortefeuille.click();
      await this.page.waitForURL('**/folders**');
    }, { app: 'compliance-v2' });
    ajouterLog('Navigation vers le Portefeuille', 'Portefeuille', 'info');
  }

  // ---------------------------------------------------------------------------
  // Gestion de la vue (carte / liste)
  // Equivalent de GetEtatpftListeOUCard() en UFT
  // ---------------------------------------------------------------------------

  /**
   * Retourne la vue active : 'carte' ou 'liste'
   * Détection via le bouton disabled : le bouton de la vue active est toujours disabled.
   * ex: si wallet.cardView est disabled → on est en vue carte.
   */
  async getVueActive() {
    const btnCarte = this.page.locator('[data-cy="wallet.cardView"]');
    const estDisabled = await btnCarte.getAttribute('disabled');
    return estDisabled !== null ? 'carte' : 'liste';
  }

  /**
   * Force le passage en vue carte si on est en vue liste.
   */
  async forcerVueCarte() {
    const vue = await this.getVueActive();
    if (vue === 'liste') {
      await this.btnVueCarte.click();
      await this.page.locator('app-card-view').waitFor({ state: 'visible' });
      ajouterLog('Bascule vers vue carte', 'Portefeuille', 'info');
    }
  }

  /**
   * Force le passage en vue liste si on est en vue carte.
   */
  async forcerVueListe() {
    const vue = await this.getVueActive();
    if (vue === 'carte') {
      await this.btnVueListe.click();
      await this.page.locator('app-list-view').waitFor({ state: 'visible' });
      ajouterLog('Bascule vers vue liste', 'Portefeuille', 'info');
    }
  }

  // ---------------------------------------------------------------------------
  // Compteur dossiers — fonctionne en vue liste ET vue carte
  // ---------------------------------------------------------------------------

  async getNbDossiers() {
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
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async selectionnerStatutEnCours() {
    await this.btnStatutEval.click();
    await this.optStatutEnCours.waitFor({ state: 'visible', timeout: 5000 });
    await this.optStatutEnCours.click();
    await this.getNbDossiers();
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
  // Sélecteurs MODE CARTE
  // Structure DOM :
  //   app-card-view > .card > .title > h2 (nom entreprise)
  //   app-card-view > .card > .evaluations > a[href*="/relations/"]
  //     > .eval-id        (#73949)
  //     > .relation-type  (CLIENT / FOURNISSEUR)
  //     > app-font-icon.RED|GREEN|ORANGE (pastille)
  // ---------------------------------------------------------------------------

  /**
   * Retourne le conteneur .card d'une entreprise (mode carte).
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getCardEntreprise(denomination) {
    return this.page
      .locator('app-card-view .card')
      .filter({ has: this.page.locator('h2', { hasText: denomination }) });
  }

  /**
   * Retourne le lien de l'évaluation dans une card (mode carte).
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getLienEvaluationCarte(denomination) {
    return this.getCardEntreprise(denomination)
      .locator('a[href*="/relations/"]')
      .first();
  }

  /**
   * Retourne le span contenant l'id d'évaluation (#73949) — mode carte uniquement.
   * Cet élément est ABSENT en mode liste.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getIdEvaluationCarte(denomination) {
    return this.getLienEvaluationCarte(denomination).locator('.eval-id');
  }

  /**
   * Retourne le span relation-type (CLIENT/FOURNISSEUR) — mode carte.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getRelationTypeCarte(denomination) {
    return this.getLienEvaluationCarte(denomination).locator('.relation-type');
  }

  /**
   * Retourne la pastille de risque (RED/GREEN/ORANGE) — mode carte.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getPastilleCarte(denomination) {
    return this.getLienEvaluationCarte(denomination)
      .locator('app-font-icon.RED, app-font-icon.GREEN, app-font-icon.ORANGE')
      .first();
  }

  /**
   * Retourne l'innerHTML de la card (compatibilité anciens tests PTF_061_x).
   * @param {string} denomination
   */
  async getInnerHTMLCard(denomination) {
    const card = this.getCardEntreprise(denomination);
    await card.waitFor({ state: 'visible', timeout: 10000 });
    return card.innerHTML();
  }

  // ---------------------------------------------------------------------------
  // Sélecteurs MODE LISTE
  // Structure DOM :
  //   app-list-view tr.cdk-row > td.cdk-column-updateDate  (date JJ/MM/AAAA)
  //   app-list-view tr.cdk-row > td.cdk-column-relation > span.relation
  //   app-list-view tr.cdk-row > td.cdk-column-score > app-font-icon.RED|...
  //   app-list-view tr.cdk-row > td.cdk-column-folder > span (nom entreprise)
  //   app-list-view tr.cdk-row > td.cdk-column-statut       (statut)
  // Note : l'id évaluation (#73949) est ABSENT en mode liste.
  // ---------------------------------------------------------------------------

  /**
   * Retourne la ligne <tr> d'une entreprise (mode liste).
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getLigneEntreprise(denomination) {
    return this.page
      .locator('app-list-view tr.cdk-row')
      .filter({
        has: this.page.locator('.cdk-column-folder', { hasText: denomination })
      });
  }

  /**
   * Retourne la cellule Relation (CLIENT/FOURNISSEUR) — mode liste.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getRelationTypeListe(denomination) {
    return this.getLigneEntreprise(denomination)
      .locator('.cdk-column-relation .relation');
  }

  /**
   * Retourne la pastille de risque (RED/GREEN/ORANGE) — mode liste.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getPastilleListe(denomination) {
    return this.getLigneEntreprise(denomination)
      .locator('app-font-icon.RED, app-font-icon.GREEN, app-font-icon.ORANGE')
      .first();
  }

  /**
   * Retourne la cellule Statut — mode liste uniquement.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getStatutListe(denomination) {
    return this.getLigneEntreprise(denomination).locator('.cdk-column-statut');
  }

  /**
   * Retourne la cellule date de mise à jour — mode liste uniquement.
   * @param {string} denomination  ex: 'ARTHEMIS'
   */
  getDateMajListe(denomination) {
    return this.getLigneEntreprise(denomination).locator('.cdk-column-updateDate');
  }

}

module.exports = { PortefeuillePage };
