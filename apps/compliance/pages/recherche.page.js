'use strict';

// apps/compliance/pages/recherche.page.js
// Page Object — Recherche Compliance for Business v2
// Mesure temps UX (affichage résultats) et temps POST (requête Solr /RsCompliance/search)

const { ajouterLog } = require('../../../shared/utils/logger');
const { enregistrer } = require('../../../shared/utils/metrics');

class RechercheCompliancePage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.champRecherche       = page.locator('[data-cy="evaluation.search.pm"]');
    this.btnRechercher        = page.locator('[data-cy="searchButton"]');
    this.premiereCard         = page.locator('app-search-result').first();
    this.messageAucunResultat = page.locator('text=Aucun résultat').first();
    this.listeResultats       = page.locator('app-search-result');
  }

  /**
   * Recherche un mot-clé et retourne les métriques
   * @param {string} motCle
   * @param {Object} context - { app, env }
   */
  async rechercherEtMesurer(motCle, context = {}) {
    const page    = this.page;
    let tempsPost = null;
    let statut    = 'timeout';
    let nbResultats = 0;

    // Intercepte le POST Solr
    const postPromise = new Promise(resolve => {
      const onRequest = request => {
        if (request.url().includes('/RsCompliance/search') && request.method() === 'POST') {
          const debut = Date.now();
          const onResponse = response => {
            if (response.url().includes('/RsCompliance/search')) {
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
      setTimeout(() => resolve(null), 20000);
    });

    // Vide et remplit le champ
    await this.champRecherche.fill('');
    await this.champRecherche.fill(motCle);

    // Mesure temps UX
    const debutUX = Date.now();
    await this.btnRechercher.click();

    try {
      const resultat = await Promise.race([
        this.premiereCard.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'ok'),
        this.messageAucunResultat.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'vide'),
      ]);
      statut = resultat;
    } catch {
      statut = 'timeout';
    }

    const tempsUX = Date.now() - debutUX;
    await postPromise;

    // Compter les résultats visibles
    if (statut === 'ok') {
      try {
        nbResultats = await this.listeResultats.count();
      } catch {}
    }

    // Enregistrer la métrique
    enregistrer('recherche.solr', {
      app:           context.app || 'compliance-v2',
      env:           context.env || 'ua',
      motcle:        motCle,
      statut,
      nb_resultats:  nbResultats,
      temps_ux_ms:   tempsUX,
      temps_post_ms: tempsPost,
    });

    ajouterLog(
      `"${motCle}" → ${statut} | UX: ${tempsUX}ms | POST: ${tempsPost ?? 'NA'}ms | ${nbResultats} résultat(s)`,
      'Recherche-Perf-CFB',
      statut === 'ok' || statut === 'vide' ? 'success' : 'warning'
    );

    return { statut, tempsUX, tempsPost, nbResultats };
  }
}

module.exports = { RechercheCompliancePage };
