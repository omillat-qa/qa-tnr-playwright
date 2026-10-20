# infra — PostgreSQL + Grafana de recette

Instance de **recette** pour valider le schéma, l'import et les dashboards avant une base de production.
VM : **devqtp04.int.dns** (10.150.241.160), Windows 11, Docker.

```
VM de test (devqtp01…devuft04)          NAS                                  devqtp04
  Playwright + tnr-reporter  ──écrit──▶  …\QTP TNR\playwright\<machine>\    ┌─────────────────────────┐
                                         test-output\data\*.jsonl  ──lu──▶ │ import-jsonl.js (tâche) │
                                                                            │   ▼ tnr_ecriture        │
                                                                            │ PostgreSQL 18  :5432    │
                                                                            │   ▲ tnr_lecture         │
                                                                            │ Grafana 12     :3000    │
                                                                            └─────────────────────────┘
```

## Contenu

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | PostgreSQL 18 + Grafana 12.2.0, volumes nommés `pgdata` / `grafana-data` |
| `.env.exemple` | Mots de passe à renseigner dans `infra/.env` (**jamais commité**) |
| `postgres/init/01-tnr.sql` | Premier démarrage : comptes `tnr_ecriture` / `tnr_lecture`, `schema.sql`, `vues.sql` |
| `grafana/provisioning/` | Datasource `TNR PostgreSQL` (lecture seule) + chargement des dashboards |
| `grafana/dashboards/*.json` | Dashboards versionnés : **TNR — Exécution**, **Temps de réponse** |
| `sauvegarde-pg.ps1` | `pg_dump` vers le NAS (rotation 14 dumps) |
| `../shared/db/schema.sql` | Tables `tnr.runs` / `tnr.tests` / `tnr.mesures` |
| `../shared/db/vues.sql` | Vues lues par Grafana (`v_runs`, `v_tests`, `v_mesures_perf`, `v_mesures_chargement`, `v_versions`) |

## Comptes

| Compte | Droits | Utilisé par |
|---|---|---|
| `postgres` | superutilisateur | administration uniquement |
| `tnr_ecriture` | propriétaire du schéma `tnr` | `import-jsonl.js` (PG_USER des VM qui importent) |
| `tnr_lecture` | `SELECT` sur `tnr`, timeout 30 s | datasource Grafana, requêtes ad hoc |
| `admin` (Grafana) | administrateur Grafana | configuration |

## Installation sur devqtp04

### 1. Prérequis

- **Virtualisation imbriquée** activée sur la VM (Docker Desktop utilise WSL 2) → demande à l'équipe infra.
- **Docker Desktop** : licence payante obligatoire en entreprise (> 250 salariés ou > 10 M$ de CA).
  Alternative gratuite : Docker Engine dans une distribution WSL 2 (Ubuntu), mêmes commandes `docker compose`.
- **Démarrage automatique** : Docker Desktop ne tourne que dans une session ouverte
  → « Start Docker Desktop when you sign in » + ouverture de session automatique du compte de service,
  ou Docker Engine sous WSL avec démarrage par tâche planifiée.
- Node.js 24 + clone du dépôt (pour l'import) : `C:\Projects\qa-tnr-playwright`, branche `dev`.

### 2. Pare-feu (PowerShell administrateur)

```powershell
New-NetFirewallRule -DisplayName "TNR Grafana 3000"    -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "TNR PostgreSQL 5432" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow -RemoteAddress LocalSubnet
```

### 3. Démarrage

```powershell
cd C:\Projects\qa-tnr-playwright\infra
copy .env.exemple .env          # puis renseigner les 4 mots de passe
docker compose up -d
docker compose ps               # postgres « healthy », grafana « running »
docker compose logs postgres    # doit montrer 01-tnr.sql exécuté sans erreur
```

Grafana : http://devqtp04.int.dns:3000 (admin / `GF_ADMIN_PASSWORD`) → dossier **TNR Playwright**.

> `01-tnr.sql` ne s'exécute **qu'au premier démarrage** (volume `pgdata` vide).
> Repartir de zéro : `docker compose down -v` (⚠ supprime la base et la config Grafana).

### 4. Import des JSONL

Dans `.env.local` du clone qui importe (devqtp04) :

```env
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=tnr
PG_USER=tnr_ecriture
PG_PASSWORD=<TNR_RW_PASSWORD>
TNR_SORTIES=\\Pronas01\Dsi\ACT\Recettes-Qualification\QTP TNR\playwright
```

```powershell
node shared/db/import-jsonl.js --toutes-machines --dry-run   # contrôle des fichiers, sans connexion
node shared/db/import-jsonl.js --toutes-machines             # import de toutes les VM (rejouable, sans doublon)
```

Import automatique : tâche planifiée toutes les 15 min.

```powershell
$action  = New-ScheduledTaskAction -Execute 'node.exe' -Argument 'shared\db\import-jsonl.js --toutes-machines' -WorkingDirectory 'C:\Projects\qa-tnr-playwright'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'TNR import PostgreSQL' -Action $action -Trigger $trigger
```

### 5. Sauvegarde

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -File C:\Projects\qa-tnr-playwright\infra\sauvegarde-pg.ps1'
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName 'TNR sauvegarde PostgreSQL' -Action $action -Trigger $trigger
```

## Faire évoluer

| Changement | Procédure |
|---|---|
| Dashboard | Modifier dans Grafana → Partager → Exporter → JSON → remplacer `grafana/dashboards/<uid>.json` → commit. Rechargé en 30 s. |
| Vue | Modifier `shared/db/vues.sql` → `psql` avec `tnr_ecriture` (ou `import-jsonl.js --schema`) |
| Colonne / table | Modifier `shared/db/schema.sql` (idempotent, `IF NOT EXISTS`) → `import-jsonl.js --schema` |
| Mot de passe | `docker exec -it tnr-postgres psql -U postgres -d tnr -c "ALTER ROLE tnr_lecture PASSWORD '…'"` + `.env` + `docker compose up -d` |
| Version PostgreSQL / Grafana | Modifier l'image dans `docker-compose.yml` → `docker compose pull && docker compose up -d`. Changement de majeure PostgreSQL = dump / restore. |

## Dashboards

**TNR — Exécution** (filtres app, env, machine)
- Runs, réussite %, échecs, flaky, projets non OK sur la période
- Réussite par jour et par app ; échecs / flaky par jour
- Derniers runs (statut, version, commit, durée) ; tests en échec (dernière erreur) ; tests instables (retry, bascules OK/KO)
- Durée des campagnes par projet

**Temps de réponse** (filtres app, env, machine, mot-clé, mesures min. par run)
- UX p50 / p95, POST p50, part serveur, dérive vs version précédente
- Temps par run, UX par mot-clé, comparaison par version, dérive par mot-clé entre les 2 dernières versions
- Chargements mesurés pendant les TNR (portefeuille, tâches) par run et par version

Annotations violettes = première apparition d'une version applicative (`v_versions`).
« Mesures min. par run » (défaut 10) écarte les runs de vérification à 2 mots-clés des agrégats perf.
