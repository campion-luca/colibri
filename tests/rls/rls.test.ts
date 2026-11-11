import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TEST_EMAIL_DOMAIN,
  TEST_EMAIL_PREFIX,
  admin,
  deleteLeftoverTestUsers,
  publicClient,
} from './env.ts';

/*
 * Row Level Security sul progetto vero: due utenti temporanei, il secondo non deve
 * leggere né scrivere niente del primo. Creati con la secret key ed email già
 * confermata (nessuna email inviata), cancellati alla fine anche se un test fallisce.
 * Si lancia solo con `npm run test:rls`.
 */

interface TestUser {
  id: string;
  db: ReturnType<typeof publicClient>;
}

const createdIds: string[] = [];
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const dayBefore = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() - n);
  return x.toISOString().slice(0, 10);
};
const yesterday = dayBefore(today, 1);

async function makeUser(): Promise<TestUser> {
  const email = `${TEST_EMAIL_PREFIX}${randomUUID()}${TEST_EMAIL_DOMAIN}`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  createdIds.push(data.user.id);
  const db = publicClient();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, db };
}

const event = (xp: number, id = randomUUID()) => ({
  id,
  ts: new Date().toISOString(),
  day: today,
  type: 'done',
  item_id: null,
  title: 'prova',
  kind: 'todo',
  xp,
  meta: null,
});

let A: TestUser;
let B: TestUser;
const ids = { item: randomUUID(), idea: randomUUID(), pause: randomUUID(), sub: randomUUID() };

beforeAll(async () => {
  A = await makeUser();
  B = await makeUser();

  // dati del primo utente
  const item = await A.db.from('items').insert({
    id: ids.item,
    kind: 'todo',
    title: 'Segreto di A',
    created_on: today,
  });
  expect(item.error).toBeNull();
  const idea = await A.db
    .from('ideas')
    .insert({ id: ids.idea, text: 'Idea di A', created_on: today });
  expect(idea.error).toBeNull();
  const pause = await A.db
    .from('pauses')
    .insert({ id: ids.pause, from_day: today, until_day: today, reason: 'Ferie' });
  expect(pause.error).toBeNull();
  const sub = await A.db.from('push_subscriptions').insert({
    id: ids.sub,
    endpoint: `https://push.example/${randomUUID()}`,
    p256dh: 'k',
    auth: 'a',
  });
  expect(sub.error).toBeNull();
  const xp = await A.db.rpc('apply_xp', { evs: [event(30)] });
  expect(xp.error).toBeNull();
  const ro = await A.db.rpc('commit_rollover', {
    p_from: null,
    p_today: today,
    p_events: [],
    p_items: [],
    p_history: [{ day: yesterday, gained: 30, lost: 0, net: 30 }],
  });
  expect(ro.error).toBeNull();
});

afterAll(async () => {
  // pulizia anche se qualcosa è fallito: utenti cancellati, i dati vanno in cascata
  for (const id of createdIds) await admin.auth.admin.deleteUser(id);
  await deleteLeftoverTestUsers();
});

describe('il primo utente vede e scrive i suoi dati', () => {
  it('profilo creato al primo accesso, XP e last_date dalle RPC', async () => {
    const { data } = await A.db.from('profiles').select('id, xp, last_date');
    expect(data).toEqual([{ id: A.id, xp: 30, last_date: today }]);
  });

  it('legge i propri dati in ogni tabella', async () => {
    for (const t of ['items', 'ideas', 'pauses', 'push_subscriptions', 'events', 'day_history']) {
      const { data, error } = await A.db.from(t).select('*');
      expect(error, t).toBeNull();
      expect(data?.length, t).toBeGreaterThan(0);
    }
  });

  it('apply_xp è idempotente: lo stesso evento due volte conta una volta', async () => {
    const e = event(5);
    expect((await A.db.rpc('apply_xp', { evs: [e] })).data).toBe(35);
    expect((await A.db.rpc('apply_xp', { evs: [e] })).data).toBe(35);
  });

  it('commit_rollover: una volta sola al giorno, mai nel futuro', async () => {
    const again = await A.db.rpc('commit_rollover', {
      p_from: today,
      p_today: today,
      p_events: [],
      p_items: [],
      p_history: [],
    });
    expect(again.data).toMatchObject({ applied: false });
    const future = await A.db.rpc('commit_rollover', {
      p_from: today,
      p_today: '2999-01-01',
      p_events: [],
      p_items: [],
      p_history: [],
    });
    expect(future.data).toMatchObject({ applied: false });
  });

  it('XP, last_date ed eventi non si scrivono direttamente (solo dalle RPC)', async () => {
    const upd = await A.db.from('profiles').update({ xp: 99999 }).eq('id', A.id);
    expect(upd.error).not.toBeNull();
    const ins = await A.db
      .from('events')
      .insert({ id: randomUUID(), day: today, type: 'done', xp: 500 });
    expect(ins.error).not.toBeNull();
    const hist = await A.db.from('day_history').insert({ day: dayBefore(today, 5), net: 1000 });
    expect(hist.error).not.toBeNull();
    // le notifiche invece si possono cambiare
    const notif = await A.db
      .from('profiles')
      .update({ notif: { evening: false } })
      .eq('id', A.id)
      .select('id');
    expect(notif.error).toBeNull();
    expect(notif.data).toHaveLength(1);
  });
});

describe('il secondo utente non legge né scrive i dati del primo', () => {
  it('non vede le righe del primo in nessuna tabella', async () => {
    for (const t of ['items', 'ideas', 'pauses', 'push_subscriptions', 'events', 'day_history']) {
      const { data, error } = await B.db.from(t).select('*');
      expect(error, t).toBeNull();
      expect(data, t).toEqual([]);
    }
    const prof = await B.db.from('profiles').select('id');
    expect(prof.data).toEqual([{ id: B.id }]);
    const byId = await B.db.from('items').select('id').eq('id', ids.item);
    expect(byId.data).toEqual([]);
  });

  it('non modifica né cancella le righe del primo', async () => {
    const upd = await B.db
      .from('items')
      .update({ title: 'preso!' })
      .eq('id', ids.item)
      .select('id');
    expect(upd.data).toEqual([]);
    const del = await B.db.from('ideas').delete().eq('id', ids.idea).select('id');
    expect(del.data).toEqual([]);
    const delPause = await B.db.from('pauses').delete().eq('id', ids.pause).select('id');
    expect(delPause.data).toEqual([]);
    const prof = await B.db.from('profiles').update({ notif: {} }).eq('id', A.id).select('id');
    expect(prof.data).toEqual([]);
    // per il primo è tutto come prima
    const still = await A.db.from('items').select('title').eq('id', ids.item).single();
    expect(still.data).toEqual({ title: 'Segreto di A' });
    const idea = await A.db.from('ideas').select('id').eq('id', ids.idea);
    expect(idea.data).toHaveLength(1);
  });

  it('non inserisce righe a nome del primo', async () => {
    const item = await B.db.from('items').insert({
      user_id: A.id,
      kind: 'todo',
      title: 'intruso',
      created_on: today,
    });
    expect(item.error).not.toBeNull();
    const pause = await B.db
      .from('pauses')
      .insert({ user_id: A.id, from_day: today, reason: 'Altro' });
    expect(pause.error).not.toBeNull();
  });

  it('non sovrascrive un elemento del primo con un upsert sullo stesso id', async () => {
    const up = await B.db
      .from('items')
      .upsert({ id: ids.item, kind: 'todo', title: 'preso!', created_on: today });
    expect(up.error).not.toBeNull();
    const still = await A.db.from('items').select('title').eq('id', ids.item).single();
    expect(still.data).toEqual({ title: 'Segreto di A' });
  });

  it('le RPC toccano solo il proprio profilo', async () => {
    const xpB = await B.db.rpc('apply_xp', { evs: [event(10)] });
    expect(xpB.data).toBe(10);
    const roB = await B.db.rpc('commit_rollover', {
      p_from: null,
      p_today: today,
      p_events: [],
      p_items: [{ id: ids.item, promise_date: today, due_penalized: today }],
      p_history: [{ day: yesterday, net: -999 }],
    });
    expect(roB.data).toMatchObject({ applied: true });
    const profA = await A.db.from('profiles').select('xp').single();
    expect(profA.data).toEqual({ xp: 35 });
    const itemA = await A.db
      .from('items')
      .select('promise_date, due_penalized')
      .eq('id', ids.item)
      .single();
    expect(itemA.data).toEqual({ promise_date: null, due_penalized: null });
    const histA = await A.db.from('day_history').select('net').eq('day', yesterday).single();
    expect(histA.data).toEqual({ net: 30 });
  });

  it('notif_sent non è accessibile agli utenti', async () => {
    const read = await B.db.from('notif_sent').select('*');
    expect(read.error !== null || read.data.length === 0).toBe(true);
    const write = await B.db.from('notif_sent').insert({ user_id: B.id, day: today, key: 'x' });
    expect(write.error).not.toBeNull();
  });
});

describe('senza login non si vede niente', () => {
  it('tabelle e RPC chiuse al client anonimo', async () => {
    const anon = publicClient();
    for (const t of ['items', 'profiles', 'events']) {
      const { data, error } = await anon.from(t).select('*');
      expect(error !== null || data.length === 0, t).toBe(true);
    }
    const rpc = await anon.rpc('apply_xp', { evs: [event(100)] });
    expect(rpc.error).not.toBeNull();
  });
});
