import { useState, useCallback } from "react";

// ─── DATOS ────────────────────────────────────────────────────────────────────
const TNA_BASE = 0.95;

const ZONAS = [
  { tag: "EXCELENTE", min: 80, max: 100, color: "#00E5A0", titulo: "Perfil Excelente", decision: "AUTO-APROBADO", montoMax: 1000000, tasaAjuste: 0, plazos: [3,6,9,12] },
  { tag: "BUENO",     min: 65, max: 79,  color: "#7FD94A", titulo: "Perfil Bueno",     decision: "APROBADO",      montoMax: 800000,  tasaAjuste: 0,    plazos: [3,6,9,12] },
  { tag: "MEDIO",     min: 50, max: 64,  color: "#FFB800", titulo: "Perfil Medio",     decision: "REVISIÓN MANUAL",montoMax: 600000,  tasaAjuste: 0.05, plazos: [3,6,9] },
  { tag: "RIESGO",    min: 30, max: 49,  color: "#FF6B2B", titulo: "Riesgo Medio-Alto",decision: "CONDICIONADO",  montoMax: 300000,  tasaAjuste: 0.10, plazos: [3,6] },
  { tag: "RECHAZADO", min: 0,  max: 29,  color: "#FF3B3B", titulo: "Alto Riesgo",      decision: "RECHAZADO",     montoMax: 0,       tasaAjuste: 0,    plazos: [] },
];

const CATEGORIAS = [
  {
    id: "identidad", nombre: "Identidad y Domicilio", icono: "🪪", ptMax: 20,
    criterios: [
      { id:"dni_f",    label:"DNI frente — legible, vigente",           pts:5,  tipo:"bin", req:true,  nota:"Obligatorio. Sin DNI no se inicia la evaluación." },
      { id:"dni_d",    label:"DNI dorso — legible, sin alteraciones",   pts:3,  tipo:"bin", req:true,  nota:"Obligatorio junto al frente." },
      { id:"selfie",   label:"Selfie sosteniendo DNI (liveness check)", pts:4,  tipo:"bin", req:false, nota:"Reduce riesgo de suplantación de identidad." },
      { id:"serv",     label:"Servicio a nombre del titular (90 días)", pts:5,  tipo:"bin", req:true,  nota:"Luz / Gas / Agua. Nombre igual al DNI." },
      { id:"dom_ok",   label:"Domicilio del servicio coincide",         pts:3,  tipo:"bin", req:false, nota:"Si es familiar conviviente se puede aceptar con nota." },
    ],
  },
  {
    id: "ingresos", nombre: "Capacidad de Ingresos", icono: "💰", ptMax: 30,
    criterios: [
      { id:"recibo",   label:"Recibo de sueldo — últimos 2 meses",     pts:15, tipo:"bin", req:true,  nota:"OBLIGATORIO para este producto." },
      { id:"ant_12",   label:"Antigüedad laboral ≥ 12 meses",          pts:8,  tipo:"exc", grupo:"ant", nota:"Dato del recibo. Máxima estabilidad." },
      { id:"ant_6",    label:"Antigüedad laboral 6–11 meses",          pts:4,  tipo:"exc", grupo:"ant", nota:"Menor estabilidad. Compensar con buen Equifax." },
      { id:"ant_0",    label:"Antigüedad laboral < 6 meses",           pts:0,  tipo:"exc", grupo:"ant", nota:"No suma puntos. Riesgo de desvinculación." },
      { id:"cuota30",  label:"Cuota solicitada ≤ 30% del sueldo neto", pts:7,  tipo:"bin", req:false, nota:"Ver calculadora de capacidad de pago." },
    ],
  },
  {
    id: "equifax", nombre: "Historial Equifax / Veraz", icono: "📊", ptMax: 25,
    criterios: [
      { id:"eq_a",  label:"Score Veraz 700–999 + BCRA Situación 1",  pts:25,  tipo:"exc", grupo:"eq", nota:"Perfil excelente. Sin deudas ni atrasos." },
      { id:"eq_b",  label:"Score Veraz 500–699 + BCRA Situación 1",  pts:18,  tipo:"exc", grupo:"eq", nota:"Buen perfil. Algún atraso menor saldado." },
      { id:"eq_c",  label:"Score Veraz 300–499 + BCRA Situación 2",  pts:8,   tipo:"exc", grupo:"eq", nota:"Historial con observaciones. Monto reducido." },
      { id:"eq_d",  label:"BCRA Situación 3 — con problemas",        pts:2,   tipo:"exc", grupo:"eq", nota:"Solo microcrédito. Monto mínimo. Requiere garante." },
      { id:"eq_e",  label:"BCRA Situación 4 o 5 — RECHAZO",         pts:-50, tipo:"exc", grupo:"eq", nota:"⚠ RECHAZO AUTOMÁTICO. Score cae a 0." },
      { id:"hist_int",label:"Cliente recurrente interno — buen pago", pts:5,   tipo:"bin", req:false, nota:"Crédito previo pagado en término. Bono de confianza." },
    ],
  },
  {
    id: "referencias", nombre: "Referencias Personales", icono: "👥", ptMax: 10,
    criterios: [
      { id:"ref1",    label:"Referencia 1 — nombre, tel., relación",       pts:4, tipo:"bin", req:true,  nota:"Mínimo 2 referencias para avanzar." },
      { id:"ref2",    label:"Referencia 2 — nombre, tel., relación dif.",  pts:4, tipo:"bin", req:true,  nota:"No puede ser la misma persona que ref. 1." },
      { id:"ref_ver", label:"Al menos 1 referencia verificada por llamado", pts:2, tipo:"bin", req:false, nota:"Ejecutivo llama y confirma que conoce al solicitante." },
    ],
  },
  {
    id: "respaldo", nombre: "Respaldo y Compromiso", icono: "🔒", ptMax: 15,
    criterios: [
      { id:"debito",   label:"Acepta débito automático en CBU/CVU",        pts:7, tipo:"bin", req:false, nota:"Reduce mora temprana significativamente." },
      { id:"garante",  label:"Garante solidario con recibo de sueldo",     pts:5, tipo:"bin", req:false, nota:"El garante pasa por verificación básica." },
      { id:"emp_pub",  label:"Empleador empresa pública o grande",         pts:3, tipo:"bin", req:false, nota:"Estado, empresas cotizantes, convenios colectivos." },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const getZona = (score) => ZONAS.find((z) => score >= z.min && score <= z.max) || ZONAS[ZONAS.length - 1];
const fmtPesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const calcCuota = (monto, cuotas, tna) => {
  const tm = tna / 12;
  if (tm === 0) return monto / cuotas;
  return (monto * tm * Math.pow(1 + tm, cuotas)) / (Math.pow(1 + tm, cuotas) - 1);
};

// ─── ESTILOS BASE ────────────────────────────────────────────────────────────
const S = {
  screen: { background:"#090C11", minHeight:"100dvh", color:"#D8E0EC", fontFamily:"Arial, sans-serif", paddingBottom:80 },
  header: { background:"#101828", borderBottom:"1px solid #1E2D42", padding:"16px 16px 12px", position:"sticky", top:0, zIndex:100 },
  card: { background:"#101828", border:"1px solid #1E2D42", borderRadius:12, marginBottom:12, overflow:"hidden" },
  catHeader: (color) => ({ padding:"12px 16px", borderBottom:"1px solid #1E2D42", display:"flex", alignItems:"center", gap:8 }),
  input: { background:"#131C28", border:"1px solid #1E2D42", borderRadius:8, padding:"10px 12px", color:"#D8E0EC", fontSize:16, width:"100%", fontFamily:"Arial" },
  btn: (color, bg) => ({ background:bg||color, color:bg?"#000":"#fff", border:"none", borderRadius:8, padding:"12px 0", fontWeight:700, fontSize:14, cursor:"pointer", width:"100%", fontFamily:"Arial" }),
  tag: (color) => ({ background:`${color}20`, border:`1px solid ${color}44`, borderRadius:6, padding:"2px 8px", fontSize:11, color, fontFamily:"monospace" }),
  navBar: { position:"fixed", bottom:0, left:0, right:0, background:"#101828", borderTop:"1px solid #1E2D42", display:"flex", zIndex:200, paddingBottom:"env(safe-area-inset-bottom)" },
  navBtn: (active) => ({ flex:1, padding:"10px 0 8px", background:"none", border:"none", color:active?"#FFB800":"#3A4A60", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:10, fontFamily:"Arial", fontWeight:active?700:400 }),
};

// ─── COMPONENTE: BADGE DE ZONA ───────────────────────────────────────────────
function ZonaBadge({ score }) {
  const zona = getZona(score);
  return (
    <div style={{ background:`${zona.color}15`, border:`1px solid ${zona.color}44`, borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
      <div style={{ fontSize:11, color:zona.color, fontFamily:"monospace", letterSpacing:2, marginBottom:4 }}>{zona.decision}</div>
      <div style={{ fontSize:18, color:"#D8E0EC", fontWeight:700 }}>{zona.titulo}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8 }}>
        <div style={{ background:"#131C28", borderRadius:999, height:8, flex:1, overflow:"hidden" }}>
          <div style={{ background:zona.color, width:`${score}%`, height:"100%", borderRadius:999, transition:"width .5s" }} />
        </div>
        <span style={{ fontFamily:"monospace", fontSize:20, fontWeight:700, color:zona.color, minWidth:44 }}>{score}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#1E2D42", fontFamily:"monospace", marginTop:2, padding:"0 2px" }}>
        {["0","30","50","65","80","100"].map(n=><span key={n}>{n}</span>)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA 1: SCORING
// ══════════════════════════════════════════════════════════════════════════════
function PantallaScoring() {
  const [sel, setSel] = useState({});
  const [catAbierta, setCatAbierta] = useState("identidad");

  const toggle = useCallback((c) => {
    setSel((prev) => {
      const next = { ...prev };
      if (c.tipo === "exc") {
        CATEGORIAS.forEach((cat) => cat.criterios.forEach((cr) => { if (cr.grupo === c.grupo) delete next[cr.id]; }));
      }
      if (prev[c.id]) delete next[c.id]; else next[c.id] = true;
      return next;
    });
  }, []);

  const calcScore = () => {
    if (sel["eq_e"]) return 0;
    let total = 0;
    const used = {};
    CATEGORIAS.forEach((cat) => cat.criterios.forEach((c) => {
      if (!sel[c.id]) return;
      const k = c.grupo || c.id;
      if (c.tipo === "exc") { if (!used[k]) { used[k] = true; total += c.pts; } }
      else total += c.pts;
    }));
    return Math.max(0, Math.min(100, total));
  };

  const score = calcScore();
  const zona = getZona(score);

  const ptsEnCat = (cat) => {
    let t = 0;
    const used = {};
    cat.criterios.forEach((c) => {
      if (!sel[c.id]) return;
      const k = c.grupo || c.id;
      if (c.tipo === "exc") { if (!used[k]) { used[k] = true; t += Math.max(0,c.pts); } }
      else t += Math.max(0,c.pts);
    });
    return t;
  };

  return (
    <div>
      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize:11, color:"#3A4A60", fontFamily:"monospace", letterSpacing:3, marginBottom:4 }}>SCORING CREDITICIO</div>
        <ZonaBadge score={score} />
        {zona.montoMax > 0 && (
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <div style={{ flex:1, background:"#131C28", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#3A4A60", marginBottom:2 }}>Monto máx.</div>
              <div style={{ fontSize:15, color:zona.color, fontWeight:700 }}>{fmtPesos(zona.montoMax)}</div>
            </div>
            <div style={{ flex:1, background:"#131C28", borderRadius:8, padding:"8px 12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#3A4A60", marginBottom:2 }}>Plazos</div>
              <div style={{ fontSize:13, color:zona.color, fontWeight:700 }}>{zona.plazos.join(" / ")} cuotas</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:"12px 12px 0" }}>
        {CATEGORIAS.map((cat) => {
          const abierta = catAbierta === cat.id;
          const ptsCat = ptsEnCat(cat);
          return (
            <div key={cat.id} style={S.card}>
              {/* Cabecera categoría */}
              <div onClick={() => setCatAbierta(abierta ? null : cat.id)}
                style={{ ...S.catHeader(), cursor:"pointer", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:20 }}>{cat.icono}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#D8E0EC" }}>{cat.nombre}</div>
                    <div style={{ fontSize:11, color:"#3A4A60" }}>máx. {cat.ptMax} pts</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {ptsCat > 0 && <span style={S.tag("#FFB800")}>+{ptsCat}</span>}
                  <span style={{ color:"#3A4A60", fontSize:16 }}>{abierta ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Criterios */}
              {abierta && cat.criterios.map((c) => {
                const active = !!sel[c.id];
                const neg = c.pts < 0;
                return (
                  <div key={c.id} onClick={() => toggle(c)}
                    style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px", borderTop:"1px solid #131C28", cursor:"pointer", background: active ? (neg?"#2A0A0A":"#0D1A10") : "transparent" }}>
                    {/* Check / Radio */}
                    <div style={{ width:22, height:22, borderRadius: c.tipo==="exc" ? "50%" : 6, border:`2px solid ${active?(neg?"#FF3B3B":"#FFB800"):"#253040"}`, background:active?(neg?"#FF3B3B":"#FFB800"):"transparent", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                      {active && <span style={{ fontSize:12, color:"#000", fontWeight:900 }}>✓</span>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color: active?"#D8E0EC":"#5A7090", lineHeight:1.4 }}>{c.label}</div>
                      <div style={{ fontSize:11, color:"#2E4060", marginTop:3, lineHeight:1.4 }}>{c.nota}</div>
                      {c.req && <span style={{ fontSize:10, color:"#FF6B2B", fontFamily:"monospace" }}>OBLIGATORIO</span>}
                    </div>
                    <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color: neg?"#FF3B3B":(active?"#FFB800":"#253040"), minWidth:32, textAlign:"right", marginTop:2 }}>
                      {c.pts > 0 ? `+${c.pts}` : c.pts}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <button onClick={() => setSel({})} style={{ ...S.btn("#3A4A60"), background:"#131C28", color:"#3A4A60", marginBottom:16 }}>
          REINICIAR EVALUACIÓN
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA 2: CALCULADORA DE CAPACIDAD DE PAGO
// ══════════════════════════════════════════════════════════════════════════════
function PantallaCalculadora() {
  const [sueldo, setSueldo] = useState("");
  const [monto, setMonto] = useState("");
  const [score, setScore] = useState("");

  const s = parseFloat(sueldo) || 0;
  const m = parseFloat(monto) || 0;
  const sc = parseInt(score) || 0;
  const zona = getZona(sc);
  const cuotaMax = s * 0.30;
  const tna = TNA_BASE + zona.tasaAjuste;

  const plazos = sc >= 65 ? [3,6,9,12] : sc >= 50 ? [3,6,9] : sc >= 30 ? [3,6] : [];

  return (
    <div style={{ padding:12 }}>
      <div style={{ fontSize:11, color:"#3A4A60", fontFamily:"monospace", letterSpacing:3, marginBottom:12 }}>CALCULADORA DE PAGO</div>

      <div style={S.card}>
        <div style={{ padding:"14px 16px" }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:"#3A4A60", display:"block", marginBottom:6, fontFamily:"monospace" }}>SUELDO NETO ACREDITADO ($)</label>
            <input type="number" inputMode="numeric" value={sueldo} onChange={e=>setSueldo(e.target.value)} placeholder="ej: 450000" style={S.input} />
            {s > 0 && <div style={{ fontSize:12, color:"#00E5A0", marginTop:6 }}>Cuota máxima permitida (30%): <strong>{fmtPesos(cuotaMax)}</strong></div>}
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color:"#3A4A60", display:"block", marginBottom:6, fontFamily:"monospace" }}>MONTO SOLICITADO ($)</label>
            <input type="number" inputMode="numeric" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="ej: 700000" style={S.input} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#3A4A60", display:"block", marginBottom:6, fontFamily:"monospace" }}>SCORE (de la pantalla anterior)</label>
            <input type="number" inputMode="numeric" value={score} onChange={e=>setScore(e.target.value)} placeholder="ej: 78" style={S.input} />
            {sc > 0 && <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
              <span style={S.tag(zona.color)}>{zona.titulo}</span>
              <span style={S.tag("#3A4A60")}>TNA {(tna*100).toFixed(0)}%</span>
            </div>}
          </div>
        </div>
      </div>

      {s > 0 && m > 0 && sc > 0 && (
        <div style={S.card}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #1E2D42" }}>
            <div style={{ fontSize:11, color:"#FFB800", fontFamily:"monospace", letterSpacing:2 }}>TABLA DE CUOTAS POR PLAZO</div>
          </div>
          {plazos.length === 0 ? (
            <div style={{ padding:16, color:"#FF3B3B", fontSize:13 }}>⛔ Score insuficiente. No hay plazos habilitados.</div>
          ) : plazos.map((p) => {
            const cuota = calcCuota(m, p, tna);
            const entra = cuota <= cuotaMax;
            const montoAdj = cuotaMax > 0
              ? (cuotaMax * (Math.pow(1+tna/12, p)-1)) / ((tna/12) * Math.pow(1+tna/12, p))
              : 0;
            const montoFinal = Math.min(m, zona.montoMax, montoAdj > 0 ? montoAdj : m);

            return (
              <div key={p} style={{ padding:"14px 16px", borderTop:"1px solid #131C28" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontWeight:700, color:"#D8E0EC", fontSize:14 }}>{p} cuotas</span>
                  <span style={S.tag(entra ? "#00E5A0" : "#FF3B3B")}>{entra ? "✓ Entra" : "✗ Supera límite"}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    ["Cuota estimada", fmtPesos(cuota), entra?"#00E5A0":"#FF6B2B"],
                    ["Cuota máx. (30%)", fmtPesos(cuotaMax), "#3A4A60"],
                    ["Monto aprobado", fmtPesos(Math.min(montoFinal, zona.montoMax)), "#FFB800"],
                    ["TNA aplicada", `${(tna*100).toFixed(0)}%`, "#3A4A60"],
                  ].map(([k,v,c])=>(
                    <div key={k} style={{ background:"#131C28", borderRadius:8, padding:"8px 10px" }}>
                      <div style={{ fontSize:10, color:"#3A4A60", marginBottom:2 }}>{k}</div>
                      <div style={{ fontSize:13, color:c, fontWeight:700, fontFamily:"monospace" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Regla del 30% */}
      <div style={{ background:"#1A0D2A", border:"1px solid #A855F733", borderRadius:12, padding:14 }}>
        <div style={{ fontSize:11, color:"#A855F7", fontFamily:"monospace", letterSpacing:2, marginBottom:8 }}>REGLA DE CAPACIDAD DE PAGO</div>
        <div style={{ fontSize:12, color:"#5A7090", lineHeight:1.6 }}>
          La cuota mensual <span style={{ color:"#A855F7" }}>nunca puede superar el 30% del sueldo neto acreditado</span>, independientemente del score. Si el monto solicitado genera una cuota mayor, se reduce el monto o se extiende el plazo.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA 3: ZONAS DE RIESGO
// ══════════════════════════════════════════════════════════════════════════════
function PantallaZonas() {
  const zonaDescs = [
    "Sin revisión manual. Acceso al monto máximo y todos los plazos. Auto-aprobado por el sistema.",
    "Aprobado con condiciones estándar. Monto hasta el 80% del máximo. Plazos completos.",
    "Requiere revisión manual del analista. Monto reducido al 60%. Máximo 9 cuotas. TNA +5%.",
    "Solo monto mínimo. Requiere garante o débito automático. Máximo 6 cuotas. TNA +10%.",
    "Rechazo. No aplica ningún producto. Puede reingresar en 6 meses con mejoras documentadas.",
  ];

  return (
    <div style={{ padding:12 }}>
      <div style={{ fontSize:11, color:"#3A4A60", fontFamily:"monospace", letterSpacing:3, marginBottom:12 }}>ZONAS DE RIESGO Y PRODUCTOS</div>

      {ZONAS.map((z, i) => (
        <div key={z.tag} style={{ background:"#101828", border:`1px solid ${z.color}33`, borderRadius:12, marginBottom:12, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", background:`${z.color}10`, borderBottom:`1px solid ${z.color}22` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:10, color:z.color, fontFamily:"monospace", letterSpacing:3, marginBottom:4 }}>ZONA {z.tag}</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#D8E0EC" }}>{z.titulo}</div>
                <div style={{ fontSize:12, color:z.color, fontFamily:"monospace", marginTop:4 }}>{z.decision}</div>
              </div>
              <div style={{ background:`${z.color}20`, border:`1px solid ${z.color}44`, borderRadius:10, padding:"6px 14px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:z.color, fontFamily:"monospace" }}>SCORE</div>
                <div style={{ fontSize:20, fontWeight:700, color:z.color, fontFamily:"monospace" }}>{z.min}–{z.max}</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:"#5A7090", marginTop:8, lineHeight:1.5 }}>{zonaDescs[i]}</div>
          </div>

          {z.montoMax > 0 && (
            <div style={{ padding:"12px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                ["Monto mínimo", fmtPesos(z.montoMax * 0.3)],
                ["Monto máximo", fmtPesos(z.montoMax)],
                ["Plazos", z.plazos.join(" / ") + " cuotas"],
                ["Ajuste TNA", z.tasaAjuste > 0 ? `+${(z.tasaAjuste*100).toFixed(0)}%` : "Sin ajuste"],
              ].map(([k,v])=>(
                <div key={k} style={{ background:"#131C28", borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontSize:10, color:"#3A4A60", marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, color:z.color, fontWeight:700 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
          {z.montoMax === 0 && (
            <div style={{ padding:"12px 16px", fontSize:13, color:"#FF3B3B" }}>
              Sin productos disponibles para este perfil.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA 4: CHECKLIST OPERATIVO
// ══════════════════════════════════════════════════════════════════════════════
const PASOS = [
  { n:"01", color:"#00C2FF", titulo:"Primer Contacto", subtitulo:"WhatsApp / Landing page", items:[
    "Solicitar nombre completo, DNI, domicilio, teléfono alternativo.",
    "Preguntar monto deseado, plazo (3/6/9/12 cuotas) y motivo.",
    "Confirmar que trabaja en relación de dependencia con recibo.",
    "Enviar lista de documentos por WhatsApp (plantilla).",
    "Registrar lead en CRM con fecha, canal y ejecutivo asignado.",
  ]},
  { n:"02", color:"#00E5A0", titulo:"Recepción de Documentos", subtitulo:"Verificar antes de avanzar", items:[
    "DNI frente — foto clara, sin flash ni cortes. [OBLIGATORIO]",
    "DNI dorso — ídem. [OBLIGATORIO]",
    "Selfie sosteniendo DNI abierto. [MUY RECOMENDADO]",
    "Servicio a nombre del titular, últimos 90 días. [OBLIGATORIO]",
    "Recibo de sueldo últimos 2 meses. [OBLIGATORIO]",
    "Referencia 1: nombre, teléfono, relación. [OBLIGATORIO]",
    "Referencia 2: nombre, teléfono, relación diferente. [OBLIGATORIO]",
    "CBU/CVU para acreditación del crédito.",
  ]},
  { n:"03", color:"#FFB800", titulo:"Verificación Documental", subtitulo:"Tarea del analista", items:[
    "Nombre del DNI coincide con el servicio y con el declarado.",
    "DNI vigente, no adulterado ni vencido.",
    "Factura con fecha dentro de los últimos 90 días.",
    "Extraer del recibo: sueldo neto, empleador, antigüedad, CUIL.",
    "Calcular cuota estimada y verificar regla del 30%.",
    "Verificar que el DNI no tenga crédito activo en el sistema.",
    "Llamar a al menos 1 referencia para verificar al solicitante.",
  ]},
  { n:"04", color:"#A855F7", titulo:"Consulta Equifax / Veraz", subtitulo:"Obligatoria antes de decidir", items:[
    "Ingresar DNI y CUIL en Equifax DecisionPoint Argentina.",
    "Registrar Score Veraz (0–999) y Situación BCRA (1 al 5).",
    "BCRA 4 o 5 → RECHAZO AUTOMÁTICO. Notificar al cliente. FIN.",
    "BCRA 3 → Escalar a analista senior. Solo microcrédito mínimo.",
    "BCRA 1 o 2 → Continuar con scoring interno.",
    "Guardar PDF del informe en carpeta del cliente en Drive.",
    "Registrar fecha de consulta (no repetir por 6 meses).",
  ]},
  { n:"05", color:"#FF9500", titulo:"Scoring y Decisión", subtitulo:"Usar pantalla de Scoring", items:[
    "Completar scoring con todos los ítems verificados.",
    "Ingresar datos en la calculadora de capacidad de pago.",
    "Score 80–100: Auto-aprobado → Avanzar a contrato.",
    "Score 65–79: Aprobado → Confirmar monto y plazo.",
    "Score 50–64: Revisión manual → Elevar al área de crédito.",
    "Score 30–49: Condicionado → Informar condiciones especiales.",
    "Score 0–29: Rechazado → Notificación con motivo genérico.",
    "Registrar decisión con score, analista, fecha y justificación.",
  ]},
  { n:"06", color:"#FF4444", titulo:"Notificación y Cierre", subtitulo:"Último paso del proceso", items:[
    "Aprobado: enviar por WA monto, cuota, cuotas y 1° vencimiento.",
    "Con condiciones: detallar las condiciones específicas.",
    "Rechazado: mensaje empático, motivo genérico, reinicio en 6 meses.",
    "Registrar notificación en CRM con fecha y hora.",
    "Si aprobado: enviar link de contrato digital (DocuSign/FirmaDoc).",
    "Contrato firmado → Alta en cartera → Desembolso.",
  ]},
];

function PantallaChecklist() {
  const [checks, setChecks] = useState({});
  const [pasoAbierto, setPasoAbierto] = useState("01");

  const toggleCheck = (key) => setChecks(p => ({ ...p, [key]: !p[key] }));

  const progreso = (paso) => {
    const items = PASOS.find(p=>p.n===paso)?.items || [];
    const hechos = items.filter((_,i) => checks[`${paso}_${i}`]).length;
    return { hechos, total: items.length };
  };

  return (
    <div style={{ padding:12 }}>
      <div style={{ fontSize:11, color:"#3A4A60", fontFamily:"monospace", letterSpacing:3, marginBottom:12 }}>CHECKLIST OPERATIVO</div>

      {PASOS.map((paso) => {
        const abierto = pasoAbierto === paso.n;
        const { hechos, total } = progreso(paso.n);
        const pct = Math.round((hechos/total)*100);
        return (
          <div key={paso.n} style={{ background:"#101828", border:`1px solid ${paso.color}33`, borderRadius:12, marginBottom:12, overflow:"hidden" }}>
            <div onClick={() => setPasoAbierto(abierto ? null : paso.n)}
              style={{ padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ background:paso.color, color:"#000", fontFamily:"monospace", fontSize:12, fontWeight:700, padding:"6px 10px", borderRadius:8, flexShrink:0 }}>
                {paso.n}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#D8E0EC" }}>{paso.titulo}</div>
                <div style={{ fontSize:11, color:"#3A4A60" }}>{paso.subtitulo}</div>
                {/* Barra de progreso */}
                <div style={{ background:"#131C28", borderRadius:999, height:4, marginTop:6, overflow:"hidden" }}>
                  <div style={{ background:paso.color, width:`${pct}%`, height:"100%", borderRadius:999, transition:"width .3s" }} />
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:12, color:paso.color, fontFamily:"monospace" }}>{hechos}/{total}</div>
                <div style={{ fontSize:9, color:"#3A4A60" }}>{abierto?"▲":"▼"}</div>
              </div>
            </div>

            {abierto && (
              <div style={{ borderTop:`1px solid ${paso.color}22` }}>
                {paso.items.map((item, i) => {
                  const key = `${paso.n}_${i}`;
                  const done = !!checks[key];
                  return (
                    <div key={i} onClick={() => toggleCheck(key)}
                      style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px", borderBottom:"1px solid #131C28", cursor:"pointer", background: done ? "#0D1A10" : "transparent" }}>
                      <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${done?paso.color:"#253040"}`, background:done?paso.color:"transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}>
                        {done && <span style={{ fontSize:12, color:"#000", fontWeight:900 }}>✓</span>}
                      </div>
                      <div style={{ fontSize:13, color:done?"#D8E0EC":"#5A7090", lineHeight:1.4, textDecoration:done?"line-through":"none" }}>
                        {item}
                      </div>
                    </div>
                  );
                })}
                {hechos === total && (
                  <div style={{ padding:"12px 16px", background:`${paso.color}15`, textAlign:"center", fontSize:13, color:paso.color, fontWeight:700 }}>
                    ✓ Paso completado
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => setChecks({})} style={{ ...S.btn("#3A4A60"), background:"#131C28", color:"#3A4A60", marginBottom:16 }}>
        REINICIAR CHECKLIST
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL — NAV BAR
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"scoring",      label:"Scoring",      icon:"⭐" },
  { id:"calculadora",  label:"Pago",         icon:"💰" },
  { id:"zonas",        label:"Zonas",        icon:"🗂️" },
  { id:"checklist",    label:"Checklist",    icon:"✅" },
];

export default function App() {
  const [tab, setTab] = useState("scoring");

  return (
    <div style={S.screen}>
      {tab === "scoring"     && <PantallaScoring />}
      {tab === "calculadora" && <PantallaCalculadora />}
      {tab === "zonas"       && <PantallaZonas />}
      {tab === "checklist"   && <PantallaChecklist />}

      {/* Nav bar fija */}
      <nav style={S.navBar}>
        {TABS.map((t) => (
          <button key={t.id} style={S.navBtn(tab===t.id)} onClick={() => setTab(t.id)}>
            <span style={{ fontSize:22 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
