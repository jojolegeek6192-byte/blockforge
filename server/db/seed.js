// seed.js
// Cree le compte "owner" (proprietaire de la boutique) a partir des
// variables d'environnement OWNER_EMAIL / OWNER_PASSWORD.
// A lancer une seule fois : `npm run seed`.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { findUserByEmail, createUser } = require('./models');

async function seed() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const displayName = process.env.OWNER_NAME || 'Proprietaire';

  if (!email || !password) {
    console.error('OWNER_EMAIL et OWNER_PASSWORD doivent etre definis dans .env');
    process.exit(1);
  }

  const existing = findUserByEmail(email);
  if (existing) {
    console.log(`Un compte existe deja pour ${email} (id=${existing.id}, isOwner=${existing.isOwner}).`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ email, passwordHash, displayName, isOwner: true });
  console.log(`Compte proprietaire cree : ${user.email} (id=${user.id})`);
  process.exit(0);
}

seed();
