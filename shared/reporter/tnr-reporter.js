'use strict';

// shared/reporter/tnr-reporter.js
// Reporter custom Playwright — collecte pass/fail + durées de tous les tests
// Génère playwright-report/tnr-results.json après chaque run
// Ce JSON sera la source pour l'email récap et Grafana/Pushgateway

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR  = path.resolve(__dirname, '../../playwright-report');
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
      const metricsFile = path.resolve(__dirname, '../../playwright-report/metrics.json');
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
    } catch (e) {
      console.error('[TNR Reporter] Erreur écriture résultats:', e.message);
    }
  }
}

module.exports = TnrReporter;
