// The client from hell: backwards cap, shades, gritted grin, phone glued to
// his ear. Flat comic drawing, three inks.

const INK = '#0d0d0c';
const PAPER = '#f6f4ee';
const LIME = '#c8ff2e';
const RED = '#ff3d1f';

export function Mascot() {
  return (
    <svg className="mascot" viewBox="0 0 320 360" role="img" aria-label="Drawing of a pushy client shouting into his phone">
      {/* anger mark */}
      <path
        d="M246 54 q14 0 14 14 M278 54 q-14 0 -14 14 M246 86 q14 0 14 -14 M278 86 q-14 0 -14 -14"
        stroke={PAPER}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
      {/* jacket and raised arm */}
      <path d="M262 360 C266 322 276 296 268 258" stroke={INK} strokeWidth="34" fill="none" strokeLinecap="round" />
      <path d="M28 360 C36 292 92 268 160 268 C228 268 284 292 292 360 Z" fill={INK} />
      <path d="M116 284 Q160 334 204 284" stroke={LIME} strokeWidth="7" fill="none" strokeDasharray="1 11" strokeLinecap="round" />
      <path d="M128 272 L160 314 L192 272" fill="none" stroke={PAPER} strokeWidth="6" strokeLinejoin="round" />
      {/* neck and ears */}
      <path d="M134 232 L134 278 Q160 292 186 278 L186 232 Z" fill={PAPER} stroke={INK} strokeWidth="6" />
      <ellipse cx="92" cy="172" rx="15" ry="21" fill={PAPER} stroke={INK} strokeWidth="6" />
      <ellipse cx="228" cy="172" rx="15" ry="21" fill={PAPER} stroke={INK} strokeWidth="6" />
      {/* head */}
      <path d="M94 122 C94 66 226 66 226 122 L226 192 C226 238 192 258 160 258 C128 258 94 238 94 192 Z" fill={PAPER} stroke={INK} strokeWidth="6" />
      {/* backwards cap */}
      <path d="M90 124 C86 48 234 48 230 124 C196 110 124 110 90 124 Z" fill={LIME} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M96 114 L38 106 C24 105 22 128 38 130 L100 130 Z" fill={LIME} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <path d="M160 58 C150 78 146 98 146 112" stroke={INK} strokeWidth="4" fill="none" />
      <circle cx="160" cy="56" r="6" fill={INK} />
      {/* angry brows */}
      <path d="M106 140 L146 150" stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <path d="M214 140 L174 150" stroke={INK} strokeWidth="10" strokeLinecap="round" />
      {/* shades */}
      <rect x="100" y="152" width="54" height="32" rx="5" fill={INK} />
      <rect x="166" y="152" width="54" height="32" rx="5" fill={INK} />
      <path d="M150 162 H170" stroke={INK} strokeWidth="7" />
      <path d="M110 174 L122 158 M120 178 L134 160 M176 174 L188 158 M186 178 L200 160" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
      {/* nose */}
      <path d="M160 186 C153 198 155 206 166 206" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* shouting grin */}
      <path d="M116 214 C128 252 192 252 204 214 Z" fill={INK} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M121 216 H199 C197 225 191 231 185 233 H135 C129 231 123 225 121 216 Z" fill={LIME} />
      <path d="M137 216 V233 M151 216 V234 M165 216 V234 M179 216 V233" stroke={INK} strokeWidth="3" />
      <path d="M141 243 C150 237 170 237 179 243 C170 249 150 249 141 243 Z" fill={RED} />
      {/* phone and hand */}
      <rect x="232" y="146" width="30" height="64" rx="6" fill={INK} stroke={PAPER} strokeWidth="4" transform="rotate(-14 247 178)" />
      <path
        d="M250 262 C236 248 234 222 246 210 L272 210 C282 222 280 248 268 262 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M246 224 H268 M245 238 H270" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
