import { useState, useEffect, useRef } from "react";
import { Star, Plus, TrendingUp, TrendingDown, Minus, Sparkles, X, Loader2, ChevronDown, Users, LayoutGrid, Rss, Menu } from "lucide-react";

const EVA = { navy: "#0a0f2c", navyDeep: "#060a1f", white: "#ffffff", red: "#e5231b" };
const SURFACE = { bg: "#f3f4f7", card: "#ffffff", border: "#e7e8ee", text: "#14172b", sub: "#6b7085" };

const METRIC_DEFS = [
  { key: "followers", label: "Followers" },
  { key: "likes", label: "Likes" },
  { key: "views", label: "Views" },
  { key: "shares", label: "Shares" },
  { key: "engagement", label: "Engagement %" },
  { key: "comments", label: "Comments" },
  { key: "saves", label: "Saves" },
  { key: "reach", label: "Reach" },
  { key: "postFreq", label: "Posts / Week" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function emptyMetrics() {
  return METRIC_DEFS.reduce((acc, m) => ({ ...acc, [m.key]: "" }), {});
}

function defaultClient(name, primary, accent, platforms = ["Facebook", "Instagram"]) {
  const metrics = {};
  platforms.forEach((p) => (metrics[p] = emptyMetrics()));
  return {
    id: uid(),
    name,
    primary,
    accent,
    platforms,
    weeks: [{ id: uid(), label: "Week 1", metrics }],
    dailyLog: [],
    inspiration: [],
    trends: "",
    contentIdeas: "",
    comparisonReport: "",
  };
}

function seedClients() {
  return [defaultClient("Suite 53 Events & Rentals", "#0a0a0a", "#c9a130")];
}

function pctChange(cur, prev) {
  const c = parseFloat(cur), p = parseFloat(prev);
  if (!p || isNaN(c) || isNaN(p)) return null;
  return ((c - p) / p) * 100;
}

function gradeForPct(pct) {
  if (pct === null) return "—";
  if (pct >= 20) return "A";
  if (pct >= 8) return "B";
  if (pct >= -3) return "C";
  if (pct >= -15) return "D";
  return "F";
}

function weekGrade(week, prevWeek, platform) {
  let total = 0, count = 0;
  METRIC_DEFS.forEach((m) => {
    const p = pctChange(week.metrics[platform]?.[m.key], prevWeek?.metrics[platform]?.[m.key]);
    if (p !== null) { total += p; count++; }
  });
  if (!count) return { grade: "—", pct: null };
  const avg = total / count;
  return { grade: gradeForPct(avg), pct: avg };
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("API error " + res.status);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function isLight(hex) {
  if (!hex) return false;
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

const GRADE_COLORS = { A: "#2f9e44", B: "#66a80f", C: "#e8a300", D: "#e8590c", F: "#c92a2a", "—": "#adb0c0" };

function GradeBadge({ grade, size = 32 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-black shrink-0"
      style={{ width: size, height: size, background: GRADE_COLORS[grade] || "#adb0c0", color: "#fff", fontSize: size > 36 ? 18 : 13 }}
    >
      {grade}
    </div>
  );
}

function Delta({ pct }) {
  if (pct === null) return <span className="text-[10px]" style={{ color: SURFACE.sub }}>—</span>;
  const up = pct >= 0;
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold`} style={{ color: up ? "#2f9e44" : "#e03131" }}>
      <Icon size={12} strokeWidth={2.75} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, boxShadow: "0 1px 2px rgba(20,23,43,0.04), 0 8px 24px -12px rgba(20,23,43,0.08)", ...style }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [clients, setClients] = useState(seedClients());
  const [activeClientId, setActiveClientId] = useState(null);
  const [view, setView] = useState("table");
  const [activePlatform, setActivePlatform] = useState("Facebook");
  const [loaded, setLoaded] = useState(false);
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: "", primary: "#0a0f2c", accent: "#e5231b" });
  const [reportLoading, setReportLoading] = useState(false);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [dailyForm, setDailyForm] = useState({ platform: "Facebook", ...emptyMetrics() });
  const [inspForm, setInspForm] = useState({ link: "", likes: "", comments: "", reposts: "", caption: "" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("eva-clients", false);
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          if (Array.isArray(parsed) && parsed.length) {
            setClients(parsed);
            setActiveClientId(parsed[0].id);
            setActivePlatform(parsed[0].platforms[0]);
            setLoaded(true);
            return;
          }
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!activeClientId && clients.length) {
      setActiveClientId(clients[0].id);
      setActivePlatform(clients[0].platforms[0]);
    }
  }, [clients, activeClientId]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await window.storage.set("eva-clients", JSON.stringify(clients), false); } catch (e) { console.error(e); }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [clients, loaded]);

  const client = clients.find((c) => c.id === activeClientId) || clients[0];

  function updateClient(id, fn) {
    setClients((prev) => prev.map((c) => (c.id === id ? fn(structuredClone(c)) : c)));
  }

  function addWeek() {
    updateClient(client.id, (c) => {
      const metrics = {};
      c.platforms.forEach((p) => (metrics[p] = emptyMetrics()));
      c.weeks.push({ id: uid(), label: `Week ${c.weeks.length + 1}`, metrics });
      return c;
    });
  }

  function setMetric(weekId, platform, key, value) {
    updateClient(client.id, (c) => {
      const w = c.weeks.find((w) => w.id === weekId);
      w.metrics[platform][key] = value;
      return c;
    });
  }

  function addPlatform(name) {
    if (!name) return;
    updateClient(client.id, (c) => {
      if (c.platforms.includes(name)) return c;
      c.platforms.push(name);
      c.weeks.forEach((w) => (w.metrics[name] = emptyMetrics()));
      return c;
    });
    setActivePlatform(name);
  }

  function createClient() {
    if (!newClientForm.name.trim()) return;
    const nc = defaultClient(newClientForm.name.trim(), newClientForm.primary, newClientForm.accent);
    setClients((prev) => [...prev, nc]);
    setActiveClientId(nc.id);
    setActivePlatform(nc.platforms[0]);
    setShowNewClient(false);
    setNewClientForm({ name: "", primary: "#0a0f2c", accent: "#e5231b" });
  }

  function pushDailyToCurrentWeek() {
    updateClient(client.id, (c) => {
      const week = c.weeks[c.weeks.length - 1];
      const entries = c.dailyLog.filter((e) => e.platform === dailyForm.platform);
      const all = [...entries, dailyForm];
      METRIC_DEFS.forEach((m) => {
        const sum = all.reduce((s, e) => s + (parseFloat(e[m.key]) || 0), 0);
        if (sum) week.metrics[dailyForm.platform][m.key] = sum;
      });
      c.dailyLog.push({ id: uid(), date: new Date().toISOString().slice(0, 10), ...dailyForm });
      return c;
    });
    setDailyForm({ platform: dailyForm.platform, ...emptyMetrics() });
  }

  function addInspiration() {
    if (!inspForm.link.trim()) return;
    updateClient(client.id, (c) => { c.inspiration.unshift({ id: uid(), favorite: false, ...inspForm }); return c; });
    setInspForm({ link: "", likes: "", comments: "", reposts: "", caption: "" });
  }

  function toggleFavorite(id) {
    updateClient(client.id, (c) => { c.inspiration.find((i) => i.id === id).favorite ^= true; return c; });
  }

  async function generateReport() {
    setReportLoading(true);
    try {
      const week = client.weeks[client.weeks.length - 1];
      const clientData = client.platforms.map((p) => `${p}: ${METRIC_DEFS.map((m) => `${m.label} ${week.metrics[p][m.key] || 0}`).join(", ")}`).join("\n");
      const insp = client.inspiration.slice(0, 8).map((i) => `Link: ${i.link} | Likes: ${i.likes || 0} | Comments: ${i.comments || 0} | Reposts: ${i.reposts || 0}${i.favorite ? " (favorited)" : ""}`).join("\n");
      const prompt = `You are a social media analyst for an event space marketing agency called EVA. Compare this client's current week performance against a set of top-performing event-space posts pulled from the niche for inspiration. Write a concise, direct report (under 250 words) covering: 1) where the client is under/over-performing vs the niche benchmarks, 2) the biggest gap, 3) one concrete recommendation. No fluff, no headers, plain prose.\n\nCLIENT (${client.name}) CURRENT WEEK:\n${clientData}\n\nNICHE INSPIRATION POSTS:\n${insp || "None provided yet."}`;
      const text = await callClaude(prompt);
      updateClient(client.id, (c) => { c.comparisonReport = text; return c; });
    } catch (e) {
      updateClient(client.id, (c) => { c.comparisonReport = "Couldn't generate the report — try again."; return c; });
    } finally { setReportLoading(false); }
  }

  async function generateIdeas() {
    if (!client.trends.trim()) return;
    setIdeasLoading(true);
    try {
      const prompt = `You run content strategy for an event space client called ${client.name} in the event-venue niche. Based on these current trend notes, generate 6 specific, ready-to-shoot content ideas (Reels/posts) tailored to an event space. Format as a tight numbered list, one line each, no preamble.\n\nTRENDS:\n${client.trends}`;
      const text = await callClaude(prompt);
      updateClient(client.id, (c) => { c.contentIdeas = text; return c; });
    } catch (e) {
      updateClient(client.id, (c) => { c.contentIdeas = "Couldn't generate ideas — try again."; return c; });
    } finally { setIdeasLoading(false); }
  }

  if (!client) return null;

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setView(id); setSidebarOpen(false); }}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition"
      style={{
        background: view === id ? "rgba(255,255,255,0.08)" : "transparent",
        color: view === id ? "#fff" : "rgba(255,255,255,0.55)",
        borderLeft: view === id ? `3px solid ${client.accent}` : "3px solid transparent",
      }}
    >
      <Icon size={17} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen w-full flex" style={{ background: SURFACE.bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <div
        className={`fixed md:static z-40 h-full md:h-auto md:min-h-screen w-64 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: `linear-gradient(180deg, ${EVA.navy}, ${EVA.navyDeep})` }}
      >
        <div className="px-5 py-6 flex items-center gap-2 border-b border-white/10">
          <div className="font-black text-2xl tracking-tight text-white">
            EV<span style={{ color: EVA.red }}>A</span>
          </div>
          <span className="text-[10px] font-bold text-white/35 tracking-[0.2em] uppercase mt-1">Tracker</span>
        </div>

        <div className="px-3 py-4 space-y-1">
          <NavItem id="table" icon={LayoutGrid} label="Performance" />
          <NavItem id="feed" icon={Rss} label="Feed" />
        </div>

        <div className="mt-auto px-3 py-4 border-t border-white/10 relative">
          <span className="px-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">Client</span>
          <button
            onClick={() => setShowClientMenu((s) => !s)}
            className="w-full mt-1.5 flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 transition"
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0" style={{ background: client.accent, color: isLight(client.accent) ? "#0a0a0a" : "#fff" }}>
              {client.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-white/90 truncate flex-1 text-left">{client.name}</span>
            <ChevronDown size={14} className="text-white/40 shrink-0" />
          </button>
          {showClientMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-white/15 shadow-2xl overflow-hidden" style={{ background: EVA.navyDeep }}>
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActiveClientId(c.id); setActivePlatform(c.platforms[0]); setShowClientMenu(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 hover:bg-white/10 ${c.id === client.id ? "bg-white/10" : ""}`}
                >
                  <span className="w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] shrink-0" style={{ background: c.accent, color: isLight(c.accent) ? "#0a0a0a" : "#fff" }}>{c.name.slice(0, 2).toUpperCase()}</span>
                  <span className="text-white/90 truncate">{c.name}</span>
                </button>
              ))}
              <button onClick={() => { setShowNewClient(true); setShowClientMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2.5 hover:bg-white/10 border-t border-white/10" style={{ color: EVA.red }}>
                <Plus size={14} /> Add client
              </button>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-8 py-4 border-b" style={{ background: "rgba(243,244,247,0.85)", backdropFilter: "blur(8px)", borderColor: SURFACE.border }}>
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} style={{ color: SURFACE.text }} /></button>
          <div>
            <h1 className="text-lg font-black" style={{ color: SURFACE.text }}>{view === "table" ? "Performance" : "Feed"}</h1>
            <p className="text-xs" style={{ color: SURFACE.sub }}>{client.name}</p>
          </div>
        </div>

        <div className="p-4 md:p-8">
          {view === "table" ? (
            <TableView client={client} activePlatform={activePlatform} setActivePlatform={setActivePlatform} addWeek={addWeek} setMetric={setMetric} addPlatform={addPlatform} />
          ) : (
            <FeedView
              client={client}
              dailyForm={dailyForm} setDailyForm={setDailyForm} pushDailyToCurrentWeek={pushDailyToCurrentWeek}
              inspForm={inspForm} setInspForm={setInspForm} addInspiration={addInspiration} toggleFavorite={toggleFavorite}
              generateReport={generateReport} reportLoading={reportLoading}
              generateIdeas={generateIdeas} ideasLoading={ideasLoading}
              updateClient={updateClient}
            />
          )}
        </div>
      </div>

      {showNewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2" style={{ color: SURFACE.text }}><Users size={16} /> New client</h3>
              <button onClick={() => setShowNewClient(false)}><X size={16} style={{ color: SURFACE.sub }} /></button>
            </div>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: SURFACE.sub }}>Client name</label>
            <input
              value={newClientForm.name}
              onChange={(e) => setNewClientForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 mb-3 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }}
              placeholder="e.g. The Grand Hall"
            />
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: SURFACE.sub }}>Primary</label>
                <input type="color" value={newClientForm.primary} onChange={(e) => setNewClientForm((f) => ({ ...f, primary: e.target.value }))} className="w-full h-9 mt-1 rounded-lg" style={{ border: `1px solid ${SURFACE.border}` }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: SURFACE.sub }}>Accent</label>
                <input type="color" value={newClientForm.accent} onChange={(e) => setNewClientForm((f) => ({ ...f, accent: e.target.value }))} className="w-full h-9 mt-1 rounded-lg" style={{ border: `1px solid ${SURFACE.border}` }} />
              </div>
            </div>
            <button onClick={createClient} className="w-full py-2.5 rounded-lg font-bold text-sm" style={{ background: EVA.red, color: "#fff" }}>Create client</button>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <Card className="p-4 flex-1 min-w-[140px]">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: SURFACE.sub }}>{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: SURFACE.text }}>{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
    </Card>
  );
}

function TableView({ client, activePlatform, setActivePlatform, addWeek, setMetric, addPlatform }) {
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [platformName, setPlatformName] = useState("");
  const weeks = client.weeks;
  const latest = weeks[weeks.length - 1];
  const prevWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const { grade, pct } = weekGrade(latest, prevWeek, activePlatform);
  const followers = latest.metrics[activePlatform]?.followers || 0;
  const engagement = latest.metrics[activePlatform]?.engagement || 0;

  return (
    <div>
      {/* Stat cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard label="Current grade" value={<GradeBadge grade={grade} size={40} />} />
        <StatCard label="Followers" value={followers || "—"} sub={<Delta pct={pct} />} />
        <StatCard label="Engagement" value={engagement ? `${engagement}%` : "—"} />
        <StatCard label="Weeks tracked" value={weeks.length} sub={<span className="text-[11px]" style={{ color: SURFACE.sub }}>{client.platforms.length} channel{client.platforms.length > 1 ? "s" : ""}</span>} />
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {client.platforms.map((p) => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border transition"
              style={{
                borderColor: activePlatform === p ? client.accent : SURFACE.border,
                background: activePlatform === p ? client.accent : SURFACE.card,
                color: activePlatform === p ? (isLight(client.accent) ? "#0a0a0a" : "#fff") : SURFACE.sub,
              }}
            >
              {p}
            </button>
          ))}
          {addingPlatform ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus value={platformName} onChange={(e) => setPlatformName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addPlatform(platformName.trim()); setPlatformName(""); setAddingPlatform(false); } }}
                placeholder="Pinterest, TikTok..."
                className="px-2.5 py-1.5 rounded-full text-xs outline-none w-32"
                style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }}
              />
              <button onClick={() => { addPlatform(platformName.trim()); setPlatformName(""); setAddingPlatform(false); }}><Plus size={16} style={{ color: SURFACE.sub }} /></button>
            </div>
          ) : (
            <button onClick={() => setAddingPlatform(true)} className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-dashed flex items-center gap-1" style={{ borderColor: SURFACE.border, color: SURFACE.sub }}>
              <Plus size={12} /> Channel
            </button>
          )}
        </div>

        <button onClick={addWeek} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm" style={{ background: client.accent, color: isLight(client.accent) ? "#0a0a0a" : "#fff" }}>
          <Plus size={15} /> Add Week
        </button>
      </div>

      <Card className="overflow-x-auto">
        <div className="flex flex-row-reverse min-w-max" dir="rtl">
          <div className="w-40 shrink-0 border-l" style={{ borderColor: SURFACE.border }}>
            <div className="h-20 flex items-end pb-2 px-3 border-b" style={{ borderColor: SURFACE.border }}>
              <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: SURFACE.sub }}>{activePlatform}</span>
            </div>
            {METRIC_DEFS.map((m) => (
              <div key={m.key} className="h-12 flex items-center px-3 text-xs font-semibold border-b" style={{ color: SURFACE.sub, borderColor: SURFACE.border }}>{m.label}</div>
            ))}
          </div>

          {weeks.map((week, idx) => {
            const prev = idx > 0 ? weeks[idx - 1] : null;
            const isLatest = idx === weeks.length - 1;
            const { grade } = weekGrade(week, prev, activePlatform);
            return (
              <div key={week.id} className="w-44 shrink-0 border-l" style={{ borderColor: SURFACE.border, background: isLatest ? "#fafafa" : "transparent", boxShadow: isLatest ? `inset 0 0 0 1px ${client.accent}55` : "none" }}>
                <div className="h-20 flex flex-col justify-end pb-2 px-3 border-b" style={{ borderColor: SURFACE.border }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: SURFACE.text }}>{week.label}</span>
                    <GradeBadge grade={grade} />
                  </div>
                </div>
                {METRIC_DEFS.map((m) => {
                  const val = week.metrics[activePlatform]?.[m.key] ?? "";
                  const prevVal = prev?.metrics[activePlatform]?.[m.key];
                  const pct = pctChange(val, prevVal);
                  return (
                    <div key={m.key} className="h-12 flex flex-col justify-center px-3 border-b" style={{ borderColor: SURFACE.border }}>
                      <input
                        value={val} onChange={(e) => setMetric(week.id, activePlatform, m.key, e.target.value)}
                        inputMode="decimal" className="bg-transparent text-sm font-bold outline-none w-full" style={{ color: SURFACE.text }} placeholder="—"
                      />
                      {prev && <Delta pct={pct} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
      <p className="text-[11px] mt-3" style={{ color: SURFACE.sub }}>Newest week sits on the left — table reads right to left. Edit the current week directly, or log day-by-day from the Feed tab and push totals in.</p>
    </div>
  );
}

function FeedView({ client, dailyForm, setDailyForm, pushDailyToCurrentWeek, inspForm, setInspForm, addInspiration, toggleFavorite, generateReport, reportLoading, generateIdeas, ideasLoading, updateClient }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="p-5">
        <h2 className="font-black text-sm uppercase tracking-wide mb-3" style={{ color: SURFACE.text }}>Client daily stats</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {client.platforms.map((p) => (
            <button key={p} onClick={() => setDailyForm((f) => ({ ...f, platform: p }))} className="px-3 py-1 rounded-full text-xs font-bold border"
              style={{ borderColor: dailyForm.platform === p ? client.accent : SURFACE.border, background: dailyForm.platform === p ? client.accent : "transparent", color: dailyForm.platform === p ? (isLight(client.accent) ? "#0a0a0a" : "#fff") : SURFACE.sub }}>
              {p}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-3">
          {METRIC_DEFS.map((m) => (
            <div key={m.key}>
              <label className="text-[10px] font-semibold uppercase" style={{ color: SURFACE.sub }}>{m.label}</label>
              <input value={dailyForm[m.key]} onChange={(e) => setDailyForm((f) => ({ ...f, [m.key]: e.target.value }))} inputMode="decimal"
                className="w-full mt-0.5 rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} placeholder="0" />
            </div>
          ))}
        </div>
        <button onClick={pushDailyToCurrentWeek} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: client.accent, color: isLight(client.accent) ? "#0a0a0a" : "#fff" }}>
          Log day &amp; push to current week
        </button>
        {client.dailyLog.length > 0 && <p className="mt-3 text-xs" style={{ color: SURFACE.sub }}>{client.dailyLog.length} day(s) logged for {dailyForm.platform}.</p>}
      </Card>

      <Card className="p-5">
        <h2 className="font-black text-sm uppercase tracking-wide mb-1" style={{ color: SURFACE.text }}>Niche inspiration</h2>
        <p className="text-[11px] mb-3" style={{ color: SURFACE.sub }}>Manually entered by you for reference — links are never fetched or scraped by Claude.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <input value={inspForm.link} onChange={(e) => setInspForm((f) => ({ ...f, link: e.target.value }))} placeholder="Post link" className="col-span-2 rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
          <input value={inspForm.likes} onChange={(e) => setInspForm((f) => ({ ...f, likes: e.target.value }))} placeholder="Likes" className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
          <input value={inspForm.comments} onChange={(e) => setInspForm((f) => ({ ...f, comments: e.target.value }))} placeholder="Comments" className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
          <input value={inspForm.reposts} onChange={(e) => setInspForm((f) => ({ ...f, reposts: e.target.value }))} placeholder="Reposts" className="rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
        </div>
        <textarea value={inspForm.caption} onChange={(e) => setInspForm((f) => ({ ...f, caption: e.target.value }))} placeholder="Caption (paste manually)" rows={2}
          className="w-full mb-3 rounded-lg px-2 py-1.5 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
        <button onClick={addInspiration} className="px-4 py-2 rounded-xl text-sm font-bold mb-4" style={{ background: client.accent, color: isLight(client.accent) ? "#0a0a0a" : "#fff" }}>Add post</button>

        <div className="space-y-2">
          {client.inspiration.length === 0 && <p className="text-xs" style={{ color: SURFACE.sub }}>No inspiration posts yet.</p>}
          {client.inspiration.map((post) => (
            <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ border: `1px solid ${SURFACE.border}` }}>
              <button onClick={() => toggleFavorite(post.id)} className="mt-0.5 shrink-0">
                <Star size={18} fill={post.favorite ? "#f2c94c" : "none"} color={post.favorite ? "#f2c94c" : "#c8cad6"} />
              </button>
              <div className="min-w-0 flex-1">
                <a href={post.link} target="_blank" rel="noreferrer" className="text-sm font-semibold truncate block hover:underline" style={{ color: SURFACE.text }}>{post.link}</a>
                <div className="flex gap-3 text-[11px] mt-0.5" style={{ color: SURFACE.sub }}>
                  <span>{post.likes || 0} likes</span><span>{post.comments || 0} comments</span><span>{post.reposts || 0} reposts</span>
                </div>
                {post.caption && <p className="text-xs mt-1 line-clamp-2" style={{ color: SURFACE.sub }}>{post.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-sm uppercase tracking-wide" style={{ color: SURFACE.text }}>Comparison report</h2>
          <button onClick={generateReport} disabled={reportLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50" style={{ background: EVA.red, color: "#fff" }}>
            {reportLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate
          </button>
        </div>
        {client.comparisonReport ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: SURFACE.text }}>{client.comparisonReport}</p>
        ) : (
          <p className="text-xs" style={{ color: SURFACE.sub }}>Compares {client.name}'s current week against your inspiration posts above.</p>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="font-black text-sm uppercase tracking-wide mb-3" style={{ color: SURFACE.text }}>Trends &amp; content ideas</h2>
        <textarea value={client.trends} onChange={(e) => updateClient(client.id, (c) => { c.trends = e.target.value; return c; })}
          placeholder="Paste what's trending on Instagram, TikTok, etc..." rows={3}
          className="w-full mb-3 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, color: SURFACE.text }} />
        <button onClick={generateIdeas} disabled={ideasLoading} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 mb-3" style={{ background: EVA.red, color: "#fff" }}>
          {ideasLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate content ideas
        </button>
        {client.contentIdeas && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: SURFACE.text }}>{client.contentIdeas}</p>}
      </Card>
    </div>
  );
}
