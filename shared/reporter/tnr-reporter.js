'use strict';

// shared/reporter/tnr-reporter.js
// Reporter custom Playwright
//
// Structure de sortie :
//   test-output/
//     runs/
//       run-20260512-143000/        ← un dossier par run (timestamp)
//         results.json              ← résultats consolidés tous projets
//         metrics.json              ← métriques perf du run
//         log.txt                   ← logs du run
//     history-[projet-perf].json    ← historique perf 90 jours
//     history-[projet-perf].csv     ← idem CSV pour Excel

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../test-output');
const RUNS_DIR   = path.join(OUTPUT_DIR, 'runs');

function makeTimestamp(date) {
  const d = date || new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

class TnrReporter {

  constructor() {
    this.runDebut  = Date.now();
    this.runDir    = null;
    this.resultats = [];
    this.suites    = {};   // { [module]: { total, passes, echecs, skips, tests[] } }
    this.projetsMap = {};  // { [nomProjet]: { total, passes, echecs, skips } }
  }

  onBegin(config, suite) {
    this.runDebut = Date.now();

    const ts = makeTimestamp(new Date(this.runDebut));
    this.runDir = path.join(RUNS_DIR, `run-${ts}`);
    fs.mkdirSync(this.runDir, { recursive: true });

    fs.writeFileSync(path.join(this.runDir, 'metrics.json'), JSON.stringify([], null, 2));

    process.env.TNR_RUN_DIR = this.runDir;

    console.log(`\n[TNR Reporter] Début du run — ${suite.allTests().length} tests`);
    console.log(`[TNR Reporter] Dossier : ${this.runDir}`);
  }

  onTestEnd(test, result) {
    const project   = test.parent?.project?.() || {};
    const metadata  = project.metadata || {};
    const nomProjet = project.name || 'inconnu';

    const rawModule = test.parent?.title || 'Sans module';
    const module = rawModule.includes('.setup.js') || rawModule.endsWith('.js')
      ? 'Setup'
      : rawModule;

    const idMatch = test.title.match(/\[([^\]]+)\]/);
    const idFonctionnel = idMatch ? idMatch[1] : null;

    const entree = {
      id:        idFonctionnel,
      titre:     test.title,
      module,
      projet:    nomProjet,
      app:       metadata.app     || 'inconnue',
      env:       metadata.env     || 'inconnu',
      browser:   metadata.browser || 'inconnu',
      statut:    result.status,
      duree_ms:  result.duration,
      erreur:    result.status === 'failed' ? (result.error?.message?.split('\n')[0] || null) : null,
      timestamp: new Date().toISOString(),
    };

    this.resultats.push(entree);

    if (module === 'Setup') return;

    // --- Agrégation par module ---
    if (!this.suites[module]) {
      this.suites[module] = { total: 0, passes: 0, echecs: 0, skips: 0, tests: [] };
    }
    const s = this.suites[module];
    if (result.status === 'passed')                                { s.total++; s.passes++; }
    else if (result.status === 'failed' || result.status === 'timedOut') { s.total++; s.echecs++; }
    else if (result.status === 'skipped')                          { s.skips++; }
    s.tests.push(entree);

    // --- Agrégation par projet ---
    if (!nomProjet.startsWith('setup-')) {
      if (!this.projetsMap[nomProjet]) {
        this.projetsMap[nomProjet] = { total: 0, passes: 0, echecs: 0, skips: 0 };
      }
      const p = this.projetsMap[nomProjet];
      if (result.status === 'passed')                                { p.total++; p.passes++; }
      else if (result.status === 'failed' || result.status === 'timedOut') { p.total++; p.echecs++; }
      else if (result.status === 'skipped')                          { p.skips++; }
    }
  }

  onEnd(result) {
    const dureeRun = Date.now() - this.runDebut;

    // Compteurs globaux — exclut Setup et skipped
    const testsComptables = this.resultats.filter(r => r.module !== 'Setup' && r.statut !== 'skipped');
    const total  = testsComptables.length;
    const passes = testsComptables.filter(r => r.statut === 'passed').length;
    const echecs = testsComptables.filter(r => r.statut === 'failed' || r.statut === 'timedOut').length;
    const skips  = this.resultats.filter(r => r.statut === 'skipped' && r.module !== 'Setup').length;

    // recap_projets — un résumé par projet non-setup
    const recap_projets = Object.entries(this.projetsMap).map(([projet, data]) => ({
      projet,
      total:   data.total,
      passes:  data.passes,
      echecs:  data.echecs,
      skips:   data.skips,
    }));

    const output = {
      run: {
        id:       path.basename(this.runDir),
        projets:  Object.keys(this.projetsMap),
        debut:    new Date(this.runDebut).toISOString(),
        fin:      new Date().toISOString(),
        duree_ms: dureeRun,
        statut:   result.status,
        total,
        passes,
        echecs,
        skips,
      },
      recap_modules: Object.entries(this.suites).map(([module, data]) => ({
        module,
        total:   data.total,
        passes:  data.passes,
        echecs:  data.echecs,
        skips:   data.skips,
        libelle: data.echecs === 0
          ? `Recap ${module} OK (${data.passes}/${data.total})`
          : `Recap ${module} ${data.echecs} err sur ${data.total}`,
      })),
      recap_projets,
      tests: this.resultats,
    };

    try {
      const resultsFile = path.join(this.runDir, 'results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(output, null, 2));

      console.log(`\n[TNR Reporter] Résultats écrits : ${resultsFile}`);
      console.log(`[TNR Reporter] ${passes}/${total} passés en ${(dureeRun / 1000).toFixed(1)}s`);
      if (skips > 0) console.log(`[TNR Reporter] ${skips} test(s) ignorés (fixme/skip)`);

      console.log('\n--- Récap modules ---');
      output.recap_modules.forEach(m => console.log(m.libelle));
      console.log('-------------------\n');

      this._archiverMetrics(output);

    } catch (e) {
      console.error('[TNR Reporter] Erreur écriture résultats:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Archivage historique perf — history-[projet].json + .csv
  // ---------------------------------------------------------------------------

  _archiverMetrics(output) {
    try {
      const metricsFile = path.join(this.runDir, 'metrics.json');
      if (!fs.existsSync(metricsFile)) return;

      const metricsRun = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      if (!metricsRun.length) return;

      const firstMetric   = metricsRun[0];
      const app           = firstMetric.app || 'unknown';
      const env           = firstMetric.env || 'unknown';
      const nomProjetPerf = output.run.projets.find(p => p.startsWith('perf-')) || `${app}-${env}`;

      const runDate  = new Date(this.runDebut).toISOString().slice(0, 10);
      const histFile = path.join(OUTPUT_DIR, `history-${nomProjetPerf}.json`);
      const csvFile  = path.join(OUTPUT_DIR, `history-${nomProjetPerf}.csv`);

      let history = [];
      if (fs.existsSync(histFile)) {
        try { history = JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch {}
      }
      history.push({
        run_id:   path.basename(this.runDir),
        run_date: new Date(this.runDebut).toISOString(),
        projet:   nomProjetPerf,
        mesures:  metricsRun,
      });
      if (history.length > 90) history = history.slice(-90);
      fs.writeFileSync(histFile, JSON.stringify(history, null, 2));

      const csvHeader = 'run_id,run_date,timestamp,projet,app,env,motcle,statut,nb_resultats,temps_ux_ms,temps_post_ms\n';
      if (!fs.existsSync(csvFile)) fs.writeFileSync(csvFile, csvHeader);

      const lignes = metricsRun
        .filter(m => m.nom === 'recherche.solr')
        .map(m =>
          `${path.basename(this.runDir)},${runDate},${m.timestamp},${nomProjetPerf},${m.app},${m.env},"${m.motcle}",${m.statut},${m.nb_resultats ?? ''},${m.temps_ux_ms ?? ''},${m.temps_post_ms ?? ''}`
        ).join('\n');
      if (lignes) fs.appendFileSync(csvFile, lignes + '\n');

      console.log(`[TNR Reporter] Historique mis à jour : history-${nomProjetPerf}.json + .csv`);

    } catch (e) {
      console.warn('[TNR Reporter] Archivage métriques :', e.message);
    }
  }
}

module.exports = TnrReporter;
