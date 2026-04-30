// config/global-setup.js
// Chargement des credentials depuis .env avant tout lancement

'use strict';

const fs   = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function globalSetup() {
  const root = path.resolve(__dirname, '..');

  // Ordre de priorité : .env.local d'abord, puis .env
  const candidates = [
    path.join(root, '.env.local'),
    path.join(root, '.env'),
  ];

  let loaded = false;
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      dotenv.config({ path: f, override: false });
      console.log(`[global-setup] credentials chargés : ${path.basename(f)}`);
      loaded = true;
      break;
    }
  }

  if (!loaded) {
    console.warn('[global-setup] ⚠ Aucun fichier .env trouvé — variables d\'env attendues depuis CI');
  }
}

module.exports = globalSetup;
