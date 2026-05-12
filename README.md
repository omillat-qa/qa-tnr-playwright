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

## 🏷️ Convention de nommage des projets

Le nom du projet encode **type + browser + env + app** — c'est l'identifiant unique utilisé dans toutes les commandes `--project` et dans les noms de fichiers de sortie.

| Pattern | Exemple | Usage |
|---------|---------|-------|
| `setup-[app]-[env]` | `setup-compliance-v2-ua` | Login unique + sauvegarde session |
| `tnr-[browser]-[env]-[app]` | `tnr-chromium-ua-compliance-v2` | Tests fonctionnels TNR |
| `perf-recherche-[env]-[app]` | `perf-recherche-ua-ellipro-risk` | Perf recherche Solr (toujours chromium) |

**Pourquoi le browser dans le nom TNR ?**
Les TNR tournent sur plusieurs browsers (chromium, firefox, edge, webkit). Pour la perf, on n'utilise que chromium (mesures comparables), donc le browser n'est pas dans le nom.

**Fichiers de sortie alignés sur le nom projet :**
```
test-output/results-tnr-chromium-ua-compliance-v2.json
test-output/history-perf-recherche-ua-ellipro-risk.json
test-output/history-perf-recherche-ua-ellipro-risk.csv
test-output/logs-tnr-chromium-ua-compliance-v2.txt
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
npx playwright test --config=config/playwright.config.js --list --project=tnr-chromium-ua-compliance-v2

# Lister les tests filtrés par tag ou ID
npx playwright test --config=config/playwright.config.js --list --grep "PTF_01"
```

> 💡 `--list` est très utile pour vérifier ce que Playwright va exécuter **avant** de lancer.

### Setup (login + sauvegarde session)

> ⚠️ À lancer **une fois en début de journée** — la session dure plusieurs heures (~8h)

```powershell
# Compliance v2
npx playwright test --config=config/playwright.config.js --project=setup-compliance-v2-ua
npx playwright test --config=config/playwright.config.js --project=setup-compliance-v2-prod

# Ellipro Risk
npx playwright test --config=config/playwright.config.js --project=setup-ellipro-risk-ua
npx playwright test --config=config/playwright.config.js --project=setup-ellipro-risk-prod
```

### TNR fonctionnels

```powershell
# Compliance v2 UA — tous les tests
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2

# Avec navigateur visible
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --headed

# Un seul test
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --grep "PTF_01"

# Plusieurs tests
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --grep "PTF_01|PTF_03|PTF_08"

# Par tag
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --grep "@smoke"

# Mode debug pas à pas
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --headed --debug --grep "PTF_01"

# Compliance v2 PROD
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-prod-compliance-v2

# Ellipro Risk UA
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-ellipro-risk
```

### Perf recherche Solr

> ⏱️ ~7-8 minutes par run — séquentiel intentionnel (mesures fiables)

```powershell
# Ellipro Risk UA
npx playwright test --config=config/playwright.config.js --project=perf-recherche-ua-ellipro-risk

# Ellipro Risk PROD
npx playwright test --config=config/playwright.config.js --project=perf-recherche-prod-ellipro-risk

# Compliance v2 UA
npx playwright test --config=config/playwright.config.js --project=perf-recherche-ua-compliance-v2

# Compliance v2 PROD
npx playwright test --config=config/playwright.config.js --project=perf-recherche-prod-compliance-v2
```

### Rapport HTML

```powershell
npx playwright show-report playwright-report
```

### Email récap

```powershell
node shared/mailer/send-report.js --app=compliance-v2 --env=ua --rapport=\\nas01\tnr\rapport\index.html
node shared/mailer/send-report.js --app=ellipro-risk --env=ua
```

### UI Playwright (mode interactif)

```powershell
# Lancer le setup d'abord, puis ouvrir l'UI
npx playwright test --config=config/playwright.config.js --project=setup-compliance-v2-ua
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
| `test-output/results-[projet].json` | Résultats run courant | Email récap, CI |
| `test-output/logs-[projet].txt` | Logs console horodatés | Debug |
| `test-output/history-[projet].json` | Historique 90 jours | **Grafana / Pushgateway** |
| `test-output/history-[projet].csv` | Historique CSV | **Excel / analyse ponctuelle** |

### Structure CSV historique

```
run_date,timestamp,app,env,motcle,statut,nb_resultats,temps_ux_ms,temps_post_ms
2026-05-12,2026-05-12T08:00:01Z,ellipro-risk,ua,"Renault",ok,10310,935,613
```

### Roadmap métriques

- [x] Collecte JSON + CSV local après chaque run
- [ ] Pushgateway Prometheus (à confirmer avec infra)
- [ ] Dashboard Grafana — courbes de tendance temps UX / POST

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
| `@smoke` | Tests critiques post-déploiement |
| `@auth` | Tests d'authentification |
| `@portefeuille` | Module portefeuille Compliance |

### Sélecteurs (ordre de priorité)

1. `data-cy` (Compliance — équipe Cypress)
2. `data-testid` (Ellipro Risk)
3. `getByRole` / `getByLabel`
4. CSS (dernier recours)

### Commits

```
feat(compliance): ajout PTF_11 test filtre équipe
fix(ellipro-risk): correction timeout recherche Solr
chore(config): mise à jour matrice browsers
docs: mise à jour README
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
- **`motscles-recherche.json` sont fixes** — les modifier casse l'historique Grafana
- **Les tests perf ne doivent PAS être parallélisés** — mesures faussées
- **Le setup doit être lancé une fois par journée** avant tous les runs
