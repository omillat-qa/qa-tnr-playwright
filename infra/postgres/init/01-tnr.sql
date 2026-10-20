-- infra/postgres/init/01-tnr.sql
-- Exécuté par l'image postgres au PREMIER démarrage seulement (volume pgdata vide), connecté à la base tnr.
--   tnr_ecriture : propriétaire du schéma tnr → import JSONL, schema.sql / vues.sql
--   tnr_lecture  : lecture seule sur tnr → Grafana
-- Mots de passe : variables TNR_RW_PASSWORD / TNR_RO_PASSWORD du conteneur (infra/.env)

\set ON_ERROR_STOP on
\getenv rw_pw TNR_RW_PASSWORD
\getenv ro_pw TNR_RO_PASSWORD

CREATE ROLE tnr_ecriture LOGIN PASSWORD :'rw_pw';
CREATE ROLE tnr_lecture  LOGIN PASSWORD :'ro_pw';

REVOKE ALL ON DATABASE tnr FROM PUBLIC;
GRANT CONNECT ON DATABASE tnr TO tnr_ecriture, tnr_lecture;
GRANT CREATE  ON DATABASE tnr TO tnr_ecriture;   -- CREATE SCHEMA IF NOT EXISTS tnr dans schema.sql

-- Schéma et vues créés PAR tnr_ecriture → il en est propriétaire (import --schema rejouable)
SET ROLE tnr_ecriture;
\i /tnr-db/schema.sql
-- Toute table / vue créée plus tard par tnr_ecriture est lisible par tnr_lecture
ALTER DEFAULT PRIVILEGES IN SCHEMA tnr GRANT SELECT ON TABLES TO tnr_lecture;
\i /tnr-db/vues.sql
RESET ROLE;

GRANT USAGE  ON SCHEMA tnr TO tnr_lecture;
GRANT SELECT ON ALL TABLES IN SCHEMA tnr TO tnr_lecture;

-- Garde-fous pour Grafana : requête bloquée ou trop longue coupée, chemin de recherche sur tnr
ALTER ROLE tnr_lecture  SET statement_timeout = '30s';
ALTER ROLE tnr_lecture  SET search_path = tnr, public;
ALTER ROLE tnr_ecriture SET search_path = tnr, public;
