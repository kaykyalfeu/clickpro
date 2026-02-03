#!/usr/bin/env node
/**
 * Script para chamar o endpoint seed-admin em produção
 *
 * Uso:
 *   node scripts/seed-remote.mjs <URL_PRODUCAO> <SETUP_SECRET>
 *
 * Exemplo:
 *   node scripts/seed-remote.mjs https://clickpro.vercel.app mysecret123
 *
 * Ou via variáveis de ambiente:
 *   PRODUCTION_URL=https://clickpro.vercel.app SETUP_SECRET=mysecret123 node scripts/seed-remote.mjs
 */

const args = process.argv.slice(2);

const productionUrl = args[0] || process.env.PRODUCTION_URL;
const setupSecret = args[1] || process.env.SETUP_SECRET;

if (!productionUrl || !setupSecret) {
  console.error(`
Uso: node scripts/seed-remote.mjs <URL_PRODUCAO> <SETUP_SECRET>

Exemplo:
  node scripts/seed-remote.mjs https://clickpro.vercel.app mysecret123

Ou via variáveis de ambiente:
  PRODUCTION_URL=https://clickpro.vercel.app SETUP_SECRET=mysecret123 node scripts/seed-remote.mjs
`);
  process.exit(1);
}

async function seedAdmin() {
  const endpoint = `${productionUrl.replace(/\/$/, '')}/api/setup/seed-admin`;

  console.log(`\n Chamando endpoint: ${endpoint}`);
  console.log(' Aguarde...\n');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: setupSecret,
        forceUpdate: true  // Para garantir que atualiza a senha
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      console.log(' SUCESSO!');
      console.log(`   ${data.message}`);
      console.log(`   Email: ${data.email}`);
      console.log('\n Agora voce pode fazer login com:');
      console.log('   Email: adrbrag18@gmail.com');
      console.log('   Senha: (a senha definida em ADMIN_SEED_PASSWORD)');
    } else {
      console.error(' ERRO:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Mensagem: ${data.error || JSON.stringify(data)}`);

      if (response.status === 401) {
        console.error('\n O SETUP_SECRET esta incorreto ou nao foi configurado no servidor.');
      }
      if (response.status === 500 && data.error?.includes('Missing')) {
        console.error('\n As variaveis ADMIN_SEED_EMAIL ou ADMIN_SEED_PASSWORD nao estao configuradas no servidor.');
      }
    }
  } catch (error) {
    console.error(' ERRO DE CONEXAO:');
    console.error(`   ${error.message}`);
    console.error('\n Verifique se a URL de producao esta correta e acessivel.');
  }
}

seedAdmin();
