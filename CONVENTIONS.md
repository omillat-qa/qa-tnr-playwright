# Conventions qa-tnr-playwright

## Structure des dossiers

```
qa-tnr-playwright/
├── shared/          # Code partagé toutes apps (POM auth, utils, fixtures)
├── apps/            # Un dossier par app
│   ├── ellipro-risk/
│   ├── ellipro-mod-dec/
│   ├── compliance/
│   ├── orange/
│   └── keycloak/
├── config/          # Configuration Playwright, envs, matrice browsers
├── test-data/       # Données de test par app (JSON)
├── .env.example     # Template variables d'environnement (commité)
└── .env             # Valeurs réelles (jamais commité)
```

## Nommage des fichiers

| Type | Convention | Exemple |
|---|---|---|
| Page Object | `nom-fonctionnel.page.js` | `keycloak.page.js` |
| Spec de test | `nom-fonctionnel.spec.js` | `auth.spec.js` |
| Fixture | `nom.fixture.js` | `auth.fixture.js` |
| Utilitaire | `nom.js` | `link-auth.js` |
| Données | `app.json` | `ellipro.json` |

## Convention des tests

### IDs fonctionnels
Chaque test doit porter un ID fonctionnel issu du référentiel métier :

```javascript
test('[R_001] Recherche QUI : lancement possible dès le second caractère', async ({ page }) => {
  // ...
});
```

Format : `[R_XXX]` pour les requirements, `[TCH_XX]` pour les cas de test Compliance.

### Tags obligatoires
Chaque test doit avoir au moins un tag de type et un tag de module :

```javascript
// Type de test
@tnr      // test de non-régression standard
@smoke    // test rapide, lancé en validation prod
@auth     // test d'authentification

// Module métier (utilisé pour le recap email)
@accueil
@recherche
@evaluation
@taches
// etc.
```

### Structure d'un spec

```javascript
const { test, expect } = require('@playwright/test');
const { AuthFixture } = require('../../shared/fixtures/auth.fixture');

test.describe('Accueil', () => {

  test('[R_001] @tnr @accueil - titre de la page après connexion', async ({ page }) => {
    // ...
  });

  test('[R_002] @smoke @accueil - menu principal visible', async ({ page }) => {
    // ...
  });

});
```

Le nom du `describe` = nom du module métier = section dans le recap email.

## Matrice browsers par environnement

| Env | Chrome | Firefox | Edge | WebKit |
|---|---|---|---|---|
| UA | ✅ | ✅ | ✅ | ✅ (léger) |
| PROD | ✅ | ✅ (Compliance) | ✅ | ❌ |
| IA | ✅ | ❌ | ❌ | ❌ |
| DEV | ✅ | ❌ | ❌ | ❌ |

## Règles credentials

- Les mots de passe et secrets sont **uniquement** dans `.env`
- `.env` est dans `.gitignore` — il ne doit jamais être commité
- `.env.example` liste toutes les clés nécessaires, sans valeurs
- En CI Jenkins : les variables sont injectées via les credentials Jenkins

## Règles Page Object (POM)

```javascript
class MonPage {
  constructor(page) {
    this.page = page;
    // Définir les locators ici, pas dans les méthodes
    this.btnConnexion = page.getByTestId('login-submit-btn');
    this.inputEmail   = page.getByTestId('login-email-input');
  }

  async seConnecter(email, password) {
    await this.inputEmail.fill(email);
    // ...
  }
}

module.exports = { MonPage };
```

## Sélecteurs - ordre de priorité

1. `data-testid` (posés par les devs) — priorité absolue
2. `getByRole` (accessibilité) — si pas de data-testid
3. `getByLabel` / `getByText` — si role insuffisant
4. Sélecteur CSS/XPath — en dernier recours uniquement, à documenter

## Commits

Format : `type(app): description courte`

Exemples :
- `feat(compliance): ajout spec evaluation R_045 à R_052`
- `fix(ellipro-risk): correction locator recherche après MAJ Angular`
- `refactor(shared): extraction keycloak.page.js depuis ellipro`
- `chore(config): mise à jour matrice browsers UA`
