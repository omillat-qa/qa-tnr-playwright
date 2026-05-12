# Conventions qa-tnr-playwright

> Document de référence pour la cellule de test Ellisphere.
> En cas de conflit avec le README, ce fichier fait foi pour les conventions de code.

---

## Structure des dossiers

```
qa-tnr-playwright/
├── .auth/               # storageState sessions (gitignore — ne jamais commiter)
├── apps/                # Un dossier par app
│   ├── compliance/
│   │   ├── pages/       # POM : portefeuille.page.js, recherche.page.js
│   │   ├── setup/       # auth.setup.js (login unique storageState)
│   │   └── tests/       # portefeuille.spec.js, perf-recherche.spec.js
│   └── ellipro-risk/
│       ├── pages/
│       ├── setup/
│       └── tests/
│           ├── auth/    # auth.spec.js (R_001-R_012), network.spec.js
│           └── recherche/
├── config/
│   ├── playwright.config.js
│   ├── apps.matrix.js   # matrice browsers × envs × apps
│   ├── environments.js  # URLs par app et env
│   └── global-setup.js  # chargement .env.local
├── shared/
│   ├── fixtures/        # auth.fixture.js
│   ├── mailer/          # send-report.js (email HTML post-run)
│   ├── pages/           # keycloak.page.js, consent.page.js
│   ├── reporter/        # tnr-reporter.js → JSON + CSV history
│   └── utils/           # logger.js, metrics.js, link-auth.js
└── test-data/
    ├── motscles-recherche.json   # 80 mots-clés Solr — NE PAS MODIFIER
    ├── compliance.json
    └── ellipro.json
```

---

## Nommage des fichiers

| Type | Convention | Exemple |
|------|------------|---------|
| Page Object | `nom-fonctionnel.page.js` | `portefeuille.page.js` |
| Spec de test | `nom-fonctionnel.spec.js` | `portefeuille.spec.js` |
| Fixture | `nom.fixture.js` | `auth.fixture.js` |
| Utilitaire | `nom.js` | `link-auth.js` |
| Données | `app.json` | `compliance.json` |

---

## Nommage des projets Playwright

Le nom du projet encode **type + browser + env + app** — c'est l'identifiant unique utilisé
dans toutes les commandes `--project` et dans les noms de fichiers de sortie.

| Pattern | Exemple | Usage |
|---------|---------|-------|
| `setup-[app]-[env]` | `setup-compliance-v2-ua` | Login unique + sauvegarde session |
| `tnr-[browser]-[env]-[app]` | `tnr-chromium-ua-compliance-v2` | Tests fonctionnels TNR |
| `perf-recherche-[env]-[app]` | `perf-recherche-ua-ellipro-risk` | Perf recherche Solr (chromium uniquement) |

Les fichiers de sortie reprennent exactement le nom du projet :
```
test-output/results-tnr-chromium-ua-compliance-v2.json
test-output/history-perf-recherche-ua-ellipro-risk.json
test-output/logs-tnr-chromium-ua-compliance-v2.txt
```

---

## IDs fonctionnels

Chaque test porte un ID fonctionnel issu du référentiel métier.

| Préfixe | App / Module | Exemple |
|---------|-------------|---------|
| `PTF_` | Portefeuille Compliance | `[PTF_01]` |
| `R_` | Auth / réseau Ellipro Risk | `[R_001]` |
| `PERF` | Tests performance Solr | `[PERF]` |

### Suffixe de vue pour les tests multi-vues

Quand un même test couvre plusieurs modes d'affichage (ex: portefeuille en vue carte ET vue liste),
on suffixe l'ID pour distinguer les deux :

| Suffixe | Vue | Exemple |
|---------|-----|---------|
| _(aucun)_ | Mode carte (défaut) | `[PTF_061_2]` |
| `L` | Mode liste | `[PTF_061_2L]` |

Règle : si un élément est **absent dans une des deux vues**, le test n'existe que pour la vue
où il est présent (ex: l'id évaluation `#xxxxx` n'existe qu'en mode carte → `PTF_061_1` uniquement,
pas de `PTF_061_1L`).

---

## Tags obligatoires

Chaque test doit avoir au moins un tag de type et un tag de module :

```javascript
// Type de test
@tnr      // test de non-régression standard
@smoke    // test rapide, lancé en validation post-déploiement
@auth     // test d'authentification

// Module métier (utilisé pour le récap email)
@portefeuille
@recherche
@evaluation
@taches
// etc.
```

---

## Structure d'un spec

```javascript
'use strict';

const { test, expect } = require('@playwright/test');
const { MaPage } = require('../pages/ma.page');
const data = require('../../../test-data/compliance.json');

test.beforeEach(async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
});

test.describe('NomModule', () => {

  test('[PTF_01] @tnr @portefeuille - description courte', async ({ page }) => {
    // ...
  });

});
```

Le nom du `describe` = nom du module métier = section dans le récap email.

---

## Sélecteurs — ordre de priorité

| Priorité | Sélecteur | App | Note |
|----------|-----------|-----|------|
| 1 | `data-cy` | Compliance | Posés par l'équipe Cypress |
| 2 | `data-testid` | Ellipro Risk | Posés par les devs |
| 3 | `getByRole` / `getByLabel` | Toutes | Accessibilité |
| 4 | CSS | Toutes | Dernier recours — documenter pourquoi |

---

## Règles Page Object (POM)

```javascript
'use strict';

class MonPage {
  constructor(page) {
    this.page = page;
    // Tous les locators déclarés dans le constructeur, jamais dans les méthodes
    this.btnConnexion = page.locator('[data-cy="login.submit"]');
    this.inputEmail   = page.locator('[data-cy="login.email"]');
  }

  async seConnecter(email, password) {
    await this.inputEmail.fill(email);
    // ...
  }
}

module.exports = { MonPage };
```

### Gestion des vues multiples (carte / liste)

Quand une page a plusieurs modes d'affichage, le POM expose :
- une méthode `getVueActive()` qui détecte la vue courante via l'attribut `disabled` du bouton de bascule
- des méthodes `forcerVueCarte()` / `forcerVueListe()` qui ne cliquent que si nécessaire
- des méthodes de sélecteurs suffixées `Carte` / `Liste` pour chaque vue

```javascript
// Détection via disabled — fiable même si Angular garde les composants dans le DOM
async getVueActive() {
  const estDisabled = await this.page.locator('[data-cy="wallet.cardView"]').getAttribute('disabled');
  return estDisabled !== null ? 'carte' : 'liste';
}

async forcerVueCarte() {
  if (await this.getVueActive() === 'liste') {
    await this.btnVueCarte.click();
    await this.page.locator('app-card-view').waitFor({ state: 'visible' });
  }
}
```

> ⚠️ Ne pas détecter la vue via `component.count()` — Angular peut garder
> les composants dans le DOM sans les afficher.

---

## Matrice browsers par environnement

| Env | Chromium | Firefox | Edge | WebKit |
|-----|----------|---------|------|--------|
| UA | ✅ | ✅ | ✅ | ✅ (léger) |
| PROD | ✅ | ✅ (Compliance) | ✅ | ❌ |
| IA / DEV | ✅ | ❌ | ❌ | ❌ |
| Perf Solr | ✅ uniquement | ❌ | ❌ | ❌ |

---

## Règles credentials

- Les credentials sont **uniquement** dans `.env.local`
- `.env.local` est dans `.gitignore` — il ne doit **jamais** être commité
- `.env.example` liste toutes les clés nécessaires, sans valeurs
- En CI Jenkins : les variables sont injectées via les credentials Jenkins
- **Jamais de credential en dur dans le code ni dans les fichiers de config**

---

## Règles critiques

| Règle | Raison |
|-------|--------|
| `.env.local`, `.auth/*.json`, `test-output/` → jamais commités | Sécurité / données run |
| `motscles-recherche.json` → **NE PAS MODIFIER** | Casse la comparaison historique Grafana |
| Tests perf → **NE PAS paralléliser** | Mesures faussées |
| StorageState → **1 seul login par app par run** | Setup lancé avant tous les tests |

---

## Commits

Format : `type(app): description courte`

| Type | Usage |
|------|-------|
| `feat` | Nouveau test ou nouvelle fonctionnalité |
| `fix` | Correction d'un test en erreur |
| `refactor` | Restructuration sans changement de comportement |
| `chore` | Config, dépendances, matrice |
| `docs` | Documentation uniquement |

Exemples :
```
feat(compliance): ajout PTF_061_2L et PTF_062 mode liste
fix(compliance): correction getVueActive() détection via disabled
refactor(shared): extraction keycloak.page.js depuis ellipro
chore(config): mise à jour matrice browsers UA
docs: mise à jour CONVENTIONS suffixe vue L
```

---

## Branches

| Branche | Usage |
|---------|-------|
| `main` | Stable — validé |
| `dev` | Travail en cours |
