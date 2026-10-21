# infra — PostgreSQL + Grafana + rapports Playwright

Instance de **recette** pour valider le schéma, l'import et les dashboards avant une base de production.
Hôte actuel : **poste C21015**, Windows 11, **Docker Engine dans WSL 2** (gratuit — pas de Docker Desktop).

```
VM de test (devqtp01…devuft04)          NAS \\Pronas01\…\QTP TNR\playwright\
  Playwright + tnr-reporter  ──écrit──▶   <machine>\test-output\data\*.jsonl
                                          <machine>\test-output\runs\run-…\rapport-html\
                                                │                    │
                    ┌───────────────────────────┼────────────────────┼──────────────┐
  Poste C21015      │ import-jsonl.js (tâche 15 min, Windows)        │ lecture seule│
                    │        ▼ tnr_ecriture                          ▼              │
                    │  WSL Ubuntu ─ Docker :                                        │
                    │    tnr-postgres  PostgreSQL 18   :5432                        │
                    │    tnr-grafana   Grafana 12.2.0  :3000  ◀── tnr_lecture       │
                    │    tnr-rapports  nginx           :8081  (liens 📊 Rapport)    │
                    └───────────────────────────────────────────────────────────────┘
```

## Contenu

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | PostgreSQL 18, Grafana 12.2.0, nginx (rapports) ; volumes `pgdata` / `grafana-data` |
| `.env.exemple` | Modèle des mots de passe → **copier** (pas renommer) en `infra/.env`, jamais commité |
| `postgres/init/01-tnr.sql` | Premier démarrage : comptes `tnr_ecriture` / `tnr_lecture`, `schema.sql`, `vues.sql` |
| `grafana/provisioning/` | Datasource `TNR PostgreSQL` (lecture seule) + chargement des dashboards |
| `grafana/dashboards/*.json` | **TNR — Exécution**, **Temps de réponse**, **TNR — Détail** |
| `rapports/nginx.conf` | Sert le dossier `playwright` du NAS en HTTP |
| `wsl/montage-nas.service` | systemd (WSL) : monte `\\Pronas01\Dsi` sur `/mnt/pronas` en lecture seule |
| `wsl/docker-apres-nas.conf` | systemd (WSL) : Docker démarre après le montage du NAS |
| `sauvegarde-pg.ps1` | `pg_dump` vers le NAS, rotation 14 dumps (Docker WSL ou natif) |
| `.gitattributes` | Fins de ligne LF pour tout ce qui est monté dans les conteneurs / WSL |
| `../shared/db/schema.sql` | Tables `tnr.runs` / `tnr.tests` / `tnr.mesures` |
| `../shared/db/vues.sql` | Vues Grafana : `v_runs`, `v_tests`, `v_mesures_perf`, `v_mesures_chargement`, `v_versions` |

## Comptes

| Compte | Droits | Utilisé par |
|---|---|---|
| `postgres` | superutilisateur | administration, sauvegarde |
| `tnr_ecriture` | propriétaire du schéma `tnr` | `import-jsonl.js` (`PG_USER` dans `.env.local`) |
| `tnr_lecture` | `SELECT` sur `tnr`, timeout 30 s | datasource Grafana, requêtes ad hoc |
| `admin` (Grafana) | administrateur Grafana | configuration (5 échecs de connexion = blocage temporaire) |

---

## Installation (Windows 11 + WSL 2)

### 1. WSL et Ubuntu

```powershell
wsl --install -d Ubuntu          # redémarrer si demandé, créer l'utilisateur Linux
```

systemd doit être actif (`/etc/wsl.conf` → `[boot]` `systemd=true`, valeur par défaut des Ubuntu récents).

### 2. Docker Engine dans Ubuntu (procédure officielle, root)

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER     # puis fermer / rouvrir Ubuntu
docker run --rm hello-world
```

Depuis PowerShell, sans ouvrir Ubuntu : `wsl -d Ubuntu -u root -- docker ps`.

### 3. Montage du NAS (lien 📊 Rapport)

```powershell
wsl -d Ubuntu -u root -- bash -c "cd /mnt/c/Projects/qa-tnr-playwright/infra/wsl && cp montage-nas.service /etc/systemd/system/ && mkdir -p /etc/systemd/system/docker.service.d && cp docker-apres-nas.conf /etc/systemd/system/docker.service.d/ && systemctl daemon-reload && systemctl enable --now montage-nas.service && systemctl restart docker && findmnt /mnt/pronas"
```

Le montage utilise l'identité de la session Windows qui lance WSL. Sans ce montage, nginx sert un dossier vide.

### 4. Secrets

- `infra\.env` : **copier** `.env.exemple` (le modèle est versionné) et renseigner les 4 mots de passe.
  Les mots de passe `tnr_*` ne sont lus qu'à la création de la base (volume `pgdata` vide).
- `.env.local` du projet (import) :

```env
TNR_SORTIES=\\Pronas01\Dsi\ACT\Recettes-Qualification\QTP TNR\playwright
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=tnr
PG_USER=tnr_ecriture
PG_PASSWORD=<TNR_RW_PASSWORD>
```

### 5. Démarrage

```powershell
wsl -d Ubuntu -u root -- bash -c "cd /mnt/c/Projects/qa-tnr-playwright/infra && docker compose up -d && docker compose ps"
wsl -d Ubuntu -u root -- docker logs tnr-postgres 2>&1 | Select-String "01-tnr|ERROR"
```

| Service | Adresse |
|---|---|
| Grafana | http://localhost:3000 (admin / `GF_ADMIN_PASSWORD`) → Dashboards → **TNR Playwright** |
| Rapports | http://localhost:8081/ (navigation `<machine>/test-output/runs/…`) |
| PostgreSQL | `localhost:5432`, base `tnr` |

> Repartir de zéro : `docker compose down -v` (⚠ supprime la base et la config Grafana).

### 6. Premier import

```powershell
cd C:\Projects\qa-tnr-playwright
node shared/db/import-jsonl.js --toutes-machines --dry-run    # contrôle, sans connexion
node shared/db/import-jsonl.js --toutes-machines              # rejouable, sans doublon
```

### 7. Tâches planifiées (dossier `\QA-TNR\` du Planificateur)

WSL s'arrête dès qu'aucun programme ne l'utilise — et Docker avec lui. La tâche **TNR WSL** le garde allumé.
`conhost --headless` : aucune fenêtre.

```powershell
$moi = "$env:USERDOMAIN\$env:USERNAME"
$log = "$env:LOCALAPPDATA\qa-tnr\import-postgres.log"; New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null

# Garde WSL (Docker, PostgreSQL, Grafana, rapports) allumé pendant la session
$a = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument '--headless wsl.exe -d Ubuntu --exec sleep infinity'
$t = New-ScheduledTaskTrigger -AtLogOn -User $moi
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskPath '\QA-TNR\' -TaskName 'TNR WSL' -Action $a -Trigger $t -Settings $s

# Import des JSONL du NAS toutes les 15 min (journal : %LOCALAPPDATA%\qa-tnr\import-postgres.log)
$a = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless cmd.exe /c node shared\db\import-jsonl.js --toutes-machines >> `"$log`" 2>&1" -WorkingDirectory 'C:\Projects\qa-tnr-playwright'
$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskPath '\QA-TNR\' -TaskName 'TNR import PostgreSQL' -Action $a -Trigger $t -Settings $s

# Sauvegarde quotidienne (facultatif) — à une heure où le poste est allumé, session ouverte
$a = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument '--headless pwsh.exe -NoProfile -File C:\Projects\qa-tnr-playwright\infra\sauvegarde-pg.ps1'
$t = New-ScheduledTaskTrigger -Daily -At 12:30
Register-ScheduledTask -TaskPath '\QA-TNR\' -TaskName 'TNR sauvegarde PostgreSQL' -Action $a -Trigger $t -Settings $s
```

Ces tâches ne tournent que **session ouverte** (comme WSL). Rien n'est perdu session fermée : l'import suivant
rattrape tout ce que les VM ont écrit sur le NAS. Supprimer : `Unregister-ScheduledTask -TaskPath '\QA-TNR\' -TaskName '<nom>' -Confirm:$false`.

### 8. Sauvegarde / restauration

```powershell
pwsh -NoProfile -File infra\sauvegarde-pg.ps1                     # → \\Pronas01\…\QTP TNR\sauvegardes-pg, 14 dumps
pwsh -NoProfile -File infra\sauvegarde-pg.ps1 -Destination D:\tmp -Conserver 3
```

Destination par défaut **hors** du dossier `playwright` (servi en HTTP par nginx). Restauration : voir l'en-tête du script.

---

## Dashboards

Annotations violettes (les 3 dashboards) = première apparition d'une version applicative (`<meta name="generator">`), avec sa date de build.

**TNR — Exécution** (filtres app, env, machine)
- Runs, réussite %, échecs, flaky, projets non OK ; réussite et échecs / flaky par jour ; durée des campagnes
- Derniers runs (statut, version, commit, 📊 Rapport) — **clic sur un run** → TNR — Détail
- Tests en échec (dernière erreur), tests instables (retry, bascules OK/KO) — **clic sur un test** → son historique

**Temps de réponse** (filtres app, env, machine, mot-clé, mesures min. par run)
- UX p50 / p95, POST p50, part serveur, dérive vs version précédente
- Temps par run, UX par mot-clé, comparaison par version, dérive par mot-clé entre les 2 dernières versions
- Chargements mesurés pendant les TNR (portefeuille, tâches)
- « Mesures min. par run » (défaut 10) écarte les runs de vérification à 2 mots-clés

**TNR — Détail** (filtres app, env, machine, test, run)
- Historique d'un test : statut, durée, retry, machine, version, erreur, **📊 Rapport ouvert sur ce test** (`#?testId=…`)
- Projets et tests d'un run (échecs en tête)

Liens : data links Grafana sur les colonnes Run / Test / Rapport. Adresse des rapports = variable cachée
`url_rapports` (`http://localhost:8081`) dans chaque dashboard — à changer pour un autre hôte.
Liens 📊 Rapport disponibles pour les runs depuis le 20/10/2026 17:48 (champs `rapport_html` / `pw_id` du reporter).

---

## Faire évoluer

| Changement | Procédure |
|---|---|
| Dashboard | Modifier dans Grafana → Partager → Exporter → JSON → remplacer `grafana/dashboards/<uid>.json` → commit. Rechargé en 30 s ; une modif UI non exportée est écrasée au prochain changement du fichier. |
| Vue | Modifier `shared/db/vues.sql` → `node shared/db/import-jsonl.js --toutes-machines --schema` |
| Colonne / table | Modifier `shared/db/schema.sql` (idempotent, `IF NOT EXISTS`) → idem `--schema` |
| Mot de passe | `wsl -d Ubuntu -u root -- docker exec tnr-postgres psql -U postgres -d tnr -c "ALTER ROLE tnr_lecture PASSWORD '…'"` + `infra/.env` + `docker compose up -d` |
| Version d'image | Modifier `docker-compose.yml` → `docker compose pull && docker compose up -d`. Majeure PostgreSQL : dump / restore. |
| Autre hôte (prod) | Même procédure ; `GF_ROOT_URL` dans `infra/.env`, `url_rapports` dans les 3 dashboards, ports à ouvrir (3000, 8081, 5432 si import distant). |

---

## Dépannage — ce qu'on a appris

| Symptôme | Cause / solution |
|---|---|
| Conteneurs qui redémarrent, Grafana injoignable par moments | WSL s'arrête sans programme actif → tâche **TNR WSL** (§ 7) |
| Liens 📊 Rapport : page vide ou 404 | NAS non monté : `wsl -d Ubuntu -u root -- systemctl status montage-nas` puis `docker restart tnr-rapports` |
| Lien `file://` vers le NAS sans effet | Bloqué par Chrome / Edge depuis une page http → passer par nginx (:8081) |
| `apt-get update` bloqué sur « Waiting for headers » (VM de test) | Sortie Internet via proxy `proxy.int.dns:8080` détecté par Windows (WPAD) mais pas par WSL |
| `407 Proxy Authorization Required` dans WSL | Le proxy exige une authentification AD hors navigateur → relais local (Px) ou ouverture réseau ; ne pas écrire de mot de passe dans apt / Docker |
| Mode réseau `mirrored` indisponible | Windows 10 (VM devqtpXX) : réservé à Windows 11 |
| Script / service en échec dans le conteneur ou WSL (`\r`) | Fins de ligne Windows : `.gitattributes` force LF ; à défaut `sed -i 's/\r$//' fichier` |
| Commande `wsl … bash -c "…"` qui casse les `\` ou les `$` | Trois shells imbriqués : passer par un fichier script (`sed 's/\r$//' script.sh \| bash`) |
| Connexion admin Grafana refusée après plusieurs essais | Blocage anti-force brute (5 échecs) → attendre 5 min |
