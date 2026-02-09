import React, { useEffect, useState } from "react";
import {
  getUnits,
  getSlots,
  getAllocations,
  createAllocation,
  deleteAllocation,
  getMe,
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

  const [signInUsername, setSignInUsername] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState("");

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setAuthCheckDone(true);
      })
      .catch(() => {
        setUser(null);
        setAuthCheckDone(true);
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
    try {
      await createAllocation(Number(selectedUnit), Number(selectedSlot));
      await loadAll();
      setSelectedUnit("");
      setSelectedSlot("");
    } catch (err) {
      alert("Allocation failed: " + err.message);
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
                  {slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.day} {s.start_time}-{s.end_time}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Allocate</button>
            </form>
          </section>
          {loading ? (
            <p>Loading timetable...</p>
          ) : (
            <Timetable
              timeRows={timeRows}
              cellAllocations={cellAllocations}
              onUnallocate={handleDelete}
              showUnallocate
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
              showUnallocate={false}
            />
          )}
        </>
      )}
    </div>
  );
}

function Timetable({ timeRows, cellAllocations, onUnallocate, showUnallocate }) {
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
                {DAYS.map((d) => (
                  <td key={d.key} className="day-cell">
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
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
