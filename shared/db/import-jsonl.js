'use strict';

// shared/db/import-jsonl.js
// Import des fichiers test-output/data/*.jsonl dans PostgreSQL (schéma shared/db/schema.sql)
//
// Rejouable : ON CONFLICT DO NOTHING sur les clés naturelles → aucune ligne en double,
// on peut réimporter tout l'historique à chaque fois.
//
// Usage :
//   node shared/db/import-jsonl.js                      # tous les fichiers data/*.jsonl
//   node shared/db/import-jsonl.js --mois=2026-10       # seulement runs/tests/mesures-2026-10.jsonl
//   node shared/db/import-jsonl.js --schema             # applique schema.sql avant l'import
//   node shared/db/import-jsonl.js --dry-run            # lit et contrôle les fichiers sans se connecter
//   node shared/db/import-jsonl.js --data=\\nas\tnr\data # autre dossier source
//   node shared/db/import-jsonl.js --machine-defaut=C21015
//       → machine attribuée aux lignes antérieures au champ machine (défaut : nom d'hôte courant)
//
// Connexion : PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD dans .env.local

const fs   = require('fs');
const os   = require('os');
const path = require('path');

(function chargerEnv() {
  const dotenv = require('dotenv');
  const envFiles = [
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const f of envFiles) {
    if (fs.existsSync(f)) { dotenv.config({ path: f, quiet: true }); break; }
  }
})();

const TABLES = ['runs', 'tests', 'mesures'];

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [cle, valeur] = arg.replace(/^--/, '').split('=');
    args[cle] = valeur === undefined ? true : valeur;
  });
  return args;
}

const args          = parseArgs();
const DATA_DIR      = path.resolve(args.data || path.join(require('../../config/sorties').OUTPUT_DIR, 'data'));
const MACHINE_DEFAUT = args['machine-defaut'] || os.hostname();

// ---------------------------------------------------------------------------
// Correspondance ligne JSONL → colonnes (renommages : timestamp → horodatage,
// id → id_fonctionnel, duree → duree_ms ; ligne d'origine conservée dans brut)
// ---------------------------------------------------------------------------

const COLONNES = {
  runs: o => ({
    run_id: o.run_id, machine: o.machine || MACHINE_DEFAUT, projet: o.projet,
    app: o.app, env: o.env, browser: o.browser, debut: o.debut, fin: o.fin,
    statut: o.statut ?? null, statut_run: o.statut_run ?? null, setup_ko: o.setup_ko ?? null,
    total: o.total, passes: o.passes, echecs: o.echecs, skips: o.skips, flaky: o.flaky,
    prevus: o.prevus ?? null, non_executes: o.non_executes ?? null, duree_tests_ms: o.duree_tests_ms,
    version_app: o.version_app ?? null, build_app: o.build_app ?? null, commit_git: o.commit_git ?? null,
    brut: JSON.stringify(o),
  }),
  tests: o => ({
    run_id: o.run_id, machine: o.machine || MACHINE_DEFAUT, projet: o.projet, titre: o.titre,
    id_fonctionnel: o.id ?? null, motcle: o.motcle ?? null, module: o.module,
    app: o.app, env: o.env, browser: o.browser, statut: o.statut,
    duree_ms: o.duree_ms, tentative: o.tentative, erreur: o.erreur ?? null, horodatage: o.timestamp,
    version_app: o.version_app ?? null, build_app: o.build_app ?? null,
    brut: JSON.stringify(o),
  }),
  mesures: o => ({
    run_id: o.run_id, machine: o.machine || MACHINE_DEFAUT, projet: o.projet,
    app: o.app, env: o.env, browser: o.browser, nom: o.nom, horodatage: o.timestamp,
    statut: o.statut ?? null, duree_ms: o.duree ?? null, motcle: o.motcle ?? null,
    nb_resultats: o.nb_resultats ?? null, temps_ux_ms: o.temps_ux_ms ?? null, temps_post_ms: o.temps_post_ms ?? null,
    brut: JSON.stringify(o),
  }),
};

// ---------------------------------------------------------------------------
// Lecture des fichiers
// ---------------------------------------------------------------------------

function fichiersDe(table) {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`Dossier introuvable : ${DATA_DIR}`);
  const motif = args.mois ? `${table}-${args.mois}.jsonl` : null;
  return fs.readdirSync(DATA_DIR)
    .filter(f => motif ? f === motif : f.startsWith(`${table}-`) && f.endsWith('.jsonl'))
    .sort()
    .map(f => path.join(DATA_DIR, f));
}

function lireLignes(fichier) {
  return fs.readFileSync(fichier, 'utf8').split('\n')
    .map((l, i) => ({ texte: l.trim(), numero: i + 1 }))
    .filter(l => l.texte)
    .map(l => {
      try {
        return JSON.parse(l.texte);
      } catch {
        throw new Error(`${path.basename(fichier)} ligne ${l.numero} : JSON invalide`);
      }
    });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function importerTable(client, table) {
  const bilan = { lues: 0, inserees: 0, sans_machine: 0 };

  for (const fichier of fichiersDe(table)) {
    const lignes = lireLignes(fichier);
    bilan.lues += lignes.length;
    bilan.sans_machine += lignes.filter(o => !o.machine).length;
    if (!client) continue;   // --dry-run

    // Un fichier = une transaction : en cas d'erreur, rien n'est importé pour ce fichier
    await client.query('BEGIN');
    try {
      for (const o of lignes) {
        const valeurs = COLONNES[table](o);
        const cols    = Object.keys(valeurs);
        const res = await client.query(
          `INSERT INTO tnr.${table} (${cols.join(', ')})
           VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
           ON CONFLICT DO NOTHING`,
          Object.values(valeurs));
        bilan.inserees += res.rowCount;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`${path.basename(fichier)} : ${e.message}`);
    }
  }
  return bilan;
}

async function main() {
  console.log(`[import] Source : ${DATA_DIR}${args.mois ? ` (mois ${args.mois})` : ''}`);

  let client = null;
  if (!args['dry-run']) {
    const manquantes = ['PG_HOST', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'].filter(v => !process.env[v]);
    if (manquantes.length)
      throw new Error(`${manquantes.join(', ')} non défini(s) dans .env.local`);

    const { Client } = require('pg');
    client = new Client({
      host:     process.env.PG_HOST,
      port:     parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE,
      user:     process.env.PG_USER,
      password: process.env.PG_PASSWORD,
    });
    await client.connect();
    console.log(`[import] Connecté à ${process.env.PG_HOST}/${process.env.PG_DATABASE}`);

    if (args.schema) {
      await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      console.log('[import] Schéma appliqué (schema.sql)');
    }
  } else {
    console.log('[import] --dry-run : lecture et contrôle des fichiers, aucune écriture');
  }

  try {
    for (const table of TABLES) {
      const b = await importerTable(client, table);
      const detail = client ? `${b.inserees} insérée(s), ${b.lues - b.inserees} déjà présente(s)` : 'lues';
      console.log(`[import] ${table.padEnd(8)} : ${b.lues} ligne(s) — ${detail}`
        + (b.sans_machine ? ` — ${b.sans_machine} sans machine → "${MACHINE_DEFAUT}"` : ''));
    }
  } finally {
    if (client) await client.end();
  }
}

main().catch(e => {
  console.error(`[import] ERREUR : ${e.message}`);
  process.exit(1);
});
