-- shared/db/vues.sql
-- Vues de lecture pour Grafana (dashboards infra/grafana/dashboards/*.json)
--
-- Idempotent : DROP + CREATE → rejouable après toute modification (pas de données dans les vues).
-- À appliquer APRÈS schema.sql, avec le compte propriétaire du schéma tnr (tnr_ecriture).
--
-- Principe : les vues enrichissent les lignes (version, indicateurs booléens, clé de test) ;
-- les agrégats restent dans les requêtes des panneaux, pour suivre la période choisie dans Grafana.

DROP VIEW IF EXISTS tnr.v_versions, tnr.v_mesures_chargement, tnr.v_mesures_perf, tnr.v_tests, tnr.v_runs;

-- ---------------------------------------------------------------------------
-- v_runs : runs sans la colonne brut + taux de réussite
-- ---------------------------------------------------------------------------
CREATE VIEW tnr.v_runs AS
SELECT
  run_id, machine, projet, app, env, browser, debut, fin,
  statut, statut_run, setup_ko,
  total, passes, echecs, skips, flaky, prevus, non_executes, duree_tests_ms,
  version_app, build_app, commit_git,
  CASE WHEN total > 0 THEN round(100.0 * passes / total, 1) END AS taux_reussite,
  projet LIKE 'perf-%'                                          AS est_perf,
  brut->>'rapport_html'                                         AS rapport_html   -- null : run sans rapport archivé
FROM tnr.runs;

-- ---------------------------------------------------------------------------
-- v_tests : tests sans brut + clé stable et indicateurs
--   cle_test   : id fonctionnel (titre à défaut) + mot-clé pour les tests [PERF]
--   est_echec  : failed / timedOut
--   est_flaky  : passé après au moins un retry
--   est_setup  : projets setup-* (exclus des taux)
--   version_app: celle du run (ligne runs), à défaut celle portée par le test (setup)
-- ---------------------------------------------------------------------------
CREATE VIEW tnr.v_tests AS
SELECT
  t.run_id, t.machine, t.projet, t.titre, t.id_fonctionnel, t.motcle, t.module,
  t.app, t.env, t.browser, t.statut, t.duree_ms, t.tentative, t.erreur, t.horodatage,
  coalesce(t.id_fonctionnel, t.titre) || coalesce(' — ' || t.motcle, '') AS cle_test,
  t.statut IN ('failed', 'timedOut')                                      AS est_echec,
  t.statut = 'passed' AND t.tentative > 0                                 AS est_flaky,
  t.projet LIKE 'setup-%'                                                 AS est_setup,
  coalesce(r.version_app, t.version_app)                                  AS version_app,
  r.commit_git,
  r.brut->>'rapport_html'                                                 AS rapport_html,
  t.brut->>'pw_id'                                                        AS pw_id   -- runs à partir du 21/10
FROM tnr.tests t
LEFT JOIN tnr.runs r USING (run_id, machine, projet);

-- ---------------------------------------------------------------------------
-- v_mesures_perf : recherches perf (mot-clé, temps UX / POST) + version du run
-- ---------------------------------------------------------------------------
CREATE VIEW tnr.v_mesures_perf AS
SELECT
  m.run_id, m.machine, m.projet, m.app, m.env, m.browser, m.nom, m.horodatage, m.statut,
  m.motcle, m.nb_resultats, m.temps_ux_ms, m.temps_post_ms,
  r.version_app, r.build_app, r.commit_git,
  count(*) OVER (PARTITION BY m.run_id, m.machine, m.projet)              AS nb_mesures_run
FROM tnr.mesures m
LEFT JOIN tnr.runs r USING (run_id, machine, projet)
WHERE m.motcle IS NOT NULL;

-- ---------------------------------------------------------------------------
-- v_mesures_chargement : temps de chargement mesurés pendant les TNR + version du run
-- ---------------------------------------------------------------------------
CREATE VIEW tnr.v_mesures_chargement AS
SELECT
  m.run_id, m.machine, m.projet, m.app, m.env, m.browser, m.nom, m.horodatage, m.statut, m.duree_ms,
  r.version_app, r.build_app, r.commit_git
FROM tnr.mesures m
LEFT JOIN tnr.runs r USING (run_id, machine, projet)
WHERE m.motcle IS NULL AND m.duree_ms IS NOT NULL;

-- ---------------------------------------------------------------------------
-- v_versions : une ligne par version applicative observée (annotations « déploiement »)
-- ---------------------------------------------------------------------------
CREATE VIEW tnr.v_versions AS
SELECT
  app, env, version_app,
  min(build_app) AS build_app,
  min(debut)     AS premier_run,
  max(debut)     AS dernier_run,
  count(DISTINCT run_id) AS nb_runs
FROM tnr.runs
WHERE version_app IS NOT NULL
GROUP BY app, env, version_app;
