'use strict';

// shared/reporter/tnr-reporter.js
// Reporter custom Playwright — collecte pass/fail + durées de tous les tests
// Fichiers de sortie nommés d'après le projet : results-[projet].json, history-[projet].json/.csv

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../test-output');

class TnrReporter {

  constructor() {
    this.runDebut    = Date.now();
    this.resultats   = [];
    this.suites      = {};
    this.nomProjet   = 'run';  // sera défini au premier onTestEnd
  }

  onBegin(config, suite) {
    this.runDebut = Date.now();
    console.log(`\n[TNR Reporter] Début du run — ${suite.allTests().length} tests`);

    // Remettre metrics.json à zéro pour ce run
    try {
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(path.join(OUTPUT_DIR, 'metrics.json'), JSON.stringify([], null, 2));
    } catch {}
  }

  onTestEnd(test, result) {
    const project  = test.parent?.project?.() || {};
    const metadata = project.metadata || {};

    // Récupère le nom du projet Playwright — ignore le setup
    if (project.name && !project.name.startsWith('setup-') && this.nomProjet === 'run') {
      this.nomProjet = project.name;
    }

    // Nettoie le module — setup → 'Setup', sinon titre du describe
    const rawModule = test.parent?.title || 'Sans module';
    const module = rawModule.includes('.setup.js') || rawModule.includes('.js')
      ? 'Setup'
      : rawModule;

    // Extrait l'ID fonctionnel ([PTF_01], [R_001], [PERF]...)
    const idMatch = test.title.match(/\[([^\]]+)\]/);
    const idFonctionnel = idMatch ? idMatch[1] : null;

    const entree = {
      id:       idFonctionnel,
      titre:    test.title,
      module,
      projet:   project.name || 'inconnu',
      app:      metadata.app     || 'inconnue',
      env:      metadata.env     || 'inconnu',
      browser:  metadata.browser || 'inconnu',
      statut:   result.status,
      duree_ms: result.duration,
      erreur:   result.status === 'failed' ? (result.error?.message?.split('\n')[0] || null) : null,
      timestamp: new Date().toISOString(),
    };

    this.resultats.push(entree);

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

    // Fichier de résultats nommé d'après le projet
    const outputFile = path.join(OUTPUT_DIR, `results-${this.nomProjet}.json`);

    const output = {
      run: {
        projet:   this.nomProjet,
        debut:    new Date(this.runDebut).toISOString(),
        fin:      new Date().toISOString(),
        duree_ms: dureeRun,
        statut:   result.status,
        total,
        passes,
        echecs,
      },
      recap_modules: Object.entries(this.suites).map(([module, data]) => ({
        module,
        total:  data.total,
        echecs: data.echecs,
        libelle: data.echecs === 0
          ? `Recap ${module} OK (${data.total}/${data.total})`
          : `Recap ${module} ${data.echecs} err sur ${data.total}`,
      })),
      tests: this.resultats,
    };

    try {
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
      console.log(`\n[TNR Reporter] Résultats écrits : ${outputFile}`);
      console.log(`[TNR Reporter] ${passes}/${total} passés en ${(dureeRun / 1000).toFixed(1)}s`);

      console.log('\n--- Récap modules ---');
      output.recap_modules.forEach(m => console.log(m.libelle));
      console.log('-------------------\n');

      this._archiverMetrics();

    } catch (e) {
      console.error('[TNR Reporter] Erreur écriture résultats:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Archivage historique — nommé d'après le projet
  // history-[nomProjet].json + .csv
  // ---------------------------------------------------------------------------

  _archiverMetrics() {
    try {
      const metricsFile = path.join(OUTPUT_DIR, 'metrics.json');
      if (!fs.existsSync(metricsFile)) return;

      const metricsRun = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      if (!metricsRun.length) return;

      const runDate  = new Date(this.runDebut).toISOString().slice(0, 10);
      const histFile = path.join(OUTPUT_DIR, `history-${this.nomProjet}.json`);
      const csvFile  = path.join(OUTPUT_DIR, `history-${this.nomProjet}.csv`);

      // --- JSON historique ---
      let history = [];
      if (fs.existsSync(histFile)) {
        try { history = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch {}
      }
      history.push({
        run_date: new Date(this.runDebut).toISOString(),
        projet:   this.nomProjet,
        mesures:  metricsRun,
      });
      if (history.length > 90) history = history.slice(-90);
      fs.writeFileSync(histFile, JSON.stringify(history, null, 2));

      // --- CSV historique ---
      const csvHeader = 'run_date,timestamp,projet,app,env,motcle,statut,nb_resultats,temps_ux_ms,temps_post_ms\n';
      if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, csvHeader);
      }

      const lignes = metricsRun
        .filter(m => m.nom === 'recherche.solr')
        .map(m =>
          `${runDate},${m.timestamp},${this.nomProjet},${m.app},${m.env},"${m.motcle}",${m.statut},${m.nb_resultats ?? ''},${m.temps_ux_ms ?? ''},${m.temps_post_ms ?? ''}`
        )
        .join('\n');

      if (lignes) fs.appendFileSync(csvFile, lignes + '\n');

      console.log(`[TNR Reporter] Historique mis à jour : history-${this.nomProjet}.json + .csv`);

    } catch (e) {
      console.warn('[TNR Reporter] Archivage métriques :', e.message);
    }
  }
}

module.exports = TnrReporter;
