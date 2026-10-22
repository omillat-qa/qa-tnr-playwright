'use strict';

// apps/ellipro-risk/pages/recherche.page.js
// Page Object — Recherche Ellipro Risk (Angular)
// Mesure temps UX (affichage résultats) et temps POST (requête Solr)

const { expect } = require('@playwright/test');
const { ajouterLog } = require('../../../shared/utils/logger');
const { enregistrer } = require('../../../shared/utils/metrics');

// Les raisons sociales peuvent contenir plusieurs espaces d'affilée, que l'affichage fusionne
const norm    = texte => texte.replace(/\s+/g, ' ').trim();
const libelle = texte => norm(texte.replace(/^search/, ''));     // libellé d'une suggestion sans l'icône
const valeur  = async champ => norm(await champ.inputValue());

class RecherchePage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.champRecherche    = page.getByTestId('search-input');
    this.carteResultat     = page.locator('#card-company-result').first();
    this.messageAucunResultat = page.locator('h6:has-text("Pas de résultat")').first();
    this.banniereResultats = page.getByRole('heading', { name: /\d+\s+résultat/ }).first();

    // TNR recherche QUI / OÙ
    this.champOu             = page.getByRole('combobox', { name: 'Où ? (Code Postal ou Ville)' });
    this.loupe               = page.getByTestId('search-button');
    this.resultats           = page.getByTestId('company-search-result');
    this.nomEntreprise       = page.getByTestId('company-name');
    this.libelleSurveillance = page.getByTestId('monitored-label');
    // Le panneau d'autocomplétion contient aussi l'historique et les modes de recherche :
    // les suggestions sont les options précédées de l'icône « search »
    this.suggestions  = page.getByRole('option').filter({ has: page.locator('mat-icon', { hasText: /^search$/ }) });
    // CSS : Material n'expose l'option active au clavier que par la classe .mat-mdc-option-active
    this.optionActive = this.suggestions.and(page.locator('.mat-mdc-option-active'));
    // CSS : panneau CDK de la recherche avancée, sans data-testid ni rôle exploitable
    this.panneauAvance = page.locator('.cdk-overlay-pane');
  }

  // ---------------------------------------------------------------------------
  // TNR recherche QUI / OÙ
  // ---------------------------------------------------------------------------

  /**
   * Accueil connecté, champ QUI prêt
   * Bandeau cookies : il peut s'afficher après la redirection Keycloak, on attend donc
   * le premier élément visible (bandeau OU champ). isVisible() n'attend pas.
   * @param {string} baseURL
   */
  async ouvrirAccueil(baseURL) {
    const page = this.page;
    await page.goto(`${baseURL}/AppEllipro/`, { waitUntil: 'domcontentloaded' });

    const btnCookies = page.getByTestId('acceptCookiesBtn')
      .or(page.locator('#acceptCookiesBtn, button:has-text("J\'ACCEPTE")')).first();
    await btnCookies.or(this.champRecherche).first().waitFor({ state: 'visible', timeout: 15000 });
    if (await btnCookies.isVisible()) {
      await btnCookies.click();
      await page.waitForTimeout(300);
    }

    await expect(this.champRecherche).toBeVisible({ timeout: 15000 });
  }

  // Le contrôle de saisie est différé : on attend la loupe active avant de valider
  async saisirQui(texte) {
    await this.champRecherche.click();
    await this.champRecherche.pressSequentially(texte);
    await expect(this.loupe).toBeEnabled();
  }

  // QUI saisi, autocomplétion du QUI refermée, curseur dans le OÙ
  async preparerOu(entreprise) {
    await this.saisirQui(entreprise);
    await this.champRecherche.press('Escape');
    await expect(this.champOu).toBeEnabled();
    await this.champOu.click();
  }

  async attendreResultats() {
    await expect(this.page).toHaveURL(/\/search-company-result\/quick\//);
    await expect(this.resultats.first()).toBeVisible();
    return this.resultats;
  }

  // Libellés des suggestions affichées, normalisés
  async libelles() {
    return (await this.suggestions.allInnerTexts()).map(libelle);
  }

  /**
   * Recherche avancée : les modes s'affichent dans le panneau ouvert au clic dans le QUI
   * @param {string} mode   - libellé du bouton radio (ex: 'téléphone')
   * @param {string} saisie
   */
  async rechercheAvancee(mode, saisie) {
    await this.champRecherche.click();
    await this.page.getByRole('radio', { name: mode }).click();
    await this.panneauAvance.locator('input[type=text]:visible').first().fill(saisie);
    await this.panneauAvance.getByRole('button', { name: 'RECHERCHE' }).click();
  }

  // ---------------------------------------------------------------------------
  // Recherche d'un mot-clé avec mesure des temps UX et POST
  // ---------------------------------------------------------------------------

  /**
   * Recherche un mot-clé et retourne les métriques
   * @param {string} motCle
   * @param {Object} context - { app, env } pour les métriques
   * @returns {{ statut: 'ok'|'vide'|'timeout', tempsUX: number, tempsPost: number, nbResultats: number }}
   */
  async rechercherEtMesurer(motCle, context = {}) {
    const page        = this.page;
    let tempsPost     = null;
    let statut        = 'timeout';
    let nbResultats   = 0;

    // Intercepte la requête POST Solr pour mesurer le temps serveur
    const postPromise = new Promise(resolve => {
      const onRequest = request => {
        if (request.url().includes('/RsEllipro/search/fr/') && request.method() === 'POST') {
          const debut = Date.now();
          const onResponse = response => {
            if (response.url() === request.url()) {
              tempsPost = Date.now() - debut;
              page.off('response', onResponse);
              resolve(tempsPost);
            }
          };
          page.on('response', onResponse);
          page.off('request', onRequest);
        }
      };
      page.on('request', onRequest);
      // Timeout sécurité si pas de POST détecté
      setTimeout(() => resolve(null), 20000);
    });

    // Vide le champ et saisit le mot-clé
    await this.champRecherche.fill('');
    await this.champRecherche.fill(motCle);
    await page.waitForTimeout(200);

    // Mesure le temps UX — du clic jusqu'à l'affichage
    const debutUX = Date.now();
    await this.champRecherche.press('Enter');

    let tempsUX = 0;
    try {
      const resultat = await Promise.race([
        this.carteResultat.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'ok'),
        this.messageAucunResultat.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'vide'),
      ]);
      tempsUX = Date.now() - debutUX;
      statut  = resultat;
    } catch {
      tempsUX = Date.now() - debutUX;
      statut  = 'timeout';
    }

    // Attend la réponse POST
    await postPromise;

    // Nb résultats si OK
    if (statut === 'ok') {
      try {
        const texte = await this.banniereResultats.innerText({ timeout: 5000 }).catch(() => '');
        const match = texte.match(/(\d+)\s+résultat/);
        if (match) nbResultats = parseInt(match[1], 10);
      } catch {}
    }

    // Enregistre dans metrics.json
    enregistrer('recherche.solr', {
      app:           context.app || 'ellipro-risk',
      env:           context.env || 'ua',
      motcle:        motCle,
      statut,
      nb_resultats:  nbResultats,
      temps_ux_ms:   tempsUX,
      temps_post_ms: tempsPost,
    });

    ajouterLog(
      `"${motCle}" → ${statut} | UX: ${tempsUX}ms | POST: ${tempsPost ?? 'NA'}ms | ${nbResultats} résultat(s)`,
      'Recherche-Perf',
      statut === 'ok' || statut === 'vide' ? 'success' : 'warning'
    );

    return { statut, tempsUX, tempsPost, nbResultats };
  }
}

module.exports = { RecherchePage, libelle, valeur };
