import { useEffect, useMemo } from "react";

export const STAR_PATH = "M12 1 L13.8 10.2 L23 12 L13.8 13.8 L12 23 L10.2 13.8 L1 12 L10.2 10.2 Z";

// What she can send to Aevin.
export const GIFTS = [
  { id: "flowers",  label: "Flowers",  text: "*gives you a bouquet of flowers*" },
  { id: "stars",    label: "Stars",    text: "*sends you a handful of stars*" },
  { id: "hug",      label: "Hug",      text: "*hugs you*" },
  { id: "candle",   label: "Candle",   text: "*lights a candle for you*" },
  { id: "confetti", label: "Confetti", text: "*throws confetti for you*" },
];

const CAPTIONS = {
  aevin: { flowers: "Aevin picked these for you", stars: "a handful of stars", hug: "a hug", candle: "a candle, lit for you", confetti: "for you, for all of it" },
  me: { flowers: "you sent flowers", stars: "you sent stars", hug: "you sent a hug", candle: "you lit a candle", confetti: "you sent confetti" },
};

function Flower({ x, y, r, color, delay = 0 }) {
  return (
    <g className="bloom" style={{ "--delay": `${delay}s`, transformOrigin: `${x}px ${y}px` }}>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={x} cy={y - r * 0.62} rx={r * 0.36} ry={r * 0.62} fill={color} opacity=".95" transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.3} fill="#ffe29a" />
    </g>
  );
}

function Bouquet() {
  return (
    <svg viewBox="0 0 180 150" className="gx" role="img" aria-label="A bouquet of flowers">
      <g stroke="#6fbf8f" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M90 140 C90 112 52 92 46 60" />
        <path d="M90 140 C90 106 90 86 92 46" />
        <path d="M90 140 C90 112 130 94 138 62" />
      </g>
      <path d="M70 112 C55 102 50 92 58 86 C68 92 74 102 70 112Z" fill="#8fd4a6" />
      <path d="M112 110 C126 100 132 92 124 86 C114 92 108 100 112 110Z" fill="#8fd4a6" />
      <Flower x={46} y={52} r={22} color="#f3a6c8" delay={0.1} />
      <Flower x={92} y={36} r={26} color="#cbb7ff" delay={0.25} />
      <Flower x={138} y={54} r={22} color="#ffc4dd" delay={0.4} />
      <path d="M70 126 L110 126 L105 146 L75 146Z" fill="#b9b6e6" />
      <path d="M90 130 L92.2 134.8 L97 137 L92.2 139.2 L90 144 L87.8 139.2 L83 137 L87.8 134.8Z" fill="#4a9dff" />
    </svg>
  );
}

function StarShower() {
  const pts = [[28, 62, 12], [66, 30, 16], [108, 66, 10], [150, 28, 14], [192, 60, 18], [234, 32, 10], [262, 68, 13]];
  return (
    <svg viewBox="0 0 290 100" className="gx wide" role="img" aria-label="A handful of stars">
      {pts.map(([x, y, s], i) => (
        <g key={i} className="floaty" style={{ animationDelay: `${i * 0.35}s` }}>
          <path className="twinkle" style={{ animationDelay: `${i * 0.27}s` }} d={STAR_PATH} fill={i % 2 ? "#7cb8ff" : "#b9b6e6"}
            transform={`translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})`} />
        </g>
      ))}
    </svg>
  );
}

function Hug() {
  return (
    <svg viewBox="0 0 120 120" className="gx" role="img" aria-label="A hug">
      {[0, 1, 2].map((i) => <circle key={i} className="ring" cx="60" cy="60" r="18" style={{ animationDelay: `${i * 0.9}s` }} />)}
      <path className="twinkle" d={STAR_PATH} fill="#4a9dff" transform="translate(40 40) scale(.84)" />
    </svg>
  );
}

function Candle() {
  return (
    <svg viewBox="0 0 80 130" className="gx" role="img" aria-label="A lit candle">
      <defs>
        <radialGradient id="cg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity=".7" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="glow" cx="40" cy="44" r="34" fill="url(#cg)" />
      <rect x="28" y="62" width="24" height="58" rx="5" fill="#e8e6f6" />
      <rect x="28" y="62" width="24" height="9" rx="4" fill="#d3d0ea" />
      <rect x="39" y="52" width="2" height="12" rx="1" fill="#6b6a85" />
      <path className="flame" d="M40 20 C48 32 49 42 40 51 C31 42 32 32 40 20Z" fill="#ffb347" />
      <path className="flame inner" d="M40 32 C44 38 44 44 40 49 C36 44 36 38 40 32Z" fill="#fff1b8" />
    </svg>
  );
}

function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    a: (i / 22) * 360 + Math.random() * 12, d: 40 + Math.random() * 50, s: 5 + Math.random() * 6,
    c: ["#4a9dff", "#b9b6e6", "#ffd479", "#f3a6c8", "#dfe2f0"][i % 5], delay: Math.random() * 0.15,
  })), []);
  return (
    <div className="burst" role="img" aria-label="Confetti">
      {pieces.map((p, i) => (
        <span key={i} style={{ "--a": `${p.a}deg`, "--d": `${p.d}px`, width: p.s, height: p.s * 1.6, background: p.c, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

export function GestureCard({ kind, mine = false }) {
  const art = { flowers: <Bouquet />, stars: <StarShower />, hug: <Hug />, candle: <Candle />, confetti: <ConfettiBurst /> }[kind];
  if (!art) return null; // "letter" has no card: the message itself becomes the letter
  return (
    <div className={`gesture ${mine ? "mine" : ""}`}>
      {art}
      <span className="gcap">{CAPTIONS[mine ? "me" : "aevin"][kind]}</span>
    </div>
  );
}

// Full-screen moment when a gesture arrives. Respects "reduce motion".
export function Overlay({ kind, onDone }) {
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = useMemo(() => Array.from({ length: kind === "hug" ? 0 : 28 }, (_, i) => ({
    x: Math.random() * 100, d: 3.4 + Math.random() * 2.8, delay: Math.random() * 1.4,
    rot: (Math.random() - 0.5) * 720, sway: (Math.random() - 0.5) * 120, s: 9 + Math.random() * 12,
    c: ["#f3a6c8", "#cbb7ff", "#ffc4dd", "#ffd6e8"][i % 4], c2: ["#4a9dff", "#b9b6e6", "#ffd479", "#f3a6c8", "#dfe2f0"][i % 5],
  })), [kind]);

  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 0 : 7000);
    return () => clearTimeout(t);
  }, []);
  if (reduced || kind === "letter") return null;

  const style = (it) => ({ "--x": `${it.x}%`, "--d": `${it.d}s`, "--delay": `${it.delay}s`, "--rot": `${it.rot}deg`, "--sway": `${it.sway}px`, width: it.s, height: it.s });
  return (
    <div className={`overlay ov-${kind}`} aria-hidden="true">
      {kind === "hug" && <div className="hugglow" />}
      {kind === "flowers" && items.map((it, i) => <span key={i} className="petal" style={{ ...style(it), background: it.c }} />)}
      {kind === "stars" && items.map((it, i) => (
        <svg key={i} className="fallstar" viewBox="0 0 24 24" style={style(it)}><path d={STAR_PATH} fill={it.c2} /></svg>
      ))}
      {kind === "confetti" && items.map((it, i) => <span key={i} className="chip" style={{ ...style(it), height: it.s * 1.5, background: it.c2 }} />)}
      {kind === "candle" && items.slice(0, 16).map((it, i) => <span key={i} className="ember" style={{ ...style(it), width: it.s / 3, height: it.s / 3 }} />)}
    </div>
  );
}
