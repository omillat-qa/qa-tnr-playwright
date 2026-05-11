'use strict';

// apps/ellipro-risk/pages/recherche.page.js
// Page Object — Recherche Ellipro Risk (Angular)
// Mesure temps UX (affichage résultats) et temps POST (requête Solr)

const { ajouterLog } = require('../../../shared/utils/logger');
const { enregistrer } = require('../../../shared/utils/metrics');

class RecherchePage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    this.champRecherche    = page.locator('input[placeholder="Recherche par raison sociale ou identifiant"]');
    this.carteResultat     = page.locator('#card-company-result').first();
    this.messageAucunResultat = page.locator('h6:has-text("Pas de résultat")').first();
    this.banniereResultats = page.locator('section.resultInfoBanner h6').first();
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
        const texte = await this.banniereResultats.innerText().catch(() => '');
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

module.exports = { RecherchePage };
