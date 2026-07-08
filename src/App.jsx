import { useState, useEffect, useRef, useMemo, useCallback } from "react";

/* ─── Theme ─── */
const RED = "#e8302a";
const CARD_BG = "#2a2a2d";
const SCREEN_BG = "#1c1c1e";
const SURFACE = "#232326";
const BORDER = "#3a3a3d";
const TEXT = "#ffffff";
const DIM = "#8e8e93";
const BADGE_BG = "#3d1a1a";

/* ─── Constants ─── */
const SK = "ironweek-v6";
const DB_NAME = "apex-db";
const DB_VERSION = 1;
const DB_STORE = "appdata";

/* ── IndexedDB helpers ── */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch { return undefined; }
}

async function idbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const req = tx.objectStore(DB_STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

/* ── Migrate from localStorage to IndexedDB on first run ── */
async function migrateFromLocalStorage() {
  try {
    const existing = await idbGet(SK);
    if (existing) return; // already migrated
    const old = localStorage.getItem(SK);
    if (old) {
      await idbSet(SK, JSON.parse(old));
      localStorage.removeItem(SK); // clean up old storage
    }
  } catch {}
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function fmtNum(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtKg(n) {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}t`;
  return `${Math.round(n).toLocaleString()} kg`;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}


function makeId() { return Math.random().toString(36).slice(2, 9); }

function ex(name, sets, reps, opts = {}) {
  return {
    id: makeId(), name, sets: String(sets), reps: String(reps),
    weight: opts.weight || "", unit: opts.unit || "kg",
    timedSets: !!opts.timedSets, duration: opts.duration || "", rest: opts.rest || "",
    useRir: false, rir: "", useIntensity: !!opts.intensity, intensity: opts.intensity || "",
    useTempo: !!opts.tempo, tempo: opts.tempo || "",
    note: opts.note || "", supersetId: opts.ss || null, last: null
  };
}

/* ── 3-month demo seeder ── */
function buildDemoData() {
  const PUSH_EXERCISES = [
    { name: "Bench Press", baseWeight: 80 },
    { name: "Incline Dumbbell Press", baseWeight: 28 },
    { name: "Overhead Press", baseWeight: 50 },
    { name: "Cable Fly", baseWeight: 14 },
    { name: "Tricep Pushdown", baseWeight: 22 },
    { name: "Lateral Raise", baseWeight: 10 },
  ];
  const PULL_EXERCISES = [
    { name: "Barbell Row", baseWeight: 70 },
    { name: "Pull-ups", baseWeight: 0 },
    { name: "Lat Pulldown", baseWeight: 55 },
    { name: "Cable Row", baseWeight: 60 },
    { name: "Dumbbell Curl", baseWeight: 16 },
    { name: "Face Pull", baseWeight: 18 },
  ];
  const LEGS_EXERCISES = [
    { name: "Back Squat", baseWeight: 100 },
    { name: "Romanian Deadlift", baseWeight: 80 },
    { name: "Leg Press", baseWeight: 140 },
    { name: "Bulgarian Split Squat", baseWeight: 30 },
    { name: "Leg Curl", baseWeight: 45 },
    { name: "Calf Raise", baseWeight: 60 },
  ];
  const FULL_EXERCISES = [
    { name: "Trap Bar Deadlift", baseWeight: 110 },
    { name: "Dumbbell Lunges", baseWeight: 22 },
    { name: "Box Jump", baseWeight: 0 },
    { name: "Farmers Carry", baseWeight: 32 },
    { name: "Plank", baseWeight: 0 },
    { name: "Ab Wheel Rollout", baseWeight: 0 },
  ];

  const DAY_TEMPLATES = [
    { label: "Push", pool: PUSH_EXERCISES },
    { label: "Pull", pool: PULL_EXERCISES },
    { label: "Legs", pool: LEGS_EXERCISES },
    { label: "Full Body", pool: FULL_EXERCISES },
  ];

  const days = DAY_TEMPLATES.map(tmpl => {
    const shuffled = [...tmpl.pool].sort(() => Math.random() - 0.5).slice(0, 5);
    return {
      id: makeId(),
      label: tmpl.label,
      exercises: shuffled.map(e => ({
        id: makeId(), name: e.name,
        sets: "4", reps: "8",
        weight: e.baseWeight > 0 ? String(e.baseWeight) : "",
        unit: "kg", useRir: false, rir: "", useIntensity: false, intensity: "",
        useTempo: false, tempo: "", note: "", supersetId: null, last: null
      }))
    };
  });

  const program = { name: "APEX Demo", days };
  const logs = [];
  const now = new Date();
  const WEEKS = 13;
  const weekOffsets = [1, 2, 4, 6];

  for (let week = 0; week < WEEKS; week++) {
    const progress = week / (WEEKS - 1);
    weekOffsets.forEach((dayOffset, sessionIdx) => {
      const sessionDate = new Date(now);
      sessionDate.setDate(sessionDate.getDate() - (WEEKS - 1 - week) * 7 + dayOffset - 6);
      if (sessionDate > now) return;
      const dateStr = sessionDate.toISOString().slice(0, 10);
      const day = days[sessionIdx % days.length];

      const exercises = day.exercises.map(e => {
        const base = parseFloat(e.weight) || 0;
        const gain = base > 0 ? base * 0.12 * progress + (Math.random() - 0.4) * (base * 0.02) : 0;
        const weight = base > 0 ? Math.round((base + gain) * 2) / 2 : 0;
        const reps = 8 + Math.floor(progress * 3) + (Math.random() > 0.7 ? 1 : 0);
        const sets = 4;
        const loggedSets = Array.from({ length: sets }, (_, si) => ({
          reps: String(reps - (si === sets - 1 && Math.random() > 0.6 ? 1 : 0)),
          weight: weight > 0 ? String(weight) : "",
          unit: "kg",
          done: true
        }));
        return {
          name: e.name, sets: String(sets), reps: String(reps),
          weight: weight > 0 ? String(weight) : "", unit: "kg",
          rir: "", intensity: "", tempo: "", note: "", loggedSets
        };
      });

      if (sessionDate > now) return;
      logs.push({ id: uid(), date: dateStr, dayId: day.id, dayLabel: day.label, exercises, simulated: true });
    });
  }

  return { program, logs, lastLogged: {} };
}

function defaultData() {
  return { program: { name: "My Program", days: [] }, logs: [], lastLogged: {} };
}

function loadData() {
  // Synchronous initial load — returns default, IndexedDB loads async in App
  return defaultData();
}

async function loadDataAsync() {
  try {
    await migrateFromLocalStorage();
    const p = await idbGet(SK);
    if (p) {
      if (!p.lastLogged) p.lastLogged = {};
      if (!p.logs) p.logs = [];
      if (!p.program) p.program = { name: "My Program", days: [] };
      return cleanApexNotes(p);
    }
  } catch {}
  return defaultData();
}
function saveData(d) { idbSet(SK, d); } // async, fire-and-forget

function cleanApexNotes(data) {
  // Strip "Added by Apex" notes older than 7 days
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...data,
    program: {
      ...data.program,
      days: (data.program?.days || []).map(day => ({
        ...day,
        exercises: day.exercises.map(e => {
          if (!e.note || !e.note.startsWith("Added by Apex")) return e;
          const match = e.note.match(/expires (\d{4}-\d{2}-\d{2})/);
          if (match && match[1] < today) return { ...e, note: "" };
          return e;
        })
      }))
    }
  };
}

function blankExercise() {
  return {
    id: uid(), name: "", sets: "", reps: "", weight: "", unit: "kg",
    timedSets: false, duration: "", rest: "",
    useRir: false, rir: "", useIntensity: false, intensity: "",
    useTempo: false, tempo: "", note: "", supersetId: null
  };
}

/* ── Badge assignment ── */
function assignBadges(exercises) {
  const groupOrder = [], seen = {};
  exercises.forEach(e => {
    const key = e.supersetId || e.id;
    if (seen[key] === undefined) { seen[key] = groupOrder.length; groupOrder.push(key); }
  });
  return exercises.map(e => {
    const key = e.supersetId || e.id;
    const gi = seen[key];
    const letter = String.fromCharCode(65 + gi);
    const siblings = exercises.filter(x => (x.supersetId || x.id) === key);
    const li = siblings.indexOf(e);
    return { ...e, badge: `${letter}${li + 1}`, groupKey: key, inSuperset: !!e.supersetId };
  });
}

function getGroups(badged) {
  const out = [], seen = new Set();
  badged.forEach(e => {
    if (!seen.has(e.groupKey)) {
      seen.add(e.groupKey);
      const items = badged.filter(x => x.groupKey === e.groupKey);
      out.push({ key: e.groupKey, items, isSuperset: items.some(x => x.inSuperset) });
    }
  });
  return out;
}

/* ── Toast ── */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = "info") => {
    setToast({ msg, type, id: uid() });
    setTimeout(() => setToast(null), 2500);
  }, []);
  return { toast, show };
}

function Toast({ toast }) {
  if (!toast) return null;
  const bg = toast.type === "success" ? "#2a7a2a" : toast.type === "error" ? RED : SURFACE;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: bg, color: "#fff", fontSize: 13, fontWeight: 600,
      padding: "10px 20px", borderRadius: 20, zIndex: 300,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      animation: "fadeInUp 0.2s ease",
      whiteSpace: "nowrap"
    }}>
      {toast.msg}
    </div>
  );
}

/* ════════════════════════════════
   ROOT APP
════════════════════════════════ */
export default function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("home");
  const [activeDayId, setActiveDayId] = useState(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  const { toast, show: showToast } = useToast();

  // Load from IndexedDB on mount
  useEffect(() => {
    loadDataAsync().then(d => {
      setData(d);
      setDbLoaded(true);
    });
  }, []);

  // Save to IndexedDB whenever data changes (after initial load)
  useEffect(() => { if (dbLoaded) saveData(data); }, [data, dbLoaded]);


  const program = data.program;

  function openExercisePage(dayId) {
    setActiveDayId(dayId);
    setPage("exercise");
  }

  function updateProgram(fn) {
    setData(prev => ({ ...prev, program: fn({ ...prev.program }) }));
  }

  function setDayCount(n) {
    updateProgram(prog => {
      const current = prog.days;
      if (n > current.length) {
        const extra = Array.from({ length: n - current.length }, (_, i) => ({
          id: uid(), label: `Day ${current.length + i + 1}`, exercises: []
        }));
        return { ...prog, days: [...current, ...extra] };
      }
      if (n < current.length) {
        const willLose = current.slice(n).filter(d => d.exercises.length > 0);
        if (willLose.length > 0) {
          const names = willLose.map(d => d.label).join(", ");
          const ok = window.confirm(`Reducing to ${n} days will permanently delete:\n\n${names}\n\nAre you sure?`);
          if (!ok) return prog;
        }
        return { ...prog, days: current.slice(0, n) };
      }
      return prog;
    });
  }

  // Used by the workout importer: grows the program's day list (if the
  // pasted program has more days than currently exist) AND places every
  // parsed exercise into the right day, all in one atomic state update.
  // Doing this in two separate steps (add days, then add exercises) would
  // race — the newly created day IDs wouldn't exist yet when we tried to
  // add exercises into them.
  function importParsedProgram(parsedGroups, singleTargetDayId) {
    const DAY_COUNT_SAFETY_MAX = 14;
    updateProgram(prog => {
      let newDays = [...prog.days];
      const neededDays = Math.min(parsedGroups.length, DAY_COUNT_SAFETY_MAX);
      if (neededDays > newDays.length) {
        const extra = Array.from({ length: neededDays - newDays.length }, (_, i) => ({
          id: uid(), label: `Day ${newDays.length + i + 1}`, exercises: []
        }));
        newDays = [...newDays, ...extra];
      }
      parsedGroups.forEach((group, groupIdx) => {
        const dayLabelWords = (group.dayLabel || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matchedDay = newDays.find(d => {
          const dl = d.label.toLowerCase();
          return dayLabelWords.some(w => dl.includes(w));
        });
        let targetDay = matchedDay;
        if (!targetDay) {
          targetDay = (parsedGroups.length === 1 && singleTargetDayId)
            ? (newDays.find(d => d.id === singleTargetDayId) || newDays[0])
            : (newDays[groupIdx] || newDays[newDays.length - 1]);
        }
        if (!targetDay) return;
        const labelToId = {};
        const newExercises = group.exercises.map(e => {
          let supersetId = null;
          if (e.supersetLabel) {
            if (!labelToId[e.supersetLabel]) labelToId[e.supersetLabel] = uid();
            supersetId = labelToId[e.supersetLabel];
          }
          return { id: Math.random().toString(36).slice(2, 9), name: e.name, sets: String(e.sets || 3), reps: String(e.reps || "8"), weight: "", unit: "kg", useRir: false, rir: "", useIntensity: false, intensity: "", useTempo: false, tempo: "", rest: e.rest ? String(e.rest) : "", note: e.note || "", supersetId };
        });
        newDays = newDays.map(d => d.id === targetDay.id ? { ...d, exercises: [...d.exercises, ...newExercises] } : d);
      });
      return { ...prog, days: newDays };
    });
  }

  function addExerciseToDay(dayId, ex) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => d.id === dayId ? { ...d, exercises: [...d.exercises, ex] } : d)
    }));
  }

  function updateExerciseInDay(dayId, exId, patch) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => d.id !== dayId ? d : {
        ...d, exercises: d.exercises.map(e => e.id === exId ? { ...e, ...patch } : e)
      })
    }));
  }

  function deleteExerciseFromDay(dayId, exId) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => d.id !== dayId ? d : {
        ...d, exercises: d.exercises.filter(e => e.id !== exId)
      })
    }));
  }

  function clearDayExercises(dayId) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => d.id !== dayId ? d : { ...d, exercises: [] })
    }));
  }

  function toggleSupersetInDay(dayId, exId) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => {
        if (d.id !== dayId) return d;
        const list = [...d.exercises];
        const idx = list.findIndex(e => e.id === exId);
        if (idx < 0) return d;
        const e = list[idx];
        if (e.supersetId) {
          list[idx] = { ...e, supersetId: null };
        } else {
          // FIX: Guard against no previous exercise
          const prev = idx > 0 ? list[idx - 1] : null;
          const groupId = prev ? (prev.supersetId || prev.id + "_ss") : uid();
          if (prev && !prev.supersetId) list[idx - 1] = { ...prev, supersetId: groupId };
          list[idx] = { ...e, supersetId: groupId };
        }
        return { ...d, exercises: list };
      })
    }));
  }

  function reorderExercisesInDay(dayId, fromIdx, toIdx) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => {
        if (d.id !== dayId) return d;
        const list = [...d.exercises];
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        return { ...d, exercises: list };
      })
    }));
    showToast("Exercise reordered", "success");
  }

  function addExerciseToSuperset(dayId, supersetId, ex) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => {
        if (d.id !== dayId) return d;
        const list = [...d.exercises];
        let insertAt = list.length;
        for (let i = list.length - 1; i >= 0; i--) {
          if ((list[i].supersetId || list[i].id + "_ss") === supersetId ||
            list[i].supersetId === supersetId) {
            insertAt = i + 1;
            break;
          }
        }
        const newEx = { ...ex, id: uid(), supersetId };
        list.splice(insertAt, 0, newEx);
        return { ...d, exercises: list };
      })
    }));
  }

  function renameDayLabel(dayId, label) {
    updateProgram(prog => ({
      ...prog,
      days: prog.days.map(d => d.id === dayId ? { ...d, label } : d)
    }));
  }

  function logWorkout(dayId, sessionNote = "") {
    const day = program.days.find(d => d.id === dayId);
    if (!day) return;
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = day.exercises.map(e => ({
      name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, unit: e.unit,
      timedSets: !!e.timedSets, duration: e.duration || "", rest: e.rest || "",
      rir: e.useRir ? e.rir : "", intensity: e.useIntensity ? e.intensity : "",
      tempo: e.useTempo ? e.tempo : "", note: e.note, loggedSets: e.loggedSets || []
    }));
    const newLast = { ...data.lastLogged };
    day.exercises.forEach(e => {
      newLast[`${dayId}_${e.id}`] = {
        sets: e.sets, reps: e.reps, weight: e.weight, unit: e.unit,
        loggedSets: e.loggedSets || []
      };
    });
    const entry = { id: uid(), date: today, dayId, dayLabel: day.label, exercises: snapshot, sessionNote: sessionNote.trim() };
    setData(prev => ({ ...prev, logs: [...prev.logs, entry], lastLogged: newLast }));
    return true;
  }

  function deleteLogEntry(logId) {
    setData(prev => ({ ...prev, logs: prev.logs.filter(l => l.id !== logId) }));
  }

  // FIX: Guard against missing day
  const activeDay = program.days.find(d => d.id === activeDayId) || null;

  if (page === "program") {
    return (
      <>
        <ProgramPage
          program={program}
          onBack={() => setPage("home")}
          onSetDayCount={setDayCount}
          onImportProgram={importParsedProgram}
          onAddExercise={addExerciseToDay}
          onUpdateExercise={updateExerciseInDay}
          onDeleteExercise={deleteExerciseFromDay}
          onClearDay={clearDayExercises}
          onToggleSuperset={toggleSupersetInDay}
          onRenameDay={renameDayLabel}
          onReorder={reorderExercisesInDay}
          onAddToSuperset={addExerciseToSuperset}
          showToast={showToast}
        />
        <Toast toast={toast} />
      </>
    );
  }

  if (page === "exercise") {
    // FIX: Guard against undefined day
    if (!activeDay && program.days.length > 0) {
      setActiveDayId(program.days[0].id);
      return null;
    }
    if (!activeDay) {
      return (
        <div style={s.root}>
          <div style={s.header}>
            <button style={s.backBtn} onClick={() => setPage("home")}>‹</button>
            <span style={s.headerTitle}>Exercise</span>
          </div>
          <div style={s.empty}>
            <div style={s.emptyText}>No program days found</div>
            <div style={s.emptyHint}>Set up a program first</div>
          </div>
        </div>
      );
    }
    return (
      <>
        <ExercisePage
          day={activeDay}
          allDays={program.days}
          lastLogged={data.lastLogged}
          onBack={() => setPage("home")}
          onSelectDay={id => setActiveDayId(id)}
          onUpdateExercise={(exId, patch) => updateExerciseInDay(activeDayId, exId, patch)}
          onLog={(note) => logWorkout(activeDayId, note)}
          onSaveLastDate={(dayId, date) => setData(prev => ({
            ...prev,
            lastLogged: { ...prev.lastLogged, [`${dayId}_lastDate`]: date }
          }))}
          showToast={showToast}
        />
        <Toast toast={toast} />
      </>
    );
  }

  if (page === "progress") {
    return (
      <>
        <ProgressPage logs={data.logs} program={data.program} onBack={() => setPage("home")} onAddExercise={addExerciseToDay} onDeleteExercise={deleteExerciseFromDay} onUpdateExercise={updateExerciseInDay} onDeleteLog={deleteLogEntry} />
        <Toast toast={toast} />
      </>
    );
  }



  return (
    <>
      <HomePage
        program={program}
        onProgram={() => setPage("program")}
        onExercise={() => {
          const hasEx = program.days.some(d => d.exercises.length > 0);
          if (hasEx) { setActiveDayId(program.days[0].id); setPage("exercise"); }
          else { setPage("program"); showToast("Build your program first", "error"); }
        }}
        onProgress={() => setPage("progress")}
      />
      <Toast toast={toast} />
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes reorderFlash {
          0%   { background: rgba(232,48,42,0.15); }
          100% { background: transparent; }
        }
      `}</style>
    </>
  );
}

/* ════════════════════════════════
   HOME PAGE
════════════════════════════════ */
function HomePage({ program, onProgram, onExercise, onProgress }) {
  const dayCount = program.days.length;
  const hasExercises = program.days.some(d => d.exercises.length > 0);
  return (
    <div style={s.root}>
      <div style={s.homeWrap}>
        <div style={s.homeTitleBlock}>
          <div style={s.homeLogoLine}>
            <span style={s.homeLogoRed}>APEX</span>
          </div>
          <div style={s.homeSubtitle}>Your personal training log</div>
          <div style={s.homeDivider} />
        </div>
        <div style={s.homeCards}>
          <button style={s.homeCard} onClick={onProgram}>
            <div style={s.homeCardLeft}>
              <div>
                <div style={{ ...s.homeCardLabel, color: RED }}>Program</div>
                <div style={s.homeCardDesc}>
                  {dayCount > 0 ? `${dayCount}-day program · tap to edit` : "Build your workout program"}
                </div>
              </div>
            </div>
            <div style={s.homeCardArrow}>›</div>
          </button>
          <button style={{ ...s.homeCard, ...(hasExercises ? {} : s.homeCardDim) }} onClick={onExercise}>
            <div style={s.homeCardLeft}>
              <div>
                <div style={{ ...s.homeCardLabel, color: RED }}>Exercise</div>
                <div style={s.homeCardDesc}>
                  {hasExercises ? "Log today's sets, reps & weight" : "Build your program to get started"}
                </div>
              </div>
            </div>
            <div style={s.homeCardArrow}>›</div>
          </button>
          <button style={s.homeCard} onClick={onProgress}>
            <div style={s.homeCardLeft}>
              <div>
                <div style={{ ...s.homeCardLabel, color: RED }}>Progress</div>
                <div style={s.homeCardDesc}>View your logged workout history</div>
              </div>
            </div>
            <div style={s.homeCardArrow}>›</div>
          </button>

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   PROGRAM PAGE
════════════════════════════════ */
function ProgramPage({ program, onBack, onSetDayCount, onImportProgram, onAddExercise, onUpdateExercise,
  onDeleteExercise, onClearDay, onToggleSuperset, onRenameDay, onReorder, onAddToSuperset, showToast }) {

  const [activeIdx, setActiveIdx] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [addToSupersetId, setAddToSupersetId] = useState(null);
  const [draft, setDraft] = useState(blankExercise());
  const [nameError, setNameError] = useState(false); // FIX: inline validation error
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [recentlyReordered, setRecentlyReordered] = useState(null);
  const scrollRef = useRef(null);

  const days = program.days;
  const activeDay = days[activeIdx] || null;

  // FIX: Memoize expensive badge/group computations
  const badged = useMemo(() => activeDay ? assignBadges(activeDay.exercises) : [], [activeDay?.exercises]);
  const groups = useMemo(() => getGroups(badged), [badged]);

  function handleAdd() {
    if (!draft.name.trim() || !activeDay) {
      setNameError(true); // FIX: Show error instead of silent disable
      return;
    }
    if (addToSupersetId) {
      onAddToSuperset(activeDay.id, addToSupersetId, draft);
    } else {
      onAddExercise(activeDay.id, { ...draft, id: uid() });
    }
    setDraft(blankExercise()); setShowForm(false); setAddToSupersetId(null); setNameError(false);
    showToast("Exercise added", "success");
  }

  function handleSaveEdit() {
    if (!activeDay) return;
    onUpdateExercise(activeDay.id, editId, editDraft);
    setEditId(null); setEditDraft(null);
    showToast("Exercise updated", "success");
  }

  function saveLabelEdit() {
    if (labelVal.trim()) onRenameDay(activeDay.id, labelVal.trim());
    setEditingLabel(false);
  }

  const touchItem = useRef(null);

  function onDragStart(idx, e) { setDragIdx(idx); }
  function onDragOver(idx, e) { e.preventDefault(); if (dragIdx !== null && idx !== dragOverIdx) setDragOverIdx(idx); }
  function onDrop(idx) {
    if (dragIdx === null || dragIdx === idx || !activeDay) return;
    onReorder(activeDay.id, dragIdx, idx);
    setRecentlyReordered(idx);
    setTimeout(() => setRecentlyReordered(null), 600);
    setDragIdx(null); setDragOverIdx(null);
  }
  function onDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  function onTouchStart(idx, e) { touchItem.current = { idx, startY: e.touches[0].clientY }; setDragIdx(idx); }
  function onTouchMove(e) {
    if (!touchItem.current) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const row = el?.closest("[data-exidx]");
    if (row) {
      const over = parseInt(row.getAttribute("data-exidx"));
      if (!isNaN(over)) setDragOverIdx(over);
    }
  }
  function onTouchEnd() {
    if (touchItem.current !== null && dragOverIdx !== null && dragOverIdx !== touchItem.current.idx && activeDay) {
      onReorder(activeDay.id, touchItem.current.idx, dragOverIdx);
      setRecentlyReordered(dragOverIdx);
      setTimeout(() => setRecentlyReordered(null), 600);
    }
    touchItem.current = null;
    setDragIdx(null); setDragOverIdx(null);
  }

  const DAY_COUNT_MAX = 14; // supports multi-week rotations, not just a calendar week

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹</button>
        <span style={s.headerTitle}>Program Builder</span>
        <button style={ip.importBtn} onClick={() => setShowImport(true)} title="Import workout from text">
          <span style={ip.importPlus}>+</span>
        </button>
      </div>

      <div style={s.progSection}>
        <div style={s.progSectionLabel}>Number of days</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={s.dayCountBtn}
            onClick={() => { const n = Math.max(1, days.length - 1); onSetDayCount(n); setActiveIdx(Math.min(activeIdx, n - 1)); }}>
            −
          </button>
          <span style={{ fontSize: 14, color: TEXT, fontWeight: 600, minWidth: 72, textAlign: "center" }}>
            {days.length} day{days.length === 1 ? "" : "s"}
          </span>
          <button style={s.dayCountBtn}
            onClick={() => { const n = Math.min(DAY_COUNT_MAX, days.length + 1); onSetDayCount(n); }}>
            +
          </button>
        </div>
      </div>

      {days.length === 0 && (
        <div style={{ ...s.empty, paddingTop: 40 }}>
          <div style={s.emptyText}>Use the stepper above to set your number of days</div>
        </div>
      )}

      {days.length > 0 && (
        <>
          <div style={s.tabBar}>
            {days.map((d, i) => (
              <button key={d.id} style={{ ...s.tab, ...(i === activeIdx ? s.tabActive : {}) }}
                onClick={() => { setActiveIdx(i); setShowForm(false); setEditId(null); setAddToSupersetId(null); }}>
                <span style={{ ...s.tabText, ...(i === activeIdx ? s.tabTextActive : {}) }}>{d.label}</span>
                {d.exercises.length > 0 && (
                  <span style={{ ...s.tabDot, ...(i === activeIdx ? s.tabDotActive : {}) }}>{d.exercises.length}</span>
                )}
                {i === activeIdx && <div style={s.tabUnderline} />}
              </button>
            ))}
          </div>

          <div style={s.dayLabelRow}>
            {editingLabel ? (
              <div style={s.dayLabelEdit}>
                <input style={{ ...s.input, flex: 1 }} value={labelVal}
                  onChange={e => setLabelVal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveLabelEdit()} autoFocus />
                <button style={s.labelSaveBtn} onClick={saveLabelEdit}>Save</button>
              </div>
            ) : (
              <div style={s.dayLabelStatic}>
                <span style={s.dayLabelText}>{activeDay?.label}</span>
                <button style={s.labelEditBtn} onClick={() => { setLabelVal(activeDay.label); setEditingLabel(true); }}>Rename</button>
                {activeDay?.exercises.length > 0 && (
                  <button
                    style={{ ...s.labelEditBtn, color: RED, marginLeft: "auto" }}
                    onClick={() => {
                      const ok = window.confirm(`Delete all ${activeDay.exercises.length} exercise${activeDay.exercises.length === 1 ? "" : "s"} in "${activeDay.label}"? This can't be undone.`);
                      if (ok) onClearDay(activeDay.id);
                    }}>
                    Delete all
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={s.scroll} ref={scrollRef} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            {groups.length === 0 && !showForm && (
              <div style={{ ...s.empty, paddingTop: 40 }}>
                <div style={s.emptyText}>No exercises yet</div>
                <div style={s.emptyHint}>Tap + Add Exercise to build this day</div>
              </div>
            )}

            {groups.map(group => (
              <div key={group.key} style={s.supersetWrap}>
                <div style={s.supersetPillWrap}>
                  <div style={s.supersetLine} />
                  <div style={{ ...s.supersetPill, background: group.isSuperset ? RED : "#333" }}>
                    {group.isSuperset ? "Superset" : "Exercise"}
                  </div>
                  <div style={s.supersetLine} />
                </div>
                {/* FIX: More visible superset card with left accent border */}
                <div style={{
                  ...s.groupCard,
                  borderColor: group.isSuperset ? "rgba(232,48,42,0.35)" : "rgba(255,255,255,0.06)",
                  borderLeft: group.isSuperset ? `3px solid ${RED}` : `1px solid rgba(255,255,255,0.06)`,
                }}>
                  {group.items.map((ex, i) => {
                    const globalIdx = badged.findIndex(b => b.id === ex.id);
                    const isDragging = dragIdx === globalIdx;
                    const isDragOver = dragOverIdx === globalIdx;
                    const wasReordered = recentlyReordered === globalIdx;
                    return (
                      <div key={ex.id}
                        data-exidx={globalIdx}
                        draggable
                        onDragStart={e => onDragStart(globalIdx, e)}
                        onDragOver={e => onDragOver(globalIdx, e)}
                        onDrop={() => onDrop(globalIdx)}
                        onDragEnd={onDragEnd}
                        onTouchStart={e => onTouchStart(globalIdx, e)}
                        style={{
                          opacity: isDragging ? 0.35 : 1,
                          borderTop: isDragOver && !isDragging ? `2px solid ${RED}` : "none",
                          transition: "opacity 0.15s",
                          // FIX: Flash animation on successful reorder
                          animation: wasReordered ? "reorderFlash 0.6s ease" : "none",
                        }}>
                        {editId === ex.id ? (
                          <ExerciseForm draft={editDraft} onChange={setEditDraft}
                            onSave={handleSaveEdit}
                            onCancel={() => { setEditId(null); setEditDraft(null); }}
                            title="EDIT EXERCISE" saveLabel="Save" />
                        ) : (
                          <ProgramExRow ex={ex}
                            showDivider={i < group.items.length - 1}
                            onEdit={() => { setEditId(ex.id); setEditDraft({ ...ex }); }}
                            onDelete={() => onDeleteExercise(activeDay.id, ex.id)}
                            onToggleSuperset={() => onToggleSuperset(activeDay.id, ex.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {group.isSuperset && (
                    <div style={pr.addToSsWrap}>
                      <button style={pr.addToSsBtn} onClick={() => {
                        setAddToSupersetId(group.key); setShowForm(true); setEditId(null);
                        setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
                      }}>
                        <span style={pr.addToSsPlus}>+</span> Add to this superset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {showForm && (
              <div style={s.formWrap}>
                <div style={s.formCard}>
                  {addToSupersetId && (
                    <div style={pr.addToSsBanner}>
                      Adding to superset ·{" "}
                      <button style={pr.addToSsClear} onClick={() => setAddToSupersetId(null)}>
                        Change to standalone ✕
                      </button>
                    </div>
                  )}
                  <ExerciseForm draft={draft} onChange={v => { setDraft(v); if (v.name.trim()) setNameError(false); }}
                    onSave={handleAdd}
                    onCancel={() => { setShowForm(false); setDraft(blankExercise()); setAddToSupersetId(null); setNameError(false); }}
                    title={addToSupersetId ? "ADD TO SUPERSET" : "NEW EXERCISE"}
                    saveLabel={addToSupersetId ? "Add to Superset" : "Add to Program"}
                    nameError={nameError} />
                </div>
              </div>
            )}

            {!showForm && (
              <button style={s.addExBtn} onClick={() => { setAddToSupersetId(null); setShowForm(true); setEditId(null); }}>
                + Add Exercise
              </button>
            )}
            <div style={{ height: 40 }} />
          </div>
        </>
      )}

      {showImport && (
        <ImportWorkoutPage
          days={days}
          onClose={() => setShowImport(false)}
          onImportProgram={onImportProgram}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// Helper wrapper to avoid prop name collision
function ProgramExRowWrapper({ ex, showDivider, onEdit, onDeleteExercise, onToggleSuperset, dayId }) {
  return <ProgramExRow ex={ex} showDivider={showDivider} onEdit={onEdit}
    onDelete={() => onDeleteExercise(dayId, ex.id)}
    onToggleSuperset={() => onToggleSuperset(dayId, ex.id)} />;
}

/* ════════════════════════════════
   GEMINI AI HELPER
   Shared by the workout importer and the progress insight report.
   - Local dev: calls Google's Gemini API directly (needs VITE_GEMINI_API_KEY).
   - Production: calls our own /api/gemini serverless function, which should
     hold the real GEMINI_API_KEY server-side and proxy the request.
   Returns the model's raw text response, or throws an Error. Rate-limit
   errors are marked with err.isRateLimit = true so callers can retry.
════════════════════════════════ */
const GEMINI_MODEL = "gemini-flash-latest";

async function callGeminiAI(prompt, { maxTokens = 2000, temperature = 0.3 } = {}) {
  const isLocal = import.meta.env.DEV;
  const url = isLocal
    ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
    : "/api/gemini";
  const headers = { "Content-Type": "application/json" };
  if (isLocal) headers["x-goog-api-key"] = import.meta.env.VITE_GEMINI_API_KEY;

  // Local dev talks to Gemini's native shape. In production, /api/gemini can
  // either proxy that same shape through, or accept this simplified
  // { prompt, maxTokens, temperature } body and return { text } — both are
  // handled below.
  const body = isLocal
    ? { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingLevel: "low" } } }
    : { prompt, maxTokens, temperature };

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await resp.json();

  if (data.error) {
    const errObj = typeof data.error === "string" ? { message: data.error } : data.error;
    const msg = errObj.message || "Gemini request failed";
    const isRateLimit = resp.status === 429 || errObj.status === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
    const err = new Error(msg);
    err.isRateLimit = isRateLimit;
    // Google returns the precise wait time in error.details, as a
    // RetryInfo entry like { "@type": ".../RetryInfo", "retryDelay": "34s" }.
    const retryInfo = Array.isArray(errObj.details)
      ? errObj.details.find(d => typeof d.retryDelay === "string")
      : null;
    if (retryInfo) {
      const parsedDelay = parseFloat(retryInfo.retryDelay); // e.g. "34s" -> 34
      if (!isNaN(parsedDelay)) err.retryDelaySeconds = parsedDelay;
    }
    throw err;
  }

  const text = data.text
    ?? data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("")
    ?? "";

  if (!text) {
    const err = new Error("Gemini returned an empty response");
    throw err;
  }
  return text;
}

function sleepMs(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ════════════════════════════════
   IMPORT WORKOUT PAGE
════════════════════════════════ */
function ImportWorkoutPage({ days, onClose, onImportProgram, showToast }) {
  const [tab, setTab] = useState("paste");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(null); // { current, total }
  const [retryStatus, setRetryStatus] = useState(null); // live text shown during rate-limit backoff
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [targetDayId, setTargetDayId] = useState(days[0]?.id || null);

  // Split pasted text into per-day chunks so each AI call stays small
  // enough to avoid truncated/incomplete JSON responses.
  function splitIntoDayChunks(fullText) {
    const DAY_WORDS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const lines = fullText.split("\n");
    const chunks = [];
    let current = [];
    let sawHeader = false;
    for (const line of lines) {
      const upper = line.trim().toUpperCase();
      const isHeader = DAY_WORDS.some(w => upper.startsWith(w));
      if (isHeader) {
        if (current.length) chunks.push(current.join("\n"));
        current = [line];
        sawHeader = true;
      } else {
        current.push(line);
      }
    }
    if (current.length) chunks.push(current.join("\n"));
    // If we never found day headers, treat the whole paste as one chunk.
    return sawHeader ? chunks.filter(c => c.trim().length > 0) : [fullText];
  }

  async function analyseChunk(chunkText, attempt = 0) {
    const prompt = `You are a fitness expert. Extract workout data from the text below and return ONLY a valid JSON array with no explanation or markdown.
Each element: { "dayLabel": string, "exercises": [{ "name": string, "sets": number, "reps": string, "rest": number, "note": string, "supersetLabel": string|null }] }

Rules for filling these in:
- "rest" is the rest time IN SECONDS. Convert any written time to seconds (e.g. "90s" → 90, "2 min" → 120). If a range is given (e.g. "2–3 min"), use the midpoint rounded to the nearest 5 seconds (e.g. 150). If a rest time is only given once for a whole block of exercises (e.g. "⏱ 2–3 min rest between supersets" written above several exercises, or "rest 90s between exercises" as a warmup-level note), apply that same rest value to every exercise in that block unless a specific exercise overrides it.
- "supersetLabel" marks exercises that are performed as a true superset (back-to-back, alternating, sharing one rest period) — this is ONLY when the text explicitly groups them under a heading containing the word "Superset" (e.g. "Superset 1", "Superset 2A", "Superset 3 • Core Stability"). Use that exact heading text as the label so exercises under the same heading share the same label string. Do NOT invent a supersetLabel for warmups, finishers, or any plain numbered list that isn't headed "Superset" — those are just sequential exercises, so leave supersetLabel null for them even though they're grouped under a heading.
- "note" should capture short qualifiers that don't fit elsewhere: tempo notation (e.g. "3-0-1 tempo"), hold times (e.g. "2s squeeze", "10s hold"), or "to failure"/"each side" style modifiers. Keep it to a few words. Don't restate the sets/reps/rest here.
- If a rep count is a range (e.g. "8–10"), keep it as written in "reps" (as a string), don't average it.

Group by day if multiple days appear in this text. If no day name is mentioned use "Imported Workout".
Text: ${chunkText}`;
    const MAX_AUTO_WAIT_SECONDS = 20; // don't silently wait longer than this per retry
    let raw;
    try {
      raw = await callGeminiAI(prompt, { maxTokens: 6000, temperature: 0.2 });
    } catch (err) {
      if (err.isRateLimit) {
        // If Google is asking for a long cooldown, your quota is likely
        // substantially used up — waiting it out automatically would just
        // hang the UI with no feedback. Fail fast with the real number
        // instead of silently sleeping for a long time.
        if (err.retryDelaySeconds && err.retryDelaySeconds > MAX_AUTO_WAIT_SECONDS) {
          throw new Error(`rate-limited — Gemini asked for a ${Math.round(err.retryDelaySeconds)}s cooldown. Try again shortly, or check your quota at aistudio.google.com`);
        }
        if (attempt < 4) {
          const jitter = Math.random() * 800;
          const waitSeconds = err.retryDelaySeconds || (attempt + 1) * 5;
          const waitMs = Math.ceil(waitSeconds * 1000) + 500 + jitter;
          setRetryStatus(`rate limited, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/4)...`);
          await sleepMs(waitMs);
          setRetryStatus(null);
          return analyseChunk(chunkText, attempt + 1);
        }
        throw new Error("hit Gemini's rate limit repeatedly — wait a minute and try again with fewer days at once");
      }
      throw err;
    }
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
    if (s === -1 || e === -1 || e <= s) {
      throw new Error("didn't return recognizable JSON");
    }
    try {
      return JSON.parse(cleaned.slice(s, e + 1));
    } catch {
      throw new Error("returned an incomplete response");
    }
  }

  async function handleAnalyse() {
    if (!text.trim()) return;
    setParsing(true);
    setParseError(null);
    setParsed(null);
    setParseProgress(null);
    setRetryStatus(null);
    const chunks = splitIntoDayChunks(text);
    const allResults = [];
    const failedChunks = [];
    const CONCURRENCY = 2; // run a couple days at once — free-tier RPM is tight (often ~10-15/min)
    let completed = 0;
    try {
      for (let batchStart = 0; batchStart < chunks.length; batchStart += CONCURRENCY) {
        const batch = chunks.slice(batchStart, batchStart + CONCURRENCY);
        const batchResults = await Promise.allSettled(batch.map(chunk => analyseChunk(chunk)));
        batchResults.forEach((res, bi) => {
          const chunkIdx = batchStart + bi;
          completed++;
          if (chunks.length > 1) setParseProgress({ current: completed, total: chunks.length });
          if (res.status === "fulfilled") {
            allResults.push(...res.value);
          } else {
            // Keep going on other days even if one chunk fails, and report
            // which day(s) failed at the end rather than losing everything.
            const firstLine = chunks[chunkIdx].split("\n")[0].trim().slice(0, 40) || `section ${chunkIdx + 1}`;
            failedChunks.push(`${firstLine} (${res.reason?.message || "failed"})`);
          }
        });
        // Small gap between batches (not between every single request) so we
        // don't trip Gemini's per-minute rate limit.
        if (batchStart + CONCURRENCY < chunks.length) await sleepMs(1200);
      }
      if (allResults.length === 0) {
        throw new Error(failedChunks.length ? failedChunks.join("; ") : "No exercises were found in the pasted text.");
      }
      setParsed(allResults);
      setTab("preview");
      if (failedChunks.length) {
        showToast(`Some sections couldn't be read: ${failedChunks.join(", ")}`, "error");
      }
    } catch (err) {
      setParseError(`Could not analyse: ${err.message}`);
    } finally {
      setParsing(false);
      setParseProgress(null);
      setRetryStatus(null);
    }
  }

  function handleAdd() {
    if (!parsed) return;
    const DAY_COUNT_SAFETY_MAX = 14;
    const neededDays = Math.min(parsed.length, DAY_COUNT_SAFETY_MAX);
    const willAddDays = neededDays > days.length ? neededDays - days.length : 0;
    const added = parsed.reduce((sum, g) => sum + g.exercises.length, 0);
    onImportProgram(parsed, targetDayId);
    if (willAddDays > 0) {
      showToast(`Added ${added} exercises across ${parsed.length} days (created ${willAddDays} new day${willAddDays === 1 ? "" : "s"} to fit)`, "success");
    } else {
      showToast(`Added ${added} exercises to your program`, "success");
    }
    onClose();
  }

  const totalEx = parsed?.reduce((s, g) => s + g.exercises.length, 0) || 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: SCREEN_BG, zIndex: 100, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onClose}>✕</button>
        <span style={s.headerTitle}>Import Workout</span>
        <span style={{ width: 32 }} />
      </div>
      <div style={s.subTabBar}>
        <button style={{ ...s.subTab, ...(tab==="paste" ? s.subTabActive : {}) }} onClick={() => setTab("paste")}>Paste</button>
        <button style={{ ...s.subTab, ...(tab==="preview" ? s.subTabActive : {}), opacity: parsed ? 1 : 0.4 }} onClick={() => parsed && setTab("preview")}>
          Preview{parsed ? ` · ${totalEx}` : ""}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "paste" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Paste your workout text</div>
            <textarea style={ip.textarea} value={text} onChange={e => setText(e.target.value)} placeholder={`Paste anything — coach notes, Reddit programs, WhatsApp messages... Example: Push Day / Bench Press 4x8 rest 3min / Incline DB Press 3x10 rest 90s`} rows={10} />
            <div style={ip.hintCard}>
              <div style={ip.hintTitle}>What Apex can read</div>
              <div style={ip.hintText}>Sets, reps, rest times, exercise names, day names, tempos, notes — paste any format and Apex figures it out.</div>
            </div>
            {parseError && <div style={{ fontSize: 13, color: "#ff6b6b" }}>{parseError}</div>}
            {retryStatus && <div style={{ fontSize: 12, color: "#a78bfa" }}>{retryStatus}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btnCancel} onClick={onClose}>Cancel</button>
              <button style={{ ...s.btnSave, opacity: (!text.trim() || parsing) ? 0.5 : 1 }} onClick={handleAnalyse} disabled={!text.trim() || parsing}>
                {parsing ? (parseProgress ? `Analysing day ${parseProgress.current}/${parseProgress.total}...` : "Analysing...") : "Analyse ›"}
              </button>
            </div>
          </div>
        )}
        {tab === "preview" && parsed && (
          <div>
            <div style={{ fontSize: 12, color: DIM, marginBottom: 14 }}>Found <span style={{ color: TEXT, fontWeight: 700 }}>{parsed.length} day{parsed.length!==1?"s":""}</span> · <span style={{ color: TEXT, fontWeight: 700 }}>{totalEx} exercises</span></div>
            {parsed.map((group, gi) => (
              <div key={gi} style={{ ...s.groupCard, borderColor: "rgba(232,48,42,0.35)", borderLeft: `3px solid ${RED}`, marginBottom: 12 }}>
                <div style={{ background: "rgba(232,48,42,0.08)", padding: "8px 14px", margin: "0 -14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: RED }} />
                  <span style={{ fontSize: 12, color: RED, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{group.dayLabel}</span>
                  <span style={{ fontSize: 11, color: DIM, marginLeft: "auto" }}>{group.exercises.length} exercises</span>
                </div>
                {group.exercises.map((ex, ei) => {
                  const prevLabel = ei > 0 ? group.exercises[ei - 1].supersetLabel : null;
                  const startsNewSuperset = ex.supersetLabel && ex.supersetLabel !== prevLabel;
                  return (
                    <div key={ei}>
                      {startsNewSuperset && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: ei > 0 ? 10 : 4, marginBottom: 2 }}>
                          <span style={{ background: RED, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, letterSpacing: "0.04em", textTransform: "uppercase" }}>{ex.supersetLabel}</span>
                          <div style={{ flex: 1, height: 1, background: RED, opacity: 0.25 }} />
                        </div>
                      )}
                      <div style={{
                        padding: "10px 0", borderBottom: ei < group.exercises.length-1 ? `1px solid ${BORDER}` : "none",
                        paddingLeft: ex.supersetLabel ? 10 : 0,
                        borderLeft: ex.supersetLabel ? `2px solid rgba(232,48,42,0.3)` : "none",
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 5 }}>{ex.name}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {ex.sets && ex.reps && <span style={s.statPill}>{ex.sets} × {ex.reps}</span>}
                          {ex.rest > 0 && <span style={{ ...s.statPill, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)" }}>Rest {ex.rest}s</span>}
                          {ex.note && <span style={s.statPill}>{ex.note}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {days.length > 1 && parsed.length === 1 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: DIM, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Add to day</div>
                {days.map(d => (
                  <button key={d.id} style={{ ...ip.dayPickerBtn, ...(targetDayId===d.id ? ip.dayPickerBtnOn : {}), marginBottom: 6 }} onClick={() => setTargetDayId(d.id)}>
                    {d.label}{targetDayId===d.id && <span style={{ color: RED, marginLeft: "auto" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btnCancel} onClick={() => setTab("paste")}>‹ Edit</button>
              <button style={s.btnSave} onClick={handleAdd}>Add to Program</button>
            </div>
            <div style={{ height: 24 }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Import styles */
const ip = {
  importBtn: { width: 32, height: 32, borderRadius: "50%", background: RED, border: "none", color: "#fff", fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 },
  importPlus: { fontSize: 22, fontWeight: 300, lineHeight: 1 },
  textarea: { width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, color: TEXT, fontSize: 13, padding: "12px 14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none", lineHeight: 1.6, minHeight: 200 },
  hintCard: { background: "#111", borderRadius: 10, padding: "10px 14px", border: `1px solid ${BORDER}` },
  hintTitle: { fontSize: 11, color: RED, fontWeight: 700, marginBottom: 4, letterSpacing: "0.04em" },
  hintText: { fontSize: 12, color: DIM, lineHeight: 1.5 },
  dayPickerBtn: { width: "100%", background: CARD_BG, border: `1px solid ${BORDER}`, color: DIM, fontSize: 13, fontWeight: 600, padding: "11px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center" },
  dayPickerBtnOn: { border: `1px solid ${RED}`, color: TEXT, background: "rgba(232,48,42,0.08)" },
};


function ProgramExRow({ ex, showDivider, onEdit, onDelete, onToggleSuperset }) {
  const [confirm, setConfirm] = useState(false);
  const pills = [
    ex.sets && `Sets: ${ex.sets}`,
    ex.timedSets
      ? ex.duration && `${ex.duration}s per set`
      : ex.reps && `Reps: ${ex.reps}`,
    ex.timedSets && ex.rest && `Rest: ${ex.rest}s`,
    ex.useRir && ex.rir && `RIR: ${ex.rir}`,
    ex.useIntensity && ex.intensity && `Intensity: ${ex.intensity}`,
    ex.useTempo && ex.tempo && `Tempo: ${ex.tempo}`,
  ].filter(Boolean);

  return (
    <div>
      <div style={s.exRow}>
        <div style={s.exTopRow}>
          <span style={pr.dragHandle} title="Drag to reorder" aria-label="Drag handle">⠿</span>
          <span style={s.exName}>{ex.name || "Untitled"}</span>
          <span style={s.badgePill}>{ex.badge}</span>
        </div>
        {pills.length > 0 && (
          <div style={s.exStats}>
            {pills.map((p, i) => <span key={i} style={s.statPill}>{p}</span>)}
          </div>
        )}
        {ex.note && <div style={s.exNote}>{ex.note}</div>}
        {confirm ? (
          <div style={s.confirmRow}>
            <span style={s.confirmMsg}>Remove exercise?</span>
            <button style={s.confirmNo} onClick={() => setConfirm(false)}>No</button>
            <button style={s.confirmYes} onClick={onDelete}>Delete</button>
          </div>
        ) : (
          <div style={s.exActions}>
            <button style={s.actionBtn} onClick={onEdit}>Edit</button>
            <button style={{ ...s.actionBtn, color: "#aaa" }} onClick={onToggleSuperset}>
              {ex.inSuperset ? "Split off" : "+ Superset"}
            </button>
            <button style={{ ...s.actionBtn, color: RED }} onClick={() => setConfirm(true)}>Delete</button>
          </div>
        )}
      </div>
      {showDivider && <div style={s.divider} />}
    </div>
  );
}

const pr = {
  dragHandle: { fontSize: 18, color: "#333", cursor: "grab", marginRight: 8, userSelect: "none", flexShrink: 0, lineHeight: 1 },
  addToSsWrap: { borderTop: `1px dashed #2a2a2e`, margin: "0 -14px", padding: "0 14px" },
  addToSsBtn: { width: "100%", background: "none", border: "none", color: RED, fontSize: 12, fontWeight: 600, padding: "9px 0", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" },
  addToSsPlus: { width: 18, height: 18, borderRadius: "50%", background: RED, color: "#fff", fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  addToSsBanner: { fontSize: 11, color: RED, marginBottom: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  addToSsClear: { background: "none", border: "none", color: DIM, fontSize: 11, cursor: "pointer", padding: 0, fontFamily: "inherit" },
};

/* ════════════════════════════════
   EXERCISE PAGE
════════════════════════════════ */
function ExercisePage({ day, allDays, lastLogged, onBack, onSelectDay, onUpdateExercise, onLog, showToast, onSaveLastDate }) {
  const [showNotes, setShowNotes] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [logged, setLogged] = useState(false);
  const [workoutActive, setWorkoutActive] = useState(false); // true once first set is marked done
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingDayId, setPendingDayId] = useState(null); // day user tried to switch to
  const [showCancelConfirm, setShowCancelConfirm] = useState(false); // top-right X confirm

  function discardLoggedSets() {
    exercises.forEach(e => {
      if (e.loggedSets && e.loggedSets.length > 0) onUpdateExercise(e.id, { loggedSets: [] });
    });
  }

  function handleDaySwitch(dayId) {
    if (dayId === day.id) return;
    if (workoutActive) {
      // Locked onto this day while a workout is active — confirm before leaving.
      setPendingDayId(dayId);
      setShowDiscardConfirm(true);
      return;
    }
    onSelectDay(dayId);
  }

  function handleDiscard() {
    discardLoggedSets();
    setWorkoutActive(false);
    setShowDiscardConfirm(false);
    if (pendingDayId) {
      onSelectDay(pendingDayId);
      setPendingDayId(null);
    }
  }

  function handleCancelWorkout() {
    discardLoggedSets();
    setWorkoutActive(false);
    setShowCancelConfirm(false);
  }
  const noteRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const scrollRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  // Auto-clear sets when day changes or date changes
  useEffect(() => {
    if (!day) return;
    const lastLoggedDate = lastLogged[`${day.id}_lastDate`] || null;
    if (lastLoggedDate !== today) {
      // New day — clear all logged sets
      day.exercises.forEach(e => {
        if (e.loggedSets && e.loggedSets.length > 0) {
          onUpdateExercise(e.id, { loggedSets: [] });
        }
      });
      setWorkoutActive(false);
    }
  }, [day?.id, today]);

  const exercises = day?.exercises || [];
  const badged = useMemo(() => assignBadges(exercises), [exercises]);
  const groups = useMemo(() => getGroups(badged), [badged]);

  const currentIdx = allDays.findIndex(d => d.id === day?.id);

  function swipeToDay(dir) {
    const nextIdx = currentIdx + dir;
    if (nextIdx >= 0 && nextIdx < allDays.length) {
      handleDaySwitch(allDays[nextIdx].id);
    }
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only trigger if horizontal swipe is dominant and more than 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipeToDay(dx < 0 ? 1 : -1);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }

  function handleLog() {
    setShowNotes(true);
    setTimeout(() => noteRef.current?.focus(), 100);
  }

  function handleSaveNote() {
    onLog(sessionNote);
    if (onSaveLastDate) onSaveLastDate(day.id, today); // remember sets were logged today, so they aren't wiped on return
    setShowNotes(false);
    setSessionNote("");
    setLogged(true);
    setWorkoutActive(false); // unlock — done logging, free to switch days again

    setTimeout(() => setLogged(false), 2200);
  }

  function handleSkipNote() {
    onLog("");
    if (onSaveLastDate) onSaveLastDate(day.id, today); // remember sets were logged today, so they aren't wiped on return
    setShowNotes(false);
    setSessionNote("");
    setLogged(true);
    setWorkoutActive(false); // unlock — done logging, free to switch days again

    setTimeout(() => setLogged(false), 2200);
  }

  // FIX: Guard against missing day (already guarded in App, but belt+suspenders)
  if (!day) {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={onBack}>‹</button>
          <span style={s.headerTitle}>Exercise</span>
        </div>
        <div style={s.empty}>
          <div style={s.emptyText}>Day not found</div>
          <div style={s.emptyHint}>Please go back and select a valid day</div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹</button>
        <span style={s.headerTitle}>{day.label}</span>
        {workoutActive ? (
          <button style={ex_s.cancelXBtn} onClick={() => setShowCancelConfirm(true)} aria-label="Cancel workout" title="Cancel workout">✕</button>
        ) : (
          <span style={{ width: 32 }} />
        )}
      </div>

      <div style={s.tabBar}>
        {allDays.map(d => (
          <button key={d.id}
            style={{ ...s.tab, ...(d.id === day.id ? s.tabActive : {}) }}
            onClick={() => handleDaySwitch(d.id)}>
            <span style={{ ...s.tabText, ...(d.id === day.id ? s.tabTextActive : {}) }}>{d.label}</span>
            {d.id === day.id && <div style={s.tabUnderline} />}
          </button>
        ))}
      </div>

      {/* Workout active banner */}
      {workoutActive && (
        <div style={ex_s.activeBanner}>
          <div style={ex_s.activeBannerDot} />
          <span style={ex_s.activeBannerText}>Workout in progress</span>
          <button style={ex_s.activeBannerFinish} onClick={handleLog}>Finish</button>
        </div>
      )}

      {/* Discard confirm modal (switching days mid-workout) */}
      {showDiscardConfirm && (
        <div style={ex_s.noteOverlay}>
          <div style={ex_s.noteModal}>
            <div style={ex_s.noteTitle}>Active Workout</div>
            <div style={ex_s.noteSub}>You have sets logged. Switch days and discard progress?</div>
            <div style={ex_s.noteActions}>
              <button style={ex_s.noteSkipBtn} onClick={() => { setShowDiscardConfirm(false); setPendingDayId(null); }}>Stay</button>
              <button style={{ ...ex_s.noteSaveBtn, background: "#7a1a1a" }} onClick={handleDiscard}>Discard & Switch</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal (top-right red X) */}
      {showCancelConfirm && (
        <div style={ex_s.noteOverlay}>
          <div style={ex_s.noteModal}>
            <div style={ex_s.noteTitle}>Cancel Workout?</div>
            <div style={ex_s.noteSub}>Are you sure? This will discard everything logged this session.</div>
            <div style={ex_s.noteActions}>
              <button style={ex_s.noteSkipBtn} onClick={() => setShowCancelConfirm(false)}>No</button>
              <button style={{ ...ex_s.noteSaveBtn, background: "#7a1a1a" }} onClick={handleCancelWorkout}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      <div style={sw.swipeHintRow}>
        {currentIdx > 0
          ? <span style={sw.swipeHint}>‹ {allDays[currentIdx - 1]?.label}</span>
          : <span />}
        {currentIdx < allDays.length - 1
          ? <span style={{ ...sw.swipeHint, textAlign: "right" }}>{allDays[currentIdx + 1]?.label} ›</span>
          : <span />}
      </div>

      <div style={s.sectionLabel}>Today's Workout</div>

      <div style={s.scroll} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} ref={scrollRef}>
        {exercises.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyText}>No exercises for {day.label}</div>
            <div style={s.emptyHint}>Add exercises in the Program page first</div>
          </div>
        )}

        {groups.map(group => (
          <div key={group.key} style={s.supersetWrap}>
            <div style={s.supersetPillWrap}>
              <div style={s.supersetLine} />
              <div style={{ ...s.supersetPill, background: group.isSuperset ? RED : "#333" }}>
                {group.isSuperset ? "Superset" : "Exercise"}
              </div>
              <div style={s.supersetLine} />
            </div>
            <div style={{
              ...s.groupCard,
              borderColor: group.isSuperset ? "rgba(232,48,42,0.35)" : "rgba(255,255,255,0.06)",
              borderLeft: group.isSuperset ? `3px solid ${RED}` : `1px solid rgba(255,255,255,0.06)`,
            }}>
              {group.items.map((ex, i) => {
                const lastKey = `${day.id}_${ex.id}`;
                const last = lastLogged[lastKey] || null;
                return (
                  <div key={ex.id}>
                    <LogExRow
                      ex={ex} last={last}
                      showDivider={i < group.items.length - 1}
                      onUpdate={patch => onUpdateExercise(ex.id, patch)}
                      onSetActive={() => setWorkoutActive(true)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ height: 110 }} />
      </div>

      <div style={s.logBar}>
        <button
          style={{ ...s.logBtn, ...(logged ? s.logBtnSuccess : {}) }}
          onClick={workoutActive ? handleLog : () => setWorkoutActive(true)}
          disabled={showNotes}>
          {logged ? "✓ Workout Logged!" : (workoutActive ? "Log This Workout" : "Start Workout")}
        </button>
      </div>

      {/* Session notes modal */}
      {showNotes && (
        <div style={ex_s.noteOverlay}>
          <div style={ex_s.noteModal}>
            <div style={ex_s.noteTitle}>How did it go?</div>
            <div style={ex_s.noteSub}>Add a note for this session — optional</div>
            <textarea
              ref={noteRef}
              style={ex_s.noteInput}
              value={sessionNote}
              onChange={e => setSessionNote(e.target.value)}
              placeholder="e.g. Felt strong today, shoulder a bit tight on press..."
              rows={4}
            />
            <div style={ex_s.noteActions}>
              <button style={ex_s.noteSkipBtn} onClick={handleSkipNote}>Skip</button>
              <button style={ex_s.noteSaveBtn} onClick={handleSaveNote}>Save & Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ExercisePage swipe styles */
const sw = {
  swipeHintRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 16px 0", height: 24 },
  swipeHint: { fontSize: 11, color: "#3a3a3d", fontWeight: 600, letterSpacing: "0.04em" },
};

/* ExercisePage local styles */
const ex_s = {
  noteOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  noteModal: { background: "#1e1e20", borderRadius: "18px 18px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 430 },
  noteTitle: { fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 6 },
  noteSub: { fontSize: 13, color: DIM, marginBottom: 16 },
  noteInput: { width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, color: TEXT, fontSize: 14, padding: "12px 14px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none", lineHeight: 1.6 },
  noteActions: { display: "flex", gap: 10, marginTop: 14 },
  noteSkipBtn: { flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 14, fontWeight: 600, padding: "13px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  noteSaveBtn: { flex: 2, background: RED, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "13px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },

  // Workout active banner
  activeBanner: { display: "flex", alignItems: "center", gap: 8, background: "rgba(232,48,42,0.1)", border: `1px solid rgba(232,48,42,0.3)`, borderRadius: 0, padding: "8px 16px" },
  activeBannerDot: { width: 8, height: 8, borderRadius: "50%", background: RED, flexShrink: 0, animation: "livePulse 1s infinite" },
  activeBannerText: { fontSize: 12, color: RED, fontWeight: 600, flex: 1 },
  activeBannerFinish: { background: RED, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },

  // Cancel workout (top-right red X, shown once a workout is locked/active)
  cancelXBtn: { width: 32, height: 32, borderRadius: "50%", background: "rgba(232,48,42,0.12)", border: `1px solid rgba(232,48,42,0.4)`, color: RED, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" },
};

function LogExRow({ ex, last, showDivider, onUpdate, onSetActive }) {
  const savedSets = ex.loggedSets || [];
  const targetSets = parseInt(ex.sets) || 0;
  const defaultUnit = ex.unit || "kg";
  const lastSets = last?.loggedSets || [];
  const restSeconds = parseInt(ex.rest) || 0;

  const [restTimer, setRestTimer] = useState(null); // seconds remaining, null = inactive
  const [restTotal, setRestTotal] = useState(0);
  const timerRef = useRef(null);
  const restEndTime = useRef(null); // absolute end timestamp (ms)

  function startRestTimer(extraSecs = 0) {
    if (!restSeconds && !extraSecs) return;
    const secs = extraSecs || restSeconds;
    const endAt = Date.now() + secs * 1000;
    restEndTime.current = endAt;
    setRestTotal(secs);
    setRestTimer(secs);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((restEndTime.current - Date.now()) / 1000));
      setRestTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        // Push notification if permitted
        if (Notification.permission === "granted") {
          new Notification("APEX", { body: "Rest complete — start your next set!", icon: "/icon-192.png", silent: false });
        }
      }
    }, 500); // tick every 500ms for accuracy when returning from background
  }

  function skipTimer() {
    clearInterval(timerRef.current);
    restEndTime.current = null;
    setRestTimer(null);
  }

  function addTime(secs) {
    if (restEndTime.current) {
      restEndTime.current += secs * 1000;
    } else {
      restEndTime.current = Date.now() + secs * 1000;
    }
    setRestTotal(prev => prev + secs);
    setRestTimer(prev => (prev || 0) + secs);
    // Restart interval if not running
    if (!timerRef.current) startRestTimer(secs);
  }

  // Re-sync timer when app comes back to foreground
  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden && restEndTime.current && timerRef.current) {
        const remaining = Math.max(0, Math.round((restEndTime.current - Date.now()) / 1000));
        setRestTimer(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(timerRef.current);
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  function updateSet(i, patch) {
    const next = [...savedSets];
    next[i] = { ...next[i], ...patch };
    onUpdate({ loggedSets: next });
  }

  function addSet() {
    const prev = savedSets[savedSets.length - 1];
    const newSet = ex.timedSets
      ? { duration: prev?.duration || ex.duration || "", weight: prev?.weight || "", unit: prev?.unit || defaultUnit, done: false }
      : { reps: prev?.reps || ex.reps || "", weight: prev?.weight || "", unit: prev?.unit || defaultUnit, done: false };
    onUpdate({ loggedSets: [...savedSets, newSet] });
  }

  function removeSet(i) { onUpdate({ loggedSets: savedSets.filter((_, idx) => idx !== i) }); }

  function toggleDone(i) {
    const wasNotDone = !savedSets[i].done;
    updateSet(i, { done: wasNotDone });
    if (wasNotDone) {
      startRestTimer();
      if (onSetActive) onSetActive();
    }
  }

  const programPills = [
    ex.useRir && ex.rir && `RIR: ${ex.rir}`,
    ex.useIntensity && ex.intensity && `Intensity: ${ex.intensity}`,
    ex.useTempo && ex.tempo && `Tempo: ${ex.tempo}`,
  ].filter(Boolean);

  const completedSets = savedSets.filter(s => s.done).length;
  const allDone = savedSets.length > 0 && completedSets === savedSets.length;

  return (
    <div>
      <div style={s.exRow}>
        <div style={s.exTopRow}>
          <div style={{ flex: 1 }}>
            <span style={{ ...s.exName, ...(allDone ? { color: "#4ecdc4" } : {}) }}>{ex.name}</span>
            {allDone && <span style={ls.doneTag}>✓ Done</span>}
          </div>
          <span style={s.badgePill}>{ex.badge}</span>
        </div>

        {(ex.sets || ex.reps || ex.duration || programPills.length > 0) && (
          <div style={s.targetRow}>
            <span style={s.targetLabel}>Target →</span>
            {ex.sets && <span style={s.targetPill}>{ex.sets} sets</span>}
            {ex.timedSets
              ? ex.duration && <span style={{ ...s.targetPill, color: "#ffa500", borderColor: "rgba(255,165,0,0.3)" }}>{ex.duration}s</span>
              : ex.reps && <span style={s.targetPill}>{ex.reps} reps</span>}
            {ex.rest && <span style={{ ...s.targetPill, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)" }}>Rest {ex.rest}s</span>}
            {programPills.map((p, i) => <span key={i} style={s.targetPill}>{p}</span>)}
          </div>
        )}

        {ex.note && <div style={{ ...s.exNote, marginBottom: 8 }}>{ex.note}</div>}

        <div style={ls.setSection}>
          {savedSets.length > 0 && (
            <div style={ls.setHeader}>
              <span style={ls.setHeaderNum}>SET</span>
              <span style={ls.setHeaderField}>{ex.timedSets ? "SECS" : "REPS"}</span>
              <span style={ls.setHeaderField}>WEIGHT</span>
              <span style={ls.setHeaderUnit}>UNIT</span>
              <span style={{ width: 28 }} />
            </div>
          )}

          {savedSets.map((set, i) => {
            const lastSet = lastSets[i];
            return (
              <div key={i} style={{ ...ls.setRow, ...(set.done ? ls.setRowDone : {}) }}>
                <button style={{ ...ls.setNumBtn, ...(set.done ? ls.setNumBtnDone : {}) }}
                  onClick={() => toggleDone(i)} aria-label={set.done ? "Mark set incomplete" : `Complete set ${i + 1}`}>
                  {set.done ? "✓" : i + 1}
                </button>
                <div style={ls.setInputWrap}>
                  {ex.timedSets ? (
                    <>
                      {lastSet?.duration && !set.duration && <span style={ls.setGhost}>{lastSet.duration}</span>}
                      <input style={{ ...ls.setInput, ...(set.done ? ls.setInputDone : {}), borderColor: set.done ? undefined : "rgba(255,165,0,0.4)" }}
                        value={set.duration || ""} onChange={e => updateSet(i, { duration: e.target.value })}
                        placeholder={ex.duration || "sec"} inputMode="numeric" aria-label={`Set ${i + 1} seconds`} />
                    </>
                  ) : (
                    <>
                      {lastSet?.reps && !set.reps && <span style={ls.setGhost}>{lastSet.reps}</span>}
                      <input style={{ ...ls.setInput, ...(set.done ? ls.setInputDone : {}) }}
                        value={set.reps || ""} onChange={e => updateSet(i, { reps: e.target.value })}
                        placeholder={ex.reps || "—"} inputMode="numeric" aria-label={`Set ${i + 1} reps`} />
                    </>
                  )}
                </div>
                <div style={ls.setInputWrap}>
                  {lastSet?.weight && !set.weight && <span style={ls.setGhost}>{lastSet.weight}</span>}
                  <input style={{ ...ls.setInput, ...(set.done ? ls.setInputDone : {}) }}
                    value={set.weight} onChange={e => updateSet(i, { weight: e.target.value })}
                    placeholder="kg" inputMode="decimal" aria-label={`Set ${i + 1} weight`} />
                </div>
                <div style={ls.setUnitPicker}>
                  {["kg", "lbs", "BW"].map(u => (
                    <button key={u}
                      style={{ ...ls.setUnitBtn, ...(set.unit === u ? ls.setUnitBtnOn : {}) }}
                      onClick={() => updateSet(i, { unit: u })} aria-label={u} aria-pressed={set.unit === u}>{u}</button>
                  ))}
                </div>
                <button style={ls.removeBtn} onClick={() => removeSet(i)} aria-label={`Remove set ${i + 1}`}>✕</button>
              </div>
            );
          })}

          {savedSets.length === 0 && lastSets.length > 0 && (
            <div style={ls.lastWeekHint}>
              <span style={s.lastLabel}>Last week →</span>
              {lastSets.slice(0, 3).map((ls2, i) => (
                <span key={i} style={s.lastPill}>
                  {ex.timedSets ? `${ls2.duration || "?"}s` : `${ls2.reps || "?"} reps`}
                  {ls2.weight ? ` @ ${ls2.weight}${ls2.unit}` : ""}
                </span>
              ))}
              {lastSets.length > 3 && <span style={s.lastPill}>+{lastSets.length - 3} more</span>}
            </div>
          )}

          {/* Rest timer */}
          {restTimer !== null && (
            <div style={ls.restTimerWrap}>
              <div style={ls.restTimerTop}>
                <span style={ls.restTimerLabel}>Rest</span>
                <span style={{ ...ls.restTimerSecs, color: restTimer <= 5 ? RED : "#a78bfa" }}>
                  {restTimer}s
                </span>
                <div style={ls.restTimerActions}>
                  <button style={ls.restTimerAdd} onClick={() => addTime(30)}>+30s</button>
                  <button style={ls.restTimerSkip} onClick={skipTimer}>Skip</button>
                </div>
              </div>
              <div style={ls.restTimerBarWrap}>
                <div style={{
                  ...ls.restTimerBarFill,
                  width: `${Math.max(0, (restTimer / restTotal) * 100)}%`,
                  background: restTimer <= 5 ? RED : "#a78bfa",
                  transition: "width 1s linear, background 0.3s"
                }} />
              </div>
              {restTimer === 0 && (
                <div style={ls.restTimerDone}>Rest complete — start your next set!</div>
              )}
            </div>
          )}

          <button style={ls.addSetBtn} onClick={addSet}>
            <span style={ls.addSetPlus}>+</span>
            <span style={ls.addSetLabel}>{savedSets.length === 0 ? "Add Set" : `Add Set ${savedSets.length + 1}`}</span>
            {targetSets > 0 && savedSets.length > 0 && (
              <span style={ls.addSetProgress}>{completedSets}/{targetSets}</span>
            )}
          </button>
        </div>
      </div>
      {showDivider && <div style={s.divider} />}
    </div>
  );
}

const ls = {
  doneTag: { fontSize: 10, color: "#4ecdc4", fontWeight: 700, letterSpacing: "0.08em", marginLeft: 8, verticalAlign: "middle" },
  setSection: { marginTop: 4 },
  setHeader: { display: "flex", alignItems: "center", gap: 6, paddingBottom: 4, marginBottom: 2 },
  setHeaderNum: { fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: "0.1em", width: 28, textAlign: "center", flexShrink: 0 },
  setHeaderField: { fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: "0.1em", flex: 1, textAlign: "center" },
  setHeaderUnit: { fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: "0.1em", width: 80, textAlign: "center", flexShrink: 0 },
  setRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "6px 0", borderRadius: 8, transition: "opacity 0.2s" },
  setRowDone: { opacity: 0.5 },
  setNumBtn: { width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${BORDER}`, background: SURFACE, color: DIM, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", transition: "all 0.15s" },
  setNumBtnDone: { background: "#1a3a2a", border: "1.5px solid #4ecdc4", color: "#4ecdc4" },
  setInputWrap: { flex: 1, position: "relative" },
  setGhost: { position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)", fontSize: 13, color: "#333", pointerEvents: "none", zIndex: 1 },
  setInput: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, fontSize: 14, fontWeight: 600, padding: "7px 8px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", textAlign: "center" },
  setInputDone: { borderColor: "#1a3a2a", color: "#4ecdc4" },
  setUnitPicker: { display: "flex", gap: 2, flexShrink: 0, width: 80 },
  setUnitBtn: { flex: 1, background: "#111", border: `1px solid ${BORDER}`, color: "#444", fontSize: 9, fontWeight: 700, padding: "4px 0", borderRadius: 5, cursor: "pointer", fontFamily: "inherit" },
  setUnitBtnOn: { background: RED, border: `1px solid ${RED}`, color: "#fff" },
  removeBtn: { width: 24, height: 24, background: "none", border: "none", color: "#333", fontSize: 11, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  lastWeekHint: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 8 },
  addSetBtn: { width: "100%", background: "none", border: `1px dashed #2a2a2e`, borderRadius: 8, color: DIM, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", marginTop: 2 },
  addSetPlus: { width: 20, height: 20, borderRadius: "50%", background: RED, color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1 },
  addSetLabel: { fontSize: 12, fontWeight: 600, color: DIM, flex: 1, textAlign: "left" },
  addSetProgress: { fontSize: 11, color: RED, fontWeight: 700 },

  // Rest timer
  restTimerWrap: { background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, padding: "10px 12px", marginTop: 8, marginBottom: 4 },
  restTimerTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  restTimerLabel: { fontSize: 11, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
  restTimerSecs: { fontSize: 22, fontWeight: 800, flex: 1 },
  restTimerActions: { display: "flex", gap: 6 },
  restTimerAdd: { background: "none", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  restTimerSkip: { background: "none", border: `1px solid ${BORDER}`, color: DIM, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  restTimerBarWrap: { height: 4, background: "rgba(167,139,250,0.15)", borderRadius: 2, overflow: "hidden" },
  restTimerBarFill: { height: "100%", borderRadius: 2 },
  restTimerDone: { fontSize: 12, color: "#a78bfa", fontWeight: 600, marginTop: 8, textAlign: "center" },
};

/* ════════════════════════════════
   EXERCISE FORM
════════════════════════════════ */
function ExerciseForm({ draft, onChange, onSave, onCancel, title, saveLabel, nameError }) {
  const set = k => v => onChange({ ...draft, [k]: v });
  const tog = k => () => onChange({ ...draft, [k]: !draft[k] });

  function handleSave() {
    if (!draft.name.trim()) { onChange({ ...draft }); return; } // trigger validation
    onSave();
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={s.formHeader}>{title}</div>
      {/* FIX: Inline validation error on name field */}
      <div style={s.field}>
        <div style={s.fieldLabel}>Exercise name</div>
        <input
          style={{ ...s.input, ...(nameError ? { borderColor: RED } : {}) }}
          value={draft.name} onChange={e => set("name")(e.target.value)}
          placeholder="e.g. Bench Press"
        />
        {nameError && <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>Exercise name is required</div>}
      </div>
      <div style={s.rowGap}>
        <SmField label="Target Sets" value={draft.sets} onChange={set("sets")} placeholder="3" />
        <div style={{ flex: 1 }}>
          <div style={s.fieldLabel}>Mode</div>
          <div style={s.unitRow}>
            <button style={{ ...s.unitBtn, ...(!draft.timedSets ? s.unitBtnOn : {}) }}
              onClick={() => onChange({ ...draft, timedSets: false })}>Reps</button>
            <button style={{ ...s.unitBtn, ...(draft.timedSets ? s.unitBtnOn : {}) }}
              onClick={() => onChange({ ...draft, timedSets: true })}>Time</button>
          </div>
        </div>
      </div>
      {draft.timedSets ? (
        <div style={s.rowGap}>
          <SmField label="Duration (sec)" value={draft.duration} onChange={set("duration")} placeholder="30" />
          <SmField label="Rest (sec)" value={draft.rest} onChange={set("rest")} placeholder="60" />
        </div>
      ) : (
        <div style={s.rowGap}>
          <SmField label="Target Reps" value={draft.reps} onChange={set("reps")} placeholder="10" />
          <SmField label="Rest (sec)" value={draft.rest} onChange={set("rest")} placeholder="e.g. 90" />
        </div>
      )}
      <div style={s.rowGap}>
        <SmField label="Weight" value={draft.weight} onChange={set("weight")} placeholder="60" />
        <div style={{ flex: 1 }}>
          <div style={s.fieldLabel}>Unit</div>
          <div style={s.unitRow}>
            {["kg", "lbs", "BW"].map(u => (
              <button key={u} style={{ ...s.unitBtn, ...(draft.unit === u ? s.unitBtnOn : {}) }}
                onClick={() => onChange({ ...draft, unit: u })}>{u}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={s.optSection}>
        <div style={s.optSectionLabel}>Optional</div>
        <OptRow label="RIR" checked={draft.useRir} onToggle={tog("useRir")}>
          {draft.useRir && <SmField label="" value={draft.rir} onChange={set("rir")} placeholder="e.g. 2" />}
        </OptRow>
        <OptRow label="Intensity %" checked={draft.useIntensity} onToggle={tog("useIntensity")}>
          {draft.useIntensity && <SmField label="" value={draft.intensity} onChange={set("intensity")} placeholder="e.g. 80–85%" />}
        </OptRow>
        <OptRow label="Tempo" checked={draft.useTempo} onToggle={tog("useTempo")}>
          {draft.useTempo && <SmField label="" value={draft.tempo} onChange={set("tempo")} placeholder="e.g. 301" />}
        </OptRow>
      </div>
      <Field label="Note (optional)" value={draft.note} onChange={set("note")} placeholder="e.g. 3 per side" />
      <div style={s.formActions}>
        <button style={s.btnCancel} onClick={onCancel}>Cancel</button>
        <button style={s.btnSave} onClick={handleSave}>{saveLabel || "Save"}</button>
      </div>
    </div>
  );
}

function OptRow({ label, checked, onToggle, children }) {
  return (
    <div style={s.optRow}>
      <div style={s.optTop} onClick={onToggle} role="checkbox" aria-checked={checked} tabIndex={0}
        onKeyDown={e => e.key === " " && onToggle()}>
        <div style={{ ...s.checkbox, ...(checked ? s.checkboxOn : {}) }}>
          {checked && <span style={s.checkmark}>✓</span>}
        </div>
        <span style={{ ...s.optLabel, ...(checked ? { color: TEXT } : {}) }}>{label}</span>
      </div>
      {children && <div style={s.optInput}>{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "" }) {
  return (
    <div style={s.field}>
      {label && <div style={s.fieldLabel}>{label}</div>}
      <input style={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function SmField({ label, value, onChange, placeholder = "" }) {
  return (
    <div style={{ ...s.field, flex: 1 }}>
      {label && <div style={s.fieldLabel}>{label}</div>}
      <input style={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ════════════════════════════════
   ANALYTICS HELPERS
════════════════════════════════ */
function epley1RM(weight, reps) {
  const w = parseFloat(weight), r = parseInt(reps);
  if (!w || !r || r < 1) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.floor((d - startOfWeek1) / (7 * 86400000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function lastNWeeks(n) {
  const weeks = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(isoWeek(d.toISOString().slice(0, 10)));
  }
  return weeks;
}

function monthKey(dateStr) { return dateStr.slice(0, 7); }

/* ════════════════════════════════
   PROGRESS PAGE
════════════════════════════════ */
/* ── Muscle group keyword classifier ── */
const MUSCLE_GROUPS = [
  { key: "chest",     label: "Chest",     keywords: ["chest","fly","push-up","pushup","pec","bench press","incline press","flat press","cable fly","bench"] },
  { key: "back",      label: "Back",      keywords: ["row","pull","lat","t-bar","pulldown","chin","deadlift","rdl","back"] },
  { key: "shoulders", label: "Shoulders", keywords: ["shoulder","delt","lateral raise","shrug","overhead press","ohp","face pull","reverse fly","press"] },
  { key: "arms",      label: "Arms",      keywords: ["curl","tricep","bicep","hammer","wrist","pushdown","tricep extension","dip","tricep push"] },
  { key: "legs",      label: "Legs",      keywords: ["squat","lunge","leg press","split squat","step-up","jump","hip thrust","glute","calf","bulgarian","box squat","broad jump","depth drop","trap bar","plyo","sprint","sled","prowler","shuttle","speed","vertical","rdl","deadlift","leg curl","leg raise"] },
  { key: "core",      label: "Core",      keywords: ["plank","sit-up","crunch","pallof","flutter","wave","farmer","med ball","slam","hanging leg","ab","core","toes to bar","rollout","carry"] },
];

const CLASSIFY_CACHE_KEY = "apex-muscle-cache-v1";
function loadClassifyCache() { try { const r = localStorage.getItem(CLASSIFY_CACHE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function saveClassifyCache(c) { try { localStorage.setItem(CLASSIFY_CACHE_KEY, JSON.stringify(c)); } catch {} }

function keywordClassify(name) {
  const n = name.toLowerCase();
  for (const g of MUSCLE_GROUPS) {
    if (g.keywords.some(k => n.includes(k))) return g.key;
  }
  return null;
}

function ProgressPage({ logs, program, onBack, onAddExercise, onDeleteExercise, onUpdateExercise, onDeleteLog }) {
  const [tab, setTab] = useState("dashboard");
  const [muscleTab, setMuscleTab] = useState("all");
  const [filterDayId, setFilterDayId] = useState(null);
  const [dayDropOpen, setDayDropOpen] = useState(false);
  const [dateRange, setDateRange] = useState(8); // weeks: 4, 8, 12, 16, 0=all
  const [exPage, setExPage] = useState(0);
  const [overrides, setOverrides] = useState(loadClassifyCache);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [insight, setInsight] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("apex-insight-cache") || "null");
      if (!cached) return null;
      // Cache is valid only if log count hasn't changed since report was generated
      return cached.logCount === logs.length ? cached.report : null;
    } catch { return null; }
  });
  const [suggestions, setSuggestions] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("apex-insight-cache") || "null");
      if (!cached) return [];
      return cached.logCount === logs.length ? (cached.suggestions || []) : [];
    } catch { return []; }
  });
  const [dismissedOnce, setDismissedOnce] = useState([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(null);
  const [dayPickerFor, setDayPickerFor] = useState(null); // suggestion index awaiting day pick
  const NEVER_KEY = "apex-never-suggest";
  const [neverSuggest, setNeverSuggest] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NEVER_KEY) || "[]"); } catch { return []; }
  });
  const PAGE_SIZE = 5;

  const hasWeekOfData = (() => {
    if (logs.length < 2) return false;
    const oldest = logs.reduce((a, b) => a.date < b.date ? a : b);
    const newest = logs.reduce((a, b) => a.date > b.date ? a : b);
    return (new Date(newest.date) - new Date(oldest.date)) / 86400000 >= 6 || logs.length >= 3;
  })();

  const programDays = program?.days || [];
  const dayOptions = programDays.map(d => ({
    id: d.id, label: d.label, exercises: [...new Set(d.exercises.map(e => e.name))]
  }));

  const filteredLogs = filterDayId ? logs.filter(l => l.dayId === filterDayId) : logs;
  const activeDay = filterDayId ? dayOptions.find(d => d.id === filterDayId) : null;
  const allExercises = activeDay
    ? activeDay.exercises
    : [...new Set(logs.flatMap(l => l.exercises.map(e => e.name)))];

  function getGroup(name) {
    return overrides[name] || keywordClassify(name) || "other";
  }

  async function generateInsight() {
    setInsightLoading(true);
    setInsightError(null);
    setInsight(null);
    setSuggestions([]);
    setDismissedOnce([]);

    // Only analyse real logged workouts — exclude demo/simulated data
    const realLogs = logs.filter(l => !l.simulated);
    if (!realLogs.length) {
      setInsightError("No real workouts logged yet. Log some workouts first, then generate your report.");
      setInsightLoading(false);
      return;
    }

    // Dynamically determine week range from actual data (up to 16 weeks rolling)
    const sortedDates = [...new Set(realLogs.map(l => l.date))].sort();
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const totalDays = Math.max(7, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const analysisWeeks = Math.min(16, totalWeeks);
    const ACTUAL_WEEKS = Array.from({ length: analysisWeeks }, (_, i) => {
      const d = new Date(lastDate);
      d.setDate(d.getDate() - (analysisWeeks - 1 - i) * 7);
      return isoWeek(d.toISOString().slice(0, 10));
    });
    const WEEKS8 = ACTUAL_WEEKS;

    // For data beyond 16 weeks, add a monthly summary so nothing is lost
    let monthlySummary = "";
    if (totalWeeks > 16) {
      const cutoffDate = new Date(lastDate);
      cutoffDate.setDate(cutoffDate.getDate() - analysisWeeks * 7);
      const olderLogs = realLogs.filter(l => new Date(l.date) <= cutoffDate);
      const monthMap = {};
      olderLogs.forEach(l => {
        const mo = l.date.slice(0, 7);
        if (!monthMap[mo]) monthMap[mo] = { sessions: 0, vol: 0 };
        monthMap[mo].sessions++;
        monthMap[mo].vol += l.exercises.reduce((s,e) =>
          s + (parseInt(e.sets)||0)*(parseInt(e.reps)||0)*(parseFloat(e.weight)||0), 0);
      });
      monthlySummary = "\n\n## Older Training History (monthly)\n" +
        Object.entries(monthMap).sort().map(([mo, d]) =>
          `${mo}: ${d.sessions} sessions, ${Math.round(d.vol).toLocaleString()} kg volume`
        ).join("\n");
    }
    const weekSummaries = WEEKS8.map((wk, i) => {
      const weekLogs = realLogs.filter(l => isoWeek(l.date) === wk);
      const vol = weekLogs.reduce((sum, l) =>
        sum + l.exercises.reduce((s, e) =>
          s + (parseInt(e.sets)||0) * (parseInt(e.reps)||0) * (parseFloat(e.weight)||0), 0), 0);
      return { week: `W${i+1}`, sessions: weekLogs.length, volumeKg: Math.round(vol).toLocaleString(),
        exercises: [...new Set(weekLogs.flatMap(l => l.exercises.map(e => e.name)))] };
    });

    const prData = [...new Set(realLogs.flatMap(l => l.exercises.map(e => e.name)))].map(name => {
      const allRM = realLogs.flatMap(l => l.exercises.filter(e => e.name === name).map(e => epley1RM(e.weight, e.reps))).filter(v => v > 0);
      const recent = realLogs.filter(l => { const d = new Date(l.date); const c = new Date(); c.setDate(c.getDate()-28); return d >= c; })
        .flatMap(l => l.exercises.filter(e => e.name === name).map(e => epley1RM(e.weight, e.reps))).filter(v => v > 0);
      const older = realLogs.filter(l => { const d = new Date(l.date); const c = new Date(); c.setDate(c.getDate()-28); return d < c; })
        .flatMap(l => l.exercises.filter(e => e.name === name).map(e => epley1RM(e.weight, e.reps))).filter(v => v > 0);
      return { exercise: name, group: getGroup(name), pr1RM: allRM.length ? Math.max(...allRM) : 0,
        recentAvg: recent.length ? Math.round(recent.reduce((a,b)=>a+b,0)/recent.length) : 0,
        olderAvg: older.length ? Math.round(older.reduce((a,b)=>a+b,0)/older.length) : 0 };
    }).filter(d => d.pr1RM > 0);

    const muscleVolume = MUSCLE_GROUPS.map(g => {
      const exList = allExercises.filter(n => getGroup(n) === g.key);
      const vol = realLogs.reduce((sum, l) =>
        sum + l.exercises.filter(e => exList.includes(e.name))
          .reduce((s, e) => s + (parseInt(e.sets)||0)*(parseInt(e.reps)||0)*(parseFloat(e.weight)||0), 0), 0);
      return { group: g.label, totalVolumeKg: Math.round(vol).toLocaleString(), exerciseCount: exList.length };
    }).filter(g => g.exerciseCount > 0);

    const programDayNames = (program?.days || []).map(d => d.label);

    // Collect recent session notes for AI context (last 8 sessions with notes)
    const recentNotes = realLogs
      .filter(l => l.sessionNote && l.sessionNote.trim())
      .slice(-8)
      .map(l => `${l.date} (${l.dayLabel}): "${l.sessionNote}"`);
    const notesSection = recentNotes.length
      ? `\n\n## Your Recent Session Notes\n${recentNotes.join("\n")}`
      : "";
    const olderHistorySection = typeof monthlySummary !== "undefined" ? monthlySummary : "";
    const neverList = neverSuggest.length ? `Never suggest these again: ${neverSuggest.join(", ")}` : "";

    const prompt = `You are Apex, a personal AI strength coach. You are speaking DIRECTLY to the user. NEVER use "the athlete" — always say "you" or "your". Write in second person throughout. The data covers ${totalWeeks} week(s) of real training. Return a JSON object with exactly two keys: "report" and "suggestions".

## Weekly Summary
${JSON.stringify(weekSummaries)}

## Per-Exercise 1RM & Trends
${JSON.stringify(prData)}

## Volume by Muscle Group
${JSON.stringify(muscleVolume)}

## Current Program Days
${programDayNames.join(", ")}${olderHistorySection}${notesSection}

${neverList}

The "report" value must be a markdown string with these sections:
1. **Overall Progress**
2. **Strength Gains**
3. **Muscle Group Balance**
4. **What Is Working**
5. **Areas to Improve**
6. **Next Week Recommendations**

CRITICAL: Write entirely in second person. If session notes are provided, reference them specifically — mention patterns you see across notes (e.g. recurring tightness, fatigue, strong days). Use "you" and "your" throughout. NEVER write "the athlete". Example: "You hit a new PR" not "The athlete hit a new PR". Use real exercise names and numbers. No emojis. Be direct, encouraging, and honest.

The "suggestions" value must be an array of up to 5 objects, each with:
- type: "add" | "remove" | "swap" | "rest"
- exercise: string (exercise name to add/remove/swap/adjust rest for)
- swapFrom: string (only for swap type, the exercise being replaced)
- suggestedDay: string (one of the program day names, or "auto" if unclear)
- sets: number
- reps: string (e.g. "8-10")
- unit: "kg" | "lbs" | "BW"
- restSeconds: number (only for rest type — the suggested rest time in seconds)
- currentRestSeconds: number (only for rest type — the current rest time, 0 if unknown)
- reason: string (one sentence, no emojis)

Return ONLY valid JSON, no markdown fences, no extra text.`;

    try {
      const raw = await callGeminiAI(prompt, { maxTokens: 3000, temperature: 0.5 });
      // Robust JSON extraction — handle literal newlines inside string values
      let parsed = { report: "", suggestions: [] };
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        try {
          const jsonStr = raw.slice(jsonStart, jsonEnd + 1);
          // Walk char by char, escaping literal newlines only inside strings
          let safe = "";
          let inStr = false, esc = false;
          for (let ci = 0; ci < jsonStr.length; ci++) {
            const ch = jsonStr[ci];
            if (esc) { safe += ch; esc = false; continue; }
            if (ch === "\\") { esc = true; safe += ch; continue; }
            if (ch === '"') { inStr = !inStr; safe += ch; continue; }
            if (inStr && ch === "\n") { safe += "\\n"; continue; }
            if (inStr && ch === "\r") { safe += "\\r"; continue; }
            if (inStr && ch === "\t") { safe += "\\t"; continue; }
            safe += ch;
          }
          parsed = JSON.parse(safe);
        } catch (e) {
          parsed = { report: raw, suggestions: [] };
        }
      } else {
        parsed = { report: raw, suggestions: [] };
      }
      const reportText = typeof parsed.report === "string" ? parsed.report : raw;
      setInsight(reportText);
      const validSugs = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
        .filter(s => s && s.exercise && !neverSuggest.includes(s.exercise));
      setSuggestions(validSugs);
      try { localStorage.setItem("apex-insight-cache", JSON.stringify({ logCount: logs.length, report: reportText, suggestions: validSugs })); } catch {}
    } catch (err) {
      setInsightError(`Apex could not generate insights: ${err.message}`);
    } finally {
      setInsightLoading(false);
    }
  }

  function acceptSuggestion(idx, chosenDayId) {
    const sug = suggestions[idx];
    if (!sug) return;
    const days = program?.days || [];

    if (sug.type === "rest") {
      // Update rest time on the matching exercise in program
      days.forEach(d => {
        const ex = d.exercises.find(e => e.name === sug.exercise);
        if (ex && onUpdateExercise) onUpdateExercise(d.id, ex.id, { rest: String(sug.restSeconds || 90) });
      });
    } else if (sug.type === "remove") {
      // Find and remove the exercise from whichever day it's in
      days.forEach(d => {
        const ex = d.exercises.find(e => e.name === sug.exercise);
        if (ex) onDeleteExercise && onDeleteExercise(d.id, ex.id);
      });
    } else {
      // add or swap — need a target day
      const targetDay = chosenDayId
        ? days.find(d => d.id === chosenDayId)
        : days.find(d => d.label === sug.suggestedDay) || days[0];
      if (!targetDay) return;

      if (sug.type === "swap") {
        const existing = targetDay.exercises.find(e => e.name === sug.swapFrom);
        if (existing && onDeleteExercise) onDeleteExercise(targetDay.id, existing.id);
      }
      if (onAddExercise) {
        onAddExercise(targetDay.id, {
          id: uid(), name: sug.exercise,
          sets: String(sug.sets || 3), reps: String(sug.reps || "8-10"),
          weight: "", unit: sug.unit || "kg",
          useRir: false, rir: "", useIntensity: false, intensity: "",
          useTempo: false, tempo: "",
          note: `Added by Apex · expires ${new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10)}`,
          supersetId: null
        });
      }
    }
    // Remove from state
    setSuggestions(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      // Persist the updated suggestions list to cache so they don't reappear on reload
      try {
        const cached = JSON.parse(localStorage.getItem("apex-insight-cache") || "{}");
        cached.suggestions = updated;
        // Keep logCount so the cache stays valid after accepting a suggestion
        localStorage.setItem("apex-insight-cache", JSON.stringify(cached));
      } catch {}
      return updated;
    });
    setDayPickerFor(null);
  }

  function dismissOnce(idx) {
    setDismissedOnce(prev => [...prev, idx]);
  }

  function dismissForever(idx) {
    const sug = suggestions[idx];
    if (!sug) return;
    const updated = [...neverSuggest, sug.exercise];
    setNeverSuggest(updated);
    try { localStorage.setItem(NEVER_KEY, JSON.stringify(updated)); } catch {}
    setSuggestions(prev => prev.filter((_, i) => i !== idx));
  }

  // Reset page when filters change
  // Reset page when filters change
  useEffect(() => { setExPage(0); }, [muscleTab, filterDayId]);

  const presentGroups = MUSCLE_GROUPS.filter(g => allExercises.some(n => getGroup(n) === g.key));
  const muscleFilteredExercises = muscleTab === "all"
    ? allExercises
    : allExercises.filter(n => getGroup(n) === muscleTab);
  const totalExPages = Math.ceil(muscleFilteredExercises.length / PAGE_SIZE);
  const chartExercises = muscleFilteredExercises.slice(exPage * PAGE_SIZE, exPage * PAGE_SIZE + PAGE_SIZE);

  // Dynamic date range — rolling window or all time
  const WEEKS8 = dateRange === 0
    ? (() => {
        // All time: find earliest log and build week array
        const allDates = logs.filter(l => !l.simulated).map(l => l.date).sort();
        if (!allDates.length) return lastNWeeks(8);
        const firstDate = new Date(allDates[0]);
        const now = new Date();
        const totalWeeks = Math.min(52, Math.ceil((now - firstDate) / (7 * 86400000)) + 1);
        return lastNWeeks(totalWeeks);
      })()
    : lastNWeeks(dateRange);

  const MONTHS12 = Array.from({ length: dateRange === 0 ? 24 : Math.max(3, Math.ceil(dateRange / 4)) }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (dateRange === 0 ? 23 : Math.max(2, Math.ceil(dateRange / 4)) - 1) + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const EX_COLORS = ["#e8302a", "#ff6b35", "#ffa500", "#4ecdc4", "#45b7d1", "#a78bfa"];
  const weekLabels = (WEEKS8 || []).map((_, i) => `W${i+1}`);

  const weeklyVol = (WEEKS8 || []).map(wk =>
    filteredLogs.filter(l => isoWeek(l.date) === wk)
      .reduce((sum, l) => sum + l.exercises.reduce((s, e) =>
        s + (parseInt(e.sets) || 0) * (parseInt(e.reps) || 0) * (parseFloat(e.weight) || 0), 0), 0)
  );

  const oneRMByExercise = chartExercises.map(name => ({
    name,
    data: (WEEKS8 || []).map(wk => {
      const best = filteredLogs.filter(l => isoWeek(l.date) === wk)
        .flatMap(l => l.exercises.filter(e => e.name === name))
        .map(e => epley1RM(e.weight, e.reps));
      return best.length ? Math.max(...best) : null;
    })
  }));

  const prCards = chartExercises.map((name, i) => {
    const allRM = filteredLogs.flatMap(l => l.exercises.filter(e => e.name === name).map(e => epley1RM(e.weight, e.reps)));
    const currentPR = allRM.length ? Math.max(...allRM) : 0;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 56);
    const oldRM = filteredLogs.filter(l => new Date(l.date) < cutoff)
      .flatMap(l => l.exercises.filter(e => e.name === name).map(e => epley1RM(e.weight, e.reps)));
    const oldPR = oldRM.length ? Math.max(...oldRM) : currentPR;
    return { name, pr: currentPR, delta: currentPR - oldPR, color: EX_COLORS[i % EX_COLORS.length] };
  });

  const filledWeeks = weeklyVol.filter(v => v > 0);
  const avgVol = filledWeeks.reduce((a, b) => a + b, 0) / (filledWeeks.length || 1);
  const half = Math.floor(weeklyVol.length / 2);
  const oldH = weeklyVol.slice(0, half).filter(v => v > 0);
  const newH = weeklyVol.slice(half).filter(v => v > 0);
  const volDelta = Math.round((newH.reduce((a, b) => a + b, 0) / (newH.length || 1)) - (oldH.reduce((a, b) => a + b, 0) / (oldH.length || 1)));

  const relGains = chartExercises.map((name, i) => {
    const series = oneRMByExercise.find(x => x.name === name)?.data || [];
    const first = series.find(v => v != null) || 1;
    const last = [...series].reverse().find(v => v != null) || first;
    return { name, pct: Math.round(((last - first) / first) * 100), color: EX_COLORS[i % EX_COLORS.length] };
  });

  const heatmap = MONTHS12.map(mo => ({ mo, count: logs.filter(l => monthKey(l.date) === mo).length }));
  const maxHeat = Math.max(...heatmap.map(h => h.count), 1);
  const selectedDayLabel = filterDayId ? dayOptions.find(d => d.id === filterDayId)?.label : null;

  function applyOverride(name, groupKey) {
    setOverrides(prev => {
      const next = { ...prev, [name]: groupKey };
      saveClassifyCache(next);
      return next;
    });
    setOverrideTarget(null);
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹</button>
        <span style={s.headerTitle}>Progress</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={s.subTabBar}>
        {[["dashboard", "Dashboard"], ["history", "History"], ["exercises", "Exercises"], ["aicoach", "AI Coach"]].map(([t, label]) => (
          <button key={t} style={{ ...s.subTab, ...(tab === t ? s.subTabActive : {}) }} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      <div style={{ ...s.scroll, padding: "12px 14px" }}>

        {/* ── EXERCISES TAB ── */}
        {tab === "exercises" && (
          <div>
            <div style={ds.classifyHeader}>
              <div style={ds.classifyTitle}>Exercise Classification</div>
              <div style={ds.classifySub}>Tap Change to reassign any exercise to a different group</div>
            </div>
            {MUSCLE_GROUPS.map((g, gi) => {
              const exList = allExercises.filter(n => getGroup(n) === g.key);
              if (!exList.length) return null;
              return (
                <div key={g.key} style={ds.classifySection}>
                  <div style={ds.classifySectionLabel}>
                    <span style={{ ...ds.classifyGroupDot, background: EX_COLORS[gi % EX_COLORS.length] }} />
                    {g.label}
                    <span style={ds.classifyGroupCount}>{exList.length}</span>
                  </div>
                  {exList.map(name => (
                    <div key={name} style={ds.classifyRow}>
                      <span style={ds.classifyExName}>{name}</span>
                      <button style={ds.classifyChangeBtn} onClick={() => setOverrideTarget(name)}>Change</button>
                    </div>
                  ))}
                </div>
              );
            })}
            {allExercises.filter(n => getGroup(n) === "other").length > 0 && (
              <div style={ds.classifySection}>
                <div style={ds.classifySectionLabel}>
                  <span style={{ ...ds.classifyGroupDot, background: "#555" }} />
                  Unclassified
                  <span style={ds.classifyGroupCount}>{allExercises.filter(n => getGroup(n) === "other").length}</span>
                </div>
                {allExercises.filter(n => getGroup(n) === "other").map(name => (
                  <div key={name} style={ds.classifyRow}>
                    <span style={ds.classifyExName}>{name}</span>
                    <button style={ds.classifyChangeBtn} onClick={() => setOverrideTarget(name)}>Assign</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && <HistoryTab logs={logs} onDeleteLog={onDeleteLog} />}

        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && !hasWeekOfData && (
          <div style={ds.notReady}>
            <div style={ds.notReadyIcon}>🗓️</div>
            <div style={ds.notReadyTitle}>Complete a week first</div>
            <div style={ds.notReadySub}>Log at least one full week of workouts to unlock your dashboard.</div>
          </div>
        )}

        {tab === "dashboard" && hasWeekOfData && (
          <>
            {/* Day filter */}
            {dayOptions.length > 0 && (
              <div style={ds.exFilterWrap}>
                <button style={ds.exFilterBtn} onClick={() => setDayDropOpen(v => !v)}>
                  <div style={ds.filterBtnInner}>
                    <div>
                      <div style={ds.filterBtnLabel}>{selectedDayLabel || "All Days"}</div>
                      <div style={ds.filterBtnSub}>
                        {selectedDayLabel && activeDay
                          ? `${activeDay.exercises.length} exercises`
                          : `${dayOptions.length} days · ${allExercises.length} exercises`}
                      </div>
                    </div>
                  </div>
                  <span style={{ color: RED, fontSize: 12 }}>{dayDropOpen ? "▲" : "▼"}</span>
                </button>
                {dayDropOpen && (
                  <div style={ds.exDropdown}>
                    <button style={{ ...ds.dayDropItem, ...(filterDayId === null ? ds.exDropItemActive : {}) }}
                      onClick={() => { setFilterDayId(null); setMuscleTab("all"); setDayDropOpen(false); }}>
                      <div style={ds.dayDropLeft}><div style={ds.dayDropLabel}>All Days</div><div style={ds.dayDropSub}>{allExercises.length} total exercises</div></div>
                      {filterDayId === null && <span style={{ color: RED }}>✓</span>}
                    </button>
                    <div style={{ height: 1, background: BORDER }} />
                    {dayOptions.map((d, i) => (
                      <button key={d.id} style={{ ...ds.dayDropItem, ...(filterDayId === d.id ? ds.exDropItemActive : {}) }}
                        onClick={() => { setFilterDayId(d.id); setMuscleTab("all"); setDayDropOpen(false); }}>
                        <div style={ds.dayDropLeft}>
                          <div style={ds.dayDropLabel}><span style={{ ...ds.dayDropDot, background: EX_COLORS[i % EX_COLORS.length] }} />{d.label}</div>
                          <div style={ds.dayDropSub}>{d.exercises.length} exercises</div>
                        </div>
                        {filterDayId === d.id && <span style={{ color: RED }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date range picker */}
            <div style={ds.dateRangeRow}>
              {[[4,"4W"],[8,"8W"],[12,"12W"],[16,"16W"],[0,"All"]].map(([val, label]) => (
                <button key={val}
                  style={{ ...ds.dateRangeBtn, ...(dateRange === val ? ds.dateRangeBtnOn : {}) }}
                  onClick={() => { setDateRange(val); setExPage(0); }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Muscle group tabs with count badges */}
            {presentGroups.length > 0 && (
              <div style={ds.muscleTabBar}>
                <button
                  style={{ ...ds.muscleTab, ...(muscleTab === "all" ? ds.muscleTabActive : {}) }}
                  onClick={() => setMuscleTab("all")}>
                  All <span style={{ ...ds.muscleTabCount, ...(muscleTab === "all" ? ds.muscleTabCountActive : {}) }}>{allExercises.length}</span>
                </button>
                {presentGroups.map((g, i) => {
                  const count = allExercises.filter(n => getGroup(n) === g.key).length;
                  const isActive = muscleTab === g.key;
                  return (
                    <button key={g.key}
                      style={{ ...ds.muscleTab, ...(isActive ? ds.muscleTabActive : {}) }}
                      onClick={() => setMuscleTab(g.key)}>
                      {g.label} <span style={{ ...ds.muscleTabCount, ...(isActive ? ds.muscleTabCountActive : {}) }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}


            {chartExercises.length === 0 && (
              <div style={{ ...ds.chartEmptyState, padding: "32px 0" }}>
                <div style={{ fontSize: 13, color: DIM, fontWeight: 600 }}>No {MUSCLE_GROUPS.find(g => g.key === muscleTab)?.label.toLowerCase()} exercises found</div>
                <button style={{ ...ds.classifyLink, fontSize: 12, marginTop: 6, display: "block" }} onClick={() => setTab("exercises")}>Assign exercises manually →</button>
              </div>
            )}

            {chartExercises.length > 0 && (
              <>
                {/* Pagination — top */}
                {muscleFilteredExercises.length > PAGE_SIZE && (
                  <div style={ds.pageRow}>
                    <span style={ds.pageInfo}>
                      {muscleTab !== "all" && <span style={{ color: RED, fontWeight: 700, marginRight: 4 }}>{MUSCLE_GROUPS.find(g => g.key === muscleTab)?.label} · </span>}
                      {exPage * PAGE_SIZE + 1}–{Math.min((exPage + 1) * PAGE_SIZE, muscleFilteredExercises.length)} of {muscleFilteredExercises.length}
                    </span>
                    <div style={ds.pageBtns}>
                      <button style={{ ...ds.pageBtn, opacity: exPage === 0 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.max(0, p - 1))} disabled={exPage === 0}>‹ Prev</button>
                      <button style={{ ...ds.pageBtn, opacity: exPage >= totalExPages - 1 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.min(totalExPages - 1, p + 1))} disabled={exPage >= totalExPages - 1}>Next ›</button>
                    </div>
                  </div>
                )}

                {/* PRs */}
                <SectionHeader title="Current PRs" subtitle="vs 8 weeks ago" />
                <div style={ds.prGrid}>
                  {prCards.map(card => (
                    <div key={card.name} style={ds.prCard}>
                      <div style={{ ...ds.prAccent, background: card.color }} />
                      <div style={ds.prName} title={card.name}>{card.name.length > 18 ? card.name.slice(0, 16) + "…" : card.name}</div>
                      <div style={ds.prVal}>{card.pr ? fmtNum(card.pr) : "—"}<span style={ds.prUnit}>{card.pr ? " kg" : ""}</span></div>
                      {card.pr > 0 && <div style={{ ...ds.prDelta, color: card.delta >= 0 ? "#4ecdc4" : "#ff6b6b" }}>{card.delta >= 0 ? "▲" : "▼"} {fmtNum(Math.abs(card.delta))} kg</div>}
                    </div>
                  ))}
                  {exPage === 0 && (
                    <div style={ds.prCard}>
                      <div style={{ ...ds.prAccent, background: "#6366f1" }} />
                      <div style={ds.prName}>Avg Weekly Vol</div>
                      <div style={ds.prVal}>{fmtKg(avgVol)}</div>
                      <div style={{ ...ds.prDelta, color: volDelta >= 0 ? "#4ecdc4" : "#ff6b6b" }}>{volDelta >= 0 ? "▲" : "▼"} {fmtKg(Math.abs(volDelta))}</div>
                    </div>
                  )}
                </div>

                {/* Muscle Snapshot */}
                {exPage === 0 && muscleTab === "all" && presentGroups.length > 0 && (
                  <>
                    <SectionHeader title="Muscle Group Snapshot" subtitle="Volume trend · last 8 weeks" />
                    <div style={ds.muscleSnapshotGrid}>
                      {presentGroups.map((g, gi) => {
                        const exList = allExercises.filter(n => getGroup(n) === g.key);
                        const half8 = Math.floor(WEEKS8.length / 2);
                        const calcVol = (weeks) => weeks.reduce((sum, wk) => {
                          const weekLogs = filteredLogs.filter(l => isoWeek(l.date) === wk);
                          return sum + weekLogs.reduce((s2, l) => {
                            return s2 + l.exercises
                              .filter(e => exList.includes(e.name))
                              .reduce((a, e) => a + (parseInt(e.sets)||0)*(parseInt(e.reps)||0)*(parseFloat(e.weight)||0), 0);
                          }, 0);
                        }, 0);
                        const oldVol = calcVol(WEEKS8.slice(0, half8));
                        const newVol = calcVol(WEEKS8.slice(half8));
                        const trend = newVol > oldVol * 1.05 ? "UP" : newVol < oldVol * 0.95 ? "DOWN" : "STABLE";
                        const trendColor = trend === "UP" ? "#4ecdc4" : trend === "DOWN" ? "#ff6b6b" : DIM;
                        const topPR = (() => {
                          const rms = filteredLogs.flatMap(l => l.exercises.filter(e => exList.includes(e.name)).map(e => epley1RM(e.weight, e.reps))).filter(v => v > 0);
                          return rms.length ? Math.max(...rms) : 0;
                        })();
                        const topEx = exList.find(n => {
                          const rms = filteredLogs.flatMap(l => l.exercises.filter(e => e.name === n).map(e => epley1RM(e.weight, e.reps))).filter(v => v > 0);
                          return rms.length ? Math.max(...rms) === topPR : false;
                        }) || exList[0];
                        return (
                          <div key={g.key} style={ds.muscleSnapshotCard}>
                            <div style={{ ...ds.muscleSnapshotAccent, background: EX_COLORS[gi % EX_COLORS.length] }} />
                            <div style={ds.muscleSnapshotLabelRow}>
                              <span style={ds.muscleSnapshotLabel}>{g.label}</span>
                            </div>
                            <div style={ds.muscleSnapshotVolRow}>
                              <span style={ds.muscleSnapshotVol}>{fmtKg(newVol / (half8 || 1))}</span>
                              <span style={ds.muscleSnapshotVolLabel}>/wk</span>
                            </div>
                            <div style={{ ...ds.muscleSnapshotTrend, color: trendColor }}>{trend}</div>
                            {topPR > 0 && <div style={ds.muscleSnapshotPR}>Top PR: {fmtNum(topPR)} kg{topEx ? ` · ${topEx.split(' ')[0]}` : ''}</div>}
                            <div style={ds.muscleSnapshotCount}>{exList.length} exercise{exList.length !== 1 ? 's' : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* 1RM chart */}
                <SectionHeader title="1RM Strength Progression" subtitle="8 weeks" />
                <div style={ds.chartCard}>
                  {oneRMByExercise.every(ex => ex.data.every(v => v == null)) ? (
                    <div style={ds.chartEmptyState}>
                      <div style={{ fontSize: 13, color: DIM, fontWeight: 600 }}>No weight data yet</div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Log sets with weight to see your 1RM trend</div>
                    </div>
                  ) : (
                    <>
                      <div role="img" aria-label="1RM strength progression over 8 weeks">
                        <OneRMLineChart data={oneRMByExercise} weeks={weekLabels} colors={EX_COLORS} />
                      </div>
                      <ChartLegend items={chartExercises.map((n, i) => ({ name: n, color: EX_COLORS[i % EX_COLORS.length] }))} />
                    </>
                  )}
                </div>

                {/* Volume (only on page 0, all-muscle view) */}
                {exPage === 0 && muscleTab === "all" && (
                  <>
                    <SectionHeader title="Weekly Training Volume" subtitle={selectedDayLabel ? `${selectedDayLabel} · 8 weeks` : "All days · 8 weeks"} />
                    <div style={ds.chartCard}>
                      <div role="img" aria-label="Weekly training volume bar chart">
                        <VolumeBarChart data={weeklyVol} weeks={weekLabels} />
                      </div>
                    </div>
                  </>
                )}

                {/* Relative strength gain */}
                <SectionHeader title="Relative Strength Gain" subtitle="% vs first week" />
                <div style={ds.chartCard}>
                  {relGains.every(g => g.pct === 0) ? (
                    <div style={ds.chartEmptyState}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                      <div style={{ fontSize: 13, color: DIM }}>Log more sessions to see trends</div>
                    </div>
                  ) : (
                    <div role="img" aria-label="Relative strength gain percentage chart">
                      <RelGainChart data={relGains} colors={EX_COLORS} />
                    </div>
                  )}
                </div>

                {/* Pagination — bottom */}
                {muscleFilteredExercises.length > PAGE_SIZE && (
                  <div style={{ ...ds.pageRow, marginTop: 4 }}>
                    <span style={ds.pageInfo}>{exPage + 1} / {totalExPages}</span>
                    <div style={ds.pageBtns}>
                      <button style={{ ...ds.pageBtn, opacity: exPage === 0 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.max(0, p - 1))} disabled={exPage === 0}>‹ Prev</button>
                      <button style={{ ...ds.pageBtn, opacity: exPage >= totalExPages - 1 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.min(totalExPages - 1, p + 1))} disabled={exPage >= totalExPages - 1}>Next ›</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Consistency heatmap always visible */}
            <SectionHeader title="Training Consistency" subtitle="Sessions per month · 12 months" />
            <div style={ds.chartCard}>
              <div role="img" aria-label="Training consistency heatmap by month">
                <ConsistencyHeatmap data={heatmap} max={maxHeat} />
              </div>
            </div>
            <div style={{ height: 48 }} />
          </>
        )}
        {/* ── AI COACH TAB ── */}
        {tab === "aicoach" && (
          <div>
            {/* Header */}
            <div style={ds.aiHeader}>
              <div style={ds.aiTitle}>Apex Coach</div>
              <div style={ds.aiSub}>Analysis of your latest workouts</div>
            </div>

            {/* Generate button / loading / error */}
            {!insight && !insightLoading && !insightError && (
              <div style={ds.aiEmptyCard}>
                <div style={ds.aiEmptyTitle}>Ready to analyse your training</div>
                <div style={ds.aiEmptySub}>Apex will review your volume, strength trends, muscle balance, and give you specific recommendations for next week.</div>
                <button style={ds.aiGenerateBtn} onClick={generateInsight}>Generate Report</button>
              </div>
            )}

            {insightLoading && (
              <div style={ds.aiLoadingCard}>
                <div style={ds.insightSpinner} />
                <div style={ds.aiLoadingText}>Apex is analysing your training data...</div>
                <div style={ds.aiLoadingSub}>This takes about 10 seconds</div>
              </div>
            )}

            {insightError && (
              <div style={ds.aiErrorCard}>
                <div style={ds.aiErrorText}>{insightError}</div>
                <button style={ds.aiGenerateBtn} onClick={generateInsight}>Try Again</button>
              </div>
            )}

            {/* Report */}
            {insight && (
              <div>
                <div style={ds.aiReportCard}>
                  <InsightReport text={insight} />
                  <button style={ds.aiRegenerateBtn} onClick={generateInsight}>Regenerate Report</button>
                </div>
              </div>
            )}

            {/* Suggestion cards */}
            {suggestions.filter((_, i) => !dismissedOnce.includes(i)).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={ds.aiSuggestionsHeader}>
                  <div style={ds.aiSuggestionsTitle}>Program Suggestions</div>
                  <div style={ds.aiSuggestionsSub}>Apex recommends these changes to your program</div>
                </div>
                {suggestions.map((sug, i) => {
                  if (dismissedOnce.includes(i)) return null;
                  const days = program?.days || [];
                  const needsDayPick = (sug.type === "add" || sug.type === "swap") &&
                    (sug.suggestedDay === "auto" || !days.find(d => d.label === sug.suggestedDay));
                  const suggestedDay = days.find(d => d.label === sug.suggestedDay);
                  return (
                    <div key={i} style={ds.sugCard}>
                      <div style={ds.sugTopRow}>
                        <div style={{ ...ds.sugTypeBadge, background: sug.type === "remove" ? "#3a1a1a" : sug.type === "swap" ? "#1a2a3a" : "#1a2a1a", color: sug.type === "remove" ? "#ff6b6b" : sug.type === "swap" ? "#45b7d1" : "#4ecdc4", borderColor: sug.type === "remove" ? "#ff6b6b33" : sug.type === "swap" ? "#45b7d133" : "#4ecdc433" }}>
                          {sug.type.toUpperCase()}
                        </div>
                        <div style={ds.sugExName}>{sug.type === "swap" ? `${sug.swapFrom} → ${sug.exercise}` : sug.exercise}</div>
                      </div>
                      {sug.type === "rest" && (
                        <div style={ds.sugMeta}>
                          {sug.currentRestSeconds > 0 ? `${sug.currentRestSeconds}s` : "Current"} → <span style={{ color: "#a78bfa", fontWeight: 700 }}>{sug.restSeconds}s rest</span>
                        </div>
                      )}
                      {sug.type !== "remove" && sug.type !== "rest" && (
                        <div style={ds.sugMeta}>
                          {sug.sets} sets × {sug.reps} {sug.unit !== "BW" ? sug.unit : "bodyweight"}
                          {suggestedDay && <span style={ds.sugDayTag}>{suggestedDay.label}</span>}
                        </div>
                      )}
                      <div style={ds.sugReason}>{sug.reason}</div>

                      {/* Day picker if needed */}
                      {dayPickerFor === i && (
                        <div style={ds.sugDayPicker}>
                          <div style={ds.sugDayPickerLabel}>Choose which day to add this to:</div>
                          {days.map(d => (
                            <button key={d.id} style={ds.sugDayPickerBtn} onClick={() => { acceptSuggestion(i, d.id); }}>
                              {d.label}
                            </button>
                          ))}
                          <button style={ds.sugDayPickerCancel} onClick={() => setDayPickerFor(null)}>Cancel</button>
                        </div>
                      )}

                      {dayPickerFor !== i && (
                        <div style={ds.sugActions}>
                          <button style={ds.sugAcceptBtn} onClick={() => {
                            if (needsDayPick) { setDayPickerFor(i); }
                            else { acceptSuggestion(i, suggestedDay?.id || null); }
                          }}>Accept</button>
                          <button style={ds.sugDismissBtn} onClick={() => dismissOnce(i)}>Skip this time</button>
                          <button style={ds.sugNeverBtn} onClick={() => dismissForever(i)}>Never suggest</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ height: 48 }} />
          </div>
        )}
      </div>

      {/* Muscle group override modal */}
      {overrideTarget && (
        <div style={ds.modalOverlay} role="dialog" aria-modal="true" aria-label="Assign muscle group">
          <div style={ds.modal}>
            <div style={ds.modalTitle}>Assign Muscle Group</div>
            <div style={ds.modalEx}>"{overrideTarget}"</div>
            <div style={ds.modalBtns}>
              {MUSCLE_GROUPS.map((g, i) => (
                <button key={g.key} style={ds.modalBtn} onClick={() => applyOverride(overrideTarget, g.key)}>
                  <span style={{ ...ds.modalBtnDot, background: EX_COLORS[i % EX_COLORS.length] }} />{g.label}
                </button>
              ))}
              <button style={ds.modalBtn} onClick={() => applyOverride(overrideTarget, "other")}>
                <span style={{ ...ds.modalBtnDot, background: "#555" }} />Other / Unclassified
              </button>
            </div>
            <button style={ds.modalCancel} onClick={() => setOverrideTarget(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════
   INSIGHT REPORT — markdown-lite renderer
════════════════════════════════ */
function InsightReport({ text }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        const isHeader = line.startsWith('## ') || line.startsWith('# ');
        if (isHeader) {
          const text = line.startsWith('## ') ? line.slice(3) : line.slice(2);
          const prevHeaders = lines.slice(0, i).filter(l => l.startsWith('## ') || l.startsWith('# '));
          return (
            <div key={i}>
              {prevHeaders.length > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '16px 0 10px' }} />}
              <div style={{ fontSize: 13, fontWeight: 800, color: RED, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', borderLeft: `3px solid ${RED}`, paddingLeft: 8 }}>{text}</div>
            </div>
          );
        }
        // Standalone bold line = treat as section header
        if (line.startsWith('**') && line.endsWith('**') && !line.slice(2,-2).includes('**')) {
          const text = line.slice(2,-2);
          const prevHeaders = lines.slice(0, i).filter(l => (l.startsWith('## ') || l.startsWith('# ') || (l.startsWith('**') && l.endsWith('**') && !l.slice(2,-2).includes('**'))));
          return (
            <div key={i}>
              {prevHeaders.length > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '16px 0 10px' }} />}
              <div style={{ fontSize: 13, fontWeight: 800, color: RED, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', borderLeft: `3px solid ${RED}`, paddingLeft: 8 }}>{text}</div>
            </div>
          );
        }
        // Bold inline
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} style={{ color: 'rgba(255,255,255,0.88)', marginBottom: 3 }}>
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} style={{ color: TEXT, fontWeight: 700 }}>{p.slice(2,-2)}</strong>
                : p
            )}
          </div>
        );
      })}
    </div>
  );
}




function HistoryTab({ logs, onDeleteLog }) {
  const reversed = [...logs].reverse();
  function vol(exList) {
    return exList.reduce((s, e) => s + (parseInt(e.sets) || 0) * (parseInt(e.reps) || 0) * (parseFloat(e.weight) || 0), 0);
  }
  const maxVol = Math.max(...reversed.map(l => vol(l.exercises)), 1);

  if (reversed.length === 0) return (
    <div style={s.empty}>
      <div style={s.emptyText}>No logged workouts yet</div>
      <div style={s.emptyHint}>Log a workout to start tracking</div>
    </div>
  );

  function handleDelete(log) {
    const ok = window.confirm(`Delete this logged workout ("${log.dayLabel}" on ${formatDate(log.date)})? This can't be undone.`);
    if (ok && onDeleteLog) onDeleteLog(log.id);
  }

  return (
    <>
      {reversed.map(log => {
        const v = vol(log.exercises);
        return (
          <div key={log.id} style={s.logCard}>
            <div style={s.logHeader}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flex: 1, gap: 10 }}>
                <div>
                  <div style={s.logDay}>{log.dayLabel}</div>
                  <div style={s.logDate}>{formatDate(log.date)}</div>
                  {log.sessionNote && <div style={s.logSessionNote}>"{log.sessionNote}"</div>}
                </div>
                {v > 0 && (
                  <div style={s.logVolBox}>
                    <div style={s.logVolNum}>{v.toLocaleString()}</div>
                    <div style={s.logVolLabel}>kg volume</div>
                  </div>
                )}
              </div>
              <button
                style={hist_s.deleteXBtn}
                onClick={() => handleDelete(log)}
                aria-label="Delete this logged workout"
                title="Delete this logged workout">
                ✕
              </button>
            </div>
            {v > 0 && (
              <div style={s.volBarWrap}>
                <div style={{ ...s.volBar, width: `${Math.min(100, (v / maxVol) * 100)}%` }} />
              </div>
            )}
            <div style={s.logExList}>
              {log.exercises.map((e, i) => (
                <div key={i} style={s.logEx}>
                  <div style={s.logExName}>{e.name}</div>
                  <div style={s.logExPills}>
                    {e.sets && <span style={s.logPill}>{e.sets} sets</span>}
                    {e.reps && <span style={s.logPill}>{e.reps} reps</span>}
                    {e.weight && <span style={s.logPill}>{e.weight} {e.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

const hist_s = {
  deleteXBtn: { background: "none", border: "none", color: DIM, fontSize: 14, cursor: "pointer", padding: "2px 0 0 10px", lineHeight: 1, flexShrink: 0 },
};

/* ── Charts ── */
function OneRMLineChart({ data, weeks, colors }) {
  const W = 360, H = 160, PAD = { t: 10, r: 8, b: 28, l: 38 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  const allVals = data.flatMap(d => d.data).filter(v => v != null);
  // FIX: 10% padding on chart extremes so points don't touch edges
  const minV = Math.floor(Math.min(...allVals) * 0.9);
  const maxV = Math.ceil(Math.max(...allVals) * 1.1);
  const range = maxV - minV || 1;

  const DASHES = ["none", "6,3", "3,3", "8,2,2,2", "4,4", "1,3"];

  function xPos(i) { return PAD.l + (i / (weeks.length - 1)) * iW; }
  function yPos(v) { return PAD.t + iH - ((v - minV) / range) * iH; }

  const yTicks = 4;
  const yGrid = Array.from({ length: yTicks + 1 }, (_, i) => minV + (range / yTicks) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
      {yGrid.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={yPos(v)} x2={PAD.l + iW} y2={yPos(v)} stroke="#2a2a2a" strokeWidth="1" />
          <text x={PAD.l - 4} y={yPos(v) + 4} textAnchor="end" fill="#555" fontSize="8">{Math.round(v)}</text>
        </g>
      ))}
      {weeks.map((w, i) => (
        <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fill="#555" fontSize="8">{w}</text>
      ))}
      {data.map((ex, ei) => {
        const pts = ex.data.map((v, i) => v != null ? [xPos(i), yPos(v)] : null);
        const segments = [];
        let current = [];
        pts.forEach(p => {
          if (p) { current.push(p); }
          else if (current.length) { segments.push(current); current = []; }
        });
        if (current.length) segments.push(current);
        return segments.map((seg, si) => (
          <g key={`${ei}-${si}`}>
            <polyline points={seg.map(p => p.join(",")).join(" ")} fill="none"
              stroke={colors[ei % colors.length]} strokeWidth="2"
              strokeDasharray={DASHES[ei % DASHES.length]}
              strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            {seg.map((p, pi) => (
              <circle key={pi} cx={p[0]} cy={p[1]} r="2.5" fill={colors[ei % colors.length]} opacity="0.9" />
            ))}
          </g>
        ));
      })}
    </svg>
  );
}

function VolumeBarChart({ data, weeks }) {
  const W = 360, H = 140, PAD = { t: 8, r: 8, b: 28, l: 44 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  // FIX: 10% padding on max
  const maxV = Math.max(...data, 1) * 1.1;
  const barW = (iW / data.length) * 0.6;
  const gap = iW / data.length;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxV));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
      {yTicks.map((v, i) => {
        const y = PAD.t + iH - (v / maxV) * iH;
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y} stroke="#2a2a2a" strokeWidth="1" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fill="#555" fontSize="7">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}t` : Math.round(v)}
            </text>
          </g>
        );
      })}
      {data.map((v, i) => {
        const barH = Math.max((v / maxV) * iH, v > 0 ? 2 : 0);
        const x = PAD.l + i * gap + (gap - barW) / 2;
        const y = PAD.t + iH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={RED} rx="2" opacity={v > 0 ? 0.85 : 0.1} />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fill="#555" fontSize="7">{weeks[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function RelGainChart({ data, colors }) {
  const W = 360, H = 140, PAD = { t: 8, r: 8, b: 28, l: 44 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;
  const maxPct = Math.max(...data.map(d => Math.abs(d.pct)), 1);
  const barH = iH / (data.length + 1);
  const barPad = barH * 0.25;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", overflow: "visible" }}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + iH} stroke="#333" strokeWidth="1" />
      {[0, 25, 50, 75, 100].map(p => {
        const x = PAD.l + (p / 100) * iW;
        return (
          <g key={p}>
            <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + iH} stroke="#222" strokeWidth="1" />
            <text x={x} y={H - 6} textAnchor="middle" fill="#555" fontSize="7">{p}%</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const y = PAD.t + i * (iH / data.length) + barPad / 2;
        const bH = iH / data.length - barPad;
        const bW = Math.max((Math.abs(d.pct) / 100) * iW, d.pct !== 0 ? 2 : 0);
        return (
          <g key={d.name}>
            <rect x={PAD.l} y={y} width={bW} height={bH} fill={colors[i % colors.length]} rx="2" opacity="0.85" />
            <text x={PAD.l - 4} y={y + bH / 2 + 3} textAnchor="end" fill="#888" fontSize="7.5"
              style={{ fontFamily: "inherit" }}>
              {d.name.split(" ")[0]}
            </text>
            <text x={PAD.l + bW + 4} y={y + bH / 2 + 3} fill={colors[i % colors.length]} fontSize="7.5" fontWeight="600">
              {d.pct > 0 ? "+" : ""}{d.pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ConsistencyHeatmap({ data, max }) {
  const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  function heatColor(count) {
    if (count === 0) return "#1a1a1c";
    const intensity = Math.min(count / max, 1);
    const r = Math.round(30 + intensity * (232 - 30));
    const g = Math.round(30 + intensity * (48 - 30));
    const b = Math.round(30 + intensity * (42 - 30));
    return `rgb(${r},${g},${b})`;
  }

  const cellSize = 22, gap = 4;
  const W = data.length * (cellSize + gap);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W + 8} ${cellSize + 22}`} style={{ width: "100%", minWidth: 200 }}>
        {data.map((d, i) => {
          const x = i * (cellSize + gap) + 4;
          const mo = parseInt(d.mo.slice(5)) - 1;
          return (
            <g key={d.mo}>
              <rect x={x} y={14} width={cellSize} height={cellSize} fill={heatColor(d.count)} rx="3" />
              {d.count > 0 && (
                <text x={x + cellSize / 2} y={14 + cellSize / 2 + 4}
                  textAnchor="middle" fill="#fff" fontSize="8" fontWeight="600">{d.count}</text>
              )}
              <text x={x + cellSize / 2} y={10} textAnchor="middle" fill="#555" fontSize="7">{MONTH_LABELS[mo]}</text>
            </g>
          );
        })}
      </svg>
      <div style={ds.heatLegend}>
        <span style={ds.heatLegendLabel}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <div key={f} style={{ ...ds.heatSwatch, background: f === 0 ? "#1a1a1c" : `rgba(232,48,42,${f})` }} />
        ))}
        <span style={ds.heatLegendLabel}>More</span>
      </div>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div style={ds.legend}>
      {items.map((item, i) => (
        <div key={item.name} style={ds.legendItem}>
          <div style={{ ...ds.legendDot, background: item.color, borderStyle: ["solid", "dashed", "dotted", "solid", "dashed"][i % 5] }} />
          <span style={ds.legendLabel}>{item.name}</span>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={ds.sectionHead}>
      <div style={ds.sectionTitle}>{title}</div>
      {subtitle && <div style={ds.sectionSub}>{subtitle}</div>}
    </div>
  );
}

/* ── Dashboard styles ── */
const ds = {
  prGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  prCard: { background: CARD_BG, borderRadius: 12, padding: "12px 12px 10px", border: `1px solid ${BORDER}`, position: "relative", overflow: "hidden" },
  prAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "12px 12px 0 0" },
  prName: { fontSize: 11, color: DIM, marginBottom: 6, marginTop: 6, fontWeight: 600, letterSpacing: "0.04em" },
  prVal: { fontSize: 26, fontWeight: 800, color: TEXT, lineHeight: 1 },
  prUnit: { fontSize: 12, color: DIM, marginLeft: 3, fontWeight: 400 },
  prDelta: { fontSize: 11, fontWeight: 600, marginTop: 4 },
  chartCard: { background: CARD_BG, borderRadius: 14, padding: "14px 10px 10px", border: `1px solid ${BORDER}`, marginBottom: 20, overflow: "hidden" },
  // FIX: Richer empty state for charts
  chartEmptyState: { textAlign: "center", padding: "24px 0" },
  legend: { display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendDot: { width: 16, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 10, color: DIM },
  sectionHead: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: "0.02em" },
  sectionSub: { fontSize: 10, color: DIM, marginTop: 2, letterSpacing: "0.04em" },
  heatLegend: { display: "flex", alignItems: "center", gap: 4, marginTop: 4, justifyContent: "flex-end" },
  heatLegendLabel: { fontSize: 9, color: "#555" },
  heatSwatch: { width: 12, height: 12, borderRadius: 2 },
  exFilterWrap: { position: "relative", marginBottom: 16 },
  exFilterBtn: { width: "100%", background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, fontSize: 13, fontWeight: 600, padding: "11px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "inherit" },
  exDropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1e1e20", border: `1px solid ${BORDER}`, borderRadius: 10, zIndex: 50, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" },
  exDropItem: { width: "100%", background: "none", border: "none", borderBottom: `1px solid #252528`, color: DIM, fontSize: 13, padding: "12px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" },
  exDropItemActive: { color: TEXT, background: "rgba(232,48,42,0.08)" },
  exDropDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  filterBtnInner: { display: "flex", alignItems: "center", gap: 10, flex: 1 },
  filterBtnLabel: { fontSize: 14, fontWeight: 600, color: TEXT, textAlign: "left" },
  filterBtnSub: { fontSize: 10, color: DIM, marginTop: 1, textAlign: "left" },
  dayDropItem: { width: "100%", background: "none", border: "none", borderBottom: `1px solid #252528`, color: DIM, fontSize: 13, padding: "12px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: "inherit" },
  dayDropLeft: { flex: 1 },
  dayDropLabel: { fontSize: 13, fontWeight: 600, color: TEXT, display: "flex", alignItems: "center", gap: 6 },
  dayDropSub: { fontSize: 10, color: DIM, marginTop: 2 },
  dayDropDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block" },
  notReady: { textAlign: "center", padding: "60px 24px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  notReadyIcon: { fontSize: 44, marginBottom: 4 },
  notReadyTitle: { fontSize: 18, fontWeight: 700, color: TEXT },
  notReadySub: { fontSize: 13, color: DIM, lineHeight: 1.6, maxWidth: 280 },
  chartEmpty: { textAlign: "center", padding: "24px 0", fontSize: 12, color: "#444", fontStyle: "italic" },
  pageRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pageInfo: { fontSize: 11, color: DIM },
  pageBtns: { display: "flex", gap: 6 },
  pageBtn: { background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },

  // Muscle group tabs
  muscleTabBar: { display: "flex", overflowX: "auto", gap: 6, marginBottom: 14, scrollbarWidth: "none", paddingBottom: 2 },
  muscleTab: { background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 20, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 },
  muscleTabActive: { background: RED, border: `1px solid ${RED}`, color: "#fff" },
  muscleTabCount: { fontSize: 10, background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "1px 6px", fontWeight: 700 },
  muscleTabCountActive: { background: "rgba(255,255,255,0.25)" },
  classifyLink: { background: "none", border: "none", color: RED, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" },

  // Exercises tab
  classifyHeader: { marginBottom: 16 },
  classifyTitle: { fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 },
  classifySub: { fontSize: 12, color: DIM, lineHeight: 1.5 },
  classifySection: { marginBottom: 20 },
  classifySectionLabel: { fontSize: 11, color: TEXT, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 },
  classifyGroupDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block" },
  classifyGroupCount: { fontSize: 10, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, borderRadius: 10, padding: "1px 7px", fontWeight: 700 },
  classifyRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` },
  classifyExName: { fontSize: 13, color: TEXT, flex: 1 },
  classifyChangeBtn: { background: "none", border: `1px solid ${BORDER}`, color: DIM, fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },

  // Override modal
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: "#1e1e20", borderRadius: "18px 18px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 430 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 6, textAlign: "center" },
  modalEx: { fontSize: 13, color: DIM, marginBottom: 18, textAlign: "center", fontStyle: "italic" },
  modalBtns: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  modalBtn: { background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 14, fontWeight: 500, padding: "12px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" },
  modalBtnDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  modalCancel: { width: "100%", background: "none", border: `1px solid ${BORDER}`, color: DIM, fontSize: 14, padding: "12px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" },

  // AI Coach tab
  aiHeader: { marginBottom: 16 },
  aiTitle: { fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 4 },
  aiSub: { fontSize: 12, color: DIM, lineHeight: 1.5 },
  aiEmptyCard: { background: CARD_BG, borderRadius: 14, padding: 20, border: `1px solid ${BORDER}`, marginBottom: 16, textAlign: "center" },
  aiEmptyTitle: { fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8 },
  aiEmptySub: { fontSize: 12, color: DIM, lineHeight: 1.6, marginBottom: 18 },
  aiGenerateBtn: { background: RED, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "13px 32px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  aiLoadingCard: { background: CARD_BG, borderRadius: 14, padding: 32, border: `1px solid ${BORDER}`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  aiLoadingText: { fontSize: 14, fontWeight: 600, color: TEXT },
  aiLoadingSub: { fontSize: 12, color: DIM },
  aiErrorCard: { background: CARD_BG, borderRadius: 14, padding: 20, border: `1px solid rgba(232,48,42,0.3)`, textAlign: "center", marginBottom: 16 },
  aiErrorText: { fontSize: 13, color: "#ff6b6b", marginBottom: 14 },
  aiReportCard: { background: CARD_BG, borderRadius: 14, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 12 },
  aiRegenerateBtn: { width: "100%", background: "none", border: `1px solid ${RED}`, color: RED, fontSize: 13, fontWeight: 700, padding: "11px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", marginTop: 16 },
  aiSuggestionsHeader: { marginBottom: 12 },
  aiSuggestionsTitle: { fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 3 },
  aiSuggestionsSub: { fontSize: 11, color: DIM },

  // Suggestion cards
  sugCard: { background: CARD_BG, borderRadius: 14, padding: 14, border: `1px solid ${BORDER}`, marginBottom: 10 },
  sugTopRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  sugTypeBadge: { fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 6, border: "1px solid", flexShrink: 0 },
  sugExName: { fontSize: 14, fontWeight: 700, color: TEXT, flex: 1 },
  sugMeta: { fontSize: 12, color: DIM, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 },
  sugDayTag: { fontSize: 10, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, padding: "2px 8px", borderRadius: 6, fontWeight: 600 },
  sugReason: { fontSize: 12, color: DIM, lineHeight: 1.5, marginBottom: 12, paddingTop: 6, borderTop: `1px solid ${BORDER}` },
  sugActions: { display: "flex", gap: 6 },
  sugAcceptBtn: { background: RED, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  sugDismissBtn: { background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  sugNeverBtn: { background: "none", border: "none", color: "#444", fontSize: 11, fontWeight: 500, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit" },
  sugDayPicker: { background: SURFACE, borderRadius: 10, padding: 12, marginBottom: 8 },
  sugDayPickerLabel: { fontSize: 11, color: DIM, fontWeight: 600, marginBottom: 8 },
  sugDayPickerBtn: { width: "100%", background: CARD_BG, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 600, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginBottom: 6, textAlign: "left" },
  sugDayPickerCancel: { width: "100%", background: "none", border: "none", color: DIM, fontSize: 12, padding: "6px", cursor: "pointer", fontFamily: "inherit" },

  // AI Insights
  insightCard: { background: CARD_BG, borderRadius: 14, padding: 16, border: `1px solid ${BORDER}`, marginBottom: 20 },
  insightEmpty: { textAlign: "center", padding: "16px 0" },
  insightEmptyIcon: { fontSize: 36, marginBottom: 8 },
  insightEmptyTitle: { fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 },
  insightEmptySub: { fontSize: 12, color: DIM, lineHeight: 1.6, marginBottom: 16, maxWidth: 280, margin: "0 auto 16px" },
  insightBtn: { background: RED, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 28px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  insightLoading: { textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  insightSpinner: { width: 28, height: 28, border: `3px solid ${BORDER}`, borderTop: `3px solid ${RED}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  insightLoadingText: { fontSize: 13, color: DIM },
  insightError: { textAlign: "center", padding: "16px 0", color: "#ff6b6b" },
  insightRefreshBtn: { background: "none", border: `1px solid ${BORDER}`, color: DIM, fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", marginTop: 16, width: "100%" },

  // Muscle Snapshot grid
  muscleSnapshotGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 },
  muscleSnapshotCard: { background: CARD_BG, borderRadius: 12, padding: "12px 12px 10px", border: `1px solid ${BORDER}`, position: "relative", overflow: "hidden" },
  muscleSnapshotAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "12px 12px 0 0" },
  muscleSnapshotLabelRow: { marginTop: 8, marginBottom: 6 },
  muscleSnapshotLabel: { fontSize: 11, color: DIM, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" },
  muscleSnapshotVolRow: { display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 },
  muscleSnapshotVol: { fontSize: 20, fontWeight: 800, color: TEXT, lineHeight: 1 },
  muscleSnapshotVolLabel: { fontSize: 11, color: DIM, fontWeight: 400, marginLeft: 2 },
  muscleSnapshotTrend: { fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 6 },
  muscleSnapshotPR: { fontSize: 11, color: DIM, marginBottom: 3 },
  muscleSnapshotCount: { fontSize: 10, color: "#555", fontWeight: 600 },

  // Date range picker
  dateRangeRow: { display: "flex", gap: 6, marginBottom: 14 },
  dateRangeBtn: { flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 12, fontWeight: 700, padding: "7px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "center" },
  dateRangeBtnOn: { background: RED, border: `1px solid ${RED}`, color: "#fff" },
};

const s = {
  root: { background: SCREEN_BG, minHeight: "100vh", fontFamily: "-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", color: TEXT, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" },
  backBtn: { fontSize: 28, color: RED, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 },
  headerTitle: { fontSize: 17, fontWeight: 600 },
  homeWrap: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px", minHeight: "100vh" },
  homeTitleBlock: { marginBottom: 48, textAlign: "center" },
  homeLogoLine: { display: "flex", justifyContent: "center", alignItems: "baseline", gap: 10, marginBottom: 8 },
  homeLogoRed: { fontSize: 58, fontWeight: 800, color: RED, letterSpacing: "0.04em", lineHeight: 1, textShadow: "0 0 40px rgba(232,48,42,0.35)" },
  homeLogoWhite: { fontSize: 58, fontWeight: 200, color: TEXT, letterSpacing: "0.08em", lineHeight: 1 },
  homeSubtitle: { fontSize: 12, color: DIM, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 },
  homeDivider: { width: 36, height: 2, background: RED, borderRadius: 2, margin: "0 auto" },
  homeCards: { display: "flex", flexDirection: "column", gap: 12 },
  homeCard: { background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" },
  homeCardDim: { opacity: 0.5 },
  homeCardLeft: { display: "flex", alignItems: "center", gap: 14 },
  homeCardIcon: { fontSize: 26 },
  homeCardLabel: { fontSize: 18, fontWeight: 700 },
  homeCardDesc: { fontSize: 12, color: DIM, marginTop: 2 },
  homeCardArrow: { fontSize: 26, color: RED, fontWeight: 300 },
  progSection: { padding: "10px 16px 0" },
  progSectionLabel: { fontSize: 10, color: DIM, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 8 },
  dayCountRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  dayCountBtn: { width: 38, height: 38, borderRadius: 10, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  dayCountBtnOn: { background: RED, border: `1px solid ${RED}`, color: "#fff" },
  dayLabelRow: { padding: "10px 16px 0" },
  dayLabelEdit: { display: "flex", gap: 8, alignItems: "center" },
  dayLabelStatic: { display: "flex", alignItems: "center", gap: 10 },
  dayLabelText: { fontSize: 18, fontWeight: 700 },
  labelEditBtn: { background: "none", border: "none", color: DIM, fontSize: 12, cursor: "pointer", padding: 0 },
  labelSaveBtn: { background: RED, border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" },
  tabBar: { display: "flex", overflowX: "auto", padding: "10px 12px 0", borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none" },
  tab: { background: "none", border: "none", padding: "4px 10px 0", cursor: "pointer", position: "relative", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  tabActive: {},
  tabText: { fontSize: 13, color: DIM, fontWeight: 400, paddingBottom: 8, whiteSpace: "nowrap" },
  tabTextActive: { color: RED, fontWeight: 600 },
  tabDot: { position: "absolute", top: 0, right: 2, width: 14, height: 14, borderRadius: "50%", background: "#333", color: DIM, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  tabDotActive: { background: RED, color: "#fff" },
  tabUnderline: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: RED, borderRadius: "2px 2px 0 0" },
  sectionLabel: { fontSize: 12, color: DIM, padding: "10px 16px 4px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 },
  scroll: { flex: 1, overflowY: "auto", padding: "8px 12px" },
  supersetWrap: { marginBottom: 12 },
  supersetPillWrap: { display: "flex", alignItems: "center", gap: 8 },
  supersetLine: { flex: 1, height: 1, background: RED, opacity: 0.3 },
  supersetPill: { color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 14px", borderRadius: 20, flexShrink: 0 },
  groupCard: { background: CARD_BG, borderRadius: 14, padding: "0 14px", border: "1px solid", marginTop: -1 },
  exRow: { paddingTop: 12, paddingBottom: 10 },
  exTopRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  exName: { fontSize: 15, fontWeight: 700, flex: 1, paddingRight: 8 },
  badgePill: { background: RED, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, flexShrink: 0 },
  exStats: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  statPill: { background: BADGE_BG, color: "#e8c0be", fontSize: 12, fontWeight: 500, padding: "4px 11px", borderRadius: 8, border: `1px solid rgba(232,48,42,0.2)` },
  exNote: { fontSize: 12, color: DIM, marginTop: 4, lineHeight: 1.4 },
  exActions: { display: "flex", gap: 14, marginTop: 8 },
  actionBtn: { background: "none", border: "none", color: DIM, fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 500 },
  confirmRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
  confirmMsg: { flex: 1, fontSize: 12, color: DIM },
  confirmNo: { background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 12, padding: "5px 10px", borderRadius: 6, cursor: "pointer" },
  confirmYes: { background: RED, border: "none", color: "#fff", fontSize: 12, padding: "5px 10px", borderRadius: 6, cursor: "pointer" },
  divider: { height: 1, background: BORDER },
  addExBtn: { width: "100%", background: CARD_BG, border: `1px dashed ${BORDER}`, color: RED, fontSize: 14, fontWeight: 600, padding: "13px", borderRadius: 14, cursor: "pointer", marginTop: 8 },
  formWrap: { marginTop: 8 },
  formCard: { background: CARD_BG, borderRadius: 14, padding: "14px", border: `1px solid ${BORDER}` },
  formHeader: { fontSize: 10, fontWeight: 700, color: RED, marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase", borderLeft: `2px solid ${RED}`, paddingLeft: 8 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 10, color: DIM, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 5 },
  input: { width: "100%", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 14, padding: "9px 11px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  rowGap: { display: "flex", gap: 8 },
  unitRow: { display: "flex", gap: 4 },
  unitBtn: { flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 11, fontWeight: 600, padding: "9px 2px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  unitBtnOn: { background: RED, border: `1px solid ${RED}`, color: "#fff" },
  optSection: { background: SURFACE, borderRadius: 10, padding: "10px 12px", marginBottom: 10 },
  optSectionLabel: { fontSize: 10, color: DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 600 },
  optRow: { marginBottom: 8 },
  optTop: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  optInput: { marginTop: 6, paddingLeft: 30 },
  optLabel: { fontSize: 13, color: DIM, fontWeight: 500 },
  checkbox: { width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${BORDER}`, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxOn: { background: RED, border: `1.5px solid ${RED}` },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 },
  formActions: { display: "flex", gap: 8, marginTop: 14 },
  btnCancel: { flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, color: DIM, fontSize: 14, fontWeight: 600, padding: "12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  btnSave: { flex: 2, background: RED, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  logBar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "10px 14px 26px", background: `linear-gradient(to top,${SCREEN_BG} 70%,transparent)` },
  logBtn: { width: "100%", background: RED, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, padding: "15px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(232,48,42,0.45)" },
  logBtnSuccess: { background: "#7a4a00", boxShadow: "0 4px 24px rgba(200,120,0,0.35)" },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyText: { fontSize: 15, color: DIM, marginBottom: 6 },
  emptyHint: { fontSize: 12, color: "#444" },
  targetRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 5 },
  targetLabel: { fontSize: 10, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 },
  targetPill: { fontSize: 11, color: "#3d3d3d", background: "#1a1a1c", border: "1px solid #242424", padding: "2px 9px", borderRadius: 6 },
  lastLabel: { fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 },
  lastPill: { fontSize: 11, color: "#555", background: "#1a1a1c", border: "1px solid #2a2a2a", padding: "2px 9px", borderRadius: 6 },
  logCard: { background: CARD_BG, borderRadius: 14, padding: "14px", marginBottom: 12, border: `1px solid ${BORDER}` },
  logHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  logDay: { fontSize: 15, fontWeight: 700 },
  logDate: { fontSize: 12, color: DIM, marginTop: 2 },
  logVolBox: { textAlign: "right" },
  logVolNum: { fontSize: 18, fontWeight: 700, color: RED },
  logVolLabel: { fontSize: 10, color: DIM },
  volBarWrap: { height: 3, background: "#222", borderRadius: 2, marginBottom: 10 },
  volBar: { height: "100%", background: RED, borderRadius: 2 },
  logExList: { display: "flex", flexDirection: "column", gap: 8 },
  logEx: { borderTop: `1px solid ${BORDER}`, paddingTop: 8 },
  logExName: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  logExPills: { display: "flex", flexWrap: "wrap", gap: 5 },
  logPill: { background: BADGE_BG, color: "#e8c0be", fontSize: 11, padding: "3px 9px", borderRadius: 6 },
  logSessionNote: { fontSize: 12, color: DIM, marginTop: 5, fontStyle: "italic", lineHeight: 1.4 },
  subTabBar: { display: "flex", padding: "0 14px", borderBottom: `1px solid ${BORDER}` },
  subTab: { background: "none", border: "none", color: DIM, fontSize: 14, fontWeight: 500, padding: "10px 16px", cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: "inherit" },
  subTabActive: { color: TEXT, borderBottom: `2px solid ${RED}` },
};
