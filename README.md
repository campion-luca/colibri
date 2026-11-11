# Colibrì

PWA personale anti-procrastinazione: ricorrenti, promesse, scadenze, XP che salgono e scendono, rank con stemmi. React 19 + Vite + TypeScript, Tailwind v4, Zustand, Supabase.

Specifica: [PROMPT-colibri.md](PROMPT-colibri.md) · decisioni prese (prevalgono sulla specifica): [DECISIONI.md](DECISIONI.md) · prototipo di riferimento: [colibri-bozza.html](colibri-bozza.html).

## Avvio

```sh
npm install
npm run dev          # http://localhost:5173
npm run dev:host     # anche dal telefono sulla stessa Wi-Fi
```

Senza variabili Supabase l'app gira **in locale** (dati nel browser, pulsanti di sviluppo in Impostazioni). Con le variabili serve il login.

## Supabase

1. Progetto ospitato in EU (Francoforte). Auth: provider Email con **email e password**. L'account si crea dalla dashboard (_Authentication → Users → Add user_, con "Auto Confirm User"); le iscrizioni restano chiuse.
2. `.env.local` nella cartella del progetto (è in `.gitignore`):

   ```sh
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   # solo per i test RLS: mai con prefisso VITE_
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

3. Collega la CLI e pubblica le migrazioni:

   ```sh
   npx supabase login
   npx supabase link --project-ref <ref>
   npm run db:push      # applica supabase/migrations
   npm run db:types     # rigenera src/data/database.types.ts
   ```

4. Iscrizioni disattivate: _Authentication → Sign In / Providers → Allow new users to sign up_ spento.

## Script

| comando                           | cosa fa                                            |
| --------------------------------- | -------------------------------------------------- |
| `npm run build`                   | typecheck + build di produzione                    |
| `npm run lint` · `npm run format` | ESLint · Prettier                                  |
| `npm test`                        | test del dominio e del livello dati (nessuna rete) |
| `npm run test:rls`                | test di Row Level Security **sul progetto vero**   |
| `npm run rls:cleanup`             | cancella eventuali utenti di test rimasti          |

### Test RLS

Creano due utenti temporanei `rls-test+<uuid>@colibri.test` con la secret key ed email già confermata (nessuna email inviata). Verificano che il secondo non legga né scriva i dati del primo, su tutte le tabelle e le RPC, e li cancellano alla fine anche se un test fallisce. Girano solo con `npm run test:rls`, mai dentro `npm test` né in CI. La secret key si legge solo da `.env.local`, mai da codice in `src/`.
