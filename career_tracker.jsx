import React, { useState, useEffect } from "react";
import { supabase } from "./src/supabaseClient";

const STORAGE_KEY = "career_tracker_v1";
const CLOUD_ROW_ID = import.meta.env.VITE_TRACKER_ID || "career_tracker";
const EMPTY_COUNTS = { dsa: 0, concepts: 0, apps: 0, mocks: 0 };

const PHASES = [
  {
    id: 1, name: "Foundation & Habit", weeks: "Weeks 1–6", color: "#22c55e",
    goal: "Kill the spiral. Build the habit. Get early wins.",
    targets: { dsa: 3, concepts: 5, apps: 0, mocks: 0 },
    focus: [
      "Arrays, Hashmaps, Strings — NeetCode 150 only",
      "JS depth: Closures, Event Loop, Async/Await, Prototypes",
      "No system design. No BE. Not yet.",
    ],
  },
  {
    id: 2, name: "Interview Core", weeks: "Weeks 7–16", color: "#60a5fa",
    goal: "Become interview-ready for strong FE product roles.",
    targets: { dsa: 4, concepts: 3, apps: 2, mocks: 0 },
    focus: [
      "Trees, BFS/DFS, Sliding Window, Binary Search",
      "React internals, Browser rendering, Performance, a11y",
      "FE System Design: 1 problem/week from week 10",
    ],
  },
  {
    id: 3, name: "Job Hunt Mode", weeks: "Weeks 17–24", color: "#f59e0b",
    goal: "Apply aggressively. Interview confidently. Get out.",
    targets: { dsa: 2, concepts: 0, apps: 6, mocks: 1 },
    focus: [
      "Maintenance DSA — 2–3/week to stay sharp",
      "Mock interviews: Pramp / peer / Interviewing.io",
      "2–3 LinkedIn outreaches/week → referrals matter a lot",
    ],
  },
  {
    id: 4, name: "Full-Stack Expansion", weeks: "Month 7–18", color: "#a78bfa",
    goal: "Level up to FE + BE ownership at the new job.",
    targets: { dsa: 0, concepts: 3, apps: 0, mocks: 0 },
    focus: [
      "Node.js + Express: build real REST APIs",
      "PostgreSQL: schema design, joins, indexing",
      "Ship 1 full-stack side project end to end",
    ],
  },
];

const METRICS = [
  { key: "dsa", label: "DSA Problems", icon: "⚡" },
  { key: "concepts", label: "FE Concepts", icon: "🧠" },
  { key: "apps", label: "Applications", icon: "📨" },
  { key: "mocks", label: "Mock Interviews", icon: "🎯" },
];

const RULES = [
  ["⚡", "Mediums Only", "No LeetCode Hards. They are not the bar. Don't burn out on them."],
  ["🗓", "Interleave by Day", "DSA Monday. FE concepts Tuesday. Don't mix both in one session."],
  ["🔢", "Score > Streak", "Lifetime numbers are real progress. Streaks are just motivation fuel."],
  ["🔄", "Sunday Review", "10 min. Did I hit targets? What blocked me? Adjust next week's plan."],
  ["🤝", "2 Outreaches/Week", "LinkedIn DMs to people at target companies. Referrals move the needle."],
  ["🛑", "No Zero Day", "Even 5 minutes is non-zero. Never let 2 zeros happen back to back."],
];

function initData() {
  const today = getTodayDate();
  return {
    currentPhase: 1,
    startDate: today,
    weekStartDate: today,
    weekly: { ...EMPTY_COUNTS },
    lifetime: { ...EMPTY_COUNTS },
    lastActiveDate: null,
    streak: 0,
    updatedAt: new Date().toISOString(),
  };
}

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(a, b) {
  return Math.floor(Math.abs(new Date(b) - new Date(a)) / 86400000);
}

function getWeekNum(startDate) {
  return Math.floor(daysBetween(startDate, getTodayDate()) / 7) + 1;
}

function normalizeCounts(counts) {
  return Object.fromEntries(
    Object.keys(EMPTY_COUNTS).map((key) => [key, Number.isFinite(counts?.[key]) ? counts[key] : 0])
  );
}

function normalizeData(value) {
  const fallback = initData();
  if (!value || typeof value !== "object") return fallback;

  const currentPhase = PHASES.some((phase) => phase.id === value.currentPhase) ? value.currentPhase : fallback.currentPhase;
  return {
    ...fallback,
    ...value,
    currentPhase,
    weekly: normalizeCounts(value.weekly),
    lifetime: normalizeCounts(value.lifetime),
    streak: Number.isFinite(value.streak) ? value.streak : fallback.streak,
    updatedAt: value.updatedAt || fallback.updatedAt,
  };
}

function readStoredData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeData(JSON.parse(raw)) : initData();
}

function saveStoredData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function refreshRollingDates(data) {
  const today = getTodayDate();
  let next = normalizeData(data);
  if (daysBetween(next.weekStartDate, today) >= 7) {
    next = { ...next, weekly: { ...EMPTY_COUNTS }, weekStartDate: today };
  }
  if (next.lastActiveDate && next.lastActiveDate !== today && daysBetween(next.lastActiveDate, today) > 1) {
    next = { ...next, streak: 0 };
  }
  return next;
}

function getDataTime(data) {
  return new Date(data?.updatedAt || 0).getTime();
}

function markUpdated(data) {
  return { ...data, updatedAt: new Date().toISOString() };
}

export default function CareerTracker() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("weekly");
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(supabase ? "local" : "local only");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    function syncOnFocus() {
      if (!document.hidden) syncFromCloud(readStoredData());
    }

    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnFocus);

    return () => {
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnFocus);
    };
  }, []);

  async function load() {
    try {
      const d = refreshRollingDates(readStoredData());
      setData(d);
      saveStoredData(d);

      if (supabase) {
        await syncFromCloud(d);
      }
    } catch { setData(initData()); }
    setLoading(false);
  }

  async function persist(d) {
    try {
      setSyncError("");
      saveStoredData(d);
      if (supabase) await saveCloudData(d);
    }
    catch (e) {
      console.error("save failed", e);
      setSyncStatus("sync failed");
      setSyncError(e.message || "Could not save to Supabase.");
    }
  }

  async function syncFromCloud(localData) {
    try {
      setSyncError("");
      setSyncStatus("syncing");
      const { data: row, error } = await supabase
        .from("tracker_data")
        .select("data, updated_at")
        .eq("id", CLOUD_ROW_ID)
        .maybeSingle();

      if (error) throw error;

      if (row?.data) {
        const cloudData = refreshRollingDates({ ...row.data, updatedAt: row.data.updatedAt || row.updated_at });
        const local = refreshRollingDates(localData);
        const nextData = getDataTime(cloudData) >= getDataTime(local) ? cloudData : local;
        setData(nextData);
        saveStoredData(nextData);
        await saveCloudData(nextData);
      } else {
        await saveCloudData(localData);
      }

      setSyncStatus("synced");
    } catch (e) {
      console.error("sync failed", e);
      setSyncStatus("sync failed");
      setSyncError(e.message || "Could not sync with Supabase.");
    }
  }

  async function saveCloudData(nextData) {
    setSyncStatus("saving");
    const dataToSave = normalizeData(nextData);
    const { error } = await supabase
      .from("tracker_data")
      .upsert({
        id: CLOUD_ROW_ID,
        data: dataToSave,
        updated_at: dataToSave.updatedAt,
      });

    if (error) throw error;
    setSyncStatus("synced");
  }

  function log(key) {
    const today = getTodayDate();
    const last = data.lastActiveDate;
    let streak = data.streak;
    if (last !== today) {
      const diff = last ? daysBetween(last, today) : 2;
      streak = diff === 1 ? streak + 1 : 1;
    }
    const next = {
      ...data,
      weekly: { ...data.weekly, [key]: data.weekly[key] + 1 },
      lifetime: { ...data.lifetime, [key]: data.lifetime[key] + 1 },
      lastActiveDate: today, streak,
    };
    const updated = markUpdated(next);
    setData(updated); persist(updated);
    setPulse(key); setTimeout(() => setPulse(null), 500);
  }

  function setPhase(id) {
    const next = markUpdated({ ...data, currentPhase: id });
    setData(next); persist(next);
  }

  function resetWeek() {
    const today = getTodayDate();
    const next = markUpdated({ ...data, weekly: { ...EMPTY_COUNTS }, weekStartDate: today });
    setData(next); persist(next);
  }

  function resetAll() {
    const confirmed = window.confirm("Reset all tracker data on this device and in Supabase?");
    if (!confirmed) return;

    const next = initData();
    setData(next); persist(next);
  }

  function syncNow() {
    if (!supabase) return;
    syncFromCloud(readStoredData());
  }

  function exportBackup() {
    const backup = JSON.stringify(data, null, 2);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `career-tracker-backup-${getTodayDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !data) {
    return (
      <div style={{ background: "#080808", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontFamily: "monospace", fontSize: "13px", letterSpacing: "0.1em" }}>
        loading tracker...
      </div>
    );
  }

  const phase = PHASES[data.currentPhase - 1];
  const today = getTodayDate();
  const loggedToday = data.lastActiveDate === today;
  const weekNum = getWeekNum(data.startDate);
  const lastUpdated = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : "not yet";

  const S = {
    root: { background: "#080808", minHeight: "100vh", maxWidth: "460px", margin: "0 auto", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", color: "#d4d4d4", paddingBottom: "40px" },
    header: { padding: "22px 20px 0" },
    label: { fontSize: "9px", color: "#3a3a3a", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "4px" },
    h1: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "21px", fontWeight: "800", color: "#fff", letterSpacing: "-0.4px", margin: 0 },
    streakNum: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "30px", fontWeight: "800", color: loggedToday ? "#f59e0b" : "#1f1f1f", lineHeight: 1 },
    phaseBadge: { marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#0f0f0f", border: `1px solid ${phase.color}33`, borderRadius: "4px", padding: "5px 11px" },
    tabs: { display: "flex", marginTop: "16px", borderBottom: "1px solid #141414" },
    body: { padding: "18px 20px 0" },
    card: (active, color) => ({ background: "#0d0d0d", border: `1px solid ${active ? color + "55" : "#161616"}`, borderRadius: "6px", padding: "14px", marginBottom: "8px", transition: "border-color 0.3s, transform 0.15s ease" }),
    bigNum: (color) => ({ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: "800", color: color || "#fff", lineHeight: 1 }),
    subtext: { fontSize: "9px", color: "#3a3a3a", marginTop: "2px" },
    plusBtn: (done, color) => ({ background: done ? color + "18" : "#161616", border: `1px solid ${done ? color + "44" : "#252525"}`, color: done ? color : "#666", width: "30px", height: "30px", borderRadius: "4px", cursor: "pointer", fontSize: "18px", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }),
  };

  return (
    <div style={S.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} ::-webkit-scrollbar{width:0}`}</style>

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={S.label}>career escape plan</p>
            <h1 style={S.h1}>Progress Tracker</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ ...S.label, marginBottom: "3px" }}>streak</p>
            <p style={S.streakNum}>{data.streak}<span style={{ fontSize: "12px", color: "#2a2a2a", marginLeft: "2px" }}>d</span></p>
          </div>
        </div>

        <div style={S.phaseBadge}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: phase.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: "9px", color: phase.color, fontWeight: "700", letterSpacing: "0.12em" }}>PHASE {data.currentPhase}</span>
          <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
          <span style={{ fontSize: "10px", color: "#666" }}>{phase.name}</span>
          <span style={{ color: "#2a2a2a", fontSize: "10px" }}>·</span>
          <span style={{ fontSize: "10px", color: "#3a3a3a" }}>WK {weekNum}</span>
        </div>

        <div style={S.tabs}>
          {[["weekly", "This Week"], ["phases", "Roadmap"], ["stats", "All-Time"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? `2px solid ${phase.color}` : "2px solid transparent", cursor: "pointer", padding: "8px 14px 7px", fontSize: "9px", fontFamily: "inherit", letterSpacing: "0.14em", textTransform: "uppercase", color: tab === id ? phase.color : "#444", marginBottom: "-1px" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={S.body}>

        {/* THIS WEEK */}
        {tab === "weekly" && (
          <>
            <p style={{ fontSize: "10px", color: "#555", marginBottom: "16px", lineHeight: "1.75" }}>{phase.goal}</p>

            {METRICS.map(m => {
              const target = phase.targets[m.key];
              const current = data.weekly[m.key];
              const done = target > 0 && current >= target;
              const skip = target === 0;
              const pct = target > 0 ? Math.min(1, current / target) : 0;

              return (
                <div key={m.key} style={{ ...S.card(done, phase.color), opacity: skip ? 0.3 : 1, transform: pulse === m.key ? "scale(1.018)" : "scale(1)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{ fontSize: "18px" }}>{m.icon}</span>
                      <div>
                        <p style={{ fontSize: "11px", color: "#bbb", fontWeight: "600" }}>{m.label}</p>
                        <p style={S.subtext}>{skip ? "not this phase" : done ? "✓ weekly target hit" : `${current} of ${target} this week`}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={S.bigNum(done ? phase.color : skip ? "#222" : "#fff")}>{current}</span>
                      {!skip && <button style={S.plusBtn(done, phase.color)} onClick={() => log(m.key)}>+</button>}
                    </div>
                  </div>
                  {!skip && (
                    <div style={{ marginTop: "10px", background: "#141414", borderRadius: "2px", height: "2px" }}>
                      <div style={{ height: "100%", width: `${pct * 100}%`, background: done ? phase.color : "#2e2e2e", borderRadius: "2px", transition: "width 0.4s ease" }} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Zero Day */}
            <div style={{ marginTop: "12px", padding: "12px 14px", background: "#0d0d0d", border: `1px solid ${loggedToday ? "#22c55e2a" : "#141414"}`, borderRadius: "6px", display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: loggedToday ? "#22c55e" : "#202020", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "10px", color: loggedToday ? "#22c55e" : "#444", fontWeight: "600" }}>
                  {loggedToday ? "Today logged — no zero day ✓" : "Nothing logged today yet"}
                </p>
                <p style={{ fontSize: "9px", color: "#2e2e2e", marginTop: "2px" }}>Even 5 minutes is non-zero. Never 2 zeros in a row.</p>
              </div>
            </div>

            <button onClick={resetWeek} style={{ marginTop: "12px", width: "100%", background: "none", border: "1px solid #161616", borderRadius: "4px", color: "#2e2e2e", padding: "9px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ↺  reset weekly counters (use on sunday)
            </button>
          </>
        )}

        {/* ROADMAP */}
        {tab === "phases" && (
          <>
            <p style={{ fontSize: "10px", color: "#444", marginBottom: "14px" }}>Tap a phase to set it as current.</p>
            {PHASES.map(p => {
              const active = data.currentPhase === p.id;
              return (
                <div key={p.id} onClick={() => setPhase(p.id)} style={{ ...S.card(active, p.color), cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: active ? p.color : "#252525", flexShrink: 0, marginTop: "6px" }} />
                      <div>
                        <p style={{ fontSize: "9px", color: active ? p.color : "#3a3a3a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "3px" }}>Phase {p.id} · {p.weeks}</p>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "14px", fontWeight: "700", color: active ? "#fff" : "#444" }}>{p.name}</p>
                      </div>
                    </div>
                    {active && <span style={{ fontSize: "8px", color: p.color, background: p.color + "18", padding: "3px 8px", borderRadius: "3px", flexShrink: 0, letterSpacing: "0.1em" }}>CURRENT</span>}
                  </div>
                  <p style={{ fontSize: "10px", color: active ? "#666" : "#3a3a3a", marginBottom: "8px", paddingLeft: "13px" }}>{p.goal}</p>
                  <div style={{ paddingLeft: "13px" }}>
                    {p.focus.map((f, i) => (
                      <p key={i} style={{ fontSize: "9px", color: active ? "#555" : "#2a2a2a", display: "flex", gap: "6px", marginBottom: "3px" }}>
                        <span style={{ color: active ? p.color : "#252525" }}>›</span>{f}
                      </p>
                    ))}
                  </div>
                  <div style={{ marginTop: "10px", paddingLeft: "13px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {METRICS.filter(m => p.targets[m.key] > 0).map(m => (
                      <span key={m.key} style={{ fontSize: "9px", color: active ? "#555" : "#252525", background: "#111", padding: "3px 7px", borderRadius: "3px" }}>
                        {m.icon} {p.targets[m.key]}/wk
                      </span>
                    ))}
                    {Object.values(p.targets).every(v => v === 0) && (
                      <span style={{ fontSize: "9px", color: active ? "#555" : "#252525" }}>on-the-job learning</span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ALL-TIME STATS */}
        {tab === "stats" && (
          <>
            <p style={{ fontSize: "10px", color: "#444", marginBottom: "14px" }}>Lifetime totals. These only go up.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
              {METRICS.map(m => (
                <div key={m.key} style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "16px" }}>
                  <p style={{ fontSize: "18px", marginBottom: "5px" }}>{m.icon}</p>
                  <p style={S.bigNum("#fff")}>{data.lifetime[m.key]}</p>
                  <p style={{ fontSize: "9px", color: "#3a3a3a", marginTop: "5px" }}>{m.label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "16px", marginBottom: "8px" }}>
              <p style={{ fontSize: "9px", color: "#3a3a3a", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "14px" }}>The Rules</p>
              {RULES.map(([icon, title, desc]) => (
                <div key={title} style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
                  <div>
                    <p style={{ fontSize: "11px", color: "#ccc", fontWeight: "600", marginBottom: "3px" }}>{title}</p>
                    <p style={{ fontSize: "9px", color: "#4a4a4a", lineHeight: "1.6" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "14px" }}>
              <p style={{ fontSize: "9px", color: "#3a3a3a", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "10px" }}>Timeline</p>
              <p style={{ fontSize: "9px", color: "#333", lineHeight: "1.8" }}>
                Started: {data.startDate}<br />
                Current week started: {data.weekStartDate}<br />
                Today: {today}<br />
                Last active: {data.lastActiveDate || "not yet"}<br />
                Last saved: {lastUpdated}<br />
                Phase {data.currentPhase}/4 · Week {weekNum} · Streak {data.streak} days
              </p>
            </div>

            <div style={{ background: "#0d0d0d", border: "1px solid #161616", borderRadius: "6px", padding: "14px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
                <p style={{ fontSize: "9px", color: "#3a3a3a", letterSpacing: "0.18em", textTransform: "uppercase" }}>Cloud Sync</p>
                <span style={{ fontSize: "8px", color: syncStatus === "synced" ? "#22c55e" : "#555", border: "1px solid #1f1f1f", borderRadius: "3px", padding: "3px 6px", textTransform: "uppercase" }}>{syncStatus}</span>
              </div>

              {!supabase && (
                <p style={{ fontSize: "9px", color: "#555", lineHeight: "1.6" }}>Add Supabase env vars in Vercel to enable cross-device sync.</p>
              )}

              {supabase && (
                <>
                  <button onClick={syncNow} style={{ width: "100%", background: "#161616", border: "1px solid #2a2a2a", borderRadius: "4px", color: "#aaa", padding: "9px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>
                    sync now
                  </button>
                  <button onClick={resetAll} style={{ width: "100%", background: "none", border: "1px solid #252525", borderRadius: "4px", color: "#777", padding: "9px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    reset all data
                  </button>
                </>
              )}

              {syncError && <p style={{ fontSize: "9px", color: "#f59e0b", lineHeight: "1.6", marginTop: "8px" }}>{syncError}</p>}
            </div>

            <button onClick={exportBackup} style={{ marginTop: "12px", width: "100%", background: "none", border: "1px solid #161616", borderRadius: "4px", color: "#555", padding: "9px", fontSize: "9px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              export backup
            </button>
          </>
        )}
      </div>
    </div>
  );
}
