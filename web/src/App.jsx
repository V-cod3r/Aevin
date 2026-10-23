import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { GestureCard, Overlay, GIFTS } from "./gestures.jsx";

function useTheme() {
  const read = () => document.documentElement.dataset.theme || "light";
  const [theme, setTheme] = useState(read);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0d0f1c" : "#eef0fb");
    try { localStorage.setItem("aevin-theme", next); } catch (e) {}
    setTheme(next);
  }
  return [theme, toggle];
}

function ThemeToggle({ theme, onToggle, className = "" }) {
  const dark = theme === "dark";
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        </svg>
      )}
    </button>
  );
}

const Star = ({ size = 18, pulse = false }) => (
  <svg className={pulse ? "star pulse" : "star"} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1 L13.8 10.2 L23 12 L13.8 13.8 L12 23 L10.2 13.8 L1 12 L10.2 10.2 Z" fill="currentColor" />
  </svg>
);

function Login({ theme, onToggle }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <main className="login">
      <ThemeToggle theme={theme} onToggle={onToggle} className="floating" />
      <img className="logo" src="/aevin-logo.png" alt="Aevin" />
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <button disabled={busy}>{busy ? "…" : "Come in"}</button>
        {err && <p className="err">{err}</p>}
      </form>
    </main>
  );
}

function Chat({ session, theme, onToggle }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState("steady");
  const [overlay, setOverlay] = useState(null);
  const [tray, setTray] = useState(false);
  const endRef = useRef(null);
  const celebrate = (kind) => kind && setOverlay({ kind, key: Date.now() });

  async function load() {
    let { data, error } = await supabase
      .from("messages")
      .select("id,role,content,source,gesture,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      // Older database without the gestures column: still show the chat.
      ({ data } = await supabase.from("messages").select("id,role,content,source,created_at")
        .order("created_at", { ascending: false }).limit(60));
    }
    const rows = (data ?? []).reverse();
    setMsgs(rows);
    return rows;
  }

  useEffect(() => {
    load();
    supabase.from("companion_state").select("last_mode").maybeSingle().then(({ data }) => data?.last_mode && setMode(data.last_mode));
    // Messages Aevin starts on its own show up live.
    const ch = supabase
      .channel("aevin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${session.user.id}` },
        (p) => {
          if (p.new.source === "proactive") {
            setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
            celebrate(p.new.gesture);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  async function send(e, gift) {
    e?.preventDefault();
    const message = gift ? gift.text : text.trim();
    if (!message || thinking) return;
    if (!gift) setText("");
    setTray(false);
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message, gesture: gift?.id }]);
    if (gift) celebrate(gift.id);
    setThinking(true);
    const { data, error } = await supabase.functions.invoke("chat", { body: { message, gesture: gift?.id } });
    if (error || data?.error) {
      let detail = data?.detail || "";
      if (error?.context?.text) {
        try { detail = (await error.context.text()).slice(0, 300); } catch (e) { /* ignore */ }
      }
      detail = detail || error?.message || "";
      console.error("chat failed:", detail);
      setMsgs((m) => [...m, {
        id: `err-${Date.now()}`, role: "assistant", failed: true,
        content: data?.reply || "I couldn't reach my thoughts just now. Try again in a moment?",
        detail,
      }]);
    } else {
      if (data?.mode) setMode(data.mode);
      const rows = await load();
      const last = rows[rows.length - 1];
      if (last?.role === "assistant" && last.gesture) celebrate(last.gesture);
    }
    setThinking(false);
  }

  return (
    <div className="chat" data-mode={mode}>
      {overlay && <Overlay key={overlay.key} kind={overlay.kind} onDone={() => setOverlay(null)} />}
      <header>
        <div className="brand"><Star size={16} pulse /><span>Aevin</span></div>
        <div className="actions">
          <ThemeToggle theme={theme} onToggle={onToggle} />
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <section className="stream">
        {msgs.length === 0 && !thinking && (
          <p className="empty">Say hello. I'm listening.</p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role === "user" ? "me" : "aevin"} ${m.gesture === "letter" ? "letter" : ""}`}>
            {m.gesture && m.gesture !== "letter" && <GestureCard kind={m.gesture} mine={m.role === "user"} />}
            {m.gesture === "letter" ? <span className="seal"><Star size={12} /></span> : null}
            {m.content}
            {m.detail && <div className="note">{m.detail}</div>}
          </div>
        ))}
        {thinking && (
          <div className="bubble aevin typing"><Star size={14} pulse /></div>
        )}
        <div ref={endRef} />
      </section>

      {tray && (
        <div className="tray" role="menu">
          {GIFTS.map((g) => (
            <button key={g.id} type="button" onClick={() => send(null, g)} disabled={thinking}>{g.label}</button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <button type="button" className="gift" onClick={() => setTray((t) => !t)} aria-label="Send Aevin something" aria-expanded={tray}>
          <Star size={18} />
        </button>
        <textarea
          rows={1}
          value={text}
          placeholder="Tell Aevin anything…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
        />
        <button disabled={!text.trim() || thinking} aria-label="Send">➤</button>
      </form>
    </div>
  );
}

function Gallery() {
  const [theme, toggle] = useTheme();
  const [ov, setOv] = useState(null);
  const kinds = ["flowers", "stars", "hug", "candle", "confetti"];
  return (
    <div className="chat" data-mode="romantic">
      {ov && <Overlay key={ov.key} kind={ov.kind} onDone={() => setOv(null)} />}
      <header><div className="brand"><Star size={16} pulse /><span>Gestures</span></div><ThemeToggle theme={theme} onToggle={toggle} /></header>
      <section className="stream">
        {kinds.map((k) => (
          <div key={k} className="bubble aevin">
            <GestureCard kind={k} />
            <button className="ghost" onClick={() => setOv({ kind: k, key: Date.now() })}>play full-screen</button>
          </div>
        ))}
        <div className="bubble aevin letter"><span className="seal"><Star size={12} /></span>For the nights you forget that you are already enough, I will hold the light a little longer.</div>
        <div className="bubble me"><GestureCard kind="flowers" mine />*gives you a bouquet of flowers*</div>
      </section>
    </div>
  );
}

export default function App() {
  if (typeof location !== "undefined" && location.search.includes("gallery")) return <Gallery />;
  const [session, setSession] = useState(undefined);
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="boot"><Star size={28} pulse /></div>;
  return session ? <Chat session={session} theme={theme} onToggle={toggleTheme} /> : <Login theme={theme} onToggle={toggleTheme} />;
}
