# Colibrì — prompt di sviluppo

> Da incollare (o far leggere) all'assistente AI in VSCode.
> Nella stessa cartella c'è `colibri-bozza.html`: è il **prototipo funzionante di riferimento**. Logica, valori, suoni, animazioni, stemmi SVG e testi vanno portati da lì, non reinventati.

---

## 0. Ruolo e modo di lavorare

Sei il mio pair programmer senior. Costruiamo **Colibrì**, una PWA personale anti-procrastinazione: task giornaliere, promesse, scadenze, XP che salgono e scendono, rank con stemmi, animazioni e suoni molto soddisfacenti.

Regole di lavoro:
1. **Leggi prima tutto questo file e `colibri-bozza.html`** (soprattutto il blocco `<script>`: CONFIG, helper, `rollover`, `checkWindows`, `toggle`, `SFX`, `EMB`, celebrazioni, drag). Poi riassumimi in 10 righe cosa hai capito e aspetta il mio ok.
2. Lavora **per fasi** (sezione 9). Alla fine di ogni fase: build senza errori, test verdi, elenco di cosa hai fatto e di cosa resta, poi aspetta il mio ok prima di passare alla successiva.
3. **Non aggiungere funzioni che non sono qui.** Se qualcosa è ambiguo, chiedimelo. Se una regola della bozza contraddice questo file, vale questo file; se manca, vale la bozza.
4. Codice in **TypeScript strict**, componenti piccoli, niente `any`. Nomi di codice in inglese; testi dell'interfaccia in **italiano**, identici alla bozza.
5. La logica di gioco (XP, penalità, ricorrenze, rollover) sta in **funzioni pure** testate, separate dalla UI.

---

## 1. Stack

**Frontend**
- React 19 + Vite + TypeScript
- Tailwind CSS v4 (token del design in `@theme`)
- `motion` (`motion/react`) per spring, layout animation e transizioni; animazioni puntuali (particelle, float "+XP", timbro) anche con Web Animations API, come nella bozza
- Zustand per lo stato client (con aggiornamenti ottimistici)
- `canvas-confetti` per i coriandoli
- Audio: **nessun file**, solo un motore Web Audio sintetizzato (porta `tone()`, `master()` e `SFX` dalla bozza)
- `vite-plugin-pwa` con `strategies: 'injectManifest'` (serve un service worker custom per le push)
- `date-fns` + `date-fns-tz`: tutte le date "giorno" calcolate in **Europe/Rome**
- Vitest per i test della logica

**Backend**
- Supabase: Postgres, Auth (magic link via email, solo il mio account), Row Level Security, Edge Functions (Deno), `pg_cron` + `pg_net` per i job programmati
- Web Push con chiavi VAPID (libreria `web-push` nella Edge Function tramite specifier `npm:`)

**Deploy**
- Frontend su Vercel, backend su Supabase

---

## 2. Design (dalla bozza)

- Sfondo `#13110f`, superfici `#1c1916` / `#25211d`, linee `#332d27`
- Testo avorio `#EFE9DC`, muted `#8d8579`, dim `#5d564d`
- Accento ambra `#F2A33A` (scuro `#a8661a`), rosso `#E0533D` (scuro `#8f2e20`), verde `#9BC27A`
- Font: **Space Grotesk** (testi) e **IBM Plex Mono** (numeri, XP, orari)
- **Angoli vivi ovunque** (border-radius 0), nessuna card arrotondata
- Bottoni principali con ombra "fisica" sotto (`0 4px 0 <colore scuro>`) che si schiaccia alla pressione (`translateY(3px)`)
- Mobile-first, larghezza massima 480px, rispetto delle safe-area iOS
- `prefers-reduced-motion`: animazioni ridotte, logica identica

Layout:
- **Header**: stemma del rank grande (104px) centrato che ondeggia piano, sotto "Rank N/6", nome del rank, XP (contatore animato), barra verso il rank successivo, riga "Mezzanotte tra Xh Ym · a rischio −N XP" (oppure "tutto al sicuro"). Fuoco dello strike in alto a destra. Toccando l'header si aprono le Impostazioni.
- **Nav in basso**: Oggi · Calendario · **[+]** al centro · Liste · Impostazioni.

---

## 3. Modello di dominio e regole

### 3.1 Tipi di elemento
| kind | nome UI | note |
|---|---|---|
| `daily` | Ricorrente | ricorrenza, 1–3 volte al giorno, fascia oraria opzionale |
| `todo` | Task | promessa oggi/domani, scadenza |
| `buy` | Da comprare | come todo, XP fissi |
| `hold` | In sospeso | parcheggiata: non si promette, non toglie XP |
| idea | Idea | lista separata, nessun XP, convertibile in Task |

Tutti (tranne le idee) hanno: titolo, **nota** opzionale, impegno, posizione manuale.

### 3.2 Impegno → XP (CONFIG)
| impegno | durata | XP |
|---|---|---|
| Veloce | ≤5' | 5 |
| Breve | ~15' | 10 |
| Seria | ~45' | 25 |
| Boss | 1h+ | 50 |

Da comprare: sempre 5 XP. Dall'impegno **Seria** in su si completa **tenendo premuto** (750 ms, bordo quadrato che si riempie, ronzio che sale; se rilasci prima la casella fa "no").

### 3.3 Costanti
```
BUY_XP = 5
PROMISE_PENALTY = 1.5   // promessa non mantenuta
DAILY_PENALTY = 1       // ripetizione di ricorrente mancata
DUE_PENALTY = 1         // scadenza mancata (non si somma alla promessa dello stesso giorno)
MAX_MISSED_DAYS = 7     // giorni di assenza penalizzati al massimo
HOLD_FROM_EFFORT = 3
STRIKE_FROM = 2
URGENT_MIN = 60         // ultima ora della fascia: "scade tra Nm" in rosso
RANKS = Uovo 0 · Pulcino 100 · Passero 300 · Rondine 700 · Falco 1500 · Colibrì 3000
```
Si parte da **0 XP** (Uovo). Gli XP non scendono sotto 0. Sotto la soglia del rank si **perde il rank**.

### 3.4 Ricorrenti
- **Ricorrenza**: ogni giorno · giorni della settimana (L…D) · ogni N giorni (2–90, da una data di partenza) · un giorno del mese (se il mese è più corto, l'ultimo giorno).
- **Ripetizioni**: 1–3 al giorno. Ogni tocco aggiunge una ripetizione (casella che si riempie dal basso, puntini nei metadati) e dà i suoi XP. Toccando una ricorrente **completata** si torna a **0** e si tolgono tutti gli XP di quel giorno. Per togliere una sola ripetizione c'è "− TOGLI UNA" nel pannello di modifica.
- **Fascia oraria** opzionale (dalle–alle, stesso giorno). Stati: `off` (non prevista oggi) · `soon` (prima della fascia: bloccata) · `active` · `done` · `missed`.
- **Alla chiusura della fascia** le ripetizioni mancanti costano **subito** −1× XP ciascuna (evento `penalty`); la riga diventa "SCADUTA" con una X rossa.
- Una ricorrente creata o modificata quando la sua fascia di oggi è già chiusa **non penalizza oggi**.
- Le non previste oggi stanno in "Non previste oggi · N" (comprimibile), con "prossima: ven".

### 3.5 Promesse
- Su task e cose da comprare: pulsanti **OGGI** e **DOM**. Una promessa è una data (`promise_date`).
- Promessa non mantenuta a mezzanotte: −1.5× XP e la task torna in lista senza promessa.
- In Oggi: sezione "Promesse e scadenze" (promesse di oggi + scadenze di oggi + fatte oggi) e in fondo "Promesse per domani · N" comprimibile.

### 3.6 Scadenze
- Data opzionale su todo/buy/hold (scelte rapide: Oggi, Domani, Tra 7 gg, oppure data).
- Il giorno della scadenza l'elemento compare **da solo** in Oggi con il tag SCADENZA.
- Se a mezzanotte non è fatta: −1× XP, una sola volta (`due_penalized`). Resta in lista con "scaduta da Ng".

### 3.7 Strike (solo dentro la giornata)
- Conta le task **non ricorrenti** completate oggi. Da 2 in su compare il fuoco ×N: fiamma che sale dalla casella con "STRIKE ×N", suono di vampata, fuoco fisso nell'header e fuochino accanto a "Promesse e scadenze".
- Colore della fiamma: 2–3 normale, 4–5 più rossa e veloce, 6+ blu.
- Si azzera a mezzanotte. **Non esistono streak tra un giorno e l'altro.**

### 3.8 Combo sonora
Completamenti entro 10 s l'uno dall'altro alzano la nota sulla scala pentatonica (vedi `SFX.done(combo)`).

### 3.9 Mezzanotte (rollover)
All'apertura dell'app, se `last_date < oggi`:
1. Calcola le statistiche del giorno precedente (ripetizioni fatte/previste, promesse mantenute/totali, strike, conteggi eventi).
2. Penalità per ogni giorno saltato (al massimo 7), **saltando i giorni in pausa**:
   - ripetizioni mancanti delle ricorrenti previste e non già penalizzate dalla fascia;
   - promesse del giorno precedente non mantenute;
   - scadenze tra `last_date` e ieri non fatte.
3. Pulizia: le non ricorrenti completate nei giorni passati spariscono dalle liste (restano nello storico).
4. Salva `day_history`, mostra il **report del mattino** e, se serve, l'animazione di discesa di rank.
5. Deve essere **idempotente**: aggiornamento condizionato di `last_date` dentro una transazione/RPC, così due dispositivi non applicano le penalità due volte.

### 3.10 Pausa (ferie/malattia)
- Motivo (Ferie, Malattia, Altro) e durata (3 giorni, 1 settimana, 2 settimane, data, senza fine). Parte da oggi.
- In pausa: niente penalità, niente notifiche; gli XP fatti contano lo stesso. Stemma e barra diventano grigi; header "⏸ In pausa · motivo · fino a …".
- "Riprendi ora": la pausa finisce ieri (o viene eliminata se iniziata oggi). Le fasce di oggi già chiuse **non** vengono penalizzate.

### 3.11 Storico eventi
Ogni azione crea un evento: `created`, `edited`, `done`, `rep`, `undone`, `deleted`, `restored`, `promised`, `unpromised`, `penalty` (con motivo: finestra, mezzanotte, promessa, scadenza), `pause`, `resume`. Ogni evento ha timestamp, giorno, item, titolo, kind, XP e meta. Su questi eventi si basano il report e il calendario.

### 3.12 Eliminazione con annulla
L'eliminazione è un **soft delete** (`deleted_at`). In basso compare un avviso "…eliminata" con **ANNULLA** e una barra che si svuota in 5 s; annullando, l'elemento torna nella stessa posizione. Un job pulisce i soft delete più vecchi di 30 giorni.

### 3.13 Ordine manuale
Grip con **tre puntini verticali** in fondo a ogni riga (e sulle idee). Tieni premuto e trascina: la riga si solleva (scale 1.03, leggera rotazione, ombra), le altre scorrono, un tic a ogni cambio di posizione, colpo sordo al rilascio, autoscroll ai bordi. Solo dentro la stessa sezione. Si salva come `position` (float, inserimento tra due vicini). L'unico ordinamento automatico rimasto è per stato (da fare sopra, fatte/scadute sotto).

### 3.14 Celebrazioni
- **Ricorrenti chiuse** (tutte le previste fatte; le scadute non bloccano): onda sulle righe, timbro "QUOTIDIANE CHIUSE", schermo che trema, onde d'urto quadrate, **il colibrì attraversa lo schermo** con una scia.
- **Promesse mantenute**: onda e timbro "PROMESSE MANTENUTE", coriandoli dagli angoli in basso.
- **Giornata perfetta** (entrambe): timbro grande su fondo ambra, fanfara lunga, colibrì e coriandoli.
- Scattano solo nel passaggio "non completo → completo".

### 3.15 Rank e stemmi
6 stemmi SVG progressivi, da portare **identici** da `EMB` nella bozza: Uovo grigio → Pulcino → Passero con cornice doppia → Rondine ad angoli smussati → Falco bronzo con rivetti, stella e riflesso → Colibrì nero e oro con raggi rotanti, scintille in orbita e bagliore.
- Gli stemmi non ancora raggiunti si vedono solo come **"?" tratteggiato** (nome e soglia restano visibili).
- Salita di rank: overlay con lo stemma che entra ruotando, colpo, scintille e coriandoli. Discesa: stemma spento, suono discendente.

---

## 4. Schermate

1. **Oggi**: card pausa (se attiva), Ricorrenti di oggi (+ Non previste oggi), Promesse e scadenze (+ Promesse per domani).
2. **Calendario** (mensile, settimana da lunedì):
   - colore della cella in base alle scadenze aperte (1 / 2 / 3+) e numero nell'angolo;
   - quadratino per i giorni con una promessa, bordo rosso per le scadenze passate non fatte;
   - barretta verde/rossa col saldo XP sui giorni passati, tratteggio sui giorni di pausa, oggi evidenziato;
   - toccando un giorno: riepilogo (saldo, ricorrenti, promesse, fatte/annullate/eliminate), scadenze e promesse spuntabili, "+ Scadenza per …" (giorni futuri) e storico ora per ora (giorni passati).
3. **Liste**: segmenti Task · Idee · Comprare · Sospeso (indicatore che scorre). Righe con OGGI/DOM, scadenza, nota e grip.
4. **Aggiungi/Modifica** (bottom sheet): nome, tipo, impegno, ripeti, volte al giorno, fascia oraria, promessa (Nessuna/Oggi/Domani), scadenza, nota, Salva/Elimina.
5. **Impostazioni**: collezione stemmi, Report di ieri, Pausa, Notifiche (vedi 6), tabella XP, regole.
6. **Report del mattino** (overlay al primo accesso del giorno): saldo, 3 riquadri con barre animate (ricorrenti, promesse, strike), conteggi fatte/annullate/eliminate/create, elenco di guadagni e perdite, promesse già scelte per oggi, pulsante "Inizia la giornata".

---

## 5. Animazioni, suoni, vibrazione (porta dalla bozza)

- Pressione: scale/translate con spring su ogni bottone, tic sonoro corto.
- Spunta: tratto della spunta disegnato, pop della casella, barrato animato, particelle quadrate, "+N XP" che sale (con "1/3" sulle ripetizioni), riga che scivola al suo posto (layout animation).
- Header: contatore XP animato, scossa quando perdi XP, scatto dello stemma quando guadagni.
- Toast in alto; toast con azione (Annulla) in basso sopra la nav.
- Banner notifica interno all'app (stile notifica di sistema) quando l'app è aperta.
- **Suoni**: onde square/sawtooth → filtro passa-basso → compressore. Note di base basse ma udibili dallo speaker del telefono (non sotto ~200 Hz). Valori esatti in `SFX`, `thud`, `fanfare`, `whoosh`, `flutter`.
- **Vibrazione**: `navigator.vibrate` su Android; su iOS il trucco dell'`<input type="checkbox" switch>` cliccato via label (iOS 18+), con fallback silenzioso.
- Audio sbloccato al primo tocco (AudioContext resume).

---

## 6. Notifiche (Web Push)

Tipi (attivabili singolarmente nelle impostazioni):
1. **Inizio fascia**: "È l'ora: {titolo}" → "Da adesso fino alle {to} · +{xp} XP" (entro 30 min dall'inizio della fascia).
2. **Scadenze**: alle 9:00, se qualcosa scade oggi.
3. **Report serale**: all'ora scelta (default 21:30): "+X XP · −Y ancora a rischio · scegli le promesse di domani" (oppure "· N promesse per domani").
4. **Report del mattino**: mostrato al primo accesso.

Implementazione:
- Il service worker gestisce `push` e `notificationclick` (apre l'app sulla schermata giusta).
- Iscrizione: chiedi il permesso **solo dopo un tocco**; salva la subscription in `push_subscriptions`. Su iOS funziona solo con la PWA installata sulla Home (16.4+): mostra un aiuto per installarla.
- Edge Function `notify` lanciata da `pg_cron` ogni 5 minuti: per ogni utente con iscrizioni calcola cosa notificare (stessa logica del dominio), deduplica con la tabella `notif_sent` e invia tramite `web-push`. Niente notifiche durante una pausa.
- La logica di dominio va in un modulo condiviso, usato sia dal frontend sia dalla Edge Function (`supabase/functions/_shared/domain`, sincronizzato o importato da `src/domain`).

---

## 7. Database Supabase (punto di partenza)

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  xp int not null default 0 check (xp >= 0),
  last_date date,
  timezone text not null default 'Europe/Rome',
  notif jsonb not null default '{"start":true,"due":true,"evening":true,"eveningAt":"21:30","morning":true}',
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('daily','todo','buy','hold')),
  title text not null,
  note text,
  effort smallint not null default 1 check (effort between 1 and 4),
  position double precision not null default 0,
  created_on date not null,
  -- ricorrenti
  recur jsonb not null default '{"type":"daily"}',   -- {type:'daily'|'weekly'|'interval'|'monthly', days?, every?, start?, day?}
  times smallint not null default 1 check (times between 1 and 3),
  window_from time, window_to time,
  done_on date, done_count smallint not null default 0, penalized_on date,
  -- non ricorrenti
  done boolean not null default false, gain int,
  promise_date date, due date, due_penalized date,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null, position double precision not null default 0,
  created_on date not null, deleted_at timestamptz
);

create table events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ts timestamptz not null default now(), day date not null,
  type text not null, item_id uuid, title text, kind text, xp int not null default 0, meta jsonb
);
create index on events (user_id, day);

create table day_history (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null, gained int, lost int, net int,
  reps int, reps_done int, prom int, prom_kept int,
  done int, undone int, deleted int, created int, paused boolean default false,
  primary key (user_id, day)
);

create table pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  from_day date not null, until_day date, reason text not null
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  created_at timestamptz default now()
);

create table notif_sent (
  user_id uuid not null references auth.users on delete cascade,
  day date not null, key text not null,
  primary key (user_id, day, key)
);
```
- **RLS attiva su tutte le tabelle**, con policy `user_id = auth.uid()` (`id = auth.uid()` su `profiles`) per select/insert/update/delete. `notif_sent` è scritta solo dalla service role.
- Trigger che crea il `profiles` al primo accesso.
- Funzione RPC `apply_xp(delta int, ev jsonb)`: inserisce l'evento e aggiorna `profiles.xp` (con minimo 0) in una sola transazione. Ogni variazione di XP passa da qui.
- Funzione RPC `run_rollover(today date)` oppure logica client con `update profiles set last_date = $today where last_date < $today returning *` come lucchetto. Scegli e motiva.
- Dopo aver creato il mio account: **disattiva le nuove iscrizioni** in Supabase Auth.

---

## 8. Struttura cartelle (proposta)

```
src/
  domain/        # funzioni pure: xp, recur, states, rollover, strike, report, calendar (+ test)
  data/          # client supabase, repository, sync ottimistico
  store/         # zustand
  audio/         # motore Web Audio + SFX
  fx/            # particelle, float, timbro, colibrì in volo, fuoco, coriandoli
  components/    # Row, Grip, Checkbox, Sheet, Toast, Header, Emblem, Calendar…
  screens/       # Today, Calendar, Lists, Settings, Report
  sw.ts          # service worker (push + cache)
supabase/
  migrations/
  functions/notify/
  functions/_shared/domain/
```

---

## 9. Fasi e criteri di accettazione

**F0 · Setup**: Vite + React + TS + Tailwind v4 + ESLint/Prettier + Vitest. Token del design e font. Pagina vuota col layout header/nav. *OK quando* build e lint passano.

**F1 · Dominio + test**: porta in `src/domain` tutta la logica della bozza (XP, stati delle ricorrenti, ricorrenze, finestre, promesse oggi/domani, scadenze, strike, rank, rollover con pausa e max 7 giorni, report, conteggi per il calendario). Test Vitest per ogni regola della sezione 3, inclusi i casi limite: mese corto, giorni saltati, pausa a metà, ripetizioni parziali, promessa + scadenza nello stesso giorno, ricorrente creata a fascia chiusa. *OK quando* tutti i test passano.

**F2 · UI locale**: schermate Oggi, Liste, Sheet, Impostazioni con stato Zustand e localStorage (ancora senza backend). Grip e riordino, annulla eliminazione, note. *OK quando* è utilizzabile da telefono in locale.

**F3 · Feel**: suoni, vibrazione, tutte le animazioni e celebrazioni, stemmi, fuoco, timbri, colibrì. Confronta fianco a fianco con `colibri-bozza.html`. *OK quando* l'effetto è identico o migliore.

**F4 · Supabase**: migrazioni, RLS, auth con magic link, repository, aggiornamenti ottimistici, RPC `apply_xp`, eventi. Stessi dati su due dispositivi. *OK quando* un refresh non perde nulla e due schede restano allineate.

**F5 · Giornata**: rollover idempotente, report del mattino, `day_history`, calendario completo, pausa. *OK quando* i test con la data simulata (solo in dev) danno i risultati attesi.

**F6 · PWA + push**: manifest, icone (lo stemma del rank attuale come icona), offline di base, service worker con push, chiavi VAPID, Edge Function `notify` e `pg_cron`, impostazioni notifiche, aiuto per l'installazione su iOS. *OK quando* ricevo sul telefono la notifica di inizio fascia e il report serale.

**F7 · Rifinitura + deploy**: reduced motion, accessibilità di base (label, contrasto, focus), pulizia del codice, deploy su Vercel, README con setup ed env. *OK quando* è online e installata sul mio telefono.

---

## 10. Variabili d'ambiente

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_VAPID_PUBLIC_KEY=
# Edge Function (secrets Supabase)
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:...
```

---

Inizia leggendo i due file e mandami il riassunto (punto 0.1). Non scrivere codice prima del mio ok.
