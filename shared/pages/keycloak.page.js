'use strict';

// shared/pages/keycloak.page.js
// Page Object Keycloak — commun à toutes les apps qui utilisent Keycloak
// Migré depuis keycloakPO_auth.js — Allure retiré, CommonJS, paths corrigés

const { ajouterLog } = require('../utils/logger');

const BAD_CREDS_RX = /Invalid username or password|Nom d.?utilisateur.*mot de passe invalide/i;
const PW_EXPIRED_RX = /password.*expired|mot de passe.*expir[ée]/i;

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function attachScreenshot(page, testInfo, label) {
  try {
    const screenshot = await page.screenshot({ fullPage: true });
    if (testInfo) {
      await testInfo.attach(label, { body: screenshot, contentType: 'image/png' });
    }
  } catch {
    // Ne pas faire planter un test à cause d'un screenshot raté
  }
}

async function getCurrentLocale(page) {
  const lang = await page.evaluate(() => document.documentElement?.lang || '');
  if (lang) return String(lang).toLowerCase();
  try {
    const u = new URL(page.url());
    const lc = (u.searchParams.get('kc_locale') || '').toLowerCase();
    if (lc) return lc;
  } catch {}
  return '';
}

function normalizeLabelToCode(label) {
  if (!label) return '';
  if (/^en\b/i.test(label)) return 'en';
  if (/^fr\b/i.test(label)) return 'fr';
  if (/anglais|english/i.test(label)) return 'en';
  if (/fran|français/i.test(label)) return 'fr';
  return String(label).toLowerCase();
}

function normalizeSpaces(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

async function strictEqualsText(page, sel, expected, name, testInfo, timeout = 8000) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout });
  const got = normalizeSpaces(await loc.innerText().catch(() => ''));
  const exp = normalizeSpaces(expected);
  if (got !== exp) {
    await attachScreenshot(page, testInfo, `strict-mismatch-${name.replace(/\s+/g, '-')}`);
    throw new Error(`Texte inattendu pour ${name}.\nAttendu : "${exp}"\nObtenu  : "${got}"\nSélecteur: ${sel}`);
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Ouvre l'app et attend le formulaire Keycloak.
 */
async function openLoginForm(page, baseURL, testInfo) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  ajouterLog(`Ouverture application: ${page.url()}`, 'Auth-TNR', 'info');

  const alreadyOnKC =
    (await page.locator('#kc-form-login, form#kc-form-login').count().catch(() => 0)) > 0 ||
    (() => { try { return /auth/i.test(new URL(page.url()).host); } catch { return false; } })();

  if (!alreadyOnKC) {
    const link = page.locator('text=Nouvelle authentification').first();
    if (await link.isVisible().catch(() => false)) {
      await Promise.allSettled([link.click(), page.waitForNavigation({ waitUntil: 'domcontentloaded' })]);
    }
  }

  const btn = page.locator('button:has-text("J\'accepte"), #acceptCookiesBtn').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(200);
    ajouterLog('Cookies acceptés (portail)', 'Auth-TNR', 'info');
  }

  await page.waitForSelector('#kc-form-login, form#kc-form-login', { timeout: 15000 });
}

/**
 * Change la langue (FR/EN).
 */
async function setLanguage(page, label) {
  const targetCode = normalizeLabelToCode(label || '');
  if (!targetCode) return;

  const current = await getCurrentLocale(page);
  if (current && current.startsWith(targetCode)) {
    ajouterLog(`Langue déjà ${targetCode}, aucune action.`, 'Auth-TNR', 'info');
    return;
  }

  const sel = page.locator('#login-select-toggle');
  if (await sel.isVisible().catch(() => false)) {
    let value = await sel.locator(`option[value*="kc_locale=${targetCode}"]`).first().getAttribute('value').catch(() => null);
    if (!value) {
      const re = new RegExp(label, 'i');
      value = await sel.locator('option').filter({ hasText: re }).first().getAttribute('value').catch(() => null);
    }
    if (value) {
      await sel.selectOption({ value }).catch(() => {});
    } else {
      try {
        const u = new URL(page.url());
        u.searchParams.set('kc_locale', targetCode);
        await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
      } catch {}
    }
  } else {
    const link = page.locator(`a[href*="kc_locale=${targetCode}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), link.click()]);
    } else {
      try {
        const u = new URL(page.url());
        u.searchParams.set('kc_locale', targetCode);
        await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
      } catch {}
    }
  }

  try {
    await page.waitForFunction(
      (code) => (document.documentElement?.lang || '').toLowerCase().startsWith(code),
      targetCode,
      { timeout: 8000 }
    );
  } catch {
    const now = await getCurrentLocale(page);
    ajouterLog(`Langue courante après tentative: ${now || 'inconnue'}`, 'Auth-TNR', 'info');
  }
}

/**
 * Bascule la langue uniquement si nécessaire et vérifie le résultat.
 */
async function ensureLanguage(page, target, testInfo) {
  const code = normalizeLabelToCode(target);
  const before = await getCurrentLocale(page);
  if (before && before.startsWith(code)) {
    ajouterLog(`Langue déjà ${code}, pas de bascule.`, 'Auth-TNR', 'info');
    return { changed: false, before, after: before };
  }
  await setLanguage(page, code);
  const after = await getCurrentLocale(page);
  if (!after || !after.startsWith(code)) {
    await attachScreenshot(page, testInfo, `lang-${code}-not-applied`);
    throw new Error(`La langue cible "${code}" n'a pas été appliquée (avant=${before}, après=${after || 'inconnue'})`);
  }
  return { changed: true, before, after };
}

/**
 * Saisit et soumet le formulaire de login.
 */
async function submitCredentials(page, { username, password }) {
  if (username !== undefined) await page.fill('#username, input[name="username"]', username);
  if (password !== undefined) await page.fill('#password, input[name="password"]', password);
  await page.click('#kc-login, button#kc-login, button[name="login"]').catch(() => {});
}

/**
 * Attend le message "identifiants invalides" (FR/EN).
 */
async function expectInvalidCredentialsMessage(page, testInfo, timeout = 10000) {
  const loc = page.locator('text=/Invalid username or password|Nom d.?utilisateur.*mot de passe invalide/i');
  try {
    await loc.first().waitFor({ state: 'visible', timeout });
  } catch (e) {
    await attachScreenshot(page, testInfo, 'invalid-credentials-not-found');
    throw e;
  }
}

/**
 * Vérifie qu'au moins un indicateur d'erreur de formulaire s'affiche.
 */
async function expectFormErrors(page, testInfo, timeout = 8000) {
  const anyError = page.locator('.pf-m-error, .kc-feedback-text, [aria-invalid="true"]');
  try {
    await anyError.first().waitFor({ state: 'visible', timeout });
  } catch (e) {
    await attachScreenshot(page, testInfo, 'form-errors-not-found');
    throw e;
  }
}

/**
 * Clique sur "Mot de passe oublié ?" et attend la page de reset.
 */
async function goToForgotPassword(page, testInfo) {
  const reset = page.locator('a:has-text("Mot de passe oublié"), a:has-text("Forgot Password")').first();
  try {
    await reset.waitFor({ state: 'visible', timeout: 15000 });
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), reset.click()]);
  } catch (e) {
    await attachScreenshot(page, testInfo, 'forgot-link-not-found');
    throw e;
  }

  const resetForm = page.locator('#kc-reset-password-form, form[action*="reset-credentials"]');
  try {
    await resetForm.first().waitFor({ state: 'visible', timeout: 10000 });
  } catch (e) {
    await attachScreenshot(page, testInfo, 'forgot-page-not-ready');
    throw e;
  }
}

/**
 * Vérifie les libellés de la page de login FR/EN (souple).
 */
async function expectLoginLabels(page, locale, testInfo) {
  const code = normalizeLabelToCode(locale);
  const failures = [];

  const checks = [
    ['titre',         page.locator('h1#kc-page-title, h1').first()],
    ['labelEmail',    page.locator('label[for="username"] .pf-v5-c-form__label-text').first()],
    ['labelPassword', page.locator('label[for="password"] .pf-v5-c-form__label-text').first()],
    ['remember',      page.locator('label[for="rememberMe"] .pf-v5-c-check__label').first()],
    ['forgot',        page.locator('a[href*="reset-credentials"]').first()],
    ['btn',           page.locator('button#kc-login, button[name="login"]').first()],
  ];

  for (const [name, loc] of checks) {
    try { await loc.waitFor({ state: 'visible', timeout: 8000 }); }
    catch { failures.push(`${name} non visible`); }
  }

  if (!failures.length) {
    const [title, email, pwd, remember, forgot, btn] = await Promise.all(
      checks.map(([, loc]) => loc.innerText().catch(() => ''))
    );
    if (code === 'fr') {
      if (!/connectez[\s\-–-]?vous.*compte/i.test(title))   failures.push(`titre FR invalide: "${title}"`);
      if (!/^Email$/i.test(email))                           failures.push(`label Email FR: "${email}"`);
      if (!/^Mot de passe$/i.test(pwd))                      failures.push(`label Pwd FR: "${pwd}"`);
      if (!/^Se souvenir de moi$/i.test(remember))           failures.push(`remember FR: "${remember}"`);
      if (!/^Mot de passe oublié\s?\?$/i.test(forgot))       failures.push(`lien FR: "${forgot}"`);
      if (!/^(Connexion|CONNEXION)$/i.test(btn))             failures.push(`bouton FR: "${btn}"`);
    } else {
      if (!/(^|\s)Sign in to your account/i.test(title))     failures.push(`title EN: "${title}"`);
      if (!/^Email$/i.test(email))                           failures.push(`label Email EN: "${email}"`);
      if (!/^Password$/i.test(pwd))                          failures.push(`label Pwd EN: "${pwd}"`);
      if (!/^Remember me$/i.test(remember))                  failures.push(`remember EN: "${remember}"`);
      if (!/^Forgot Password\?$/i.test(forgot))              failures.push(`link EN: "${forgot}"`);
      if (!/^(SIGN IN|Sign in)$/i.test(btn))                 failures.push(`button EN: "${btn}"`);
    }
  }

  if (failures.length) {
    await attachScreenshot(page, testInfo, `labels-${code}-mismatch`);
    throw new Error(`Libellés manquants/incorrects (${code}):\n- ${failures.join('\n- ')}`);
  }
}

/**
 * Vérifie les libellés STRICTS de la page de login FR/EN.
 */
async function expectLoginLabelsStrict(page, locale, testInfo) {
  const code = normalizeLabelToCode(locale);
  if (code === 'fr') {
    await strictEqualsText(page, 'h1#kc-page-title, h1', 'Connectez-vous à votre compte', 'titre FR', testInfo);
    await strictEqualsText(page, 'label[for="username"] .pf-v5-c-form__label-text', 'Email', 'label Email FR', testInfo);
    await strictEqualsText(page, 'label[for="password"] .pf-v5-c-form__label-text', 'Mot de passe', 'label Mot de passe FR', testInfo);
    await strictEqualsText(page, 'label[for="rememberMe"] .pf-v5-c-check__label', 'Se souvenir de moi', 'checkbox FR', testInfo);
    await strictEqualsText(page, 'a[href*="reset-credentials"]', 'Mot de passe oublié ?', 'lien FR', testInfo);
    await strictEqualsText(page, 'button#kc-login, button[name="login"]', 'CONNEXION', 'bouton FR', testInfo);
  } else if (code === 'en') {
    await strictEqualsText(page, 'h1#kc-page-title, h1', 'Sign in to your account', 'title EN', testInfo);
    await strictEqualsText(page, 'label[for="username"] .pf-v5-c-form__label-text', 'Email', 'label Email EN', testInfo);
    await strictEqualsText(page, 'label[for="password"] .pf-v5-c-form__label-text', 'Password', 'label Password EN', testInfo);
    await strictEqualsText(page, 'label[for="rememberMe"] .pf-v5-c-check__label', 'Remember me', 'checkbox EN', testInfo);
    await strictEqualsText(page, 'a[href*="reset-credentials"]', 'Forgot Password?', 'link EN', testInfo);
    await strictEqualsText(page, 'button#kc-login, button[name="login"]', 'SIGN IN', 'button EN', testInfo);
  } else {
    throw new Error(`Langue non gérée pour le strict: "${locale}"`);
  }
}

/**
 * Vérifie le footer FR (ordre + href exacts).
 */
async function expectFooterLinksFR(page, testInfo) {
  const container = page.locator('div.footer').first();
  await container.waitFor({ state: 'visible', timeout: 8000 });

  const links = container.locator('a');
  const count = await links.count();
  if (count < 3) {
    await attachScreenshot(page, testInfo, 'footer-fr-links-missing');
    throw new Error(`Footer: attendu 3 liens, trouvé ${count}`);
  }

  const expectedTexts = [
    'Conditions générales de vente',
    'Politique de confidentialité',
    'Mentions légales',
  ];
  const expectedHrefs = [
    'https://www.ellisphere.com/uploads/documents/cgv/cgv_ellisphere.pdf',
    'https://www.ellisphere.com/uploads/documents/rgpd/Politique_RGPD_Ellisphere.pdf',
    'https://www.ellisphere.com/uploads/documents/mentions_legales/mentions_legales_ellipro_fr.pdf',
  ];

  const failures = [];
  for (let i = 0; i < 3; i++) {
    const a = links.nth(i);
    const txt  = normalizeSpaces(await a.innerText().catch(() => ''));
    const href = await a.getAttribute('href').catch(() => '');
    if (txt  !== expectedTexts[i])  failures.push(`Lien #${i + 1}: texte attendu="${expectedTexts[i]}", obtenu="${txt}"`);
    if (href !== expectedHrefs[i])  failures.push(`Lien #${i + 1}: href attendu="${expectedHrefs[i]}", obtenu="${href}"`);
  }

  if (failures.length) {
    await attachScreenshot(page, testInfo, 'footer-fr-mismatch');
    throw new Error('Footer FR non conforme:\n- ' + failures.join('\n- '));
  }
}

module.exports = {
  BAD_CREDS_RX,
  PW_EXPIRED_RX,
  openLoginForm,
  setLanguage,
  ensureLanguage,
  submitCredentials,
  expectInvalidCredentialsMessage,
  expectFormErrors,
  goToForgotPassword,
  expectLoginLabels,
  expectLoginLabelsStrict,
  expectFooterLinksFR,
  attachScreenshot,
  getCurrentLocale,
};
