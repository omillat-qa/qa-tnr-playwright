-- shared/db/schema.sql
-- Schéma PostgreSQL des runs TNR / perf — alimenté par test-output/data/*.jsonl
-- (shared/reporter/tnr-reporter.js), lu par Grafana.
--
-- Idempotent : peut être rejoué sans erreur (IF NOT EXISTS partout).
-- PostgreSQL 15+.
--
-- Conventions :
--   - une table par fichier JSONL : runs, tests, mesures
--   - clés naturelles issues du reporter → import rejouable sans doublon (ON CONFLICT DO NOTHING)
--   - champs ajoutés au fil du temps (statut, prevus, version_app, commit_git…) → NULL sur les lignes antérieures
--   - `brut` conserve la ligne JSONL d'origine : un champ ajouté demain au reporter n'est pas perdu
--     avant la mise à jour du schéma
--   - renommages vs JSONL : timestamp → horodatage, id → id_fonctionnel, duree → duree_ms

CREATE SCHEMA IF NOT EXISTS tnr;

-- ---------------------------------------------------------------------------
-- runs : une ligne par projet et par run (data/runs-AAAA-MM.jsonl)
-- Les projets setup-* n'y figurent pas (seulement dans tests).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tnr.runs (
  run_id          text        NOT NULL,
  machine         text        NOT NULL,   -- nom d'hôte de la VM (lignes antérieures au 2026-10-19 : valeur par défaut de l'import)
  projet          text        NOT NULL,
  app             text        NOT NULL,
  env             text        NOT NULL,
  browser         text        NOT NULL,
  debut           timestamptz NOT NULL,
  fin             timestamptz NOT NULL,
  statut          text        CHECK (statut IN ('ok', 'ko', 'incomplet', 'non_execute')),
  statut_run      text,                   -- statut Playwright du run : passed | failed | timedout | interrupted
  setup_ko        boolean,
  total           integer     NOT NULL,
  passes          integer     NOT NULL,
  echecs          integer     NOT NULL,
  skips           integer     NOT NULL,
  flaky           integer     NOT NULL,
  prevus          integer,
  non_executes    integer,
  duree_tests_ms  bigint      NOT NULL,
  version_app     text,                   -- <meta name="generator"> de l'app testée
  build_app       timestamptz,
  commit_git      text,                   -- commit du projet de tests ; suffixe "-modifie" = code non commité
  brut            jsonb       NOT NULL,
  importe_le      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, machine, projet)
);

CREATE INDEX IF NOT EXISTS runs_debut       ON tnr.runs (debut);
CREATE INDEX IF NOT EXISTS runs_app_env     ON tnr.runs (app, env, debut);

-- ---------------------------------------------------------------------------
-- tests : une ligne par test, dernière tentative seulement (data/tests-AAAA-MM.jsonl)
-- Pas de clé étrangère vers runs : les tests des projets setup-* n'ont pas de ligne runs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tnr.tests (
  run_id          text        NOT NULL,
  machine         text        NOT NULL,
  projet          text        NOT NULL,
  titre           text        NOT NULL,
  id_fonctionnel  text,                   -- PTF_05, TCH_07, PERF… (null si pas d'id entre crochets)
  motcle          text,                   -- tests [PERF] uniquement : clé unique avec id_fonctionnel
  module          text        NOT NULL,
  app             text        NOT NULL,
  env             text        NOT NULL,
  browser         text        NOT NULL,
  statut          text        NOT NULL CHECK (statut IN ('passed', 'failed', 'timedOut', 'skipped', 'interrupted')),
  duree_ms        integer     NOT NULL,
  tentative       integer     NOT NULL,   -- > 0 et statut passed = flaky
  erreur          text,
  horodatage      timestamptz NOT NULL,
  version_app     text,                   -- renseigné sur les lignes setup-* (lecture une fois par run)
  build_app       timestamptz,
  brut            jsonb       NOT NULL,
  importe_le      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, machine, projet, titre)
);

CREATE INDEX IF NOT EXISTS tests_horodatage ON tnr.tests (horodatage);
CREATE INDEX IF NOT EXISTS tests_id         ON tnr.tests (id_fonctionnel, horodatage);
CREATE INDEX IF NOT EXISTS tests_echecs     ON tnr.tests (horodatage) WHERE statut IN ('failed', 'timedOut');

-- ---------------------------------------------------------------------------
-- mesures : une ligne par mesure de temps (data/mesures-AAAA-MM.jsonl)
-- Deux familles dans la même table :
--   - chargements TNR  : nom = "portefeuille.chargement"…, duree_ms
--   - recherche perf   : nom = "recherche.solr", motcle, temps_ux_ms, temps_post_ms, nb_resultats
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tnr.mesures (
  mesure_id       bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id          text        NOT NULL,
  machine         text        NOT NULL,
  projet          text        NOT NULL,
  app             text        NOT NULL,
  env             text        NOT NULL,
  browser         text        NOT NULL,
  nom             text        NOT NULL,
  horodatage      timestamptz NOT NULL,
  statut          text,
  duree_ms        integer,                -- chargements TNR (champ "duree" du JSONL)
  motcle          text,                   -- perf recherche
  nb_resultats    integer,
  temps_ux_ms     integer,
  temps_post_ms   integer,
  brut            jsonb       NOT NULL,
  importe_le      timestamptz NOT NULL DEFAULT now()
);

-- Clé naturelle (motcle absent sur les chargements TNR → coalesce)
CREATE UNIQUE INDEX IF NOT EXISTS mesures_unicite
  ON tnr.mesures (run_id, machine, projet, nom, horodatage, coalesce(motcle, ''));
CREATE INDEX IF NOT EXISTS mesures_nom      ON tnr.mesures (nom, horodatage);
CREATE INDEX IF NOT EXISTS mesures_motcle   ON tnr.mesures (motcle, horodatage) WHERE motcle IS NOT NULL;
