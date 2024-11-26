import { testConnection } from './supabase-client';

async function main() {
  await testConnection();
}

main().catch(console.error); 