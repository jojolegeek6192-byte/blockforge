// jsonDatabase.js
// Petite base de donnees "fichier JSON" maison.
// Choisie volontairement a la place de SQLite : aucune dependance avec
// compilation native, donc 100% portable (fonctionne partout ou Node tourne,
// y compris apres un simple `git clone` + `npm install`).
//
// Le fichier data.json est cree automatiquement au premier lancement.
// Ce n'est evidemment pas fait pour des millions de lignes, mais c'est
// largement suffisant pour une boutique de ressources Roblox.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  users: [],
  assets: [],
  reviews: [],
  purchases: [],
  _meta: {
    nextUserId: 1,
    nextAssetId: 1,
    nextReviewId: 1,
    nextPurchaseId: 1,
  },
};

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[db] Fichier data.json corrompu, reinitialisation.', err);
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function writeDb(data) {
  // Ecriture atomique simple : on ecrit dans un fichier temporaire puis on
  // remplace, pour limiter le risque de fichier coupe si le process crash
  // pendant l'ecriture.
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

// Verrou tres simple en memoire pour serialiser les ecritures dans un meme
// process (suffisant ici : pas de cluster, un seul process Node, et toutes
// les operations fs sont synchrones donc pas de risque d'entrelacement).
let isWriting = false;
function withWriteLock(fn) {
  if (isWriting) {
    // Cas extremement improbable en synchrone (pas de reentrance possible
    // tant qu'on ne fait pas d'I/O asynchrone dans fn), mais on protege
    // quand meme contre un appel recursif accidentel.
    throw new Error('Ecriture concurrente detectee sur la base de donnees JSON.');
  }
  isWriting = true;
  try {
    return fn();
  } finally {
    isWriting = false;
  }
}

module.exports = {
  DB_PATH,
  readDb,
  writeDb,
  withWriteLock,
};
