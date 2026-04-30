// config/environments.js
// URLs de toutes les apps par environnement
// Les credentials sont dans .env — jamais ici

'use strict';

const environments = {

  'ellipro-risk': {
    dev:  'https://devoffmod.int.dns',
    ia:   'https://iaellipro.int.dns',
    ua:   'https://uaellipro.dsi-info.net',
    prod: 'https://www.ellipro.fr',
  },

  'ellipro-mod-dec': {
    dev:  'https://devoffmod.int.dns',
    ia:   'https://iaellipro.int.dns',
    ua:   'https://uaellipro.dsi-info.net',
    prod: 'https://www.ellipro.fr',
  },

  'ellipro-saml': {
    dev:  'https://devsamlellipro.int.dns',
    ia:   'https://iasamlellipro.int.dns',
    ua:   'https://uasamlellipro.dsi-info.net',
    prod: 'https://saml.ellipro.fr',
  },

  'compliance-v1': {
    dev:  'https://devcompliance.int.dns',
    ia:   'https://iacompliance.int.dns',
    ua:   'https://uacompliance.dsi-info.net',
    prod: 'https://compliance.ellisphere.com',
  },

  'compliance-v1-saml': {
    dev:  'https://devsaml-compliance.int.dns',
    ia:   'https://iasaml-compliance.int.dns',
    ua:   'https://uasaml-compliance.dsi-info.net',
    prod: 'https://saml-compliance.ellisphere.com',
  },

  'compliance-v2': {
    dev:  'https://devcomplianceforbusiness.int.dns',
    ia:   'https://iacomplianceforbusiness.int.dns',
    ua:   'https://uacomplianceforbusiness.dsi-info.net',
    prod: 'https://complianceforbusiness.ellisphere.com',
  },

  'compliance-v2-saml': {
    dev:  'https://devsaml-cfb.int.dns',
    ia:   'https://iasaml-cfb.int.dns',
    ua:   'https://uasaml-cfb.dsi-info.net',
    prod: 'https://saml-cfb.ellisphere.com',
  },

  'orange': {
    dev:  'https://devorange.int.dns',
    ia:   'https://iaorange.int.dns',
    ua:   'https://uaorange.dsi-info.net',
    prod: 'https://orange.ellisphere.com',
  },

  'keycloak': {
    dev:  'https://devlogin.int.dns',
    ia:   'https://iaauth.int.dns',
    ua:   'https://uaauth.dsi-info.net',
    prod: 'https://auth.ellisphere.com',
  },

  'releve-conso': {
    dev:  'https://devreleveconsommation.int.dns',
    ia:   'https://iareleveconsommation.int.dns',
    ua:   'https://uareleveconsommation.dsi-info.net',
    prod: 'https://releveconsommation.ellisphere.com',
  },

};

/**
 * Retourne l'URL d'une app pour un environnement donné
 * @param {string} app   - clé app (ex: 'ellipro-risk')
 * @param {string} env   - environnement (dev|ia|ua|prod)
 * @returns {string} URL
 */
function getUrl(app, env) {
  const appConfig = environments[app];
  if (!appConfig) throw new Error(`App inconnue : "${app}"`);
  const url = appConfig[env];
  if (!url) throw new Error(`Env inconnu "${env}" pour l'app "${app}"`);
  return url;
}

module.exports = { environments, getUrl };
