/* Stemmi dei rank: SVG identici alla bozza. Più sali, più si complicano. */

const BIRD_P = `<path d="M1.5 11.6l9.2.9-.2 1z"/><circle cx="13.2" cy="12.6" r="3.1"/><path d="M14.6 10.2l9.6 6.6-3.6 7.4-7.2-8.3z"/><path d="M15.8 11.8L28.5 3.5l-5.6 11.4z"/><path d="M20.4 22.4l2.6 8 3.4-7.6z"/>`;
const D = '#13110f';
const IV = '#EFE9DC';
const AM = '#F2A33A';
const AMD = '#a8661a';

const EMB = [
  // 0 · Uovo — essenziale
  `<rect x="2" y="2" width="96" height="96" fill="#25211d" stroke="#5d564d" stroke-width="3"/>
   <path d="M50 24c14 0 22 20 22 35 0 14-10 23-22 23s-22-9-22-23c0-15 8-35 22-35z" fill="none" stroke="${IV}" stroke-width="4"/>`,
  // 1 · Pulcino — l'uovo si rompe
  `<rect x="2" y="2" width="96" height="96" fill="${AM}"/>
   <circle cx="50" cy="44" r="14" fill="${D}"/><circle cx="55" cy="40" r="2.6" fill="${AM}"/><path d="M63 43l8 2.5-8 2.5z" fill="${IV}"/>
   <path d="M27 57l6-6 6 7 6-8 6 8 6-8 6 7 6-6 4 4c0 15-9 26-22 26S28 72 27 57z" fill="${IV}" stroke="${D}" stroke-width="3" stroke-linejoin="miter"/>`,
  // 2 · Passero — cornice doppia
  `<rect x="2" y="2" width="96" height="96" fill="${AM}"/><rect x="9" y="9" width="82" height="82" fill="none" stroke="${D}" stroke-width="3"/>
   <path d="M68 52l18-9-2 9-14 9z" fill="${D}"/><ellipse cx="52" cy="56" rx="20" ry="14" fill="${D}"/><circle cx="35" cy="45" r="10" fill="${D}"/>
   <circle cx="32" cy="43" r="2.2" fill="${AM}"/><path d="M25 43.5l-7 2 7 2z" fill="${IV}"/><path d="M45 52l22-3-7 13z" fill="${AMD}"/>
   <path d="M48 69v8M56 69v8M42 78h22" stroke="${D}" stroke-width="3"/>`,
  // 3 · Rondine — angoli tagliati, volo e scie
  `<path d="M16 3h68l13 13v68L84 97H16L3 84V16z" fill="${AM}" stroke="${D}" stroke-width="3"/>
   <path d="M19 10h62l9 9v62l-9 9H19l-9-9V19z" fill="none" stroke="${D}" stroke-width="1.5" opacity=".55"/>
   <path d="M30 22l6-6M64 16l6 6M47 15h6" stroke="${D}" stroke-width="3"/>
   <path d="M50 46L16 28l12 18 18 9zM50 46l34-18-12 18-18 9z" fill="${D}"/>
   <path d="M50 32c4 4 5 12 4 22l5 22-9-10-9 10 5-22c-1-10 0-18 4-22z" fill="${D}"/><path d="M50 40l3 8h-6z" fill="${IV}"/>`,
  // 4 · Falco — bronzo, rivetti, ali spiegate, stella
  `<defs><linearGradient id="emb4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc66b"/><stop offset=".5" stop-color="${AM}"/><stop offset="1" stop-color="#b8661a"/></linearGradient></defs>
   <rect x="2.5" y="2.5" width="95" height="95" fill="url(#emb4)" stroke="${D}" stroke-width="5"/>
   <rect x="10" y="10" width="80" height="80" fill="none" stroke="${IV}" stroke-width="1.5" opacity=".8"/>
   <rect x="7" y="7" width="6" height="6" fill="${D}"/><rect x="87" y="7" width="6" height="6" fill="${D}"/><rect x="7" y="87" width="6" height="6" fill="${D}"/><rect x="87" y="87" width="6" height="6" fill="${D}"/>
   <path d="M50 12l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="${IV}"/>
   <path d="M50 34l6 7-2 6 26-8 12 4-8 6 4 4-10 2 2 4H66l-8 4-2 14-6 7-6-7-2-14-8-4H20l2-4-10-2 4-4-8-6 12-4 26 8-2-6z" fill="${D}"/>
   <path d="M47 42h6l-3 4z" fill="${AM}"/>`,
  // 5 · Colibrì — ossidiana e oro, raggi rotanti, scintille in orbita
  `<defs><linearGradient id="emb5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c9"/><stop offset=".35" stop-color="#ffc35a"/><stop offset=".7" stop-color="${AM}"/><stop offset="1" stop-color="#9c5a12"/></linearGradient></defs>
   <rect x="2" y="2" width="96" height="96" fill="#0b0908"/>
   <g class="rays" opacity=".22" fill="url(#emb5)">${Array.from({ length: 12 }, (_, i) => `<path d="M50 50L47 -2h6z" transform="rotate(${i * 30} 50 50)"/>`).join('')}</g>
   <rect x="3" y="3" width="94" height="94" fill="none" stroke="url(#emb5)" stroke-width="4"/>
   <rect x="9" y="9" width="82" height="82" fill="none" stroke="url(#emb5)" stroke-width="1" opacity=".7"/>
   <path d="M44 14l3-4 3 4-3 4zM50 12l3-5 3 5-3 5zM56 14l3-4 3 4-3 4z" fill="url(#emb5)" transform="translate(-3 0)"/>
   <g fill="url(#emb5)" transform="translate(19 22) scale(1.95)">${BIRD_P}</g>
   <g class="orbit"><rect x="48" y="6" width="4" height="4" fill="#fff1c9"/><rect x="49" y="90" width="3" height="3" fill="${AM}"/></g>`,
];

const MYSTERY = `<rect x="2" y="2" width="96" height="96" fill="#1c1916" stroke="#332d27" stroke-width="3" stroke-dasharray="8 6"/><text x="50" y="68" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="52" fill="#5d564d">?</text>`;

interface EmblemProps {
  rank: number;
  /** rank non ancora raggiunto: "?" tratteggiato */
  locked?: boolean;
  className?: string;
}

export function Emblem({ rank, locked = false, className = '' }: EmblemProps) {
  const svg = locked ? MYSTERY : (EMB[rank] ?? EMB[0] ?? '');
  return (
    <span
      className={`emb block ${locked ? 'mystery' : `r${rank}`} ${className}`}
      aria-hidden="true"
    >
      {/* markup costante, nessun dato dell'utente */}
      <svg viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}
