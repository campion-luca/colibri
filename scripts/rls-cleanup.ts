/*
 * Cancella gli utenti di test rls-test+*@colibri.test rimasti nel progetto Supabase
 * (per esempio dopo un'esecuzione interrotta di `npm run test:rls`).
 * Uso: npm run rls:cleanup   (legge le chiavi solo da .env.local)
 */
import { deleteLeftoverTestUsers } from '../tests/rls/env.ts';

const removed = await deleteLeftoverTestUsers();
console.log(removed ? `Cancellati ${removed} utenti di test.` : 'Nessun utente di test rimasto.');
