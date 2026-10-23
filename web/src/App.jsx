import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { GestureCard, Overlay } from "./gestures.jsx";

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

// Shrink photos before upload: faster, cheaper, and plenty sharp for Aevin to look at.
async function shrink(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  if (!blob) throw new Error("Could not read that image");
  return blob;
}

function ChatImage({ path, local }) {
  const [url, setUrl] = useState(local || null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    if (local || !path) return;
    let live = true;
    supabase.storage.from("aevin-images").createSignedUrl(path, 3600).then(({ data, error }) => {
      if (!live) return;
      if (data?.signedUrl) setUrl(data.signedUrl);
      else setFailed(error?.message || "no link returned");
    });
    return () => { live = false; };
  }, [path, local]);
  if (url) {
    return <img className="photo" src={url} alt="A picture you sent" loading="lazy"
      onError={() => { setUrl(null); setFailed("the picture file could not be opened"); }} />;
  }
  if (failed) return <div className="photo missing">Picture unavailable<small>{failed}</small></div>;
  return <div className="photo ph" />;
}

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
  const [pending, setPending] = useState(null); // a photo waiting to be sent
  const fileRef = useRef(null);
  const localUrls = useRef({}); // pictures sent this session stay visible without a round trip
  const endRef = useRef(null);
  const celebrate = (kind) => kind && setOverlay({ kind, key: Date.now() });

  async function load() {
    // Try the newest column set first, then older ones, so the chat still shows
    // if a database migration hasn't been run yet.
    let data = null;
    for (const cols of [
      "id,role,content,source,gesture,image_path,created_at",
      "id,role,content,source,gesture,created_at",
      "id,role,content,source,created_at",
    ]) {
      const res = await supabase.from("messages").select(cols).order("created_at", { ascending: false }).limit(60);
      if (!res.error) { data = res.data; break; }
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
    const photo = gift ? null : pending;
    if ((!message && !photo) || thinking) return;
    if (!gift) { setText(""); setPending(null); }
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message, gesture: gift?.id, local: photo?.url }]);
    if (gift) celebrate(gift.id);
    setThinking(true);

    let image_path;
    if (photo) {
      const path = `${session.user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("aevin-images").upload(path, photo.blob, { contentType: "image/jpeg" });
      if (upErr) {
        console.error("upload failed:", upErr.message);
        setMsgs((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", failed: true, content: "I couldn't get that picture. Try again?", detail: upErr.message }]);
        setThinking(false);
        return;
      }
      image_path = path;
      localUrls.current[path] = photo.url;
    }
    const { data, error } = await supabase.functions.invoke("chat", { body: { message, gesture: gift?.id, image_path } });
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

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await shrink(file);
      setPending((old) => { if (old) URL.revokeObjectURL(old.url); return { blob, url: URL.createObjectURL(blob) }; });
    } catch (err) {
      setMsgs((m) => [...m, { id: `err-${Date.now()}`, role: "assistant", failed: true, content: "I couldn't open that picture. Could you try a different one?", detail: String(err.message ?? err) }]);
    }
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
            {(m.image_path || m.local) && <ChatImage path={m.image_path} local={m.local || localUrls.current[m.image_path]} />}
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

      {pending && (
        <div className="pending">
          <img src={pending.url} alt="Picture ready to send" />
          <button type="button" onClick={() => setPending(null)} aria-label="Remove picture">×</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
      <form className="composer" onSubmit={send}>
        <button type="button" className="gift" onClick={() => fileRef.current?.click()} disabled={thinking} aria-label="Send Aevin a picture">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" />
          </svg>
        </button>
        <textarea
          rows={1}
          value={text}
          placeholder="Tell Aevin anything…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }}
        />
        <button disabled={(!text.trim() && !pending) || thinking} aria-label="Send">➤</button>
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
