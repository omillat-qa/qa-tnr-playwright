# qa-tnr-playwright

> Cellule de Test — Ellisphere  
> Migration des TNR UI et tests de performance Solr depuis UFT One vers Playwright

---

## 📋 Contexte

Ce projet remplace progressivement les campagnes de tests UFT One (Internet Explorer, mort en 2022) par une stack moderne basée sur **Playwright** + **Node.js**.

Il couvre deux types de tests :
- **TNR fonctionnels** — vérification du comportement des applications après livraison
- **Perf recherche Solr** — mesure des temps de réponse UX et serveur sur la recherche, avec historique pour courbes de tendance Grafana

---

## 🏗️ Architecture du projet

```
qa-tnr-playwright/
├── .auth/                          # Sessions storageState (gitignore — tokens)
│   ├── cfb-ua.json
│   ├── cfb-prod.json
│   ├── ellipro-risk-ua.json
│   └── ellipro-risk-prod.json
│
├── apps/
│   ├── compliance/
│   │   ├── pages/
│   │   │   ├── portefeuille.page.js    # POM Portefeuille CFB v2
│   │   │   └── recherche.page.js       # POM Recherche Solr CFB v2
│   │   ├── setup/
│   │   │   └── auth.setup.js           # Login unique CFB (storageState)
│   │   └── tests/
│   │       ├── portefeuille.spec.js    # 17 tests PTF_01 à PTF_10
│   │       └── perf-recherche.spec.js  # 80 mots-clés recherche Solr
│   │
│   └── ellipro-risk/
│       ├── pages/
│       │   └── recherche.page.js       # POM Recherche Solr Ellipro Risk
│       ├── setup/
│       │   └── auth.setup.js           # Login unique Ellipro Risk
│       └── tests/
│           ├── auth/
│           │   ├── auth.spec.js        # R_001 à R_012 Keycloak
│           │   └── network.spec.js     # R_013 réseau
│           └── recherche/
│               └── perf-recherche.spec.js  # 80 mots-clés Solr
│
├── config/
│   ├── playwright.config.js            # Config principale
│   ├── apps.matrix.js                  # Matrice browsers × envs × apps
│   ├── environments.js                 # URLs par app et env
│   └── global-setup.js                 # Chargement .env.local
│
├── shared/
│   ├── mailer/
│   │   └── send-report.js              # Email HTML post-run
│   ├── pages/
│   │   ├── keycloak.page.js            # POM Keycloak (commun toutes apps)
│   │   └── consent.page.js             # Gestion cookies + popups
│   ├── reporter/
│   │   └── tnr-reporter.js             # Reporter custom → JSON + CSV history
│   └── utils/
│       ├── logger.js                   # Logger → test-output/log_tests.txt
│       └── metrics.js                  # enregistrer() → test-output/metrics.json
│
├── test-data/
│   └── motscles-recherche.json         # 80 mots-clés Solr fixes (ne pas modifier)
│
├── test-output/                        # Artifacts de run (gitignore)
│   ├── tnr-results.json                # Résultats run courant
│   ├── metrics.json                    # Métriques run courant
│   ├── log_tests.txt                   # Logs console
│   ├── history-[app]-[env].json        # Historique 90 jours → Grafana
│   └── history-[app]-[env].csv         # Historique CSV → Excel
│
├── playwright-report/                  # Rapport HTML Playwright (gitignore)
│   └── index.html
│
├── .env.example                        # Template variables d'environnement
├── .env.local                          # Credentials réels (gitignore — JAMAIS commité)
└── CONVENTIONS.md                      # Conventions équipe
```

---

## 🚀 Installation

```powershell
# Cloner le repo
git clone https://github.com/omillat-qa/qa-tnr-playwright.git
cd qa-tnr-playwright

# Installer les dépendances
npm install

# Installer les browsers Playwright
npx playwright install chromium firefox webkit

# Copier le template de configuration
copy .env.example .env.local
# Remplir .env.local avec les credentials (voir section Variables)
```

---

## ⚙️ Variables d'environnement (.env.local)

```env
# SMTP — relay interne Ellisphere (sans auth)
SMTP_HOST=smtp.int.dns
SMTP_PORT=25
SMTP_FROM=devqtp02@ellisphere.com

# Destinataires par app (séparés par virgule)
MAIL_COMPLIANCE_V2=prenom.nom@ellisphere.com
MAIL_ELLIPRO_RISK=

# Credentials Compliance for Business v2
TNR_CFB_UA_USERNAME=CFBv2_TNR@nomail.dns
TNR_CFB_UA_PASSWORD=
TNR_CFB_PROD_USERNAME=
TNR_CFB_PROD_PASSWORD=

# Credentials Ellipro Risk
TNR_ELLIPRO_UA_USERNAME=tests_tnr_wrisk@nomail.dns
TNR_ELLIPRO_UA_PASSWORD=
TNR_ELLIPRO_PROD_USERNAME=
TNR_ELLIPRO_PROD_PASSWORD=
```

---

## 🎯 Commandes

### Lister les tests disponibles

```powershell
# Lister tous les projets disponibles
npx playwright test --config=config/playwright.config.js --list

# Lister les tests d'un projet spécifique
npx playwright test --config=config/playwright.config.js --list --project=chromium-ua-compliance-v2

# Lister les tests filtrés par tag ou ID
npx playwright test --config=config/playwright.config.js --list --grep "PTF_01"
```

### Setup (login + sauvegarde session)

> ⚠️ À lancer une fois en début de journée — la session dure plusieurs heures

```powershell
# Compliance v2
npx playwright test --config=config/playwright.config.js --project=setup-cfb-v2-ua
npx playwright test --config=config/playwright.config.js --project=setup-cfb-v2-prod

# Ellipro Risk
npx playwright test --config=config/playwright.config.js --project=setup-ellipro-risk-ua
npx playwright test --config=config/playwright.config.js --project=setup-ellipro-risk-prod
```

### TNR fonctionnels

```powershell
# Compliance v2 UA — tous les tests
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2

# Compliance v2 UA — avec navigateur visible
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2 --headed

# Un seul test
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2 --grep "PTF_01"

# Plusieurs tests
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2 --grep "PTF_01|PTF_03|PTF_08"

# Par tag
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2 --grep "@smoke"

# Mode debug pas à pas
npx playwright test --config=config/playwright.config.js --project=chromium-ua-compliance-v2 --headed --debug --grep "PTF_01"

# Compliance v2 PROD
npx playwright test --config=config/playwright.config.js --project=chromium-prod-compliance-v2

# Ellipro Risk UA
npx playwright test --config=config/playwright.config.js --project=chromium-ua-ellipro-risk
```

### Perf recherche Solr

> ⏱️ ~7-8 minutes par run — séquentiel intentionnel (mesures fiables)

```powershell
# Ellipro Risk UA
npx playwright test --config=config/playwright.config.js --project=perf-recherche-ellipro-risk-ua

# Ellipro Risk PROD
npx playwright test --config=config/playwright.config.js --project=perf-recherche-ellipro-risk-prod

# Compliance v2 UA
npx playwright test --config=config/playwright.config.js --project=perf-recherche-compliance-v2-ua

# Compliance v2 PROD
npx playwright test --config=config/playwright.config.js --project=perf-recherche-compliance-v2-prod
```

### Rapport HTML

```powershell
# Ouvrir le dernier rapport dans le navigateur
npx playwright show-report playwright-report
```

### Email récap

```powershell
# Après un run TNR ou perf — envoyer le récap HTML par email
node shared/mailer/send-report.js --app=compliance-v2 --env=ua --rapport=\\nas01\tnr\rapport\index.html
node shared/mailer/send-report.js --app=compliance-v2 --env=prod
node shared/mailer/send-report.js --app=ellipro-risk --env=ua
```

### UI Playwright (mode interactif)

```powershell
# Ouvrir l'interface graphique Playwright
# ⚠️ Lancer le setup d'abord pour que les sessions soient disponibles
npx playwright test --config=config/playwright.config.js --ui
```

---

## 📊 Applications couvertes

| App | Type | Auth | TNR | Perf Solr | Envs |
|-----|------|------|-----|-----------|------|
| Compliance for Business v2 | Angular | Keycloak | ✅ 17 tests | ✅ 80 mots-clés | UA, PROD |
| Ellipro Risk | Angular | Keycloak | ✅ 13 tests | ✅ 80 mots-clés | UA, PROD, IA, DEV |
| Ellipro Mod/Déc | JSF | Keycloak + MD5 | 🔜 à migrer | 🔜 à migrer | UA, PROD |
| Iris | JSF interne | SSO interne | 🔜 à migrer | 🔜 à migrer | UA, PROD |
| Web Orange | Angular | MD5 | 🔜 à migrer | — | UA, PROD |
| Compliance v1 | Angular | SAML | 🔜 à migrer | — | UA, PROD |

---

## 📈 Métriques et historique

### Fichiers produits après chaque run

| Fichier | Contenu | Usage |
|---------|---------|-------|
| `test-output/tnr-results.json` | Résultats run courant (pass/fail, durées) | Email récap, CI |
| `test-output/metrics.json` | Métriques perf run courant | Debug |
| `test-output/log_tests.txt` | Logs console horodatés | Debug |
| `test-output/history-[app]-[env].json` | Historique 90 jours | **Grafana / Pushgateway** |
| `test-output/history-[app]-[env].csv` | Historique 90 jours | **Excel / analyse ponctuelle** |

### Structure CSV historique

```
run_date,timestamp,app,env,motcle,statut,nb_resultats,temps_ux_ms,temps_post_ms
2026-05-12,2026-05-12T08:00:01Z,ellipro-risk,ua,"Renault",ok,10310,935,613
2026-05-12,2026-05-12T08:00:07Z,ellipro-risk,ua,"CAC",ok,1505,940,584
```

### Roadmap métriques

- [x] Collecte JSON + CSV local après chaque run
- [ ] Pushgateway Prometheus (à confirmer avec infra)
- [ ] Dashboard Grafana — courbes de tendance temps UX / POST par app, env, mot-clé

---

## 🔄 Vision Jenkins (roadmap CI)

```
Pipeline nocturne (cron 02:00)
  ├── Setup sessions (login UA + PROD)
  ├── TNR fonctionnels (Compliance v2, Ellipro Risk)
  ├── Perf recherche Solr (UA + PROD)
  ├── Envoi email récap par app
  └── Publication rapport HTML (lien cliquable dans email)
```

---

## 📐 Conventions

### IDs fonctionnels

| Préfixe | App | Exemple |
|---------|-----|---------|
| `PTF_` | Portefeuille Compliance | `[PTF_01]` |
| `R_` | Auth / réseau Ellipro Risk | `[R_001]` |
| `PERF` | Tests performance | `[PERF]` |

### Tags

| Tag | Usage |
|-----|-------|
| `@tnr` | Tous les tests TNR fonctionnels |
| `@smoke` | Tests critiques post-déploiement (sous-ensemble rapide) |
| `@auth` | Tests d'authentification |
| `@portefeuille` | Module portefeuille Compliance |

### Sélecteurs (ordre de priorité)

1. `data-cy` (Compliance — équipe Cypress)
2. `data-testid` (Ellipro Risk)
3. `getByRole` / `getByLabel`
4. CSS (dernier recours)

### Commits

```
type(app): description
feat(compliance): ajout PTF_11 test filtre équipe
fix(ellipro-risk): correction timeout recherche Solr
chore(config): mise à jour matrice browsers
```

---

## 🗂️ Branches

| Branche | Usage |
|---------|-------|
| `main` | Stable — validé |
| `dev` | Travail en cours |

---

## ⚠️ Points d'attention

- **`.env.local` ne doit JAMAIS être commité** — contient les credentials
- **`.auth/*.json` ne doit JAMAIS être commité** — contient les tokens de session
- **`test-output/` ne doit JAMAIS être commité** — artifacts de run
- **Les mots-clés `motscles-recherche.json` sont fixes** — les modifier casse la comparaison historique Grafana
- **Les tests perf ne doivent PAS être parallélisés** — les mesures seraient faussées
