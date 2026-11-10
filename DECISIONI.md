# Colibrì — decisioni prese

Integrano `PROMPT-colibri.md`. In caso di conflitto vale questo file.

## Regole di dominio

1. **Promesse durante un'assenza.** Al rollover si penalizza ogni promessa non mantenuta la cui data cade nei giorni penalizzati (max 7, saltando quelli in pausa). Poi si tolgono comunque tutte le promesse con data passata, anche se più vecchie di 7 giorni.
2. **Promessa + scadenza nello stesso giorno.** Una sola penalità, quella della promessa (1.5×), e si segna anche `due_penalized`.

3. **"In sospeso" con scadenza non toglie XP.** Niente penalità e non conta negli XP a rischio. Il giorno della scadenza compare in Oggi con il tag SCADENZA ed entra nella notifica delle 9:00 senza il testo sugli XP persi ("Scade oggi: X (in sospeso)").
4. **Ordine in Oggi.** Ricorrenti di oggi in due gruppi, da fare (attive e non ancora aperte) sopra, fatte e scadute sotto, poi l'ordine manuale. **"Non previste oggi" per prossima data**, come nella bozza, e senza grip.
5. **Ogni azione crea un evento**, anche creare un'idea e "− TOGLI UNA" (evento `undone` con `meta.single`).
6. **Penalità dopo un'assenza.** Negli eventi penalità `day` è il giorno a cui si riferisce la penalità; `ts` è il momento in cui è stata applicata. `day_history` ha una riga per l'ultimo giorno di apertura e per ogni altro giorno che riceve penalità, così il calendario mostra il rosso sul giorno giusto. Il report del mattino somma tutte le penalità del rollover e, se i giorni sono più di uno, mostra la data accanto a ogni voce.

## UX (CLAUDE.md vs prompt)

- CSS base sempre: titoli bilanciati, numeri tabulari, tap target ≥ 44px, safe area.
- Tap target ≥ 44px anche per grip e OGGI/DOM: si allarga l'area toccabile (padding o pseudo-elemento), la grafica resta piccola come nella bozza.
- Sheet con **vaul**, ma con angoli vivi e lo stile della bozza.
- Skeleton durante il caricamento, minimale.
- **Niente** ⌘K, scorciatoie da tastiera, BlurHash, sonner, shadcn. Toast personalizzati come nella bozza.
- `squircle` e `@view-transition` del CSS base non si applicano: angoli vivi ovunque e app SPA.

## F3 · Feel: differenze dalla bozza

Tempi, curve di easing e frequenze sono copiati dalla bozza. Cambiano solo questi punti:

- **Niente libreria `motion`.** Tutte le animazioni usano Web Animations API e CSS, come nella bozza, con gli stessi tempi e curve; lo scorrimento delle righe è un FLIP fatto a mano (420 ms, `cubic-bezier(.2,.8,.2,1)`). Risparmia una dipendenza senza perdere niente.
- **Pausa prima del riordino.** Al tocco l'ordine delle sezioni resta congelato e la riga cambia aspetto dov'è; dopo 560 ms (350 se annulli, 450 per OGGI/DOM) scorre al suo posto. Le righe sono memoizzate: durante l'animazione si ridisegna solo quella toccata.
- **Solo transform/opacity negli FX.** Per questo:
  - eliminazione: la riga esce scivolando (190 ms) e le altre salgono con il FLIP, invece di animare l'altezza;
  - onde d'urto dei timbri: quadrati SVG con bordo fisso di 3 px, invece di animare `border-width`;
  - bagliore dello stemma Colibrì: uno strato che pulsa con l'opacità, invece di animare `box-shadow`;
  - onda sulle righe: un velo ambra che compare e scompare, invece di animare sfondo e bordo;
  - "?" degli stemmi segreti: pulsa con l'opacità invece che con il colore.
- **Budget FX:** massimo 40 nodi contemporanei; oltre, le particelle decorative vengono saltate (timbro, colibrì, fiamma e "+XP" passano sempre).
- **prefers-reduced-motion:** niente scosse (casella, header, schermo, campo vuoto), particelle (anche la scia del colibrì e i coriandoli), raggi e scintille rotanti, colibrì in volo. Restano pop, "+XP", timbri, scorrimento delle righe, suoni (anche il frullo d'ali) e logica. Tolta la regola CSS globale che azzerava tutte le animazioni.
- **Vibrazione su "tieni premuto" (iOS).** Al completamento a tempo si prova a vibrare subito; su iOS il trucco dello switch funziona solo dentro un gesto dell'utente, quindi se c'è stato un completamento la vibrazione si ripete sul `pointerup` che segue. La ripetizione avviene solo dove manca `navigator.vibrate` (iOS), così su Android non vibra due volte.
- **Suoni e Vibrazione** (unica aggiunta approvata): interruttori in Impostazioni, salvati sul dispositivo (localStorage `colibri-prefs`).
- **Discesa di rank al rollover:** per ora l'overlay compare subito; in F5 arriverà dopo il report del mattino, come nella bozza.
- **Banner di notifica interno all'app:** spostato in F6 insieme alle notifiche.

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
