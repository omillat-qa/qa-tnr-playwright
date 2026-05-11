'use strict';

// shared/reporter/tnr-reporter.js
// Reporter custom Playwright — collecte pass/fail + durées de tous les tests
// Génère playwright-report/tnr-results.json après chaque run
// Ce JSON sera la source pour l'email récap et Grafana/Pushgateway

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR  = path.resolve(__dirname, '../../test-output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tnr-results.json');

class TnrReporter {

  constructor() {
    this.runDebut   = Date.now();
    this.resultats  = [];
    this.suites     = {};
  }

  onBegin(config, suite) {
    this.runDebut = Date.now();
    console.log(`\n[TNR Reporter] Début du run — ${suite.allTests().length} tests`);

    // Remettre metrics.json à zéro pour ce run
    try {
      const metricsFile = path.resolve(__dirname, '../../test-output/metrics.json');
      const dir = path.dirname(metricsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(metricsFile, JSON.stringify([], null, 2));
    } catch {}
  }

  onTestEnd(test, result) {
    // Extraire les métadonnées du projet
    const project  = test.parent?.project?.() || {};
    const metadata = project.metadata || {};

    // Extraire le module depuis le describe parent
    // Pour les fichiers setup, on retourne 'Setup' proprement
    const rawModule = test.parent?.title || 'Sans module';
    const module = rawModule.includes('.setup.js') || rawModule.includes('.js')
      ? 'Setup'
      : rawModule;

    // Extraire l'ID fonctionnel depuis le titre ([R_001], [PTF_01]...)
    const idMatch = test.title.match(/\[([^\]]+)\]/);
    const idFonctionnel = idMatch ? idMatch[1] : null;

    const entree = {
      id:           idFonctionnel,
      titre:        test.title,
      module:       module,
      app:          metadata.app    || 'inconnue',
      env:          metadata.env    || 'inconnu',
      browser:      metadata.browser || 'inconnu',
      statut:       result.status,   // passed | failed | skipped | timedOut
      duree_ms:     result.duration,
      erreur:       result.status === 'failed' ? (result.error?.message?.split('\n')[0] || null) : null,
      timestamp:    new Date().toISOString(),
    };

    this.resultats.push(entree);

    // Agréger par module pour le récap email
    if (!this.suites[module]) {
      this.suites[module] = { total: 0, echecs: 0, tests: [] };
    }
    this.suites[module].total++;
    if (result.status !== 'passed') this.suites[module].echecs++;
    this.suites[module].tests.push(entree);
  }

  onEnd(result) {
    const dureeRun = Date.now() - this.runDebut;
    const total    = this.resultats.length;
    const passes   = this.resultats.filter(r => r.statut === 'passed').length;
    const echecs   = this.resultats.filter(r => r.statut !== 'passed').length;

    const output = {
      run: {
        debut:     new Date(this.runDebut).toISOString(),
        fin:       new Date().toISOString(),
        duree_ms:  dureeRun,
        statut:    result.status,
        total,
        passes,
        echecs,
      },
      // Format récap email — un bloc par module
      recap_modules: Object.entries(this.suites).map(([module, data]) => ({
        module,
        total:  data.total,
        echecs: data.echecs,
        libelle: data.echecs === 0
          ? `Recap ${module} OK (${data.total}/${data.total})`
          : `Recap ${module} ${data.echecs} err sur ${data.total}`,
      })),
      // Détail complet pour Grafana/Pushgateway
      tests: this.resultats,
    };

    try {
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
      console.log(`\n[TNR Reporter] Résultats écrits : ${OUTPUT_FILE}`);
      console.log(`[TNR Reporter] ${passes}/${total} passés en ${(dureeRun / 1000).toFixed(1)}s`);

      // Afficher le récap modules dans la console (format email)
      console.log('\n--- Récap modules ---');
      output.recap_modules.forEach(m => console.log(m.libelle));
      console.log('-------------------\n');

      // Archiver les métriques pour les courbes de tendance Grafana
      this._archiverMetrics(output);

    } catch (e) {
      console.error('[TNR Reporter] Erreur écriture résultats:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Archivage historique — accumule les runs sans écraser
  // ---------------------------------------------------------------------------

  _archiverMetrics(output) {
    try {
      const metricsFile = path.join(OUTPUT_DIR, 'metrics.json');
      if (!fs.existsSync(metricsFile)) return;

      const metricsRun = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      if (!metricsRun.length) return;

      // Identifier l'app+env du run depuis la première métrique
      const first   = metricsRun[0];
      const app     = first.app     || 'unknown';
      const env     = first.env     || 'unknown';
      const runDate = new Date(this.runDebut).toISOString().slice(0, 10); // YYYY-MM-DD

      // --- JSON historique ---
      const histFile = path.join(OUTPUT_DIR, `history-${app}-${env}.json`);
      let history = [];
      if (fs.existsSync(histFile)) {
        try { history = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch {}
      }

      // Ajouter le run courant avec son timestamp de run
      history.push({
        run_date:  new Date(this.runDebut).toISOString(),
        app,
        env,
        mesures:   metricsRun,
      });

      // Garder 90 jours max (90 runs quotidiens)
      if (history.length > 90) history = history.slice(-90);
      fs.writeFileSync(histFile, JSON.stringify(history, null, 2));

      // --- CSV historique (pour Excel / analyse ponctuelle) ---
      const csvFile = path.join(OUTPUT_DIR, `history-${app}-${env}.csv`);
      const csvHeader = 'run_date,timestamp,app,env,motcle,statut,nb_resultats,temps_ux_ms,temps_post_ms\n';

      if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, csvHeader);
      }

      const lignes = metricsRun
        .filter(m => m.nom === 'recherche.solr')
        .map(m =>
          `${runDate},${m.timestamp},${m.app},${m.env},"${m.motcle}",${m.statut},${m.nb_resultats ?? ''},${m.temps_ux_ms ?? ''},${m.temps_post_ms ?? ''}`
        )
        .join('\n');

      if (lignes) fs.appendFileSync(csvFile, lignes + '\n');

      console.log(`[TNR Reporter] Historique mis à jour : history-${app}-${env}.json + .csv`);

    } catch (e) {
      // Ne jamais faire planter le reporter à cause de l'archivage
      console.warn('[TNR Reporter] Archivage métriques :', e.message);
    }
  }
}

module.exports = TnrReporter;
