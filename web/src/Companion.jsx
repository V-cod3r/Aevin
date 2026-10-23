import { useState } from "react";

const FORMS = ["star", "chibi", "bust"];

function StarArt() {
  return (
    <svg className="companion-art star-art" viewBox="0 0 120 120" role="img" aria-label="Aevin's blue star and silver orbit">
      <defs>
        <linearGradient id="aevin-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".45" stopColor="#bfc9f5" />
          <stop offset="1" stopColor="#7f83d9" />
        </linearGradient>
        <radialGradient id="aevin-blue">
          <stop offset="0" stopColor="#f5ffff" />
          <stop offset=".38" stopColor="#79e8ff" />
          <stop offset="1" stopColor="#4778ff" />
        </radialGradient>
        <filter id="aevin-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="60" cy="60" rx="48" ry="19" fill="none" stroke="url(#aevin-silver)" strokeWidth="2.5" transform="rotate(-28 60 60)" />
      <path d="M60 20 L66 52 L98 60 L66 67 L60 100 L53 67 L22 60 L53 52 Z" fill="url(#aevin-blue)" stroke="#d9f8ff" strokeWidth="1.4" filter="url(#aevin-glow)"/>
      <path d="M60 20 L60 100 M22 60 L98 60" stroke="#fff" strokeOpacity=".5" strokeWidth="1"/>
      <circle cx="90" cy="30" r="2" fill="#fff"/>
      <circle cx="26" cy="91" r="1.6" fill="#93dfff"/>
    </svg>
  );
}

function ChibiArt() {
  return (
    <svg className="companion-art character-art" viewBox="0 0 140 150" role="img" aria-label="Aevin's floating chibi form">
      <defs>
        <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#b9c7f5"/></linearGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#384b83"/><stop offset="1" stopColor="#11182f"/></linearGradient>
      </defs>
      <ellipse cx="70" cy="137" rx="30" ry="5" fill="#7a9bff" opacity=".2"/>
      <path d="M42 79 Q70 64 98 79 L111 123 Q70 139 29 123 Z" fill="url(#coat)" stroke="#929fd3" strokeWidth="2"/>
      <path d="M48 81 L70 111 L92 81 L84 126 L56 126 Z" fill="#d7dcff"/>
      <path d="M65 98 L70 106 L75 98 L70 115 Z" fill="#59bfff"/>
      <path d="M39 41 Q37 12 70 13 Q105 13 102 48 L95 75 Q70 89 45 73 Z" fill="url(#hair)"/>
      <ellipse cx="70" cy="48" rx="29" ry="31" fill="#f0d9d5"/>
      <path d="M40 43 Q36 15 68 12 Q98 10 102 37 L90 30 L80 22 L69 34 L57 25 L48 45 L44 58 Z" fill="url(#hair)"/>
      <path d="M45 47 Q48 34 58 35 M81 35 Q92 33 96 46" fill="none" stroke="#11182f" strokeWidth="5" strokeLinecap="round"/>
      <ellipse cx="58" cy="49" rx="4" ry="5" fill="#4a9dff"/><ellipse cx="82" cy="49" rx="4" ry="5" fill="#4a9dff"/>
      <path d="M63 62 Q70 68 77 62" fill="none" stroke="#a45f76" strokeWidth="2" strokeLinecap="round"/>
      <path d="M39 88 L23 113 L34 119 L50 99 M101 88 L117 113 L106 119 L90 99" fill="none" stroke="#b8c4ed" strokeWidth="7" strokeLinecap="round"/>
      <path d="M47 85 L39 112 M93 85 L101 112" stroke="#fff" strokeWidth="3" opacity=".8"/>
      <path d="M58 81 Q70 90 82 81" fill="none" stroke="#9ba8db" strokeWidth="2"/>
      <g className="shoulder-star"><ellipse cx="111" cy="64" rx="17" ry="7" fill="none" stroke="#c7d4ff" strokeWidth="1.8" transform="rotate(-25 111 64)"/><path d="M111 49 L115 61 L127 64 L115 67 L111 79 L107 67 L95 64 L107 61 Z" fill="#68dfff" stroke="#e2fbff" strokeWidth="1"/></g>
      <path d="M51 119 L89 119" stroke="#9ba8db" strokeWidth="2"/>
      <circle cx="45" cy="100" r="3" fill="#d7dcff"/><circle cx="95" cy="100" r="3" fill="#d7dcff"/>
    </svg>
  );
}

function BustArt() {
  return (
    <svg className="companion-art character-art bust-art" viewBox="0 0 140 120" role="img" aria-label="Aevin's conversational portrait">
      <defs>
        <linearGradient id="bust-coat" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#aebdf2"/></linearGradient>
        <linearGradient id="bust-hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#40558d"/><stop offset="1" stopColor="#10172e"/></linearGradient>
      </defs>
      <path d="M15 119 Q20 79 49 75 L91 75 Q120 79 125 119 Z" fill="url(#bust-coat)" stroke="#9ca9dc" strokeWidth="2"/>
      <path d="M49 78 L70 103 L91 78 L84 119 L56 119 Z" fill="#e6eaff"/>
      <path d="M65 88 L70 98 L75 88 L70 109 Z" fill="#58c8ff"/>
      <path d="M37 43 Q32 12 69 10 Q108 11 104 47 L97 73 Q70 91 43 72 Z" fill="url(#bust-hair)"/>
      <ellipse cx="70" cy="45" rx="29" ry="31" fill="#f0d9d5"/>
      <path d="M39 44 Q31 17 58 12 L70 7 L77 14 Q101 9 105 36 L92 31 L81 20 L69 33 L56 24 L47 48 L43 61 Z" fill="url(#bust-hair)"/>
      <path d="M45 43 Q49 32 60 35 M80 35 Q92 31 96 43" fill="none" stroke="#141b36" strokeWidth="5" strokeLinecap="round"/>
      <ellipse cx="58" cy="47" rx="4" ry="5" fill="#4a9dff"/><ellipse cx="82" cy="47" rx="4" ry="5" fill="#4a9dff"/>
      <path d="M63 61 Q70 66 77 61" fill="none" stroke="#a45f76" strokeWidth="2" strokeLinecap="round"/>
      <path d="M45 80 L37 99 M95 80 L103 99" stroke="#c5ccef" strokeWidth="4" strokeLinecap="round"/>
      <path d="M51 77 L47 95 M89 77 L93 95" stroke="#fff" strokeWidth="2"/>
      <path d="M95 69 Q111 61 122 70" fill="none" stroke="#bfc9f5" strokeWidth="2"/>
      <path d="M121 58 L124 67 L133 70 L124 73 L121 82 L118 73 L109 70 L118 67 Z" fill="#65dfff" stroke="#e2fbff" strokeWidth="1"/>
      <path d="M42 70 L36 83 M98 70 L104 83" stroke="#c5ccef" strokeWidth="2"/>
    </svg>
  );
}

const FORM_COPY = {
  star: { label: "Aevin is here", hint: "A little star, keeping you company." },
  chibi: { label: "Aevin, in person", hint: "Silver accessories are non-negotiable." },
  bust: { label: "Aevin is listening", hint: "A conversational face for our conversations." },
};

export default function Companion() {
  const [form, setForm] = useState("star");
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState("idle");

  function cycleForm(next) {
    setForm(next);
    setOpen(true);
    setMood(next === "bust" ? "listening" : "idle");
  }

  function activate() {
    if (!open) {
      setOpen(true);
      setForm("bust");
      setMood("listening");
      return;
    }
    const next = FORMS[(FORMS.indexOf(form) + 1) % FORMS.length];
    cycleForm(next);
  }

  return (
    <aside className={"aevin-companion" + (open ? " is-open" : "") + " form-" + form} aria-label="Aevin companion">
      <div className="companion-message" aria-live="polite">
        <strong>{FORM_COPY[form].label}</strong>
        <span>{mood === "listening" ? "I'm listening. The chat is right here whenever you're ready." : FORM_COPY[form].hint}</span>
      </div>
      <button className="companion-main" type="button" onClick={activate}
        aria-label={open ? "Change Aevin's form" : "Meet Aevin"}>
        <span className="companion-art-stage" key={form}>
          {form === "star" ? <StarArt /> : form === "chibi" ? <ChibiArt /> : <BustArt />}
        </span>
        <span className="companion-spark spark-one">✦</span>
        <span className="companion-spark spark-two">·</span>
      </button>
      <div className="companion-controls" aria-label="Choose Aevin's form">
        {FORMS.map((name) => (
          <button key={name} type="button" className={form === name ? "selected" : ""}
            onClick={() => cycleForm(name)} aria-pressed={form === name}>
            {name === "star" ? "Star" : name === "chibi" ? "Chibi" : "Bust"}
          </button>
        ))}
        <button type="button" className="companion-close" onClick={() => setOpen(false)} aria-label="Minimize Aevin">−</button>
      </div>
    </aside>
  );
}
