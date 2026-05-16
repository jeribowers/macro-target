import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { supabase } from "./lib/supabase.js";

// ── Constants ──────────────────────────────────────────────────────────────
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const ACTIVITY = [
  { label: "Rest",   mult: 0.85 },
  { label: "Light",  mult: 1.0  },
  { label: "Medium", mult: 1.15 },
  { label: "Hard",   mult: 1.3  },
];
const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
const MACROS = [
  ["calories", "cal", "#f59e0b", "kcal"],
  ["protein",  "pro", "#fb923c", "g"],
  ["carbs",    "car", "#10b981", "g"],
  ["fat",      "fat", "#a78bfa", "g"],
];
const MACRO_NAMES = { calories: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };
const ACCENT = "#3b82f6";
const SIZE = {
  textSm: 15,
  textMd: 17,
  textLg: 19,
  textXl: 22,
  buttonSm: { fontSize: 15, py: "8px", px: "12px" },
  buttonMd: { fontSize: 17, py: "11px", px: "18px" },
  inputMd: { fontSize: 17, py: "10px", px: "12px" },
};

function fmt(n) { return Number(n || 0).toLocaleString(); }
function todayKey() { return new Date().toISOString().split("T")[0]; }
function toKey(d) { return d instanceof Date ? d.toISOString().split("T")[0] : d; }

function scaleMacros(food, grams) {
  const s = grams / 100;
  return {
    calories: Math.round((food.cal100 || 0) * s),
    protein:  Math.round((food.prot100 || 0) * s),
    carbs:    Math.round((food.carb100 || 0) * s),
    fat:      Math.round((food.fat100  || 0) * s),
  };
}

// ── Icons ──────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 16, sw = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Plus       = () => <Ic d="M12 5v14M5 12h14" />;
const SearchIc   = () => <Ic d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />;
const TrashIc    = () => <Ic d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />;
const EditIc     = () => <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />;
const CalIc      = () => <Ic d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />;
const BookIc     = () => <Ic d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />;
const TargetIc   = () => <Ic d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />;
const ChartIc    = () => <Ic d="M3 3v18h18M7 16l4-4 4 4 4-6" />;
const XIc        = () => <Ic d="M18 6L6 18M6 6l12 12" />;
const BookmarkIc = () => <Ic d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" s={13} />;
const ChevDownIc = () => <Ic d="M6 9l6 6 6-6" s={14} />;
const ChevL      = () => <Ic d="M15 18l-6-6 6-6" s={16} sw={2.5} />;
const ChevR      = () => <Ic d="M9 18l6-6-6-6" s={16} sw={2.5} />;
const GoogleIc   = () => (
  <svg width={20} height={20} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── Loading spinner ────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid #1e293b", borderTopColor: ACCENT,
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Login screen ───────────────────────────────────────────────────────────
function LoginScreen({ onLogin, error }) {
  const [loading, setLoading] = useState(false);
  async function handleGoogle() {
    setLoading(true);
    await onLogin();
    setLoading(false);
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🥗</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>Macro Target</h1>
        <p style={{ color: "#64748b", fontSize: SIZE.textSm }}>Track your nutrition, hit your goals.</p>
      </div>
      <button onClick={handleGoogle} disabled={loading}
        style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "none", borderRadius: 12, padding: `${SIZE.buttonMd.py} ${SIZE.buttonMd.px}`, color: "#1e293b", fontSize: SIZE.buttonMd.fontSize, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
        <GoogleIc />
        {loading ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && <p style={{ color: "#ef4444", fontSize: SIZE.textSm, textAlign: "center", maxWidth: 280 }}>{error}</p>}
    </div>
  );
}

// ── Macro horizontal bar ───────────────────────────────────────────────────
function MacroBar({ value, goal, color, macroKey, unit }) {
  const pct      = Math.min(value / (goal || 1), 1);
  const over     = value > goal;
  const barColor = over ? "#ef4444" : color;
  const remaining = goal - value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{MACRO_NAMES[macroKey]}</span>
        <span style={{ fontSize: 13, fontFamily: "monospace", color: barColor, fontWeight: 600 }}>
          {over ? `+${fmt(Math.abs(remaining))} over` : `${fmt(remaining)} left`}
        </span>
      </div>
      <div style={{ height: 12, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: barColor, borderRadius: 99, transition: "width 0.4s ease", minWidth: value > 0 ? 4 : 0 }} />
      </div>
      <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>
        {fmt(value)}<span style={{ color: "#64748b" }}>/{fmt(goal)}{unit}</span>
      </div>
    </div>
  );
}

// ── Macro preview grid ─────────────────────────────────────────────────────
function MacroPreview({ macros }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, background: "#1e293b", borderRadius: 10, padding: "12px 8px" }}>
      {MACROS.map(([key, , color, unit]) => (
        <div key={key} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "monospace" }}>{fmt(macros[key] ?? 0)}</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>{unit}</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>{MACRO_NAMES[key]}</div>
        </div>
      ))}
    </div>
  );
}

// ── NumField ───────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, unit = "" }) {
  const [str, setStr] = useState(value === 0 ? "" : String(value));
  const [touched, setTouched] = useState(value !== 0);
  const prevVal = useRef(value);
  if (prevVal.current !== value && !touched) {
    prevVal.current = value;
    setStr(value === 0 ? "" : String(value));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}{unit && ` (${unit})`}</label>}
      <input inputMode="decimal" type="number" min="0" value={str}
        onFocus={e => { if (!touched) setStr(""); e.target.select(); }}
        onChange={e => { setTouched(true); setStr(e.target.value); const n = parseFloat(e.target.value); onChange(isNaN(n) ? 0 : n); }}
        onBlur={() => { if (str === "" || str === "-") { setStr("0"); onChange(0); } }}
        style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: `${SIZE.inputMd.py} ${SIZE.inputMd.px}`, color: "#f1f5f9", fontSize: SIZE.inputMd.fontSize, width: "100%" }} />
    </div>
  );
}

// ── SwipeRow ───────────────────────────────────────────────────────────────
function SwipeRow({ onDelete, children }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(null);
  const dragging = useRef(false);
  const THRESHOLD = 55, DELETE_WIDTH = 80;
  function snap(dx) { setOffset(dx < -THRESHOLD ? -DELETE_WIDTH : 0); }
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 8, marginBottom: 5 }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_WIDTH, display: "flex", alignItems: "center", justifyContent: "center", background: "#ef4444", borderRadius: "0 8px 8px 0" }}>
        <button onClick={() => { setOffset(0); onDelete(); }}
          style={{ background: "none", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "0 8px" }}>
          <TrashIc /><span>Delete</span>
        </button>
      </div>
      <div style={{ transform: `translateX(${offset}px)`, transition: dragging.current ? "none" : "transform 0.2s ease", position: "relative", zIndex: 1, userSelect: "none" }}
        onTouchStart={e => { startX.current = e.touches[0].clientX; }}
        onTouchMove={e => { if (startX.current === null) return; const dx = e.touches[0].clientX - startX.current; if (dx < 0) setOffset(Math.max(dx, -DELETE_WIDTH)); }}
        onTouchEnd={() => { snap(offset); startX.current = null; }}
        onMouseDown={e => { dragging.current = true; startX.current = e.clientX; }}
        onMouseMove={e => { if (!dragging.current) return; const dx = e.clientX - startX.current; if (dx < 0) setOffset(Math.max(dx, -DELETE_WIDTH)); }}
        onMouseUp={() => { if (!dragging.current) return; dragging.current = false; snap(offset); }}
        onMouseLeave={() => { if (!dragging.current) return; dragging.current = false; snap(offset); }}>
        {children}
      </div>
    </div>
  );
}

// ── Entry Modal ────────────────────────────────────────────────────────────
function EntryModal({ foods, meal, editEntry, onSave, onClose, onSaveToLibrary }) {
  const isEdit = !!editEntry;
  const [mode, setMode]         = useState(isEdit ? "custom" : "library");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [amountMode, setAmountMode] = useState("grams");
  const [grams, setGrams]       = useState(isEdit ? (editEntry.grams || 100) : 100);
  const [servings, setServings] = useState(1);
  const [custom, setCustom]     = useState({
    name: isEdit ? editEntry.name : "", calories: isEdit ? editEntry.calories : 0,
    protein: isEdit ? editEntry.protein : 0, carbs: isEdit ? editEntry.carbs : 0, fat: isEdit ? editEntry.fat : 0,
  });
  const [savedToLib, setSavedToLib] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  function selectFood(f) { setSelected(f); setGrams(f.defaultGrams || 100); setServings(1); }
  const effectiveGrams = selected ? (amountMode === "servings" ? Math.round(servings * (selected.defaultGrams || 100)) : grams) : grams;
  const liveMacros = selected ? scaleMacros(selected, effectiveGrams) : null;

  const inputSt = { width: "100%", boxSizing: "border-box", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: `${SIZE.inputMd.py} ${SIZE.inputMd.px}`, color: "#f1f5f9", fontSize: SIZE.inputMd.fontSize };

  async function handleSave() {
    let entry;
    if (mode === "library" && selected) {
      entry = { name: selected.name, grams: effectiveGrams, ...liveMacros };
    } else if ((mode === "custom" || isEdit) && custom.name.trim()) {
      entry = { ...custom, name: custom.name.trim(), grams };
    } else return;
    setSaving(true);
    await onSave(entry);
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.88)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540, padding: 20, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: "#f1f5f9" }}>{isEdit ? "Edit Entry" : `Add to ${meal}`}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><XIc /></button>
        </div>

        {!isEdit && (
          <div style={{ display: "flex", background: "#1e293b", borderRadius: 8, padding: 3 }}>
            {[["library", "From Library"], ["custom", "Custom"]].map(([m, lbl]) => (
              <button key={m} onClick={() => { setMode(m); setSelected(null); }}
                style={{ flex: 1, background: mode === m ? ACCENT : "none", border: "none", borderRadius: 6, padding: SIZE.buttonSm.py, color: mode === m ? "#fff" : "#64748b", fontSize: SIZE.buttonSm.fontSize, fontWeight: 600, cursor: "pointer" }}>
                {lbl}
              </button>
            ))}
          </div>
        )}

        {mode === "library" && !isEdit && (<>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}><SearchIc /></span>
            <input value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }} placeholder="Search library…" style={{ ...inputSt, paddingLeft: 36 }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.length === 0 && <p style={{ color: "#64748b", fontSize: 14, textAlign: "center", margin: "12px 0" }}>No foods found. Add some in the Library tab.</p>}
            {filtered.map(f => (
              <div key={f.id} onClick={() => selectFood(f)}
                style={{ padding: "8px 12px", borderRadius: 7, background: selected?.id === f.id ? "#172554" : "#1e293b", border: `1px solid ${selected?.id === f.id ? ACCENT : "#334155"}`, cursor: "pointer" }}>
                <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 14 }}>{f.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>
                  {fmt(f.cal100)} kcal · {f.prot100}g protein · {f.carb100}g carbs · {f.fat100}g fat
                  <span style={{ color: "#64748b" }}> per 100{f.unit || "g"}</span>
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", background: "#1e293b", borderRadius: 8, padding: 3 }}>
                {[["grams", `${selected.unit || "g"}`], ["servings", `Servings (1 = ${selected.defaultGrams || 100}${selected.unit || "g"})`]].map(([am, lbl]) => (
                  <button key={am} onClick={() => setAmountMode(am)}
                    style={{ flex: 1, background: amountMode === am ? "#0f172a" : "none", border: "none", borderRadius: 6, padding: "8px 6px", color: amountMode === am ? "#f1f5f9" : "#64748b", fontSize: SIZE.textSm, fontWeight: 600, cursor: "pointer" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {amountMode === "grams" ? (
                <NumField label={`Amount (${selected.unit || "g"})`} value={grams} onChange={setGrams} />
              ) : (
                <div>
                  <NumField label="Servings" value={servings} onChange={setServings} />
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, textAlign: "center" }}>= {effectiveGrams}{selected.unit || "g"} total</div>
                </div>
              )}
              <MacroPreview macros={liveMacros} />
            </div>
          )}
        </>)}

        {(mode === "custom" || isEdit) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!isEdit && (
              <div>
                <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Food Name</label>
                <input value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Oatmeal" style={{ ...inputSt, marginTop: 4 }} />
              </div>
            )}
            {isEdit && <div style={{ fontSize: 17, color: "#f1f5f9", fontWeight: 700, marginBottom: 2 }}>{editEntry.name}</div>}
            <div>
              <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Amount (g)</label>
              <input inputMode="decimal" type="number" min="1" value={grams}
                onChange={e => setGrams(Number(e.target.value))}
                onFocus={e => e.target.select()}
                style={{ ...inputSt, marginTop: 4 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <NumField label="Calories" unit="kcal" value={custom.calories} onChange={v => setCustom(c => ({ ...c, calories: v }))} />
              <NumField label="Protein"  unit="g"    value={custom.protein}  onChange={v => setCustom(c => ({ ...c, protein: v  }))} />
              <NumField label="Carbs"    unit="g"    value={custom.carbs}    onChange={v => setCustom(c => ({ ...c, carbs: v    }))} />
              <NumField label="Fat"      unit="g"    value={custom.fat}      onChange={v => setCustom(c => ({ ...c, fat: v      }))} />
            </div>
            {!isEdit && (
              <button
                onClick={() => {
                  if (!custom.name.trim()) return;
                  const g = grams || 100;
                  const factor = 100 / g;
                  onSaveToLibrary({
                    name: custom.name.trim(), unit: "g", defaultGrams: g,
                    cal100: Math.round(custom.calories * factor), prot100: Math.round(custom.protein * factor),
                    carb100: Math.round(custom.carbs * factor), fat100: Math.round(custom.fat * factor),
                  });
                  setSavedToLib(true);
                  setTimeout(() => setSavedToLib(false), 2000);
                }}
                style={{ background: savedToLib ? "#134e3a" : "none", border: `1px dashed ${savedToLib ? "#10b981" : "#475569"}`, borderRadius: 7, padding: `${SIZE.buttonSm.py} ${SIZE.buttonSm.px}`, color: savedToLib ? "#10b981" : "#94a3b8", fontSize: SIZE.buttonSm.fontSize, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                {savedToLib ? "✓ Saved to Library" : "+ Also save to Library"}
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, background: ACCENT, border: "none", borderRadius: 8, padding: `${SIZE.buttonMd.py} ${SIZE.buttonMd.px}`, color: "#fff", fontSize: SIZE.buttonMd.fontSize, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
          </button>
          <button onClick={onClose} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: `${SIZE.buttonMd.py} 16px`, color: "#94a3b8", fontSize: SIZE.buttonMd.fontSize, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Daily Log ──────────────────────────────────────────────────────────────
function DailyLog({ userId, foods, setFoods }) {
  const [date, setDate]     = useState(todayKey());
  const [modal, setModal]   = useState(null);
  const [entries, setEntries] = useState({});   // { meal: [...] }
  const [activity, setActivityState] = useState("Light");
  const [goals, setGoals]   = useState(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  // Load goals once
  useEffect(() => {
    supabase.from("goals").select("*").eq("user_id", userId).single()
      .then(({ data }) => { if (data) setGoals({ calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat }); });
  }, [userId]);

  // Load entries + activity for current date
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("log_entries").select("*").eq("user_id", userId).eq("log_date", date),
      supabase.from("activity_levels").select("level").eq("user_id", userId).eq("log_date", date).single(),
    ]).then(([{ data: rows }, { data: act }]) => {
      const grouped = {};
      MEALS.forEach(m => { grouped[m] = []; });
      (rows || []).forEach(r => {
        if (!grouped[r.meal]) grouped[r.meal] = [];
        grouped[r.meal].push({ id: r.id, name: r.name, grams: r.grams, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat });
      });
      setEntries(grouped);
      setActivityState(act?.level || "Light");
      setLoading(false);
    });
  }, [date, userId]);

  const actMult  = ACTIVITY.find(a => a.label === activity)?.mult ?? 1.0;
  const dayGoals = Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, Math.round(v * actMult)]));
  const totals   = MEALS.reduce((acc, m) => {
    (entries[m] || []).forEach(e => { acc.calories += e.calories; acc.protein += e.protein; acc.carbs += e.carbs; acc.fat += e.fat; });
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  async function setActivity(level) {
    setActivityState(level);
    await supabase.from("activity_levels").upsert({ user_id: userId, log_date: date, level }, { onConflict: "user_id,log_date" });
  }

  async function saveEntry(meal, entry, editId) {
    if (editId != null) {
      const { data } = await supabase.from("log_entries").update({ ...entry, grams: entry.grams, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat }).eq("id", editId).select().single();
      setEntries(prev => ({ ...prev, [meal]: (prev[meal] || []).map(e => e.id === editId ? { ...data } : e) }));
    } else {
      const { data } = await supabase.from("log_entries").insert({ user_id: userId, log_date: date, meal, ...entry }).select().single();
      setEntries(prev => ({ ...prev, [meal]: [...(prev[meal] || []), data] }));
    }
    setModal(null);
  }

  async function removeEntry(meal, id) {
    await supabase.from("log_entries").delete().eq("id", id);
    setEntries(prev => ({ ...prev, [meal]: (prev[meal] || []).filter(e => e.id !== id) }));
  }

  async function saveToLibrary(data) {
    const exists = foods.some(f => f.name.toLowerCase() === data.name.toLowerCase());
    if (exists) return;
    const { data: food } = await supabase.from("foods").insert({ user_id: userId, ...data }).select().single();
    if (food) setFoods(prev => [...prev, { ...food, defaultGrams: food.default_grams }]);
  }

  function shiftDate(days) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(toKey(d));
  }
  const isToday = date === todayKey();
  const displayDate = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
  })();

  const btnBase = { background: "#1e293b", border: "1px solid #334155", borderRadius: 7, color: "#cbd5e1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Date + Activity row */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "8px 8px 8px 6px", gap: 6 }}>
          <button onClick={() => shiftDate(-1)} style={{ ...btnBase, border: "none", background: "none", padding: "4px 6px", flexShrink: 0 }}><ChevL /></button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 15, color: "#f1f5f9", letterSpacing: "-0.01em" }}>
            {isToday ? <span style={{ color: ACCENT }}>Today</span> : displayDate}
          </div>
          {!isToday ? (
            <>
              <button onClick={() => shiftDate(1)} style={{ ...btnBase, border: "none", background: "none", padding: "4px 6px", flexShrink: 0 }}><ChevR /></button>
              <button onClick={() => setDate(todayKey())} style={{ ...btnBase, padding: "4px 8px", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Today</button>
            </>
          ) : <div style={{ width: 28 }} />}
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "#1e293b" }} />
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select value={activity} onChange={e => setActivity(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", padding: "12px 32px 12px 14px", color: "#cbd5e1", fontSize: SIZE.textSm, fontWeight: 600, cursor: "pointer", appearance: "none", WebkitAppearance: "none", minWidth: 120 }}>
            {ACTIVITY.map(a => <option key={a.label} value={a.label}>{a.label} (×{a.mult})</option>)}
          </select>
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}><ChevDownIc /></span>
        </div>
      </div>

      {/* Macro bars */}
      <div style={{ background: "#0f172a", border: "1px solid #293548", borderRadius: 14, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#475569", padding: "8px 0" }}>Loading…</div>
        ) : MACROS.map(([key, , color, unit]) => (
          <MacroBar key={key} value={Math.round(totals[key])} goal={dayGoals[key]} color={color} macroKey={key} unit={unit} />
        ))}
      </div>

      {/* Meal sections */}
      {MEALS.map(meal => {
        const mealEntries = entries[meal] || [];
        return (
          <div key={meal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>{meal}</span>
              <button onClick={() => setModal({ meal })}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #293548", borderRadius: 6, padding: "7px 12px", color: "#94a3b8", fontSize: SIZE.textSm, cursor: "pointer" }}>
                <Plus /> Add
              </button>
            </div>
            {mealEntries.length === 0 && <div style={{ color: "#293548", fontSize: 13, paddingBottom: 4 }}>—</div>}
            {mealEntries.map(e => {
              const inLib = foods.some(f => f.name.toLowerCase() === e.name.toLowerCase());
              return (
                <SwipeRow key={e.id} onDelete={() => removeEntry(meal, e.id)}>
                  <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>
                        {e.name}
                        {inLib && <span style={{ color: "#334155" }} title="Saved in library"><BookmarkIc /></span>}
                        <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>{fmt(e.grams)}g</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        <span style={{ color: "#f59e0b" }}>{fmt(e.calories)} cal</span> · <span style={{ color: "#fb923c" }}>{fmt(e.protein)}g protein</span> · <span style={{ color: "#10b981" }}>{fmt(e.carbs)}g carbs</span> · <span style={{ color: "#a78bfa" }}>{fmt(e.fat)}g fat</span>
                      </div>
                    </div>
                    <button onClick={() => setModal({ meal, editEntry: e })} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, flexShrink: 0 }}><EditIc /></button>
                  </div>
                </SwipeRow>
              );
            })}
          </div>
        );
      })}

      {modal && (
        <EntryModal foods={foods} meal={modal.meal} editEntry={modal.editEntry || null}
          onSave={(entry) => saveEntry(modal.meal, entry, modal.editEntry?.id)}
          onClose={() => setModal(null)}
          onSaveToLibrary={saveToLibrary} />
      )}
    </div>
  );
}

// ── Food Library ───────────────────────────────────────────────────────────
function FoodLibrary({ userId, foods, setFoods }) {
  const [search, setSearch]     = useState("");
  const [adding, setAdding]     = useState(false);
  const [editingId, setEditingId] = useState(null);
  const BLANK = { name: "", defaultGrams: 100, unit: "g", cal100: 0, prot100: 0, carb100: 0, fat100: 0 };
  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  async function addFood(data) {
    const { data: food } = await supabase.from("foods").insert({
      user_id: userId, name: data.name, unit: data.unit, default_grams: data.defaultGrams,
      cal100: data.cal100, prot100: data.prot100, carb100: data.carb100, fat100: data.fat100,
    }).select().single();
    if (food) setFoods(prev => [...prev, { ...food, defaultGrams: food.default_grams }]);
    setAdding(false);
  }

  async function updateFood(id, data) {
    await supabase.from("foods").update({
      name: data.name, unit: data.unit, default_grams: data.defaultGrams,
      cal100: data.cal100, prot100: data.prot100, carb100: data.carb100, fat100: data.fat100,
    }).eq("id", id);
    setFoods(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
    setEditingId(null);
  }

  async function deleteFood(id) {
    await supabase.from("foods").delete().eq("id", id);
    setFoods(prev => prev.filter(f => f.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}><SearchIc /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search foods…"
            style={{ width: "100%", boxSizing: "border-box", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: `11px 12px 11px 36px`, color: "#f1f5f9", fontSize: SIZE.textSm }} />
        </div>
        <button onClick={() => { setAdding(a => !a); setEditingId(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: ACCENT, border: "none", borderRadius: 8, padding: `${SIZE.buttonSm.py} 16px`, color: "#fff", fontSize: SIZE.textSm, fontWeight: 600, cursor: "pointer" }}>
          <Plus /> Add
        </button>
      </div>
      {adding && <FoodForm initial={{ ...BLANK, name: search }} title="New Food" onSave={addFood} onCancel={() => setAdding(false)} />}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 520, overflowY: "auto" }}>
        {filtered.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center", margin: "20px 0", fontSize: 14 }}>No foods saved yet.</p>}
        {filtered.map(f => (
          <div key={f.id} style={{ marginBottom: 6 }}>
            {editingId === f.id ? (
              <FoodForm
                initial={{ name: f.name, defaultGrams: f.defaultGrams || f.default_grams, unit: f.unit || "g", cal100: f.cal100, prot100: f.prot100, carb100: f.carb100, fat100: f.fat100 }}
                title={`Editing: ${f.name}`}
                onSave={data => updateFood(f.id, data)}
                onCancel={() => setEditingId(null)} />
            ) : (
              <SwipeRow onDelete={() => deleteFood(f.id)}>
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onClick={() => { setEditingId(f.id); setAdding(false); }}>
                  <div style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontWeight: 600, color: "#f1f5f9", fontSize: 15 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {fmt(f.cal100)} kcal · {f.prot100}g protein · {f.carb100}g carbs · {f.fat100}g fat
                      <span style={{ color: "#64748b" }}> per 100{f.unit || "g"}</span>
                      {(f.defaultGrams || f.default_grams) && (f.defaultGrams || f.default_grams) !== 100 &&
                        <span style={{ color: "#94a3b8" }}> · serving {f.defaultGrams || f.default_grams}{f.unit || "g"}</span>}
                    </div>
                  </div>
                  <span style={{ color: "#475569", padding: 4, flexShrink: 0 }}><EditIc /></span>
                </div>
              </SwipeRow>
            )}
          </div>
        ))}
      </div>
      <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Tap a food to edit · swipe left to delete.</p>
    </div>
  );
}

// ── Food Form ──────────────────────────────────────────────────────────────
function FoodForm({ initial, onSave, onCancel, title }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const inputSt = { width: "100%", boxSizing: "border-box", marginTop: 4, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, padding: `${SIZE.inputMd.py} ${SIZE.inputMd.px}`, color: "#f1f5f9", fontSize: SIZE.inputMd.fontSize };
  const serving = Number(form.defaultGrams) || 100;

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({ ...form, name: form.name.trim(), defaultGrams: Number(form.defaultGrams) || 100, cal100: Number(form.cal100) || 0, prot100: Number(form.prot100) || 0, carb100: Number(form.carb100) || 0, fat100: Number(form.fat100) || 0 });
    setSaving(false);
  }

  return (
    <div style={{ background: "#0f172a", border: `1px solid ${ACCENT}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{title}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: -6 }}>Enter macros per 100g/ml.</div>
      <div>
        <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Food Name</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Breast" style={inputSt} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Totals based on · Serving size</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input inputMode="decimal" type="number" min="1" value={form.defaultGrams}
            onChange={e => setForm(f => ({ ...f, defaultGrams: e.target.value }))}
            onFocus={e => e.target.select()}
            style={{ ...inputSt, marginTop: 0, flex: 1 }} />
          <select value={form.unit || "g"} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            style={{ ...inputSt, marginTop: 0, width: 72, flexShrink: 0, background: "#293548", borderColor: "#475569", appearance: "none", WebkitAppearance: "none", cursor: "pointer", textAlign: "center" }}>
            {["g", "ml", "oz", "serving"].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["Calories", "cal100", "kcal"], ["Protein", "prot100", "g"], ["Carbs", "carb100", "g"], ["Fat", "fat100", "g"]].map(([l, k, u]) => (
          <NumField key={k} label={`${l} per 100${form.unit || "g"}`} value={form[k]} onChange={v => setForm(f => ({ ...f, [k]: v }))} />
        ))}
      </div>
      {serving > 0 && (
        <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Per {serving}{form.unit || "g"} serving</div>
          <div style={{ display: "flex", gap: 12, fontSize: 13, flexWrap: "wrap" }}>
            {[["Calories", Math.round(form.cal100 * serving / 100), "#f59e0b", "kcal"], ["Protein", Math.round(form.prot100 * serving / 100), "#fb923c", "g"], ["Carbs", Math.round(form.carb100 * serving / 100), "#10b981", "g"], ["Fat", Math.round(form.fat100 * serving / 100), "#a78bfa", "g"]].map(([lbl, v, c, u]) => (
              <span key={lbl} style={{ color: c, fontWeight: 600 }}>{fmt(v)}<span style={{ color: "#64748b", fontWeight: 400 }}>{u} {lbl}</span></span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: 7, padding: `${SIZE.buttonMd.py} ${SIZE.buttonMd.px}`, color: "#fff", fontSize: SIZE.buttonMd.fontSize, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Food"}
        </button>
        <button onClick={onCancel} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 7, padding: `${SIZE.buttonMd.py} 16px`, color: "#94a3b8", fontSize: SIZE.buttonMd.fontSize, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Goals Panel ────────────────────────────────────────────────────────────
function GoalsPanel({ userId }) {
  const [goals, setGoalsState] = useState(DEFAULT_GOALS);
  const [base, setBase]         = useState(DEFAULT_GOALS);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    supabase.from("goals").select("*").eq("user_id", userId).single()
      .then(({ data }) => {
        if (data) { const g = { calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat }; setGoalsState(g); setBase(g); }
        setLoaded(true);
      });
  }, [userId]);

  async function saveGoals(g) {
    setGoalsState(g);
    await supabase.from("goals").upsert({ user_id: userId, ...g }, { onConflict: "user_id" });
  }

  if (!loaded) return <div style={{ color: "#64748b", textAlign: "center", padding: 24 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Base Daily Goals</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {MACROS.map(([key, , , unit]) => (
            <NumField key={key} label={MACRO_NAMES[key]} unit={unit} value={base[key]}
              onChange={v => { const nb = { ...base, [key]: v }; setBase(nb); saveGoals(nb); }} />
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Adjust for Activity</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {ACTIVITY.map(p => (
            <button key={p.label}
              onClick={() => saveGoals({ calories: Math.round(base.calories * p.mult), protein: Math.round(base.protein * p.mult), carbs: Math.round(base.carbs * p.mult), fat: Math.round(base.fat * p.mult) })}
              style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 8px", color: "#94a3b8", fontSize: SIZE.textSm, fontWeight: 600, cursor: "pointer", textAlign: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = ACCENT; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "#334155"; }}>
              {p.label}<div style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>×{p.mult}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Current Targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MACROS.map(([key, , color, unit]) => (
            <div key={key} style={{ background: "#1e293b", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: SIZE.textXl, fontWeight: 700, color, fontFamily: "monospace" }}>
                {fmt(goals[key])}<span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>{unit}</span>
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8" }}>{MACRO_NAMES[key]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trends Panel ───────────────────────────────────────────────────────────
function TrendsPanel({ userId, goals }) {
  const [range, setRange] = useState("week");
  const [macro, setMacro] = useState("calories");
  const [data, setData]   = useState([]);

  useEffect(() => {
    const days = range === "week" ? 7 : range === "month" ? 30 : 180;
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    const fromStr = toKey(from);
    supabase.from("log_entries").select("log_date,calories,protein,carbs,fat")
      .eq("user_id", userId).gte("log_date", fromStr)
      .then(({ data: rows }) => {
        const map = {};
        (rows || []).forEach(r => {
          if (!map[r.log_date]) map[r.log_date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          map[r.log_date].calories += r.calories;
          map[r.log_date].protein  += r.protein;
          map[r.log_date].carbs    += r.carbs;
          map[r.log_date].fat      += r.fat;
        });
        const result = Array.from({ length: days }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
          const key = toKey(d);
          const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          return { date: label, ...(map[key] || { calories: 0, protein: 0, carbs: 0, fat: 0 }) };
        });
        setData(result);
      });
  }, [range, userId]);

  const [, , color, unit] = MACROS.find(([k]) => k === macro);
  const goal = goals[macro];

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
        <div style={{ color: "#94a3b8", marginBottom: 3 }}>{label}</div>
        <div style={{ color, fontWeight: 700 }}>{fmt(payload[0]?.value)}{unit}</div>
        {goal && <div style={{ color: "#94a3b8" }}>Goal: {fmt(goal)}{unit}</div>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", background: "#0f172a", borderRadius: 8, padding: 3, border: "1px solid #1e293b" }}>
        {[["week","7 Days"],["month","30 Days"],["6mo","6 Months"]].map(([r,lbl]) => (
          <button key={r} onClick={() => setRange(r)}
            style={{ flex: 1, background: range===r ? "#1e293b" : "none", border: "none", borderRadius: 6, padding: "8px", color: range===r ? "#f1f5f9" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MACROS.map(([key, , c]) => (
          <button key={key} onClick={() => setMacro(key)}
            style={{ background: macro===key ? c+"22" : "#1e293b", border: `1px solid ${macro===key ? c : "#334155"}`, borderRadius: 20, padding: "6px 14px", color: macro===key ? c : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {MACRO_NAMES[key]}
          </button>
        ))}
      </div>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "16px 4px 8px" }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={range==="week" ? 0 : range==="month" ? 4 : 20} />
            <YAxis tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<Tip />} />
            {goal && <ReferenceLine y={goal} stroke={color} strokeDasharray="3 3" strokeOpacity={0.35} />}
            <Line type="monotone" dataKey={macro} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color, stroke: "#0f172a", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.every(d => !d[macro]) && (
        <p style={{ color: "#64748b", textAlign: "center", fontSize: 14, padding: "20px 0" }}>No data yet — trends will appear here once you start logging.</p>
      )}
    </div>
  );
}

// ── App shell ──────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(undefined); // undefined = loading
  const [authError, setAuthError] = useState("");
  const [tab, setTab]           = useState("log");
  const [foods, setFoods]       = useState([]);
  const [goals, setGoals]       = useState(DEFAULT_GOALS);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Load foods when logged in
  useEffect(() => {
    if (!session?.user) return;
    supabase.from("foods").select("*").eq("user_id", session.user.id).order("name")
      .then(({ data }) => {
        if (data) setFoods(data.map(f => ({ ...f, defaultGrams: f.default_grams })));
      });
    supabase.from("goals").select("*").eq("user_id", session.user.id).single()
      .then(({ data }) => { if (data) setGoals({ calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat }); });
  }, [session?.user?.id]);

  async function handleLogin() {
    setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // Check allowlist
  async function checkAllowlist(email) {
    const { data } = await supabase.from("allowed_users").select("email").eq("email", email).single();
    return !!data;
  }

  // Loading
  if (session === undefined) return <Spinner />;

  // Not logged in
  if (!session) return <LoginScreen onLogin={handleLogin} error={authError} />;

  const userId = session.user.id;
  const userEmail = session.user.email;

  const tabs = [
    { id: "log",     label: "Log",     icon: <CalIc />    },
    { id: "library", label: "Library", icon: <BookIc />   },
    { id: "goals",   label: "Goals",   icon: <TargetIc /> },
    { id: "trends",  label: "Trends",  icon: <ChartIc />  },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "#f1f5f9", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 60 }}>
      <div style={{ width: "100%", maxWidth: 540, padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: SIZE.textXl, fontWeight: 800, letterSpacing: "-0.03em" }}>Macro Target</h1>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid #1e293b", borderRadius: 7, padding: "8px 12px", color: "#475569", fontSize: SIZE.textSm, cursor: "pointer" }}>Sign out</button>
      </div>
      <div style={{ width: "100%", maxWidth: 540, padding: "16px 20px 0" }}>
        <div style={{ display: "flex", background: "#0f172a", borderRadius: 12, padding: 4, border: "1px solid #1e293b" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: tab===t.id ? "#1e293b" : "none", border: "none", borderRadius: 9, padding: "11px 6px", color: tab===t.id ? "#f1f5f9" : "#94a3b8", fontSize: SIZE.textSm, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 540, padding: "18px 20px 0" }}>
        {tab === "log"     && <DailyLog userId={userId} foods={foods} setFoods={setFoods} />}
        {tab === "library" && <FoodLibrary userId={userId} foods={foods} setFoods={setFoods} />}
        {tab === "goals"   && <GoalsPanel userId={userId} />}
        {tab === "trends"  && <TrendsPanel userId={userId} goals={goals} />}
      </div>
    </div>
  );
}
