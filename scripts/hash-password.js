const argon2 = require('argon2');

const password = process.argv[2];

if (!password) {
  console.error('Uso: pnpm hash-password <contraseña>');
  process.exit(1);
}

async function main() {
  const hash = await argon2.hash(password);

  console.log('\nHash Argon2:\n');
  console.log(hash);
}

main().catch((error) => {
  console.error('Error generando el hash:', error);
  process.exit(1);
});
