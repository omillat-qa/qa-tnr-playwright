# CLAUDE.md — qa-tnr-playwright

> Cellule de Test Ellisphere — Migration UFT One → Playwright  
> Référence pour Claude Code. En cas de conflit, **CONVENTIONS.md fait foi** pour les règles de code.

---

## Stack technique

- **Runtime** : Node.js v24.11.0 / npm 11.6.0
- **Langage** : JavaScript uniquement — CommonJS partout (`'use strict'`, `require/module.exports`)
- **Pas d'ESM** (`type: module` interdit), **pas de TypeScript**
- **Framework de test** : Playwright (pas d'Allure — reporter HTML natif + reporter custom JSON/CSV)
- **OS de développement** : Windows (chemins PowerShell dans les exemples)

---

## Structure du projet

```
qa-tnr-playwright/
├── .auth/               # storageState sessions — NE JAMAIS LIRE NI MODIFIER
├── apps/
│   ├── compliance/
│   │   ├── pages/       # Page Objects (POM)
│   │   ├── setup/       # auth.setup.js
│   │   └── tests/       # *.spec.js
│   └── ellipro-risk/
│       ├── pages/
│       ├── setup/
│       └── tests/
│           ├── auth/
│           └── recherche/
├── config/
│   ├── playwright.config.js
│   ├── apps.matrix.js   # matrice projets × browsers × envs
│   ├── environments.js  # URLs par app et env
│   └── global-setup.js  # chargement .env.local
├── shared/
│   ├── mailer/          # send-report.js
│   ├── pages/           # keycloak.page.js, consent.page.js
│   ├── reporter/        # tnr-reporter.js → JSON + CSV
│   └── utils/           # logger.js, metrics.js, link-auth.js
└── test-data/
    ├── motscles-recherche.json   # ⛔ NE JAMAIS MODIFIER
    ├── compliance.json
    ├── ellipro.json
    └── taches.json
```

---

## Commandes utiles

```powershell
# Lister tous les projets disponibles
npx playwright test --config=config/playwright.config.js --list

# Lister les tests d'un projet
npx playwright test --config=config/playwright.config.js --list --project=tnr-chromium-ua-compliance-v2

# Setup session (à lancer une fois par journée avant les tests)
npx playwright test --config=config/playwright.config.js --project=setup-compliance-v2-ua

# Lancer un projet TNR complet
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2

# Lancer un test par ID ou tag
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --grep "PTF_01"
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --grep "@smoke"

# Mode debug
npx playwright test --config=config/playwright.config.js --project=tnr-chromium-ua-compliance-v2 --headed --debug --grep "PTF_01"

# Rapport HTML — un par run : <TNR_SORTIES>\<machine>\test-output\runs\run-xxx\rapport-html (cf. config/sorties.js)
npx playwright show-report "<dossier du run>\rapport-html"
```

---

## Conventions de nommage des projets

| Pattern | Exemple |
|---------|---------|
| `setup-[app]-[env]` | `setup-compliance-v2-ua` |
| `tnr-[browser]-[env]-[app]` | `tnr-chromium-ua-compliance-v2` |
| `perf-recherche-[env]-[app]` | `perf-recherche-ua-ellipro-risk` |

Les fichiers de sortie reprennent **exactement** le nom du projet :
```
test-output/results-tnr-chromium-ua-compliance-v2.json
test-output/history-perf-recherche-ua-ellipro-risk.json
test-output/logs-tnr-chromium-ua-compliance-v2.txt
```

---

## Règles ABSOLUES — ne jamais enfreindre

| Règle | Raison |
|-------|--------|
| `.env.local` → jamais lu, jamais modifié, jamais commité | Contient les credentials |
| `.auth/*.json` → jamais lu, jamais modifié, jamais commité | Contient les tokens de session |
| `test-output/` → jamais commité | Artifacts de run |
| `test-data/motscles-recherche.json` → **NE JAMAIS MODIFIER** | Casse l'historique Grafana |
| Tests perf → **jamais parallélisés** | Mesures faussées |
| Credentials → **jamais dans le code ni la config** | Sécurité |

---

## Règle générale — consentement obligatoire

**Toute modification de fichier existant nécessite une validation explicite d'Olivier.**  
Proposer le diff avant d'écrire. Ne jamais modifier silencieusement un fichier existant.  
Exceptions : fichiers créés de toutes pièces dans la session courante sur demande explicite.

---

## Branche de travail

Travailler sur la branche **`dev`** par défaut.  
Ne jamais merger ou pousser sur `main` sans instruction explicite.

---

## Sélecteurs — ordre de priorité

1. `data-cy` (Compliance — posés par l'équipe Cypress)
2. `data-testid` (Ellipro Risk)
3. `getByRole` / `getByLabel`
4. CSS (dernier recours — toujours documenter pourquoi dans un commentaire)

---

## IDs fonctionnels et tags

| Préfixe ID | Module |
|------------|--------|
| `[PTF_XX]` | Portefeuille Compliance |
| `[TCH_XX]` | Tâches Compliance |
| `[R_XXX]` | Auth / réseau Ellipro Risk |
| `[PERF]` | Tests performance Solr |

Tags obligatoires : `@tnr` sur tous les TNR, `@smoke` sur les tests critiques post-déploiement.

---

## Pattern Angular CDK — dropdown multi-select

Les dropdowns de filtres Angular CDK (Compliance) ne se ferment **pas** automatiquement
après un clic d'option (multi-select). Il faut toujours :
1. Cliquer l'option
2. Appuyer `Escape`
3. Attendre `aria-expanded="false"` sur le bouton trigger

Sans ça, le `cdk-overlay-backdrop` reste actif et bloque les clics suivants.  
Voir `taches.page.js` → méthodes `fermerDropdownEquipes()` / `fermerDropdownUser()` pour le pattern de référence.

---

## Références

- **README.md** — vue d'ensemble, commandes, applications couvertes, roadmap
- **CONVENTIONS.md** — règles de code (fait foi en cas de conflit)
- **config/apps.matrix.js** — matrice complète des projets Playwright
- **config/environments.js** — URLs par app et environnement
