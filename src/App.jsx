import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Menu,
  Bell,
  Gauge as GaugeIcon,
  Home,
  Wallet,
  PiggyBank,
  Plus,
  Check,
  TrendingUp,
  AlertTriangle,
  X,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Trash2,
  MessageCircle,
  Pencil,
} from "lucide-react";

// ---- Design tokens : verre dépoli façon iOS (glassmorphism) ----
const FONT_UI = "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = FONT_UI;

const GLASS_BG = "rgba(255,255,255,0.55)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.65)";
const GLASS_SHADOW = "0 10px 30px rgba(31,28,20,0.10), inset 0 1px 0 rgba(255,255,255,0.5)";
const BLUR = "blur(24px) saturate(180%)";

const glass = {
  background: GLASS_BG,
  backdropFilter: BLUR,
  WebkitBackdropFilter: BLUR,
  border: GLASS_BORDER,
  borderRadius: 22,
  boxShadow: GLASS_SHADOW,
};

const TODAY = 11;
const DAYS_IN_MONTH = 31;
const DAYS_REMAINING = DAYS_IN_MONTH - TODAY + 1;
const CURRENT_WEEK = Math.ceil(TODAY / 7);

// Répartition du revenu : épargne en priorité, puis charges, puis vivre.
// Ce qui n'est pas consommé dans l'enveloppe "charges" part directement en épargne.
const CHARGES_RATIO = 0.3;
const EPARGNE_RATIO = 0.4;
const VIVRE_RATIO = 0.3;
const ALERT_THRESHOLD = 0.5;

// Aucun revenu ni charge par défaut : l'appli les demande au lancement, dans cet ordre :
// 1) revenus  2) charges fixes (définies une fois, sur la base de l'enveloppe épargne/charges)
const INCOME_INIT = [];
const CHARGES_INIT = [];

// Aucune dépense pré-remplie : c'est à l'utilisateur de les ajouter,
// sinon des exemples fictifs faussent les calculs (rythme, jauge...).
const VIVRE_TRANSACTIONS_INIT = [];

// Pas d'objectif ni d'épargne antérieure présupposés : l'utilisateur les définit lui-même.

const TABS = [
  { id: "accueil", label: "Accueil", icon: GaugeIcon },
  { id: "depenses", label: "Dépenses", icon: Wallet },
  { id: "charges", label: "Charges", icon: Home },
  { id: "epargne", label: "Épargne", icon: PiggyBank },
];

function money(n) {
  return `${n.toFixed(2).replace(/\.00$/, "")}€`;
}

const sectionLabelStyle = {
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#7A756B",
  marginBottom: 10,
  fontWeight: 600,
  lineHeight: 1.3,
  textAlign: "center",
};

const inputStyle = {
  flex: 1,
  minWidth: 0,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.8)",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT_UI,
  color: "#111111",
  outline: "none",
  lineHeight: 1.3,
};

const addBtnStyle = {
  width: 38,
  flexShrink: 0,
  border: "none",
  borderRadius: 12,
  background: "linear-gradient(180deg, #2A2A2A, #000000)",
  boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

function BackgroundBlobs() {
  const blob = (top, left, size, color) => ({
    position: "absolute",
    top,
    left,
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    filter: "blur(60px)",
    opacity: 0.55,
  });
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0 }}>
      <div style={blob("-60px", "-40px", "260px", "#FFB37B")} />
      <div style={blob("120px", "220px", "220px", "#A8D5FF")} />
      <div style={blob("420px", "-60px", "240px", "#B7EACB")} />
      <div style={blob("620px", "200px", "260px", "#FFE29A")} />
    </div>
  );
}

function WeeklyGauge({ spent, budget }) {
  const remaining = Math.max(0, budget - spent);
  const pctRemaining = budget > 0 ? Math.max(0, Math.min(1, remaining / budget)) : 0;
  const R = 76;
  const CX = 100;
  const CY = 96;
  const L = Math.PI * R;
  const filled = L * pctRemaining;
  const path = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  const overBudget = spent > budget;

  return (
    <svg viewBox="0 0 200 112" width="100%" style={{ display: "block", maxWidth: 320, margin: "0 auto" }}>
      <defs>
        <linearGradient id="gaugeFill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFC488" />
          <stop offset="100%" stopColor="#FF8A3D" />
        </linearGradient>
        <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#FF8A3D" floodOpacity="0.3" />
        </filter>
      </defs>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="15" strokeLinecap="round" />
      <path
        d={path}
        fill="none"
        stroke={overBudget ? "#111111" : "url(#gaugeFill)"}
        strokeWidth="15"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${L}`}
        filter="url(#gaugeShadow)"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x="100" y="88" textAnchor="middle" fontFamily={FONT_MONO} fontSize="27" fontWeight="800" letterSpacing="-0.3" fill="#111111">
        {money(remaining)}
      </text>
    </svg>
  );
}

function AlertBanner({ pctSpent, remaining }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "rgba(255,178,110,0.35)",
        backdropFilter: BLUR,
        WebkitBackdropFilter: BLUR,
        border: "1px solid rgba(255,178,110,0.6)",
        borderRadius: 18,
        padding: "12px 14px",
        marginBottom: 14,
        boxSizing: "border-box",
      }}
    >
      <AlertTriangle size={18} color="#8A4A12" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 13, color: "#5E3A10", lineHeight: 1.5 }}>
        <strong>{Math.round(pctSpent * 100)}% du budget de la semaine déjà utilisé.</strong>
        <br />
        Il te reste {money(remaining)} jusqu'à dimanche pour ne pas taper dans l'épargne.
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, sub, fraction, tint }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 11, color: "#5A5A5A", fontWeight: 600, letterSpacing: "0.02em", marginBottom: 6, lineHeight: 1.3, textAlign: "center" }}>
        {label}
      </div>
      <div
        style={{
          ...glass,
          background: tint,
          borderRadius: 18,
          width: "100%",
          padding: "14px 10px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <Icon size={16} color="#111111" />
        {fraction ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.15 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: "#111111" }}>{fraction.num}</span>
            <span style={{ width: 26, height: 1, background: "#00000025", margin: "3px 0" }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, color: "#4A4A4A" }}>{fraction.den}</span>
          </div>
        ) : (
          <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: "#111111", marginTop: 8, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            {value}
          </div>
        )}
        {sub && <div style={{ fontSize: 10, color: "#5A5A5A", marginTop: 5, lineHeight: 1.3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function VivreList({ transactions, onAdd, onEdit, onRemove, limit }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!label.trim() || !val || val <= 0) return;
    onAdd({ id: Date.now(), label: label.trim(), amount: val, day: TODAY });
    setLabel("");
    setAmount("");
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditAmount(String(t.amount));
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const val = parseFloat(editAmount.replace(",", "."));
    if (!editLabel.trim() || !val || val <= 0) return;
    onEdit(editingId, { label: editLabel.trim(), amount: val });
    setEditingId(null);
  };

  const list = transactions.slice().sort((a, b) => b.day - a.day);
  const shown = limit ? list.slice(0, limit) : list;

  return (
    <div style={{ ...glass, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 18px", background: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wallet size={16} color="#111111" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Dépenses récentes</span>
        </div>
      </div>
      <div style={{ padding: "6px 18px 18px" }}>
        {shown.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#7A756B", textAlign: "center", padding: "16px 0" }}>
            Aucune dépense enregistrée. Ajoute la première ci-dessous 👇
          </div>
        )}
        {shown.map((t) =>
          editingId === t.id ? (
            <form key={t.id} onSubmit={saveEdit} style={{ display: "flex", gap: 6, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.5)" }}>
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} style={inputStyle} autoFocus />
              <input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} inputMode="decimal" style={{ ...inputStyle, width: 56, flex: "none" }} />
              <button type="submit" style={{ ...addBtnStyle, background: "linear-gradient(180deg, #2E9B57, #1C6B3D)" }} aria-label="Enregistrer">
                <Check size={15} color="#FFFFFF" />
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ ...addBtnStyle, background: "rgba(0,0,0,0.08)", boxShadow: "none" }} aria-label="Annuler">
                <X size={15} color="#5A5A5A" />
              </button>
            </form>
          ) : (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.5)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,138,61,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Wallet size={13} color="#FF8A3D" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: "#111111", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#7A756B", lineHeight: 1.3 }}>Jour {t.day}</div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: "#111111", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>-{money(t.amount)}</div>
              <button onClick={() => startEdit(t)} style={{ border: "none", background: "none", padding: 3, cursor: "pointer", display: "flex", flexShrink: 0 }} aria-label="Modifier">
                <Pencil size={13} color="#B0A990" />
              </button>
              <button onClick={() => onRemove(t.id)} style={{ border: "none", background: "none", padding: 3, cursor: "pointer", display: "flex", flexShrink: 0 }} aria-label="Supprimer">
                <Trash2 size={13} color="#B0A990" />
              </button>
            </div>
          )
        )}
        <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 14 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Ciné" style={inputStyle} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€" inputMode="decimal" style={{ ...inputStyle, width: 56, flex: "none" }} />
          <button type="submit" style={addBtnStyle} aria-label="Ajouter une dépense">
            <Plus size={15} color="#FFFFFF" />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChargesList({ charges, onToggle, onAdd, onRemove, envelope }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const total = charges.reduce((s, c) => s + c.amount, 0);
  const paid = charges.filter((c) => c.done).reduce((s, c) => s + c.amount, 0);
  const pct = total ? Math.round((paid / total) * 100) : 0;
  const toEpargne = Math.max(0, envelope - total);

  const submit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!label.trim() || !val || val <= 0) return;
    onAdd({ id: Date.now(), label: label.trim(), amount: val, done: false });
    setLabel("");
    setAmount("");
  };

  return (
    <div style={{ ...glass, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 18px", background: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Home size={16} color="#111111" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Charges fixes</span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5A5A5A" }}>{money(paid)} / {money(total)} payées</span>
      </div>
      <div style={{ padding: "10px 18px 16px" }}>
        <div style={{ height: 5, background: "rgba(255,255,255,0.5)", borderRadius: 3, overflow: "hidden", margin: "4px 0 4px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#111111" }} />
        </div>
        {charges.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", borderTop: "1px solid rgba(255,255,255,0.5)", padding: "10px 0" }}>
            <button onClick={() => onToggle(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 18, height: 18, borderRadius: 6, border: `1.5px solid ${c.done ? "#111111" : "rgba(0,0,0,0.25)"}`, background: c.done ? "#111111" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {c.done && <Check size={12} color="#FFFFFF" />}
              </div>
              <span style={{ fontSize: 13.5, color: c.done ? "#7A756B" : "#111111", textDecoration: c.done ? "line-through" : "none", flex: 1, minWidth: 0, lineHeight: 1.3 }}>{c.label}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: "#111111", flexShrink: 0, whiteSpace: "nowrap" }}>{money(c.amount)}</span>
            </button>
            <button onClick={() => onRemove(c.id)} style={{ border: "none", background: "none", padding: 3, cursor: "pointer", display: "flex", flexShrink: 0 }} aria-label="Supprimer">
              <Trash2 size={13} color="#B0A990" />
            </button>
          </div>
        ))}
        <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Assurance" style={inputStyle} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€" inputMode="decimal" style={{ ...inputStyle, width: 56, flex: "none" }} />
          <button type="submit" style={addBtnStyle} aria-label="Ajouter une charge">
            <Plus size={15} color="#FFFFFF" />
          </button>
        </form>
      </div>
      <div style={{ padding: "10px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize: 11.5, color: "#5A5A5A", lineHeight: 1.5 }}>
          Enveloppe charges ({Math.round(CHARGES_RATIO * 100)}% des revenus) : <strong style={{ color: "#111111" }}>{money(envelope)}</strong>.
          {toEpargne > 0 ? (
            <> Comme tu utilises moins, <strong style={{ color: "#2E9B57" }}>{money(toEpargne)}</strong> part directement dans ton épargne.</>
          ) : (
            <> Enveloppe entièrement utilisée.</>
          )}
        </div>
      </div>
    </div>
  );
}

function IncomeList({ incomeSources, onAdd, onRemove, totalIncome, compact }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!label.trim() || !val || val <= 0) return;
    onAdd({ id: Date.now(), label: label.trim(), amount: val });
    setLabel("");
    setAmount("");
  };

  return (
    <div style={compact ? {} : { ...glass, padding: 0, overflow: "hidden" }}>
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 18px", background: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet size={16} color="#111111" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Revenus du mois</span>
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5A5A5A" }}>Total : {money(totalIncome)}</span>
        </div>
      )}
      <div style={compact ? {} : { padding: "10px 18px 16px" }}>
        {incomeSources.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 13.5, color: "#111111", flex: 1, minWidth: 0 }}>{s.label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: "#2E9B57", fontWeight: 600, whiteSpace: "nowrap" }}>+{money(s.amount)}</span>
            {onRemove && (
              <button onClick={() => onRemove(s.id)} style={{ border: "none", background: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }} aria-label="Supprimer">
                <Trash2 size={13} color="#B0A990" />
              </button>
            )}
          </div>
        ))}
        <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Bourse CROUS" style={inputStyle} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€" inputMode="decimal" style={{ ...inputStyle, width: 56, flex: "none" }} />
          <button type="submit" style={addBtnStyle} aria-label="Ajouter un revenu">
            <Plus size={15} color="#FFFFFF" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- Config des charges à l'onboarding : comparée en direct à l'enveloppe 30% ----
function ChargesSetup({ charges, onAdd, onRemove, envelope }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const total = charges.reduce((s, c) => s + c.amount, 0);
  const pct = envelope > 0 ? Math.min(100, Math.round((total / envelope) * 100)) : 0;
  const over = total > envelope;
  const toEpargne = Math.max(0, envelope - total);

  const submit = (e) => {
    e.preventDefault();
    const val = parseFloat(amount.replace(",", "."));
    if (!label.trim() || !val || val <= 0) return;
    onAdd({ id: Date.now(), label: label.trim(), amount: val, done: false });
    setLabel("");
    setAmount("");
  };

  return (
    <div style={{ ...glass, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "16px 18px", background: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Home size={16} color="#111111" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Tes charges fixes</span>
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5A5A5A" }}>{money(total)} / {money(envelope)} (enveloppe 30%)</span>
      </div>
      <div style={{ padding: "12px 18px 16px" }}>
        <div style={{ height: 6, background: "rgba(255,255,255,0.5)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: over ? "#B8611E" : "#111111" }} />
        </div>
        <div style={{ fontSize: 11.5, color: "#5A5A5A", lineHeight: 1.5, marginBottom: 6 }}>
          {over
            ? "Tes charges dépassent l'enveloppe : le dépassement sera pris sur ton budget Vivre."
            : toEpargne > 0
            ? <>Le reste (<strong style={{ color: "#2E9B57" }}>{money(toEpargne)}</strong>) partira automatiquement dans ton épargne.</>
            : "Enveloppe pile utilisée."}
        </div>
        {charges.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 13.5, color: "#111111", flex: 1, minWidth: 0 }}>{c.label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: "#111111", whiteSpace: "nowrap" }}>{money(c.amount)}</span>
            <button onClick={() => onRemove(c.id)} style={{ border: "none", background: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }} aria-label="Supprimer">
              <Trash2 size={13} color="#B0A990" />
            </button>
          </div>
        ))}
        <form onSubmit={submit} style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Loyer" style={inputStyle} />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="€" inputMode="decimal" style={{ ...inputStyle, width: 56, flex: "none" }} />
          <button type="submit" style={addBtnStyle} aria-label="Ajouter une charge">
            <Plus size={15} color="#FFFFFF" />
          </button>
        </form>
      </div>
    </div>
  );
}

function PreviousSavingsField({ value, onValidate }) {
  const [draft, setDraft] = useState(value || "");

  useEffect(() => setDraft(value || ""), [value]);

  const submit = (e) => {
    e.preventDefault();
    const val = parseFloat((draft || "0").replace(",", "."));
    onValidate(isNaN(val) ? "0" : String(val));
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="0" inputMode="decimal" style={inputStyle} />
      <button
        type="submit"
        style={{ border: "none", borderRadius: 12, padding: "0 16px", fontSize: 13, fontWeight: 700, fontFamily: FONT_UI, color: "#FFFFFF", background: "linear-gradient(180deg, #2A2A2A, #000000)", boxShadow: "0 4px 10px rgba(0,0,0,0.25)", cursor: "pointer", flexShrink: 0 }}
      >
        Valider
      </button>
    </form>
  );
}

function EpargneTab({ goal, setGoal, previousSavings, setPreviousSavings, epargneBudget, totalSaved, epargneFromCharges }) {
  const [goalLabel, setGoalLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const hasGoal = goal.target > 0;
  const goalPct = hasGoal ? Math.min(100, Math.round((totalSaved / goal.target) * 100)) : 0;

  const submitGoal = (e) => {
    e.preventDefault();
    const val = parseFloat(goalTarget.replace(",", "."));
    if (!goalLabel.trim() || !val || val <= 0) return;
    setGoal({ label: goalLabel.trim(), target: val });
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {hasGoal ? (
        <div style={{ background: "linear-gradient(160deg, #2E9B57, #1C6B3D)", borderRadius: 22, padding: 20, color: "#FFFFFF", boxSizing: "border-box", boxShadow: "0 10px 30px rgba(46,155,87,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PiggyBank size={16} color="#FFFFFF" />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{goal.label}</span>
            </div>
            <button onClick={() => setGoal({ label: "", target: 0 })} style={{ border: "none", background: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "3px 8px", fontSize: 10.5, color: "#FFFFFF", cursor: "pointer", fontFamily: FONT_UI }}>
              Modifier
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700 }}>{money(totalSaved)}</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>sur {money(goal.target)}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600 }}>{goalPct}%</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.25)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${goalPct}%`, height: "100%", background: "#FFFFFF" }} />
          </div>
        </div>
      ) : (
        <div style={{ ...glass, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <PiggyBank size={16} color="#2E9B57" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Définis ton objectif d'épargne</span>
          </div>
          <form onSubmit={submitGoal} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} placeholder="Ex : Permis, voyage, ordi..." style={inputStyle} />
            <div style={{ display: "flex", gap: 6 }}>
              <input value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="Montant visé (€)" inputMode="decimal" style={inputStyle} />
              <button type="submit" style={addBtnStyle} aria-label="Définir l'objectif">
                <Plus size={15} color="#FFFFFF" />
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ ...glass, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <TrendingUp size={16} color="#2E9B57" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Épargne automatique de ce mois</span>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 700, color: "#111111", marginBottom: 6 }}>
          {money(epargneBudget)}
        </div>
        <div style={{ fontSize: 12.5, color: "#5A5A5A", lineHeight: 1.5 }}>
          {Math.round(EPARGNE_RATIO * 100)}% de tes revenus{epargneFromCharges > 0 ? <> + {money(epargneFromCharges)} de charges non utilisées</> : ""}. Ce montant évolue directement avec tes revenus.
        </div>
      </div>

      <div style={{ ...glass, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Wallet size={16} color="#111111" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>Épargne déjà existante</span>
        </div>
        <div style={{ fontSize: 12, color: "#5A5A5A", marginBottom: 8 }}>Ce que tu avais déjà de côté avant d'utiliser l'appli.</div>
        <PreviousSavingsField value={previousSavings} onValidate={setPreviousSavings} />
      </div>
    </div>
  );
}

function ProfileDrawer({ open, onClose, profile, setProfile, incomeSources, onAddIncome, onRemoveIncome, totalIncome, onNouveauMois }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,16,10,0.35)",
          backdropFilter: "blur(2px)",
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: "86%",
          maxWidth: 340,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: BLUR,
          WebkitBackdropFilter: BLUR,
          boxShadow: "4px 0 30px rgba(0,0,0,0.15)",
          zIndex: 41,
          transform: open ? "translateX(0)" : "translateX(-105%)",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
          padding: "20px 18px",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <button onClick={onClose} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 10, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 16 }} aria-label="Fermer">
          <X size={16} color="#111111" />
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(160deg, #FF8A3D, #FFC488)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(255,138,61,0.35)", marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
              {(profile.firstName[0] || "?") + (profile.lastName[0] || "")}
            </span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{profile.firstName} {profile.lastName}</span>
          <span style={{ fontSize: 12, color: "#7A756B", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2E9B57", display: "inline-block" }} />
            Connecté
          </span>
        </div>

        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7A756B", fontWeight: 600, marginBottom: 8 }}>Infos personnelles</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          <input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} placeholder="Prénom" style={inputStyle} />
          <input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} placeholder="Nom" style={inputStyle} />
          <input value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="Âge" inputMode="numeric" style={inputStyle} />
        </div>

        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7A756B", fontWeight: 600, marginBottom: 8 }}>
          Revenus du mois · {money(totalIncome)}
        </div>
        <div style={{ marginBottom: 20 }}>
          <IncomeList incomeSources={incomeSources} onAdd={onAddIncome} onRemove={onRemoveIncome} totalIncome={totalIncome} compact />
        </div>

        <button
          onClick={onNouveauMois}
          style={{
            width: "100%",
            border: "none",
            background: "linear-gradient(180deg, #FF9F5B, #FF8A3D)",
            borderRadius: 12,
            padding: "11px 12px",
            fontSize: 13,
            fontWeight: 700,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: FONT_UI,
            boxShadow: "0 6px 14px rgba(255,138,61,0.3)",
            marginBottom: 10,
          }}
        >
          🔄 Nouveau mois — mettre à jour mon salaire
        </button>
        <div style={{ fontSize: 10.5, color: "#7A756B", lineHeight: 1.4, marginBottom: 20, textAlign: "center" }}>
          Garde ton épargne déjà cumulée et tes charges fixes, remet à zéro tes revenus et tes dépenses du mois.
        </div>

        <button
          style={{
            width: "100%",
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(0,0,0,0.04)",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: "#7A756B",
            cursor: "pointer",
            fontFamily: FONT_UI,
          }}
        >
          Se déconnecter
        </button>
      </div>
    </>
  );
}

function NotificationPanel({ open, onClose, notifications }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, display: open ? "block" : "none" }} />
      <div
        style={{
          position: "absolute",
          top: "calc(68px + env(safe-area-inset-top))",
          right: 14,
          width: 270,
          maxWidth: "calc(100vw - 28px)",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: BLUR,
          WebkitBackdropFilter: BLUR,
          border: GLASS_BORDER,
          borderRadius: 16,
          boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
          zIndex: 41,
          padding: 8,
          boxSizing: "border-box",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.18s ease, transform 0.18s ease",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111111", padding: "6px 8px 8px" }}>Notifications</div>
        {notifications.length === 0 && (
          <div style={{ fontSize: 12.5, color: "#7A756B", padding: "6px 8px 10px" }}>Tout est calme pour l'instant 👌</div>
        )}
        {notifications.map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 8px", borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,138,61,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color="#FF8A3D" />
              </div>
              <span style={{ fontSize: 12.5, color: "#333333", lineHeight: 1.4 }}>{n.text}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- Assistant : répond localement à partir des vraies données de l'appli ----
// Pas d'appel à une IA externe (pas de backend/clé API sur ce déploiement statique) :
// des règles simples repèrent des mots-clés dans la question et piochent dans l'état réel.
function answerQuestion(question, s) {
  const q = question.toLowerCase();

  if (s.totalIncome === 0) {
    return "Tu n'as pas encore renseigné de revenus — ajoute ton salaire dans le menu ☰ pour que je puisse te répondre.";
  }

  if (/(reste|dispo).*(semaine|hebdo)|semaine.*(reste|dispo)/.test(q)) {
    return `Il te reste ${money(s.weeklyRemaining)} à dépenser cette semaine, sur un budget de ${money(s.weeklyBudget)}.`;
  }
  if (/(dépens|depens).*(semaine)/.test(q)) {
    return `Tu as dépensé ${money(s.weeklySpent)} cette semaine (${Math.round(s.weeklyPct * 100)}% de ton budget hebdo).`;
  }
  if (/(reste|dispo).*(mois|vivre)|vivre.*(reste|dispo)/.test(q)) {
    return `Il te reste ${money(Math.max(0, s.vivreRemaining))} sur ton budget Vivre du mois (${money(s.vivreBudget)} au total).`;
  }
  if (/(dépens|depens)/.test(q) && /mois/.test(q)) {
    return `Tu as dépensé ${money(s.vivreSpent)} ce mois-ci sur ton budget Vivre.`;
  }
  if (/charge/.test(q)) {
    const restant = s.totalCharges - s.paidCharges;
    return restant > 0
      ? `Tu as payé ${money(s.paidCharges)} sur ${money(s.totalCharges)} de charges. Il reste ${money(restant)} à régler.`
      : `Toutes tes charges (${money(s.totalCharges)}) sont payées ce mois-ci ✅`;
  }
  if (/(optimis|réduire|reduire|éliminer|eliminer|couper|conseil)/.test(q)) {
    if (s.transactions.length === 0) return "Tu n'as pas encore assez de dépenses enregistrées pour que je puisse te conseiller — reviens quand tu en auras quelques-unes.";
    const sorted = [...s.transactions].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const lines = sorted.map((t, i) => `${i + 1}. ${t.label} — ${money(t.amount)}`).join("\n");
    const biggest = sorted[0];
    return `Tes plus grosses dépenses ce mois-ci :\n${lines}\n\nRéduire "${biggest.label}" (${money(biggest.amount)}) est le levier le plus rapide pour te redonner de la marge cette semaine.`;
  }
  if (/(épargn|epargn|économ|econom)/.test(q)) {
    return `Ton épargne automatique de ce mois est de ${money(s.epargneBudget)}. Au total tu as ${money(s.totalSaved)} de côté${s.goal.target > 0 ? ` (${Math.min(100, Math.round((s.totalSaved / s.goal.target) * 100))}% de ton objectif "${s.goal.label}")` : ""}.`;
  }
  if (/(revenu|salaire|touche|gagn)/.test(q)) {
    return `Tes revenus déclarés ce mois-ci sont de ${money(s.totalIncome)}.`;
  }
  if (/objectif|but/.test(q)) {
    return s.goal.target > 0
      ? `Ton objectif "${s.goal.label}" est à ${money(s.totalSaved)} sur ${money(s.goal.target)} (${Math.min(100, Math.round((s.totalSaved / s.goal.target) * 100))}%).`
      : "Tu n'as pas encore défini d'objectif d'épargne — tu peux le faire dans l'onglet Épargne.";
  }
  if (/(plus|gros|cher).*(dépens|depens)|dépens.*(plus|gros)/.test(q)) {
    if (s.transactions.length === 0) return "Tu n'as pas encore enregistré de dépense ce mois-ci.";
    const top = [...s.transactions].sort((a, b) => b.amount - a.amount)[0];
    return `Ta plus grosse dépense ce mois-ci est "${top.label}" à ${money(top.amount)} (jour ${top.day}).`;
  }
  if (/(combien|nombre).*(dépens|depens)/.test(q) || /(dépens|depens).*(nombre|combien)/.test(q)) {
    return `Tu as enregistré ${s.transactions.length} dépense${s.transactions.length > 1 ? "s" : ""} ce mois-ci, pour un total de ${money(s.vivreSpent)}.`;
  }
  if (/en tout|au total|bilan|résumé|resume/.test(q)) {
    const totalDepense = s.vivreSpent + s.paidCharges;
    return `Résumé du mois : ${money(s.totalIncome)} de revenus, ${money(totalDepense)} dépensés (charges + vivre), ${money(s.totalSaved)} épargnés au total.`;
  }
  if (/jour|fin.*mois/.test(q)) {
    return `Il reste ${s.daysRemaining} jour${s.daysRemaining > 1 ? "s" : ""} avant la fin du mois.`;
  }

  return "Je ne suis pas sûr de comprendre 🤔 Essaie par exemple : \"combien il me reste cette semaine ?\", \"où en sont mes charges ?\" ou \"combien j'ai économisé ?\"";
}

const SUGGESTED_QUESTIONS = [
  "Combien il me reste cette semaine ?",
  "Où en sont mes charges ?",
  "Qu'est-ce que je peux réduire ?",
  "Résumé du mois",
];

function AssistantChat({ open, onClose, state }) {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Salut 👋 Pose-moi une question sur tes finances — dépenses, charges, épargne, revenus..." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const ask = (text) => {
    const q = text.trim();
    if (!q) return;
    const a = answerQuestion(q, state);
    setMessages((prev) => [...prev, { from: "user", text: q }, { from: "bot", text: a }]);
    setInput("");
  };

  const submit = (e) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(20,16,10,0.35)", backdropFilter: "blur(2px)", zIndex: 50, opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s ease" }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: open ? 0 : "-100%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 420,
          height: "72vh",
          background: "rgba(255,255,255,0.94)",
          backdropFilter: BLUR,
          WebkitBackdropFilter: BLUR,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.2)",
          zIndex: 51,
          transition: "bottom 0.3s cubic-bezier(0.22,1,0.36,1)",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>💬 Assistant budget</span>
          <button onClick={onClose} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 10, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Fermer">
            <X size={14} color="#111111" />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div
                style={{
                  maxWidth: "80%",
                  padding: "9px 12px",
                  borderRadius: 14,
                  fontSize: 13,
                  lineHeight: 1.45,
                  background: m.from === "user" ? "linear-gradient(180deg, #2A2A2A, #000000)" : "rgba(0,0,0,0.05)",
                  color: m.from === "user" ? "#FFFFFF" : "#111111",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 16px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              onClick={() => ask(sq)}
              style={{ flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,138,61,0.1)", color: "#8A4A12", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontFamily: FONT_UI, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {sq}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", gap: 6, padding: "10px 16px calc(12px + env(safe-area-inset-bottom))", flexShrink: 0, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pose ta question..." style={inputStyle} />
          <button type="submit" style={addBtnStyle} aria-label="Envoyer">
            <ArrowRight size={15} color="#FFFFFF" />
          </button>
        </form>
      </div>
    </>
  );
}

const STORAGE_KEY = "budget-etudiant-v1";

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function BudgetEtudiant() {
  const saved = useMemo(() => loadSaved(), []);

  const [activeTab, setActiveTab] = useState("accueil");
  const [charges, setCharges] = useState(saved?.charges ?? CHARGES_INIT);
  const [transactions, setTransactions] = useState(saved?.transactions ?? VIVRE_TRANSACTIONS_INIT);
  const [incomeSources, setIncomeSources] = useState(saved?.incomeSources ?? INCOME_INIT);
  const [onboardStep, setOnboardStep] = useState(saved?.onboardStep ?? "income"); // "income" -> "charges" -> done
  const [onboardingDone, setOnboardingDone] = useState(saved?.onboardingDone ?? false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [profile, setProfile] = useState(saved?.profile ?? { firstName: "Mac", lastName: "Orel", age: "" });
  const [goal, setGoal] = useState(saved?.goal ?? { label: "", target: 0 });
  const [previousSavingsInput, setPreviousSavingsInput] = useState(saved?.previousSavingsInput ?? "");
  const touchStartX = useRef(null);
  const panelRefs = useRef([]);

  const tabIndex = TABS.findIndex((t) => t.id === activeTab);

  useEffect(() => {
    panelRefs.current[tabIndex]?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab]);

  // Sauvegarde locale : tout est réécrit à chaque changement, donc rien
  // à ressaisir en rouvrant l'appli.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ charges, transactions, incomeSources, onboardStep, onboardingDone, profile, goal, previousSavingsInput })
      );
    } catch {
      // stockage indisponible (mode privé...) : on continue sans persister
    }
  }, [charges, transactions, incomeSources, onboardStep, onboardingDone, profile, goal, previousSavingsInput]);


  const totalIncome = useMemo(() => incomeSources.reduce((s, i) => s + i.amount, 0), [incomeSources]);
  const totalCharges = useMemo(() => charges.reduce((s, c) => s + c.amount, 0), [charges]);
  const paidCharges = useMemo(() => charges.filter((c) => c.done).reduce((s, c) => s + c.amount, 0), [charges]);

  const chargesEnvelope = totalIncome * CHARGES_RATIO;
  const chargesUnderspend = Math.max(0, chargesEnvelope - totalCharges);
  const chargesOverspend = Math.max(0, totalCharges - chargesEnvelope);

  const epargneBudget = Math.round(totalIncome * EPARGNE_RATIO + chargesUnderspend);
  const vivreBudget = Math.max(0, Math.round(totalIncome * VIVRE_RATIO - chargesOverspend));

  const vivreSpent = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions]);
  const vivreRemaining = vivreBudget - vivreSpent;

  const weeklyBudget = Math.round(vivreBudget / 4);
  const weeklySpent = useMemo(
    () => transactions.filter((t) => Math.ceil(t.day / 7) === CURRENT_WEEK).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const weeklyPct = weeklyBudget > 0 ? weeklySpent / weeklyBudget : 0;
  const weeklyRemaining = Math.max(0, weeklyBudget - weeklySpent);
  const showAlert = weeklyPct >= ALERT_THRESHOLD;

  const previousSavings = parseFloat((previousSavingsInput || "0").replace(",", ".")) || 0;
  const totalSaved = previousSavings + epargneBudget;

  const notifications = useMemo(() => {
    const list = [];
    if (totalIncome === 0) list.push({ icon: Wallet, text: "Ajoute ton salaire ou ta bourse du mois pour activer tes enveloppes." });
    if (TODAY <= 3 && totalIncome > 0) list.push({ icon: Wallet, text: "N'oublie pas de vérifier tes revenus du mois." });
    if (showAlert) list.push({ icon: AlertTriangle, text: `${Math.round(weeklyPct * 100)}% du budget hebdo déjà dépensé.` });
    if (DAYS_REMAINING <= 5) list.push({ icon: Calendar, text: `Plus que ${DAYS_REMAINING} jours avant la fin du mois.` });
    if (paidCharges < totalCharges) list.push({ icon: Home, text: `${money(totalCharges - paidCharges)} de charges restent à cocher.` });
    return list;
  }, [totalIncome, showAlert, weeklyPct, paidCharges, totalCharges]);

  const handleToggleCharge = (id) => setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  const handleAddCharge = (c) => setCharges((prev) => [...prev, c]);
  const handleRemoveCharge = (id) => setCharges((prev) => prev.filter((c) => c.id !== id));
  const handleAddTransaction = (t) => setTransactions((prev) => [t, ...prev]);
  const handleEditTransaction = (id, patch) => setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const handleRemoveTransaction = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id));
  const handleAddIncome = (s) => setIncomeSources((prev) => [...prev, s]);
  const handleRemoveIncome = (id) => setIncomeSources((prev) => prev.filter((s) => s.id !== id));

  // Nouveau mois : on garde l'épargne déjà accumulée et la liste des charges
  // fixes (pas besoin de tout redéfinir), on remet à zéro les revenus et les
  // dépenses, et on décoche les charges pour le nouveau mois de paiement.
  const handleNouveauMois = () => {
    setPreviousSavingsInput(String(previousSavings + epargneBudget));
    setIncomeSources([]);
    setTransactions([]);
    setCharges((prev) => prev.map((c) => ({ ...c, done: false })));
    setOnboardStep("income");
    setOnboardingDone(false);
    setProfileOpen(false);
  };

  const goToTab = (dir) => {
    const next = Math.min(TABS.length - 1, Math.max(0, tabIndex + dir));
    setActiveTab(TABS[next].id);
  };

  const onPointerDown = (e) => { touchStartX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.clientX - touchStartX.current;
    if (Math.abs(delta) > 50) goToTab(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const panelStyle = { width: "25%", flexShrink: 0, height: "100%", overflowY: "auto", padding: "0 20px 24px", boxSizing: "border-box" };

  const showOnboarding = !onboardingDone;

  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #FDF6EE 0%, #FBEFE3 45%, #EFF3FB 100%)", fontFamily: FONT_UI, color: "#111111", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <BackgroundBlobs />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 420, width: "100%", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", paddingTop: "env(safe-area-inset-top)" }}>
        {/* Barre du haut */}
        <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", margin: "calc(10px + env(safe-area-inset-top)) 14px 14px", ...glass, borderRadius: 18 }}>
          <button onClick={() => setProfileOpen(true)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", display: "flex" }} aria-label="Ouvrir le menu">
            <Menu size={20} color="#111111" />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Bonjour {profile.firstName}</span>
          <button onClick={() => setNotifOpen((v) => !v)} style={{ position: "relative", width: 20, height: 20, border: "none", background: "none", padding: 0, cursor: "pointer" }} aria-label="Notifications">
            <Bell size={20} color="#111111" />
            {notifications.length > 0 && (
              <div style={{ position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: "#FF8A3D", border: "1.5px solid #FFFFFF" }} />
            )}
          </button>
        </div>

        <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} notifications={notifications} />

        {showOnboarding ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px 24px", overflowY: "auto" }}>
            {onboardStep === "income" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111111", marginBottom: 6 }}>Bienvenue {profile.firstName} 👋</div>
                  <div style={{ fontSize: 13, color: "#5A5A5A", lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>
                    {charges.length > 0
                      ? "Nouveau mois — combien touches-tu ? Tes charges fixes sont déjà enregistrées, pas besoin de les ressaisir."
                      : "Étape 1/2 — combien touches-tu ce mois-ci ? On répartit ensuite 30% charges, 40% épargne, 30% pour vivre."}
                  </div>
                </div>
                <IncomeList incomeSources={incomeSources} onAdd={handleAddIncome} onRemove={handleRemoveIncome} totalIncome={totalIncome} />
                <button
                  onClick={() => (charges.length > 0 ? setOnboardingDone(true) : setOnboardStep("charges"))}
                  disabled={totalIncome <= 0}
                  style={{ marginTop: 16, width: "100%", border: "none", borderRadius: 14, padding: "13px 16px", fontSize: 14, fontWeight: 700, fontFamily: FONT_UI, color: "#FFFFFF", background: totalIncome > 0 ? "linear-gradient(180deg, #2A2A2A, #000000)" : "#C9C4B8", boxShadow: totalIncome > 0 ? "0 6px 16px rgba(0,0,0,0.25)" : "none", cursor: totalIncome > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {charges.length > 0 ? "Voir mon budget" : "Définir mes charges fixes"} <ArrowRight size={15} />
                </button>
              </>
            )}

            {onboardStep === "charges" && (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#111111", marginBottom: 6 }}>Tes charges fixes</div>
                  <div style={{ fontSize: 13, color: "#5A5A5A", lineHeight: 1.5, maxWidth: 300, margin: "0 auto" }}>
                    Étape 2/2 — loyer, box, forfait... Ce que tu n'utilises pas sur l'enveloppe de 30% part automatiquement dans ton épargne.
                  </div>
                </div>
                <ChargesSetup charges={charges} onAdd={handleAddCharge} onRemove={handleRemoveCharge} envelope={chargesEnvelope} />
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => setOnboardStep("income")}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", background: "rgba(255,255,255,0.6)", borderRadius: 14, padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "#5A5A5A", cursor: "pointer", fontFamily: FONT_UI, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ArrowLeft size={14} /> Revenus
                  </button>
                  <button
                    onClick={() => setOnboardingDone(true)}
                    style={{ flex: 1, border: "none", borderRadius: 14, padding: "13px 16px", fontSize: 14, fontWeight: 700, fontFamily: FONT_UI, color: "#FFFFFF", background: "linear-gradient(180deg, #2A2A2A, #000000)", boxShadow: "0 6px 16px rgba(0,0,0,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    Voir mon budget <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Contenu — panneaux glissants (swipe), chacun avec son propre scroll */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
              <div style={{ display: "flex", width: "400%", height: "100%", transform: `translateX(-${tabIndex * 25}%)`, transition: "transform 0.35s cubic-bezier(0.22,1,0.36,1)" }}>
                <div style={panelStyle} ref={(el) => (panelRefs.current[0] = el)}>
                  <div style={{ ...glass, padding: "20px 12px", marginBottom: 14 }}>
                    <WeeklyGauge spent={weeklySpent} budget={weeklyBudget} />
                  </div>
                  {showAlert && <AlertBanner pctSpent={weeklyPct} remaining={weeklyRemaining} />}
                  <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                    <QuickStat icon={Home} label="Charges" fraction={{ num: money(paidCharges), den: money(totalCharges) }} tint="rgba(168,213,255,0.45)" />
                    <QuickStat icon={Wallet} label="Vivre restant" value={money(Math.max(0, vivreRemaining))} sub={`${DAYS_REMAINING}j restants`} tint="rgba(255,226,154,0.5)" />
                    <QuickStat icon={PiggyBank} label="Épargné" value={money(totalSaved)} tint="rgba(183,234,203,0.5)" />
                  </div>
                  <div style={sectionLabelStyle}>Dernières dépenses</div>
                  <VivreList transactions={transactions} onAdd={handleAddTransaction} onEdit={handleEditTransaction} onRemove={handleRemoveTransaction} limit={3} />
                </div>

                <div style={panelStyle} ref={(el) => (panelRefs.current[1] = el)}>
                  <div style={sectionLabelStyle}>Budget vivre</div>
                  <VivreList transactions={transactions} onAdd={handleAddTransaction} onEdit={handleEditTransaction} onRemove={handleRemoveTransaction} />
                </div>

                <div style={panelStyle} ref={(el) => (panelRefs.current[2] = el)}>
                  <div style={sectionLabelStyle}>Charges fixes du mois</div>
                  <ChargesList charges={charges} onToggle={handleToggleCharge} onAdd={handleAddCharge} onRemove={handleRemoveCharge} envelope={chargesEnvelope} />
                </div>

                <div style={panelStyle} ref={(el) => (panelRefs.current[3] = el)}>
                  <div style={sectionLabelStyle}>Épargne & objectif</div>
                  <EpargneTab goal={goal} setGoal={setGoal} previousSavings={previousSavingsInput} setPreviousSavings={setPreviousSavingsInput} epargneBudget={epargneBudget} totalSaved={totalSaved} epargneFromCharges={chargesUnderspend} />
                </div>
              </div>
            </div>

            {/* Barre d'onglets — reste figée, hors de la zone qui scrolle */}
            <div style={{ flexShrink: 0, display: "flex", margin: "0 14px calc(14px + env(safe-area-inset-bottom))", padding: 6, ...glass, borderRadius: 20 }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", background: active ? "rgba(255,255,255,0.75)" : "none", boxShadow: active ? "0 4px 10px rgba(0,0,0,0.08)" : "none", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: FONT_UI, transition: "background 0.2s ease" }}
                  >
                    <Icon size={19} color={active ? "#FF8A3D" : "#7A756B"} />
                    <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? "#111111" : "#7A756B", lineHeight: 1.2 }}>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bouton flottant vers l'assistant */}
            <button
              onClick={() => setChatOpen(true)}
              style={{
                position: "absolute",
                right: 20,
                bottom: 92,
                width: 50,
                height: 50,
                borderRadius: "50%",
                border: "none",
                background: "linear-gradient(160deg, #FF9F5B, #FF8A3D)",
                boxShadow: "0 8px 20px rgba(255,138,61,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 5,
              }}
              aria-label="Ouvrir l'assistant"
            >
              <MessageCircle size={22} color="#FFFFFF" />
            </button>
          </>
        )}
      </div>

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        setProfile={setProfile}
        incomeSources={incomeSources}
        onAddIncome={handleAddIncome}
        onRemoveIncome={handleRemoveIncome}
        totalIncome={totalIncome}
        onNouveauMois={handleNouveauMois}
      />

      <AssistantChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        state={{
          totalIncome,
          totalCharges,
          paidCharges,
          weeklyBudget,
          weeklySpent,
          weeklyRemaining,
          weeklyPct,
          vivreBudget,
          vivreSpent,
          vivreRemaining,
          epargneBudget,
          totalSaved,
          goal,
          transactions,
          daysRemaining: DAYS_REMAINING,
        }}
      />
    </div>
  );
}
