import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";

const Star = ({ size = 18, pulse = false }) => (
  <svg className={pulse ? "star pulse" : "star"} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1 L13.8 10.2 L23 12 L13.8 13.8 L12 23 L10.2 13.8 L1 12 L10.2 10.2 Z" fill="currentColor" />
  </svg>
);

function Login() {
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

function Chat({ session }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  async function load() {
    const { data } = await supabase
      .from("messages")
      .select("id,role,content,source,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    setMsgs((data ?? []).reverse());
  }

  useEffect(() => {
    load();
    // Messages Aevin starts on its own show up live.
    const ch = supabase
      .channel("aevin-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${session.user.id}` },
        (p) => {
          if (p.new.source === "proactive") setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  async function send(e) {
    e?.preventDefault();
    const message = text.trim();
    if (!message || thinking) return;
    setText("");
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message }]);
    setThinking(true);
    const { error } = await supabase.functions.invoke("chat", { body: { message } });
    if (error) {
      setMsgs((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", content: "I couldn't reach my thoughts just now. Try again in a moment?" }]);
    } else {
      await load();
    }
    setThinking(false);
  }

  return (
    <div className="chat">
      <header>
        <div className="brand"><Star size={16} /><span>Aevin</span></div>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <section className="stream">
        {msgs.length === 0 && !thinking && (
          <p className="empty">Say hello. I'm listening.</p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.role === "user" ? "me" : "aevin"}`}>{m.content}</div>
        ))}
        {thinking && (
          <div className="bubble aevin typing"><Star size={14} pulse /></div>
        )}
        <div ref={endRef} />
      </section>

      <form className="composer" onSubmit={send}>
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

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="boot"><Star size={28} pulse /></div>;
  return session ? <Chat session={session} /> : <Login />;
}
