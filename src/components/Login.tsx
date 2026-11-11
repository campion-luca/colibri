import { useEffect, useRef, useState } from 'react';
import { SFX } from '../audio/engine.ts';
import { sb } from '../data/client.ts';
import { nudge } from '../fx/effects.ts';
import { Emblem } from './Emblem.tsx';

/*
 * Accesso con email e password (account creato dalla dashboard Supabase, iscrizioni
 * chiuse). Niente link da aprire: funziona anche nella PWA installata su iPhone.
 * Dopo il primo accesso la sessione resta salvata e si rinnova da sola.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loginError(e: { status?: number; code?: string; message: string }): string {
  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(e.message)) {
    return 'Email o password non corrette.';
  }
  if (e.code === 'email_not_confirmed') return 'Questo account non è ancora confermato.';
  if (e.status === 429) return 'Troppi tentativi: riprova tra qualche minuto.';
  return 'Accesso non riuscito. Controlla la connessione e riprova.';
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const emailField = useRef<HTMLInputElement>(null);
  const passwordField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailField.current?.focus();
  }, []);

  const fail = (msg: string, field: HTMLInputElement | null) => {
    setError(msg);
    SFX.loss();
    nudge(field);
  };

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) {
      fail('Scrivi un indirizzo email valido.', emailField.current);
      return;
    }
    if (!password) {
      fail('Scrivi la password.', passwordField.current);
      return;
    }
    setBusy(true);
    setError('');
    const { error: err } = await sb().auth.signInWithPassword({ email: e, password });
    setBusy(false);
    if (err) {
      fail(loginError(err), passwordField.current);
      return;
    }
    SFX.day();
  };

  return (
    <div className="login">
      <form
        className="login-c"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Emblem rank={0} className="login-emb" />
        <h1>Colibrì</h1>
        <p className="rules">Entra con la tua email e la tua password.</p>
        <input
          ref={emailField}
          className="field"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          enterKeyHint="next"
          placeholder="la-tua@email.it"
          aria-label="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <input
          ref={passwordField}
          className="field"
          type="password"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Accesso…' : 'Entra'}
        </button>
        <p className="login-err" role="alert">
          {error}
        </p>
      </form>
    </div>
  );
}
