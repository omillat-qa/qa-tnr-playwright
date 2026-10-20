'use strict';

// shared/utils/version-app.js
// Version applicative déployée, lue dans le HTML → champs version_app / build_app de data/*.jsonl
// Sources, par ordre de préférence :
//   1. <meta name="generator" content="AppEllipro 1.36.17.1 2026-10-13T08:04:11Z">  → version + date de build
//   2. ?v=X.Y.Z sur un script de l'app (cache-busting Angular)                     → version seule
// Les scripts d'un autre domaine sont ignorés (page de login Keycloak : styles-es.css?v=1.12).

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ version: string, build: string|null }|null>}
 */
async function lireVersionApp(page) {
  return page.evaluate(() => {
    const meta  = document.querySelector('meta[name="generator"]');
    const match = meta && meta.content.match(/(\d+(?:\.\d+)+)(?:\s+(\d{4}-\d{2}-\d{2}T\S+))?/);
    if (match) return { version: match[1], build: match[2] || null };

    for (const s of document.querySelectorAll('script[src]')) {
      const url = new URL(s.src, location.href);
      if (url.origin !== location.origin) continue;
      const v = url.searchParams.get('v');
      if (v) return { version: v, build: null };
    }
    return null;
  }).catch(() => null);
}

/**
 * Lit la version et l'attache au test : tnr-reporter la reprend dans tests/runs.jsonl
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 */
async function annoterVersionApp(page, testInfo) {
  const v = await lireVersionApp(page);
  if (!v) return;
  testInfo.annotations.push({ type: 'version_app', description: v.version });
  if (v.build) testInfo.annotations.push({ type: 'build_app', description: v.build });
}

/**
 * Lit la version par HTTP, sans navigateur ni session : la page d'accueil des apps est publique.
 * Sert aux projets sans setup (ex. TNR Ellipro, qui ne testent que la page de login Keycloak).
 * @param {string} url
 * @returns {Promise<{ version: string, build: string|null }|null>}
 */
async function lireVersionAppHttp(url, { ignoreHTTPSErrors = true } = {}) {
  const { request } = require('@playwright/test');
  const ctx = await request.newContext({ ignoreHTTPSErrors });
  try {
    const html  = await (await ctx.get(url, { timeout: 10000 })).text();
    const match = html.match(/<meta\s+name="generator"\s+content="[^"]*?(\d+(?:\.\d+)+)(?:\s+(\d{4}-\d{2}-\d{2}T[^"\s]+))?/i);
    return match ? { version: match[1], build: match[2] || null } : null;
  } catch {
    return null;   // app injoignable : le run n'est pas bloqué
  } finally {
    await ctx.dispose();
  }
}

module.exports = { lireVersionApp, annoterVersionApp, lireVersionAppHttp };
