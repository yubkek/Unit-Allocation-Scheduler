import React, { useEffect, useState } from "react";
import { getUnits, getSlots, getAllocations, createAllocation, deleteAllocation } from "./api";
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

function formatTimeRange(s) {
  return `${s.start_time} - ${s.end_time}`;
}

export default function App() {
  const [units, setUnits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [allocs, setAllocs] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
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

  useEffect(() => { loadAll(); }, []);

  // derive time rows: default show all 24 hourly rows, plus any extra slot times
  const timeRows = React.useMemo(() => {
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const start = String(h).padStart(2, "0") + ":00:00";
      const endHour = (h + 1) % 24;
      const end = String(endHour).padStart(2, "0") + ":00:00";
      rows.push({ start_time: start, end_time: end });
    }
    // include any slot times that don't match the hourly grid
    slots.forEach(s => {
      const exists = rows.some(r => r.start_time === s.start_time && r.end_time === s.end_time);
      if (!exists) rows.push({ start_time: s.start_time, end_time: s.end_time });
    });
    // sort by start_time (string sort works for HH:MM:SS)
    rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return rows;
  }, [slots]);

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

  // Helper to find allocations for given day and time row
  function cellAllocations(dayKey, row) {
    return allocs.filter(a => a.slot.day === dayKey && a.slot.start_time === row.start_time && a.slot.end_time === row.end_time);
  }

  return (
    <div className="page">
      <h1>Timetable Allocator (Mon–Sun)</h1>

      <section className="section">
        <h2>Create allocation</h2>

        <form onSubmit={handleAllocate}>
          <label className="form-group">
            Unit:
            <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}>
              <option value="">--select unit--</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            Slot:
            <select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)}>
              <option value="">--select slot--</option>
              {slots.map(s => (
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
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                {DAYS.map(d => (
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

                    {DAYS.map(d => (
                      <td key={d.key} className="day-cell">
                        {cellAllocations(d.key, row).length === 0 ? (
                          <small className="empty-slot">—</small>
                        ) : (
                          cellAllocations(d.key, row).map(a => (
                            <div key={a.id} className="alloc-card">
                              <strong>{a.unit.code}</strong>
                              {a.unit.name}

                              <div>
                                <button onClick={() => handleDelete(a.id)}>
                                  Unallocate
                                </button>
                              </div>
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
      )}
    </div>
  );
}
