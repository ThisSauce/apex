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

function uid() { return Math.random().toString(36).slice(2, 9); }

function makeId() { return Math.random().toString(36).slice(2, 9); }

function ex(name, sets, reps, opts = {}) {
  return {
    id: makeId(), name, sets: String(sets), reps: String(reps),
    weight: opts.weight || "", unit: opts.unit || "kg",
    useRir: false, rir: "", useIntensity: !!opts.intensity, intensity: opts.intensity || "",
    useTempo: !!opts.tempo, tempo: opts.tempo || "",
    note: opts.note || "", supersetId: opts.ss || null, last: null
  };
}

function defaultData() {
  return {
    program: { name: "My Program", days: [] },
    logs: [],
    lastLogged: {}
  };
}

function loadData() {
  try {
    const r = localStorage.getItem(SK);
    if (r) {
      const p = JSON.parse(r);
      if (!p.lastLogged) p.lastLogged = {};
      if (!p.logs) p.logs = [];
      if (!p.program) p.program = { name: "My Program", days: [] };
      return p;
    }
  } catch {}
  return defaultData();
}
function saveData(d) { try { localStorage.setItem(SK, JSON.stringify(d)); } catch {} }

function blankExercise() {
  return {
    id: uid(), name: "", sets: "", reps: "", weight: "", unit: "kg",
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

  const { toast, show: showToast } = useToast();

  useEffect(() => { saveData(data); }, [data]);

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

  function logWorkout(dayId) {
    const day = program.days.find(d => d.id === dayId);
    if (!day) return;
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = day.exercises.map(e => ({
      name: e.name, sets: e.sets, reps: e.reps, weight: e.weight, unit: e.unit,
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
    const entry = { id: uid(), date: today, dayId, dayLabel: day.label, exercises: snapshot };
    setData(prev => ({ ...prev, logs: [...prev.logs, entry], lastLogged: newLast }));
    return true;
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
          onAddExercise={addExerciseToDay}
          onUpdateExercise={updateExerciseInDay}
          onDeleteExercise={deleteExerciseFromDay}
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
          onLog={() => logWorkout(activeDayId)}
          showToast={showToast}
        />
        <Toast toast={toast} />
      </>
    );
  }

  if (page === "progress") {
    return (
      <>
        <ProgressPage logs={data.logs} program={data.program} onBack={() => setPage("home")} />
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
          if (program.days.length > 0) { setActiveDayId(program.days[0].id); setPage("exercise"); }
          else setPage("program");
        }}
        onProgress={() => setPage("progress")}
      />
      <Toast toast={toast} />
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
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
          <button style={{ ...s.homeCard, ...(dayCount === 0 ? s.homeCardDim : {}) }} onClick={onExercise}>
            <div style={s.homeCardLeft}>
              <div>
                <div style={{ ...s.homeCardLabel, color: RED }}>Exercise</div>
                <div style={s.homeCardDesc}>
                  {dayCount > 0 ? "Log today's sets, reps & weight" : "Set up a program first"}
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
function ProgramPage({ program, onBack, onSetDayCount, onAddExercise, onUpdateExercise,
  onDeleteExercise, onToggleSuperset, onRenameDay, onReorder, onAddToSuperset, showToast }) {

  const [activeIdx, setActiveIdx] = useState(0);
  const [showForm, setShowForm] = useState(false);
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

  const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹</button>
        <span style={s.headerTitle}>Program Builder</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={s.progSection}>
        <div style={s.progSectionLabel}>Days per week</div>
        <div style={s.dayCountRow}>
          {DAY_OPTIONS.map(n => (
            <button key={n}
              style={{ ...s.dayCountBtn, ...(days.length === n ? s.dayCountBtnOn : {}) }}
              onClick={() => { onSetDayCount(n); setActiveIdx(Math.min(activeIdx, n - 1)); }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 && (
        <div style={{ ...s.empty, paddingTop: 40 }}>
          <div style={s.emptyText}>Select how many days per week above</div>
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
    </div>
  );
}

// Helper wrapper to avoid prop name collision
function ProgramExRowWrapper({ ex, showDivider, onEdit, onDeleteExercise, onToggleSuperset, dayId }) {
  return <ProgramExRow ex={ex} showDivider={showDivider} onEdit={onEdit}
    onDelete={() => onDeleteExercise(dayId, ex.id)}
    onToggleSuperset={() => onToggleSuperset(dayId, ex.id)} />;
}

function ProgramExRow({ ex, showDivider, onEdit, onDelete, onToggleSuperset }) {
  const [confirm, setConfirm] = useState(false);
  const pills = [
    ex.sets && `Sets: ${ex.sets}`,
    ex.reps && `Reps: ${ex.reps}`,
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
function ExercisePage({ day, allDays, lastLogged, onBack, onSelectDay, onUpdateExercise, onLog, showToast }) {
  const [logged, setLogged] = useState(false);
  const [logMsg, setLogMsg] = useState("");

  const exercises = day?.exercises || [];

  // FIX: Memoize badges and groups
  const badged = useMemo(() => assignBadges(exercises), [exercises]);
  const groups = useMemo(() => getGroups(badged), [badged]);

  function handleLog() {
    onLog();
    setLogged(true);
    setLogMsg("✓ Workout Logged!");
    showToast("Workout logged! 💪", "success");
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
        <span style={{ width: 32 }} />
      </div>

      <div style={s.tabBar}>
        {allDays.map(d => (
          <button key={d.id}
            style={{ ...s.tab, ...(d.id === day.id ? s.tabActive : {}) }}
            onClick={() => onSelectDay(d.id)}>
            <span style={{ ...s.tabText, ...(d.id === day.id ? s.tabTextActive : {}) }}>{d.label}</span>
            {d.id === day.id && <div style={s.tabUnderline} />}
          </button>
        ))}
      </div>

      <div style={s.sectionLabel}>Today's Workout</div>

      <div style={s.scroll}>
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
        <button style={{ ...s.logBtn, ...(logged ? s.logBtnSuccess : {}) }} onClick={handleLog}>
          {logged ? logMsg : "Log This Workout"}
        </button>
      </div>
    </div>
  );
}

function LogExRow({ ex, last, showDivider, onUpdate }) {
  const savedSets = ex.loggedSets || [];
  const targetSets = parseInt(ex.sets) || 0;
  const defaultUnit = ex.unit || "kg";
  const lastSets = last?.loggedSets || [];

  function updateSet(i, patch) {
    const next = [...savedSets];
    next[i] = { ...next[i], ...patch };
    onUpdate({ loggedSets: next });
  }

  function addSet() {
    const prev = savedSets[savedSets.length - 1];
    onUpdate({ loggedSets: [...savedSets, { reps: prev?.reps || ex.reps || "", weight: prev?.weight || "", unit: prev?.unit || defaultUnit, done: false }] });
  }

  function removeSet(i) { onUpdate({ loggedSets: savedSets.filter((_, idx) => idx !== i) }); }
  function toggleDone(i) { updateSet(i, { done: !savedSets[i].done }); }

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

        {(ex.sets || ex.reps || programPills.length > 0) && (
          <div style={s.targetRow}>
            <span style={s.targetLabel}>Target →</span>
            {ex.sets && <span style={s.targetPill}>{ex.sets} sets</span>}
            {ex.reps && <span style={s.targetPill}>{ex.reps} reps</span>}
            {programPills.map((p, i) => <span key={i} style={s.targetPill}>{p}</span>)}
          </div>
        )}

        {ex.note && <div style={{ ...s.exNote, marginBottom: 8 }}>{ex.note}</div>}

        <div style={ls.setSection}>
          {savedSets.length > 0 && (
            <div style={ls.setHeader}>
              <span style={ls.setHeaderNum}>SET</span>
              <span style={ls.setHeaderField}>REPS</span>
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
                  {lastSet?.reps && !set.reps && <span style={ls.setGhost}>{lastSet.reps}</span>}
                  <input style={{ ...ls.setInput, ...(set.done ? ls.setInputDone : {}) }}
                    value={set.reps} onChange={e => updateSet(i, { reps: e.target.value })}
                    placeholder={ex.reps || "—"} inputMode="numeric" aria-label={`Set ${i + 1} reps`} />
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
                <span key={i} style={s.lastPill}>{ls2.reps} reps @ {ls2.weight}{ls2.unit}</span>
              ))}
              {lastSets.length > 3 && <span style={s.lastPill}>+{lastSets.length - 3} more</span>}
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
        <SmField label="Target Reps" value={draft.reps} onChange={set("reps")} placeholder="10" />
      </div>
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
function ProgressPage({ logs, program, onBack }) {
  const [tab, setTab] = useState("dashboard");
  const [filterDayId, setFilterDayId] = useState(null);
  const [dayDropOpen, setDayDropOpen] = useState(false);
  const [exPage, setExPage] = useState(0);
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

  useEffect(() => { setExPage(0); }, [filterDayId]);

    const totalExPages = Math.ceil(allExercises.length / PAGE_SIZE);
  const chartExercises = allExercises.slice(exPage * PAGE_SIZE, exPage * PAGE_SIZE + PAGE_SIZE);

  const WEEKS8 = lastNWeeks(8);
  const MONTHS12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 11 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const EX_COLORS = ["#e8302a", "#ff6b35", "#ffa500", "#4ecdc4", "#45b7d1", "#a78bfa"];
  const weekLabels = WEEKS8.map((_, i) => `W${i + 1}`);

  const weeklyVol = WEEKS8.map(wk =>
    filteredLogs.filter(l => isoWeek(l.date) === wk)
      .reduce((sum, l) => sum + l.exercises.reduce((s, e) =>
        s + (parseInt(e.sets) || 0) * (parseInt(e.reps) || 0) * (parseFloat(e.weight) || 0), 0), 0)
  );

  const oneRMByExercise = chartExercises.map(name => ({
    name,
    data: WEEKS8.map(wk => {
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

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹</button>
        <span style={s.headerTitle}>Progress</span>
        <span style={{ width: 32 }} />
      </div>

      <div style={s.subTabBar}>
        {[["dashboard", "Dashboard"], ["history", "History"]].map(([t, label]) => (
          <button key={t} style={{ ...s.subTab, ...(tab === t ? s.subTabActive : {}) }} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      <div style={{ ...s.scroll, padding: "12px 14px" }}>
        {tab === "history" && <HistoryTab logs={logs} />}

        {tab === "dashboard" && !hasWeekOfData && (
          <div style={ds.notReady}>
            <div style={ds.notReadyIcon}>🗓️</div>
            <div style={ds.notReadyTitle}>Complete a week first</div>
            <div style={ds.notReadySub}>Log at least one full week of workouts to unlock your dashboard.</div>
          </div>
        )}

        {tab === "dashboard" && hasWeekOfData && (
          <>
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
                      onClick={() => { setFilterDayId(null); setDayDropOpen(false); }}>
                      <div style={ds.dayDropLeft}><div style={ds.dayDropLabel}>All Days</div><div style={ds.dayDropSub}>{allExercises.length} total exercises</div></div>
                      {filterDayId === null && <span style={{ color: RED }}>✓</span>}
                    </button>
                    <div style={{ height: 1, background: BORDER }} />
                    {dayOptions.map((d, i) => (
                      <button key={d.id} style={{ ...ds.dayDropItem, ...(filterDayId === d.id ? ds.exDropItemActive : {}) }}
                        onClick={() => { setFilterDayId(d.id); setDayDropOpen(false); }}>
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

            {chartExercises.length === 0 && (
              <div style={{ ...ds.chartEmpty, padding: "32px 0", fontSize: 13 }}>
                No exercises found.{" "}
                <button style={ds.classifyLink} onClick={() => setTab("classify")}>Assign manually →</button>
              </div>
            )}

            {chartExercises.length > 0 && (
              <>
                {allExercises.length > PAGE_SIZE && (
                  <div style={ds.pageRow}>
                    <span style={ds.pageInfo}>Exercises {exPage * PAGE_SIZE + 1}–{Math.min((exPage + 1) * PAGE_SIZE, allExercises.length)} of {allExercises.length}</span>
                    <div style={ds.pageBtns}>
                      <button style={{ ...ds.pageBtn, opacity: exPage === 0 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.max(0, p - 1))} disabled={exPage === 0}>‹ Prev</button>
                      <button style={{ ...ds.pageBtn, opacity: exPage >= totalExPages - 1 ? 0.3 : 1 }} onClick={() => setExPage(p => Math.min(totalExPages - 1, p + 1))} disabled={exPage >= totalExPages - 1}>Next ›</button>
                    </div>
                  </div>
                )}

                <SectionHeader title="Current PRs" subtitle="vs 8 weeks ago" />
                <div style={ds.prGrid}>
                  {prCards.map(card => (
                    <div key={card.name} style={ds.prCard}>
                      <div style={{ ...ds.prAccent, background: card.color }} />
                      <div style={ds.prName} title={card.name}>{card.name.length > 18 ? card.name.slice(0, 16) + "…" : card.name}</div>
                      <div style={ds.prVal}>{card.pr || "—"}<span style={ds.prUnit}>{card.pr ? "kg" : ""}</span></div>
                      {card.pr > 0 && <div style={{ ...ds.prDelta, color: card.delta >= 0 ? "#4ecdc4" : "#ff6b6b" }}>{card.delta >= 0 ? "▲" : "▼"} {Math.abs(card.delta)} kg</div>}
                    </div>
                  ))}
                  {exPage === 0 && (
                    <div style={ds.prCard}>
                      <div style={{ ...ds.prAccent, background: "#6366f1" }} />
                      <div style={ds.prName}>Avg Weekly Vol</div>
                      <div style={ds.prVal}>{avgVol >= 1000 ? `${(avgVol / 1000).toFixed(1)}` : Math.round(avgVol)}<span style={ds.prUnit}>{avgVol >= 1000 ? "t" : "kg"}</span></div>
                      <div style={{ ...ds.prDelta, color: volDelta >= 0 ? "#4ecdc4" : "#ff6b6b" }}>{volDelta >= 0 ? "▲" : "▼"} {Math.abs(volDelta >= 1000 ? (volDelta / 1000).toFixed(1) : volDelta)}{volDelta >= 1000 ? "t" : "kg"}</div>
                    </div>
                  )}
                </div>

                <SectionHeader title="1RM Strength Progression" subtitle="8 weeks" />
                <div style={ds.chartCard}>
                  {oneRMByExercise.every(ex => ex.data.every(v => v == null))
                    ? (
                      <div style={ds.chartEmptyState}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
                        <div style={{ fontSize: 13, color: DIM }}>No weight data yet</div>
                        <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>Log sets with weight to see your 1RM trend</div>
                      </div>
                    )
                    : (
                      <>
                        {/* FIX: ARIA label on SVG chart */}
                        <div role="img" aria-label="1RM strength progression over 8 weeks">
                          <OneRMLineChart data={oneRMByExercise} weeks={weekLabels} colors={EX_COLORS} />
                        </div>
                        <ChartLegend items={chartExercises.map((n, i) => ({ name: n, color: EX_COLORS[i % EX_COLORS.length] }))} />
                      </>
                    )}
                </div>

                {exPage === 0 && (
                  <>
                    <SectionHeader title="Weekly Training Volume" subtitle={selectedDayLabel ? `${selectedDayLabel} · 8 weeks` : "All days · 8 weeks"} />
                    <div style={ds.chartCard}>
                      <div role="img" aria-label="Weekly training volume bar chart">
                        <VolumeBarChart data={weeklyVol} weeks={weekLabels} />
                      </div>
                    </div>
                  </>
                )}

                <SectionHeader title="Relative Strength Gain" subtitle="% vs first week" />
                <div style={ds.chartCard}>
                  {relGains.every(g => g.pct === 0)
                    ? (
                      <div style={ds.chartEmptyState}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                        <div style={{ fontSize: 13, color: DIM }}>Log more sessions to see trends</div>
                      </div>
                    )
                    : (
                      <div role="img" aria-label="Relative strength gain percentage chart">
                        <RelGainChart data={relGains} colors={EX_COLORS} />
                      </div>
                    )}
                </div>

                {allExercises.length > PAGE_SIZE && (
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

            <SectionHeader title="Training Consistency" subtitle="Sessions per month · 12 months" />
            <div style={ds.chartCard}>
              <div role="img" aria-label="Training consistency heatmap by month">
                <ConsistencyHeatmap data={heatmap} max={maxHeat} />
              </div>
            </div>
            <div style={{ height: 48 }} />
          </>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ logs }) {
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

  return (
    <>
      {reversed.map(log => {
        const v = vol(log.exercises);
        return (
          <div key={log.id} style={s.logCard}>
            <div style={s.logHeader}>
              <div>
                <div style={s.logDay}>{log.dayLabel}</div>
                <div style={s.logDate}>{formatDate(log.date)}</div>
              </div>
              {v > 0 && (
                <div style={s.logVolBox}>
                  <div style={s.logVolNum}>{v.toLocaleString()}</div>
                  <div style={s.logVolLabel}>kg volume</div>
                </div>
              )}
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
};

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/* ─── STYLES ─── */
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
  logBtnSuccess: { background: "#2a7a2a" },
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
  subTabBar: { display: "flex", padding: "0 14px", borderBottom: `1px solid ${BORDER}` },
  subTab: { background: "none", border: "none", color: DIM, fontSize: 14, fontWeight: 500, padding: "10px 16px", cursor: "pointer", borderBottom: "2px solid transparent", fontFamily: "inherit" },
  subTabActive: { color: TEXT, borderBottom: `2px solid ${RED}` },
};
