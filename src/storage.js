import { supabase } from "./lib/supabaseClient";

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env."
    );
  }
  return supabase;
}

function metricsRowsToObject(rows) {
  const byPlatform = {};
  (rows || []).forEach((r) => {
    if (!byPlatform[r.platform]) byPlatform[r.platform] = {};
    byPlatform[r.platform][r.metric_key] = r.value ?? "";
  });
  return byPlatform;
}

function fillPlatforms(metricsByPlatform, platforms) {
  const result = {};
  platforms.forEach((p) => { result[p] = { ...(metricsByPlatform[p] || {}) }; });
  return result;
}

function dailyLogRowToEntry(row) {
  const entry = { id: row.id, date: row.log_date, platform: row.platform };
  (row.daily_log_metrics || []).forEach((m) => { entry[m.metric_key] = m.value ?? ""; });
  return entry;
}

function inspirationRowToPost(row) {
  return {
    id: row.id,
    link: row.link,
    likes: row.likes ?? "",
    comments: row.comments ?? "",
    reposts: row.reposts ?? "",
    caption: row.caption ?? "",
    favorite: row.favorite,
  };
}

function clientRowToClient(row) {
  const weeks = (row.weeks || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((w) => ({ id: w.id, label: w.label, metrics: fillPlatforms(metricsRowsToObject(w.metrics), row.platforms) }));

  const dailyLog = (row.daily_logs || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(dailyLogRowToEntry);

  const inspiration = (row.inspiration_posts || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(inspirationRowToPost);

  return {
    id: row.id,
    name: row.name,
    primary: row.primary_color,
    accent: row.accent,
    platforms: row.platforms,
    weeks,
    dailyLog,
    inspiration,
    trends: row.trends || "",
    contentIdeas: row.content_ideas || "",
    comparisonReport: row.comparison_report || "",
  };
}

const CLIENT_SELECT = `
  id, name, primary_color, accent, platforms, trends, content_ideas, comparison_report, created_at,
  weeks ( id, label, position, metrics ( platform, metric_key, value ) ),
  daily_logs ( id, log_date, platform, created_at, daily_log_metrics ( metric_key, value ) ),
  inspiration_posts ( id, link, likes, comments, reposts, caption, favorite, created_at )
`;

export async function fetchClients() {
  const db = requireSupabase();
  const { data, error } = await db
    .from("clients")
    .select(CLIENT_SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(clientRowToClient);
}

export async function createClient({ name, primary, accent, platforms = ["Facebook", "Instagram"] }) {
  const db = requireSupabase();
  const { data: clientRow, error: clientError } = await db
    .from("clients")
    .insert({ name, primary_color: primary, accent, platforms })
    .select()
    .single();
  if (clientError) throw clientError;

  const { data: weekRow, error: weekError } = await db
    .from("weeks")
    .insert({ client_id: clientRow.id, label: "Week 1", position: 0 })
    .select()
    .single();
  if (weekError) throw weekError;

  return {
    id: clientRow.id,
    name: clientRow.name,
    primary: clientRow.primary_color,
    accent: clientRow.accent,
    platforms: clientRow.platforms,
    weeks: [{ id: weekRow.id, label: weekRow.label, metrics: fillPlatforms({}, platforms) }],
    dailyLog: [],
    inspiration: [],
    trends: "",
    contentIdeas: "",
    comparisonReport: "",
  };
}

export async function addWeek(clientId, position, platforms) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("weeks")
    .insert({ client_id: clientId, label: `Week ${position + 1}`, position })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, label: data.label, metrics: fillPlatforms({}, platforms) };
}

export async function setMetric(weekId, platform, key, value) {
  const db = requireSupabase();
  const numericValue = value === "" || value === null || value === undefined ? null : parseFloat(value);
  const { error } = await db
    .from("metrics")
    .upsert({ week_id: weekId, platform, metric_key: key, value: numericValue }, { onConflict: "week_id,platform,metric_key" });
  if (error) throw error;
}

export async function setWeekMetricTotals(weekId, platform, totals) {
  const db = requireSupabase();
  const rows = Object.entries(totals).map(([metric_key, value]) => ({ week_id: weekId, platform, metric_key, value }));
  if (!rows.length) return;
  const { error } = await db.from("metrics").upsert(rows, { onConflict: "week_id,platform,metric_key" });
  if (error) throw error;
}

export async function setPlatforms(clientId, platforms) {
  const db = requireSupabase();
  const { error } = await db.from("clients").update({ platforms }).eq("id", clientId);
  if (error) throw error;
}

export async function logDailyEntry(clientId, platform, metrics) {
  const db = requireSupabase();
  const { data: logRow, error: logError } = await db
    .from("daily_logs")
    .insert({ client_id: clientId, platform, log_date: new Date().toISOString().slice(0, 10) })
    .select()
    .single();
  if (logError) throw logError;

  const metricRows = Object.entries(metrics)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([metric_key, value]) => ({ daily_log_id: logRow.id, metric_key, value: parseFloat(value) }));
  if (metricRows.length) {
    const { error: metricsError } = await db.from("daily_log_metrics").insert(metricRows);
    if (metricsError) throw metricsError;
  }

  return { id: logRow.id, date: logRow.log_date, platform, ...metrics };
}

export async function addInspiration(clientId, insp) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("inspiration_posts")
    .insert({
      client_id: clientId,
      link: insp.link,
      likes: insp.likes === "" ? null : parseFloat(insp.likes),
      comments: insp.comments === "" ? null : parseFloat(insp.comments),
      reposts: insp.reposts === "" ? null : parseFloat(insp.reposts),
      caption: insp.caption || null,
      favorite: false,
    })
    .select()
    .single();
  if (error) throw error;
  return inspirationRowToPost(data);
}

export async function setFavorite(postId, favorite) {
  const db = requireSupabase();
  const { error } = await db.from("inspiration_posts").update({ favorite }).eq("id", postId);
  if (error) throw error;
}

export async function updateClientText(clientId, fields) {
  const db = requireSupabase();
  const payload = {};
  if ("trends" in fields) payload.trends = fields.trends;
  if ("contentIdeas" in fields) payload.content_ideas = fields.contentIdeas;
  if ("comparisonReport" in fields) payload.comparison_report = fields.comparisonReport;
  const { error } = await db.from("clients").update(payload).eq("id", clientId);
  if (error) throw error;
}
