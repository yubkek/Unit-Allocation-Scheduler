import React, { useEffect, useState } from "react";
import {
  getUnits,
  getSlots,
  getAllocations,
  createAllocation,
  deleteAllocation,
  getMe,
  getCsrf,
  login,
  logout,
} from "./api";
import "./App.css";

const DAYS = [
  { key: "Mon", label: "Mon" },
  { key: "Tue", label: "Tue" },
  { key: "Wed", label: "Wed" },
  { key: "Thu", label: "Thu" },
  { key: "Fri", label: "Fri" },
  { key: "Sat", label: "Sat" },
  { key: "Sun", label: "Sun" },
];

const TABS = [
  { id: "home", label: "Home" },
  { id: "allocate", label: "Allocate view" },
  { id: "timetable", label: "Timetable only view" },
];

function formatTimeRange(s) {
  return `${s.start_time} - ${s.end_time}`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  const [units, setUnits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [allocs, setAllocs] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(false);

  // --- AI suggestion UI state ---
  const [suggestionMode, setSuggestionMode] = useState("few-days");
  const [preferDays, setPreferDays] = useState([]); // days to load on (for 'load-specific')
  const [avoidDays, setAvoidDays] = useState([]); // days to avoid (for 'keep-out')
  const [suggestions, setSuggestions] = useState([]); // ranked slot objects

  // Scope: 'unit' = single-unit suggestions, 'global' = whole-timetable suggestions
  const [suggestionScope, setSuggestionScope] = useState("global");
  const [globalSuggestions, setGlobalSuggestions] = useState([]); // { unit, slot, score }[]



  const [signInUsername, setSignInUsername] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    // ensure CSRF cookie is present before any POSTs, then check auth
    getCsrf()
      .catch(() => {})
      .finally(() => {
        getMe()
          .then((u) => {
            setUser(u);
            setAuthCheckDone(true);
          })
          .catch(() => {
            setUser(null);
            setAuthCheckDone(true);
          });
      });
  }, []);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    try {
      const [u, s, a] = await Promise.all([getUnits(), getSlots(), getAllocations()]);
      setUnits(u);
      setSlots(s);
      setAllocs(a);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const timeRows = React.useMemo(() => {
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const start = String(h).padStart(2, "0") + ":00:00";
      const endHour = (h + 1) % 24;
      const end = String(endHour).padStart(2, "0") + ":00:00";
      rows.push({ start_time: start, end_time: end });
    }
    slots.forEach((s) => {
      const exists = rows.some(
        (r) => r.start_time === s.start_time && r.end_time === s.end_time
      );
      if (!exists) rows.push({ start_time: s.start_time, end_time: s.end_time });
    });
    rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return rows;
  }, [slots]);

  async function handleSignIn(e) {
    e.preventDefault();
    setSignInError("");
    try {
      await login(signInUsername.trim(), signInPassword);
      const u = await getMe();
      setUser(u);
      setSignInUsername("");
      setSignInPassword("");
    } catch (err) {
      const msg = err?.message || "";
      const isNetworkError =
        msg === "Failed to fetch" ||
        msg.includes("NetworkError") ||
        err?.name === "TypeError";
      setSignInError(
        isNetworkError
          ? "Could not reach the server. Is the Django backend running? (Run: python manage.py runserver in the backend folder, then open http://localhost:5173)"
          : msg || "Sign in failed."
      );
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      setUser(null);
      setActiveTab("home");
    } catch (err) {
      console.error(err);
      setUser(null);
    }
  }

  async function handleAllocate(e) {
    e.preventDefault();
    if (!selectedUnit || !selectedSlot) return;
    const occupied = new Set(allocs.map((a) => a.slot.id));
    if (occupied.has(Number(selectedSlot))) return alert("This slot is already occupied — cannot allocate (clash).");
    try {
      await createAllocation(Number(selectedUnit), Number(selectedSlot));
      await loadAll();
      setSelectedUnit("");
      setSelectedSlot("");
    } catch (err) {
      let msg = err.message || String(err);
      try { const j = JSON.parse(msg); msg = j.detail || Object.values(j).flat().join('; '); } catch(e){}
      alert("Allocation failed: " + msg);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this allocation?")) return;
    try {
      await deleteAllocation(id);
      await loadAll();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  }

  function cellAllocations(dayKey, row) {
    return allocs.filter(
      (a) =>
        a.slot.day === dayKey &&
        a.slot.start_time === row.start_time &&
        a.slot.end_time === row.end_time
    );
  }

  // Toggle helper used for day pickers
  function toggleDayInList(day, listSetter) {
    listSetter((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function togglePreferDay(day) {
    toggleDayInList(day, setPreferDays);
  }
  function toggleAvoidDay(day) {
    toggleDayInList(day, setAvoidDays);
  }

  // Generate simple client-side "AI" suggestions (ranked list of slots)
  function generateSuggestions() {
    // If user chose per-unit scope, require a selected unit.
    if (suggestionScope === "unit" && !selectedUnit) {
      alert("Select a unit first to generate suggestions.");
      return;
    }

    const DAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    const occupiedDays = Array.from(new Set(allocs.map((a) => a.slot.day)));
    const dayLoad = allocs.reduce((acc, a) => {
      acc[a.slot.day] = (acc[a.slot.day] || 0) + 1;
      return acc;
    }, {});

    // scoring helper (same logic used for per-unit and global)
    function scoreSlot(s) {
      const scoreParts = [];
      const dayIdx = DAY_INDEX[s.day];

      if (suggestionMode === "few-days") {
        scoreParts.push((dayLoad[s.day] || 0) * 2);
        scoreParts.push(occupiedDays.includes(s.day) ? 10 : 0);
      }

      const minDist = occupiedDays.length
        ? Math.min(...occupiedDays.map((d) => Math.abs(DAY_INDEX[d] - dayIdx)))
        : 7;
      if (suggestionMode === "spread") {
        scoreParts.push(minDist * 3);
        scoreParts.push(-(dayLoad[s.day] || 0));
      }

      if (suggestionMode === "mixed") {
        scoreParts.push((occupiedDays.includes(s.day) ? 6 : 0) + minDist);
      }

      if (suggestionMode === "load-specific") {
        scoreParts.push(preferDays.includes(s.day) ? 30 : 0);
        scoreParts.push(-(avoidDays.includes(s.day) ? 50 : 0));
      }

      if (avoidDays.includes(s.day)) scoreParts.push(-1000);
      const hour = Number(s.start_time.split(":")[0]) || 0;
      scoreParts.push(-Math.abs(12 - hour) * 0.1);
      return scoreParts.reduce((a, b) => a + b, 0);
    }

    // ---- GLOBAL (whole‑timetable) suggestions ----
    if (suggestionScope === "global") {
      const unallocatedUnits = units.filter((u) => !allocs.some((a) => a.unit.id === u.id));
      if (unallocatedUnits.length === 0) {
        alert("No unallocated units available for global suggestions.");
        return;
      }

      // build candidate lists per unit
      const occupiedSet = new Set(allocs.map((a) => a.slot.id));
      const candidatesPerUnit = unallocatedUnits.map((u) => {
        const candidates = slots
          .filter((s) => !avoidDays.includes(s.day) && !occupiedSet.has(s.id))
          .map((s) => ({ slot: s, score: scoreSlot(s) }))
          .sort((a, b) => b.score - a.score);
        return { unit: u, candidates };
      });

      // most-constrained-first: units with fewest candidates assigned first
      candidatesPerUnit.sort((a, b) => a.candidates.length - b.candidates.length);

      const assignedSlotIds = new Set();
      const results = [];
      for (const entry of candidatesPerUnit) {
        const pick = entry.candidates.find((c) => !assignedSlotIds.has(c.slot.id)) || entry.candidates[0] || null;
        if (pick) assignedSlotIds.add(pick.slot.id);
        results.push({ unit: entry.unit, slot: pick ? pick.slot : null, score: pick ? Math.round(pick.score * 10) / 10 : 0 });
      }

      setGlobalSuggestions(results);
      setSuggestions([]);
      return;
    }

    // ---- PER-UNIT suggestions (existing behavior) ----
    const occupiedSet = new Set(allocs.map((a) => a.slot.id));
    const candidates = slots
      .filter((s) => !avoidDays.includes(s.day) && !occupiedSet.has(s.id))
      .map((s) => ({ slot: s, score: scoreSlot(s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => ({ ...x.slot, _score: Math.round(x.score * 10) / 10 }));

    setSuggestions(candidates);
  }

  async function applySuggestion(s) {
    if (!selectedUnit) return alert("Select a unit first.");
    const occupied = new Set(allocs.map((a) => a.slot.id));
    if (occupied.has(Number(s.id))) return alert("Slot already occupied — cannot allocate (clash).");
    try {
      await createAllocation(Number(selectedUnit), Number(s.id));
      await loadAll();
      setSuggestions([]);
      setSelectedSlot("");
    } catch (err) {
      // try to parse JSON error bodies for clearer messages
      let msg = err.message || String(err);
      try {
        const j = JSON.parse(msg);
        msg = j.detail || Object.values(j).flat().join("; ");
      } catch (e) {
        /* not JSON */
      }
      alert("Allocation failed: " + msg);
    }
  }

  async function applyTopSuggestion() {
    if (!suggestions.length) return;
    await applySuggestion(suggestions[0]);
  }

  function clearSuggestions() {
    setSuggestions([]);
  }

  if (!authCheckDone) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Timetable Allocator</h1>
        <section className="section sign-in-section">
          <h2>Sign in</h2>
          <form onSubmit={handleSignIn}>
            <label className="sign-in-form">
              Username:
              <input
                type="text"
                value={signInUsername}
                onChange={(e) => setSignInUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="sign-in-form">
              Password:
              <input
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" style={{ marginTop: "20px", padding: "12px" }}>Sign in</button>
            {signInError && <p className="sign-in-error">{signInError}</p>}
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="app-header">
        <h1>Timetable Allocator</h1>
        <div className="header-actions">
          <span className="user-name">{user.username}</span>
          <button type="button" className="sign-out-btn" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`tab ${activeTab === t.id ? "tab-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "home" && (
        <section className="section">
          <h2>Home</h2>
          <p>Welcome, {user.username}. Use the tabs above to allocate units to slots or view the timetable.</p>
        </section>
      )}

      {activeTab === "allocate" && (
        <>
          <section className="section">
            <h2>Create allocation</h2>
            <form onSubmit={handleAllocate}>
              <label className="form-group">
                Unit:
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                >
                  <option value="">--select unit--</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                Slot:
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                >
                  <option value="">--select slot--</option>
                  {(() => {
                    const occupied = new Set(allocs.map((a) => a.slot.id));
                    return slots.map((s) => (
                      <option key={s.id} value={s.id} disabled={occupied.has(s.id)}>
                        {s.day} {s.start_time}-{s.end_time}{occupied.has(s.id) ? " (occupied)" : ""}
                      </option>
                    ));
                  })()}
                </select>
              </label>
              <button type="submit">Allocate</button>
            </form>

            <div className="ai-panel" style={{marginTop:20}}>
              <h3>AI suggestions</h3>

              <div className="ai-scope" style={{marginBottom:8}}>
                <label style={{marginRight:12}}><input type="radio" name="ai-scope" value="unit" checked={suggestionScope==="unit"} onChange={() => setSuggestionScope("unit")} /> Per‑unit</label>
                <label><input type="radio" name="ai-scope" value="global" checked={suggestionScope==="global"} onChange={() => setSuggestionScope("global")} /> Whole timetable</label>
              </div>

              <div className="ai-options">
                <label><input type="radio" name="ai-mode" value="few-days" checked={suggestionMode==="few-days"} onChange={() => setSuggestionMode("few-days")} /> Fewest days (grouped)</label>
                <label><input type="radio" name="ai-mode" value="spread" checked={suggestionMode==="spread"} onChange={() => setSuggestionMode("spread")} /> Spread out (as far apart as possible)</label>
                <label><input type="radio" name="ai-mode" value="mixed" checked={suggestionMode==="mixed"} onChange={() => setSuggestionMode("mixed")} /> Mixed</label>
                <label><input type="radio" name="ai-mode" value="load-specific" checked={suggestionMode==="load-specific"} onChange={() => setSuggestionMode("load-specific")} /> Load on specific days</label>
                <label><input type="radio" name="ai-mode" value="avoid-specific" checked={suggestionMode==="avoid-specific"} onChange={() => setSuggestionMode("avoid-specific")} /> Keep specific days out</label>
              </div>

              {(suggestionMode === "load-specific" || suggestionMode === "avoid-specific") && (
                <div className="ai-days">
                  {DAYS.map((d) => (
                    <label key={d.key} className="ai-day-toggle">
                      <input
                        type="checkbox"
                        checked={preferDays.includes(d.key) || avoidDays.includes(d.key)}
                        onChange={() => {
                          if (suggestionMode === "load-specific") togglePreferDay(d.key);
                          else toggleAvoidDay(d.key);
                        }}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              )}

              <div className="ai-actions">
                <button type="button" onClick={generateSuggestions}>Show suggestions</button>
                <button type="button" onClick={applyTopSuggestion} disabled={!suggestions.length}>Apply top suggestion</button>
                <button type="button" onClick={clearSuggestions} disabled={!suggestions.length}>Clear suggestions</button>
              </div>

              {suggestionScope === "unit" && suggestions.length > 0 && (
                <div className="suggestion-list">
                  {suggestions.map((s) => (
                    <div key={s.id} className="suggestion-item">
                      <div className="suggestion-info">
                        <strong>{s.day} {s.start_time.replace(/:00:00$/, '')} - {s.end_time.replace(/:00:00$/, '')}</strong>
                        <div className="suggestion-meta">score: {s._score}</div>
                      </div>
                      <div className="suggestion-actions">
                        <button type="button" onClick={() => { setSelectedSlot(String(s.id)); }}>Select</button>
                        <button type="button" onClick={() => applySuggestion(s)} disabled={allocs.some(a => a.slot.id === s.id)}>{allocs.some(a => a.slot.id === s.id) ? 'Occupied' : 'Allocate'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {suggestionScope === "global" && globalSuggestions.length > 0 && (
                <div className="suggestion-list">
                  {globalSuggestions.map((g) => (
                    <div key={g.unit.id} className="suggestion-item">
                      <div className="suggestion-info">
                        <strong>{g.unit.code} → {g.slot ? `${g.slot.day} ${g.slot.start_time.replace(/:00:00$/, '')}` : '—'}</strong>
                        <div className="suggestion-meta">score: {g.score}</div>
                      </div>
                      <div className="suggestion-actions">
                        <button type="button" onClick={() => { setSelectedUnit(String(g.unit.id)); }}>Select unit</button>
                        <button type="button" onClick={async () => {
                          if (!g.slot) return alert('No slot suggested for this unit');
                          const occupiedNow = allocs.some(a => a.slot.id === g.slot.id);
                          if (occupiedNow) return alert('Slot is now occupied — cannot allocate.');
                          try {
                            await createAllocation(g.unit.id, g.slot.id);
                            await loadAll();
                            setGlobalSuggestions((prev) => prev.filter((x) => x.unit.id !== g.unit.id));
                          } catch (err) {
                            let msg = err.message || String(err);
                            try { const j = JSON.parse(msg); msg = j.detail || Object.values(j).flat().join('; '); } catch(e){}
                            alert('Allocation failed: ' + msg);
                          }
                        }} disabled={!g.slot}>Allocate</button>
                      </div>
                    </div>
                  ))}

                  <div style={{marginTop:8}}>
                    <button type="button" onClick={async () => {
                      if (!globalSuggestions.length) return;
                      if (!confirm('Create allocations for all suggested units?')) return;
                      const failures = [];
                      for (const g of globalSuggestions) {
                        if (!g.slot) { failures.push(`${g.unit.code}: no suggestion`); continue; }
                        if (allocs.some(a => a.slot.id === g.slot.id)) { failures.push(`${g.unit.code}: slot occupied`); continue; }
                        try {
                          await createAllocation(g.unit.id, g.slot.id);
                        } catch (err) {
                          let msg = err.message || String(err);
                          try { const j = JSON.parse(msg); msg = j.detail || Object.values(j).flat().join('; '); } catch(e){}
                          failures.push(`${g.unit.code}: ${msg}`);
                        }
                      }
                      await loadAll();
                      setGlobalSuggestions([]);
                      if (failures.length) alert('Some allocations failed:\n' + failures.join('\n'));
                    }}>Apply all suggestions</button>
                    <button type="button" onClick={() => setGlobalSuggestions([])} style={{marginLeft:8}}>Clear</button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {loading ? (
            <p>Loading timetable...</p>
          ) : (
            <Timetable
              timeRows={timeRows}
              cellAllocations={cellAllocations}
              onUnallocate={handleDelete}
              showUnallocate
              slots={slots}
              suggestedSlotIds={(suggestionScope === 'global' ? globalSuggestions.map(g => g.slot && g.slot.id).filter(Boolean) : suggestions.map((s) => s.id))}
              previewSuggestions={(suggestionScope === 'global' ? globalSuggestions.map(g => ({ slotId: g.slot && g.slot.id, unitCode: g.unit.code })) : [])}
            />
          )}
        </>
      )} 

      {activeTab === "timetable" && (
        <>
          {loading ? (
            <p>Loading timetable...</p>
          ) : (
            <Timetable
              timeRows={timeRows}
              cellAllocations={cellAllocations}
              slots={slots}
              suggestedSlotIds={(suggestionScope === 'global' ? globalSuggestions.map(g => g.slot && g.slot.id).filter(Boolean) : suggestions.map((s) => s.id))}
              previewSuggestions={(suggestionScope === 'global' ? globalSuggestions.map(g => ({ slotId: g.slot && g.slot.id, unitCode: g.unit.code })) : [])}
              showUnallocate={false}
            />
          )}
        </>
      )} 
    </div>
  );
}

function Timetable({ timeRows, cellAllocations, onUnallocate, showUnallocate, slots = [], suggestedSlotIds = [], previewSuggestions = [] }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {DAYS.map((d) => (
              <th key={d.key}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeRows.length === 0 ? (
            <tr>
              <td colSpan={8}>No slots available.</td>
            </tr>
          ) : (
            timeRows.map((row, idx) => (
              <tr key={idx}>
                <td className="time-cell">{formatTimeRange(row)}</td>
                {DAYS.map((d) => {
                  const slotForCell = slots.find(
                    (s) => s.day === d.key && s.start_time === row.start_time && s.end_time === row.end_time
                  );
                  const isSuggested = slotForCell && suggestedSlotIds.includes(slotForCell.id);
                  const previews = slotForCell ? previewSuggestions.filter((p) => p.slotId === slotForCell.id) : [];
                  return (
                    <td key={d.key} className={`day-cell ${isSuggested ? "suggested-cell" : ""}`}>
                      {isSuggested && <div className="suggestion-badge">AI</div>}
                      {previews.map((p) => (
                        <div key={p.unitCode} className="preview-card">{p.unitCode} (suggested)</div>
                      ))}

                      {cellAllocations(d.key, row).length === 0 ? (
                        <small className="empty-slot">—</small>
                      ) : (
                        cellAllocations(d.key, row).map((a) => (
                          <div key={a.id} className="alloc-card">
                            <strong>{a.unit.code}</strong>
                            {a.unit.name}
                            {showUnallocate && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => onUnallocate(a.id)}
                                >
                                  Unallocate
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
