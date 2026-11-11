import { useEffect, useRef, useState } from 'react';
import { SFX } from '../audio/engine.ts';
import { sb } from '../data/client.ts';
import { nudge } from '../fx/effects.ts';
import { Emblem } from './Emblem.tsx';

/*
 * Accesso con codice OTP a 6 cifre via email (niente link magico: su iPhone il link
 * si aprirebbe in Safari e non nella PWA installata, che ha uno spazio dati separato).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendError(e: { status?: number; code?: string; message: string }): string {
  if (e.status === 429 || e.code === 'over_email_send_rate_limit') {
    return 'Troppi invii: riprova tra qualche minuto.';
  }
  if (e.code === 'signup_disabled' || /signups? not allowed/i.test(e.message)) {
    return 'Questa email non è abilitata.';
  }
  return 'Invio non riuscito. Controlla la connessione e riprova.';
}

export function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, [step]);

  const fail = (msg: string) => {
    setError(msg);
    SFX.loss();
    nudge(field.current);
  };

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e)) {
      fail('Scrivi un indirizzo email valido.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: err } = await sb().auth.signInWithOtp({
      email: e,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      fail(sendError(err));
      return;
    }
    SFX.commit();
    setEmail(e);
    setCode('');
    setStep('code');
  };

  const verify = async (token: string) => {
    if (token.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await sb().auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    if (err) {
      setCode('');
      fail('Codice non valido o scaduto.');
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
          void (step === 'email' ? send() : verify(code));
        }}
      >
        <Emblem rank={0} className="login-emb" />
        <h1>Colibrì</h1>

        {step === 'email' ? (
          <>
            <p className="rules">Entra con la tua email: ti mando un codice a 6 cifre.</p>
            <input
              ref={field}
              className="field"
              type="email"
              autoComplete="email"
              inputMode="email"
              enterKeyHint="send"
              placeholder="la-tua@email.it"
              aria-label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Invio…' : 'Invia codice'}
            </button>
          </>
        ) : (
          <>
            <p className="rules">
              Ho mandato un codice a <b>{email}</b>. Scrivilo qui sotto.
            </p>
            <input
              ref={field}
              className="field code num"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="······"
              aria-label="Codice a 6 cifre"
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6) void verify(v);
              }}
            />
            <button type="submit" className="btn" disabled={busy || code.length !== 6}>
              {busy ? 'Verifica…' : 'Entra'}
            </button>
            <div className="login-alt">
              <button
                type="button"
                className="mini"
                onClick={() => {
                  setStep('email');
                  setError('');
                }}
              >
                CAMBIA EMAIL
              </button>
              <button type="button" className="mini" disabled={busy} onClick={() => void send()}>
                RIMANDA IL CODICE
              </button>
            </div>
          </>
        )}

        <p className="login-err" role="alert">
          {error}
        </p>
      </form>
    </div>
  );
}
