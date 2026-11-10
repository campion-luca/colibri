# Colibrì — decisioni prese

Integrano `PROMPT-colibri.md`. In caso di conflitto vale questo file.

## Regole di dominio

1. **Promesse durante un'assenza.** Al rollover si penalizza ogni promessa non mantenuta la cui data cade nei giorni penalizzati (max 7, saltando quelli in pausa). Poi si tolgono comunque tutte le promesse con data passata, anche se più vecchie di 7 giorni.
2. **Promessa + scadenza nello stesso giorno.** Una sola penalità, quella della promessa (1.5×), e si segna anche `due_penalized`.

## UX (CLAUDE.md vs prompt)

- CSS base sempre: titoli bilanciati, numeri tabulari, tap target ≥ 44px, safe area.
- Tap target ≥ 44px anche per grip e OGGI/DOM: si allarga l'area toccabile (padding o pseudo-elemento), la grafica resta piccola come nella bozza.
- Sheet con **vaul**, ma con angoli vivi e lo stile della bozza.
- Skeleton durante il caricamento, minimale.
- **Niente** ⌘K, scorciatoie da tastiera, BlurHash, sonner, shadcn. Toast personalizzati come nella bozza.
- `squircle` e `@view-transition` del CSS base non si applicano: angoli vivi ovunque e app SPA.

## Stato e sincronizzazione

- Solo **Zustand** (niente TanStack Query).
- Allineamento tra dispositivi: ricaricamento dello stato su `visibilitychange` / `focus`. Realtime di Supabase solo se poi serve.

## Dati iniziali

- In produzione si parte vuoti, a 0 XP, con stati vuoti curati.
- Dati di esempio solo in sviluppo, dietro `import.meta.env.DEV` o un pulsante dev nascosto.

## Idempotenza

- Ogni evento ha un **id UUID generato dal client**; vincolo unique su `events.id`. La RPC `apply_xp` con un id già visto non fa niente (niente header `Idempotency-Key`).

## Rollover: RPC `commit_rollover`

- Prima di calcolare, il client ricarica lo stato fresco dal server.
- Il client calcola penalità, statistiche e modifiche agli item con il dominio TypeScript.
- La RPC, in una sola transazione, fa `update profiles set last_date = p_today` solo se `last_date < p_today` **e** `p_today` non è nel futuro rispetto all'ora di Europe/Rome sul server.
- Se l'update non tocca righe: non scrive niente e restituisce lo stato attuale; il client scarta il suo calcolo e ricarica.
- XP con minimo 0 applicato nella RPC.
- Gli eventi penalità hanno id deterministici (hash di utente + giorno + item + motivo) come doppia protezione.
