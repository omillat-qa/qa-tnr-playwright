'use strict';

// apps/compliance/pages/portefeuille.page.js
// Page Object — Portefeuille (page /folders) Compliance for Business v2
// Sélecteurs mis à jour après refactoring Angular (octobre 2026)
// Nouveau DOM card : .list > .folder-card avec data-cy="card.{id}.name"
// Nouveau DOM liste : app-data-table > table.wallet-list > tr.hoverable avec .column-*

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
    this.btnVueListe          = page.locator('[data-cy="wallet.listView"]');

    // --- Recherche ---
    this.champRecherche       = page.locator('[data-cy="wallet.search"]');

    // --- Contenu ---
    this.titrePortefeuille    = page.getByRole('heading', { name: 'Portefeuille' });
    // Vue liste : dd[data-cy="wallet.listView.evals.total"]
    // Vue carte : dd[data-cy="wallet.cardView.folders.total"]
    this.labelNbDossiersListe = page.locator('dd[data-cy="wallet.listView.evals.total"]');
    this.labelNbDossiersCarte = page.locator('dd[data-cy="wallet.cardView.folders.total"]');
    this.messageAucunResultat = page.locator('[data-cy="wallet.noResult"]');
    
																			
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
  // Nombre de dossiers — fonctionne en vue liste ET vue carte
												 
																				

	 
												
																						  
	 
						
																	  
																
													
   

	 
														  
	 
						  
										  
						  
									 
														  
																					
																   
	 
   

	 
														  
	 
						  
										  
						  
									 
																			 
																   
	 
   

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
  // Vue carte — nouveau DOM : .folder-card
  // data-cy="card.{folderId}.name" sur le span du nom
															   
																						 
								   
												 
													
																
  // ---------------------------------------------------------------------------

  /**
   * Retourne le locator du folder-card d'une entreprise par dénomination.
   * Utilise data-cy$=".name" pour matcher sans connaître le folderId.
   * @param {string} denomination
   */
  getCardEntreprise(denomination) {
    return this.page
      .locator('.folder-card')
      .filter({ has: this.page.locator('[data-cy$=".name"]').filter({ hasText: denomination }) });
  }

  /**
   * Retourne le lien titre de la card (a.title → /folders/{id})
   * C'est ce lien qu'on clique pour aller sur la page dossier.
   * @param {string} denomination
   */
  getLienTitreCarte(denomination) {
    return this.getCardEntreprise(denomination).locator('a.title');
  }

  /**
   * Retourne le premier lien évaluation de la card.
   * Sélecteur : a[data-cy*=".evaluation."][data-cy$=".link"]
   * @param {string} denomination
   */
  getLienEvaluationCarte(denomination) {
    return this.getCardEntreprise(denomination)
      .locator('a[data-cy*=".evaluation."][data-cy$=".link"]')
      .first();
  }

  /**
   * Retourne l'ID évaluation (#xxxxx) dans la card.
   * @param {string} denomination
   */
  getIdEvaluationCarte(denomination) {
    return this.getLienEvaluationCarte(denomination).locator('.eval-id');
  }

  /**
   * Retourne le libellé du type de relation (CLIENT, FOURNISSEUR, …) — vue carte.
   * @param {string} denomination
   */
  getRelationTypeCarte(denomination) {
    return this.getLienEvaluationCarte(denomination).locator('.relation-type');
  }

  /**
   * Retourne la pastille de risque (app-font-icon.RED|GREEN|ORANGE) — vue carte.
   * @param {string} denomination
   */
  getPastilleCarte(denomination) {
    return this.getLienEvaluationCarte(denomination)
      .locator('app-font-icon.RED, app-font-icon.GREEN, app-font-icon.ORANGE')
      .first();
  }

  /**
   * Récupère l'innerHTML complet du folder-card (utilisé par PTF_061_1/2/3).
   * @param {string} denomination
   */
  async getInnerHTMLCard(denomination) {
    const card = this.getCardEntreprise(denomination);
    await card.waitFor({ state: 'visible', timeout: 15000 });
    return card.innerHTML();
  }

  /**
   * Clique sur le lien titre d'un folder-card pour accéder à la page dossier.
   * @param {string} denomination
   */
  async cliqueSurCarte(denomination) {
    const lien = this.getLienTitreCarte(denomination);
    await lien.waitFor({ state: 'visible', timeout: 15000 });
    await lien.click();
  }

  /**
   * Force le passage en vue carte et attend que les cards soient visibles.
   */
  async forcerVueCarte() {
    if (await this.btnVueCarte.isVisible().catch(() => false)) {
      await this.btnVueCarte.click();
    }
    await this.page.locator('.folder-card').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  // ---------------------------------------------------------------------------
  // Vue liste — nouveau DOM : app-data-table > table.wallet-list > tr.hoverable
  // Classes colonnes : .column-* (sans préfixe cdk-)
																			 
																		
																			 
																			  
																	 
															   
  // ---------------------------------------------------------------------------

  /**
   * Retourne le locator de la ligne tr.hoverable d'une entreprise par dénomination.
   * La colonne nom est th.column-folder contenant app-symbol-label avec le texte.
   * @param {string} denomination
   */
  getLigneEntreprise(denomination) {
    return this.page
      .locator('table.wallet-list tr.hoverable')
			   
      .filter({ has: this.page.locator('.column-folder', { hasText: denomination }) });
		 
  }

  /**
   * Retourne le libellé du type de relation (CLIENT, FOURNISSEUR, …) — vue liste.
   * Colonne : td.column-relationship > span.relation
   * @param {string} denomination
   */
  getRelationTypeListe(denomination) {
    return this.getLigneEntreprise(denomination).locator('.column-relationship .relation');
												 
  }

  /**
   * Retourne la pastille de risque (app-font-icon.RED|GREEN|ORANGE) — vue liste.
   * Colonne : td.column-score > span.risks > app-font-icon
   * @param {string} denomination
   */
  getPastilleListe(denomination) {
    return this.getLigneEntreprise(denomination)
      .locator('app-font-icon.RED, app-font-icon.GREEN, app-font-icon.ORANGE')
      .first();
  }

  /**
   * Retourne la cellule statut — vue liste.
   * Colonne : td.column-statut
   * @param {string} denomination
   */
  getStatutListe(denomination) {
    return this.getLigneEntreprise(denomination).locator('.column-statut');
  }

  /**
   * Retourne la cellule date de mise à jour — vue liste.
   * Colonne : td.column-updateDate
   * @param {string} denomination
   */
  getDateMajListe(denomination) {
    return this.getLigneEntreprise(denomination).locator('.column-updateDate');
  }

  /**
   * Force le passage en vue liste et attend que le tableau soit visible.
   */
  async forcerVueListe() {
    if (await this.btnVueListe.isVisible().catch(() => false)) {
      await this.btnVueListe.click();
    }
    await this.page.locator('table.wallet-list').waitFor({ state: 'visible', timeout: 10000 });
  }

}

module.exports = { PortefeuillePage };