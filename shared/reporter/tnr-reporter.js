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
//     data/
//       runs-AAAA-MM.jsonl          ← une ligne par projet et par run
//       tests-AAAA-MM.jsonl         ← une ligne par test (dernière tentative)
//       mesures-AAAA-MM.jsonl       ← une ligne par mesure (perf, chargements)

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../test-output');
const RUNS_DIR   = path.join(OUTPUT_DIR, 'runs');
const DATA_DIR   = path.join(OUTPUT_DIR, 'data');

// `--list` : Playwright appelle onBegin/onEnd sans rien exécuter → rien à archiver
const MODE_LISTE = process.argv.includes('--list');

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
    this.projetsPrevus = {}; // { [nomProjet]: { prevus, metadata, dependances[] } } — depuis onBegin
  }

  onBegin(config, suite) {
    this.runDebut = Date.now();

    const ts = makeTimestamp(new Date(this.runDebut));
    this.runDir = path.join(RUNS_DIR, `run-${ts}`);
    fs.mkdirSync(this.runDir, { recursive: true });

    process.env.TNR_RUN_DIR = this.runDir;

    console.log(`\n[TNR Reporter] Début du run — ${suite.allTests().length} tests`);
    console.log(`[TNR Reporter] Dossier : ${this.runDir}`);

    // Tests prévus par projet : permet de tracer les projets jamais exécutés (setup KO)
    // et les tests non joués (run interrompu, --max-failures)
    for (const s of suite.suites) {
      const projet = config.projects.find(p => p.name === s.title) || {};
      this.projetsPrevus[s.title] = {
        prevus:      s.allTests().length,
        metadata:    projet.metadata || {},
        dependances: projet.dependencies || [],
      };
    }

    // Perf + TNR dans le même run → mesures perf faussées par la charge parallèle
    const projetsLances = suite.suites.filter(s => s.allTests().length).map(s => s.title);
    if (projetsLances.some(p => p.startsWith('perf-')) && projetsLances.some(p => p.startsWith('tnr-'))) {
      console.warn('[TNR Reporter] ⚠ Projets perf et tnr dans le même run — lancer la perf seule pour des mesures fiables');
    }
  }

  onTestEnd(test, result) {
    // Retry : une tentative en échec qui sera rejouée n'est pas le résultat final
    // → on l'ignore pour ne pas compter le test deux fois (échec + succès)
    const estDerniereTentative =
      result.status === 'passed' ||
      result.status === 'skipped' ||
      result.retry >= test.retries;
    if (!estDerniereTentative) return;

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
      tentative: result.retry,   // > 0 = passé après retry (flaky)
      erreur:    ['failed', 'timedOut'].includes(result.status) ? (result.error?.message?.split('\n')[0] || null) : null,
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

    // --list : aucun run réel → pas d'archive (sinon dossier vide pris pour « le dernier run »).
    // Un vrai run sans résultat (setup bloqué, timeout global) est archivé : c'est un incident.
    if (MODE_LISTE) {
      try {
        if (!fs.readdirSync(this.runDir).length) fs.rmdirSync(this.runDir);
      } catch { /* dossier déjà absent ou non vide : on le laisse */ }
      console.log('[TNR Reporter] Mode --list — run non archivé');
      return;
    }

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

      const metricsRun = this._archiverMetrics();
      this._exporterDonnees(output, metricsRun);

    } catch (e) {
      console.error('[TNR Reporter] Erreur écriture résultats:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Archivage historique perf — history-[projet].json + .csv
  // ---------------------------------------------------------------------------

  _archiverMetrics() {
    try {
      // Fusion des fichiers par worker → metrics.json consolidé du run
      const metricsRun = fs.readdirSync(this.runDir)
        .filter(f => /^metrics-w\d+\.jsonl$/.test(f))
        .flatMap(f => fs.readFileSync(path.join(this.runDir, f), 'utf8').split('\n').filter(Boolean))
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      fs.writeFileSync(path.join(this.runDir, 'metrics.json'), JSON.stringify(metricsRun, null, 2));

      // Historique : uniquement les projets perf-*, un fichier par projet
      const parProjet = {};
      for (const m of metricsRun) {
        if (!m.projet || !m.projet.startsWith('perf-')) continue;
        (parProjet[m.projet] ||= []).push(m);
      }
      for (const [projet, mesures] of Object.entries(parProjet)) {
        this._ecrireHistorique(projet, mesures);
      }
      return metricsRun;
    } catch (e) {
      console.warn('[TNR Reporter] Archivage métriques :', e.message);
      return [];
    }
  }

  _ecrireHistorique(nomProjetPerf, metricsRun) {
    try {
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

  // ---------------------------------------------------------------------------
  // Export données normalisées — test-output/data/[type]-AAAA-MM.jsonl
  // Une ligne JSON horodatée par événement : source unique pour Grafana / Prometheus / Excel
  // ---------------------------------------------------------------------------

  _exporterDonnees(output, metricsRun) {
    try {
      const runId = output.run.id;
      const mois  = output.run.debut.slice(0, 7);

      // app / env / browser par projet (depuis les tests) → enrichit les mesures
      const metaProjet = {};
      for (const t of output.tests) {
        metaProjet[t.projet] ||= { app: t.app, env: t.env, browser: t.browser };
      }

      // Une ligne par projet prévu (hors setup), même s'il n'a rien exécuté
      const recapParProjet = Object.fromEntries(output.recap_projets.map(p => [p.projet, p]));
      const nomsProjets = Object.keys(this.projetsPrevus).filter(n => !n.startsWith('setup-'));

      const runs = nomsProjets.map(nom => {
        const p      = recapParProjet[nom] || { total: 0, passes: 0, echecs: 0, skips: 0 };
        const prevu  = this.projetsPrevus[nom];
        const tests  = output.tests.filter(t => t.projet === nom);
        const nonExecutes = Math.max(0, prevu.prevus - tests.length);
        const setupKo = output.tests.some(t =>
          prevu.dependances.includes(t.projet) && ['failed', 'timedOut'].includes(t.statut));

        // ok | ko (échecs) | incomplet (tests non joués) | non_execute (rien n'a tourné)
        const statut = tests.length === 0 ? 'non_execute'
          : p.echecs > 0                  ? 'ko'
          : nonExecutes > 0               ? 'incomplet'
          :                                 'ok';

        return {
          run_id:   runId,
          debut:    output.run.debut,
          fin:      output.run.fin,
          projet:   nom,
          app:      prevu.metadata.app     || metaProjet[nom]?.app     || 'inconnue',
          env:      prevu.metadata.env     || metaProjet[nom]?.env     || 'inconnu',
          browser:  prevu.metadata.browser || metaProjet[nom]?.browser || 'inconnu',
          statut,
          statut_run: output.run.statut,   // passed | failed | timedout | interrupted (Playwright)
          setup_ko:   setupKo,
          total:    p.total,
          passes:   p.passes,
          echecs:   p.echecs,
          skips:    p.skips,
          prevus:       prevu.prevus,
          non_executes: nonExecutes,
          flaky:    tests.filter(t => t.statut === 'passed' && t.tentative > 0).length,
          duree_tests_ms: tests.reduce((s, t) => s + (t.duree_ms || 0), 0),
        };
      });
      const tests   = output.tests.map(t => ({ run_id: runId, ...t }));
      const mesures = metricsRun.map(m => ({ run_id: runId, ...metaProjet[m.projet], ...m }));

      fs.mkdirSync(DATA_DIR, { recursive: true });
      for (const [type, lignes] of Object.entries({ runs, tests, mesures })) {
        if (!lignes.length) continue;
        const fichier = path.join(DATA_DIR, `${type}-${mois}.jsonl`);
        fs.appendFileSync(fichier, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
      }
      console.log(`[TNR Reporter] Données exportées : data/*-${mois}.jsonl (${runs.length} run(s), ${tests.length} test(s), ${mesures.length} mesure(s))`);
    } catch (e) {
      console.warn('[TNR Reporter] Export données :', e.message);
    }
  }
}

module.exports = TnrReporter;
