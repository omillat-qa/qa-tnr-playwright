'use strict';

// shared/utils/link-auth.js
// Génération des liens signés HMAC-SHA256 pour AppEllipro et VcNom-web

const crypto = require('crypto');

function two(n) { return String(n).padStart(2, '0'); }

function formatIsoLocal(d = new Date()) {
  const y = d.getFullYear(), M = two(d.getMonth() + 1), D = two(d.getDate());
  const h = two(d.getHours()), m = two(d.getMinutes()), s = two(d.getSeconds());
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  const oh = two(Math.floor(abs / 60)), om = two(abs % 60);
  return `${y}-${M}-${D}T${h}:${m}:${s}${sign}${oh}:${om}`;
}

function secondsTimestampMs(d = new Date()) {
  return Math.floor(d.getTime() / 1000) * 1000;
}

/**
 * Génère un lien signé AppEllipro (Risk/Angular)
 * @param {{ baseHost, id, email, contrat, secret, now? }} params
 */
function buildAppElliproUrl({ baseHost, id, email, contrat, secret, now }) {
  if (!baseHost || !id || !email || !contrat || !secret)
    throw new Error('[link-auth] buildAppElliproUrl : paramètre manquant');

  const tsMs = secondsTimestampMs(now || new Date());
  const host = String(baseHost).replace(/\/+$/, '');
  const unsignedUrl = `${host}/AppEllipro/entreprise/FRA/register/${id}?email=${email}&date=${tsMs}&contrat=${contrat}`;
  const cle = crypto.createHmac('sha256', String(secret)).update(unsignedUrl, 'utf8').digest('hex');
  return { url: `${unsignedUrl}&cle=${cle}`, unsignedUrl, cle, tsMs };
}

/**
 * Génère un lien signé VcNom-web (Modulaire/Décisionnel)
 * @param {{ baseHost, email, C, typeid, id, secret, now?, encodePlusInIso? }} params
 */
function buildVcNomUrl({ baseHost, email, C, typeid, id, secret, now, encodePlusInIso = false }) {
  if (!baseHost || !email || !C || !typeid || !id || !secret)
    throw new Error('[link-auth] buildVcNomUrl : paramètre manquant');

  const isoRaw = formatIsoLocal(now || new Date());
  const iso = encodePlusInIso ? isoRaw.replace(/\+/g, '%2B') : isoRaw;
  const host = String(baseHost).replace(/\/+$/, '');
  const unsignedUrl = `${host}/VcNom-web/ExtLogging/e/${email}/cat/${iso}/C/${C}/typeid/${typeid}/id/${id}`;
  const cle = crypto.createHmac('sha256', String(secret)).update(unsignedUrl, 'utf8').digest('hex');
  return { url: `${unsignedUrl}/${cle}`, unsignedUrl, cle, iso };
}

module.exports = { formatIsoLocal, secondsTimestampMs, buildAppElliproUrl, buildVcNomUrl };
