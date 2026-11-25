import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref, remove, set } from "firebase/database";

/* ============ Firebase ============ */
const firebaseConfig = {
  apiKey: "AIzaSyAtIYiRP1TQwh__FnN31CJePIx13PREjI8",
  authDomain: "poupei-d3141.firebaseapp.com",
  databaseURL: "https://poupei-d3141-default-rtdb.firebaseio.com",
  projectId: "poupei-d3141",
  storageBucket: "poupei-d3141.firebasestorage.app",
  messagingSenderId: "796218678562",
  appId: "1:796218678562:web:9387cb96d9b9e1750fd97b",
};
const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
const BASE = "poupei"; // caminho dos dados no banco

/* ============ Dados e utilitários ============ */
const iso = (d) => d.toISOString().slice(0, 10);
const hoje = () => iso(new Date());
const diasAtras = (n) => iso(new Date(Date.now() - n * 864e5));

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// valor com centavos: 3998 -> "R$ 3.998,00"
const compacto = (v) =>
  `${v < 0 ? "−" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDia = (d) => {
  if (d === hoje()) return "Hoje";
  if (d === diasAtras(1)) return "Ontem";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
};

/* ============ Cache local (mostra os dados na hora e sincroniza em seguida) ============ */
const lerCache = (k, padrao) => {
  try {
    const v = localStorage.getItem("poupei:" + k);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
};
const gravarCache = (k, v) => {
  try {
    localStorage.setItem("poupei:" + k, JSON.stringify(v));
  } catch {}
};

/* ============ App ============ */
export default function App() {
  const [itens, setItens] = useState(() => lerCache("itens", []));
  const [nome, setNome] = useState(() => lerCache("nome", "Jakson"));
  const [aba, setAba] = useState("home");
  const [sheet, setSheet] = useState(null);

  // Escuta o banco em tempo real
  useEffect(() => {
    const base = BASE;
    const offItens = onValue(ref(db, `${base}/itens`), (snap) => {
      const v = snap.val();
      const lista = v ? Object.values(v) : [];
      setItens(lista);
      gravarCache("itens", lista);
    });
    const offNome = onValue(ref(db, `${base}/nome`), (snap) => {
      if (snap.val()) {
        setNome(snap.val());
        gravarCache("nome", snap.val());
      }
    });
    return () => {
      offItens();
      offNome();
    };
  }, []);

  const mudarNome = (n) => {
    setNome(n);
    gravarCache("nome", n);
    set(ref(db, `${BASE}/nome`), n);
  };

  const t = useMemo(() => {
    const corte = diasAtras(30);
    const r = itens.filter((i) => i.data >= corte);
    const rec = r.filter((i) => i.tipo === "receita").reduce((s, i) => s + i.valor, 0);
    const des = r.filter((i) => i.tipo === "despesa").reduce((s, i) => s + i.valor, 0);
    return { rec, des, liq: rec - des };
  }, [itens]);

  const salvar = (it) => {
    set(ref(db, `${BASE}/itens/${it.id}`), it);
    setSheet(null);
  };
  const remover = (id) => {
    remove(ref(db, `${BASE}/itens/${id}`));
    setSheet(null);
  };
  const editar = (item) => setSheet({ item, tipo: item.tipo });

  return (
    <div className="app">
      <style>{CSS}</style>

      <main className="scroll fit" key={aba}>
        {aba === "home" && (
          <Home itens={itens} t={t} nome={nome} setNome={mudarNome} />
        )}
        {aba !== "home" && <Lista tipo={aba} itens={itens} t={t} editar={editar} voltar={() => setAba("home")} />}
      </main>

      <nav className="dock">
        <button
          className={"dk " + (aba === "receita" ? "on" : "")}
          onClick={() => setAba(aba === "receita" ? "home" : "receita")}
          aria-label="Receitas"
        >
          <IUp />
        </button>
        <button
          className="dk add"
          aria-label="Novo lançamento"
          onClick={() => setSheet({ tipo: aba === "despesa" ? "despesa" : "receita" })}
        >
          <IPlus />
        </button>
        <button
          className={"dk " + (aba === "despesa" ? "on" : "")}
          onClick={() => setAba(aba === "despesa" ? "home" : "despesa")}
          aria-label="Despesas"
        >
          <IDown />
        </button>
      </nav>

      {sheet && (
        <Sheet
          key={sheet.item?.id || "novo"}
          inicial={sheet.item}
          tipoInicial={sheet.tipo}
          onSalvar={salvar}
          onRemover={remover}
          onFechar={() => setSheet(null)}
        />
      )}
    </div>
  );
}

/* ============ Início ============ */
function Home({ t, nome, setNome }) {
  const h = new Date().getHours();
  const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const frase =
    t.rec === 0 && t.des === 0
      ? "Bora registrar o primeiro lançamento?"
      : t.liq >= 0
      ? "Tá sobrando grana, continue assim."
      : "Gastou mais do que ganhou, bora segurar a mão.";

  const gasto = t.rec > 0 ? Math.round((t.des / t.rec) * 100) : null;
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <>
      <header className="greet">
        <h1>
          <button className="nm" onClick={() => {
            const n = window.prompt("Como devemos te chamar?", nome);
            if (n && n.trim()) setNome(n.trim());
          }}>
            {saud}, {nome}.
          </button>
          <span>{frase}</span>
        </h1>
      </header>

      <section className="panel tall">
        <div className="ttl">Total líquido</div>
        <Num v={t.liq} base={52} />

        <div className="split">
          <div>
            <span className="lbl"><i className="d g" /> Receitas</span>
            <b><Anim txt={compacto(t.rec)} /></b>
          </div>
          <div>
            <span className="lbl"><i className="d o" /> Despesas</span>
            <b><Anim txt={compacto(t.des)} /></b>
          </div>
        </div>

        <div className="ratio">
          <div style={{ width: !montado ? "0%" : t.rec + t.des === 0 ? "50%" : `${(t.rec / (t.rec + t.des)) * 100}%` }} />
        </div>

        <p className="note">
          {gasto !== null && <>Você {gasto <= 100 ? <>poupou {100 - gasto}% e gastou</> : <>gastou</>} {gasto}% do que recebeu nos últimos 30 dias. </>}
        </p>
      </section>
    </>
  );
}

/* Número grande: tudo no mesmo tamanho e cor; reduz a fonte se ficar longo */
/* Texto de valor com animação por caractere (só reanima o que mudou) */
function Anim({ txt }) {
  const n = txt.length;
  return (
    <span aria-label={txt} role="text">
      {[...txt].map((c, i) => (
        <span key={`${n - i}-${c}`} className="ch" style={{ "--k": i }} aria-hidden="true">
          {c}
        </span>
      ))}
    </span>
  );
}

function Num({ v, base }) {
  const txt = compacto(v);
  const size = Math.round(base * Math.min(1, 11 / Math.max(txt.length, 11)));
  return (
    <div className="big" style={{ fontSize: size }}>
      <Anim txt={txt} />
    </div>
  );
}

/* ============ Receitas / Despesas ============ */
function Lista({ tipo, itens, t, editar, voltar }) {
  const rec = tipo === "receita";
  const total = rec ? t.rec : t.des;
  const lista = itens.filter((i) => i.tipo === tipo).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  return (
    <>
      <header className="greet">
        <button className="back" onClick={voltar}>
          <IBack /> Início
        </button>
        <h1>
          {rec ? "Suas receitas." : "Suas despesas."}
          <span>
            {rec ? "Tudo o que entrou" : "Tudo o que saiu"} nos últimos 30 dias.
          </span>
        </h1>
      </header>

      <section className="panel">
        <div className="ttl">{rec ? "Total de receitas" : "Total de despesas"} · 30 dias</div>
        <Num v={total} base={52} />
      </section>

      <div className="lista">
        {lista.length === 0 ? (
          <p className="vazio">Nada por aqui ainda. Toque em + para adicionar {rec ? "uma receita" : "uma despesa"}.</p>
        ) : (
          <div className="dia">
            {lista.map((i, n) => (
              <button key={i.id} className="row" style={{ "--i": Math.min(n, 10) }} onClick={() => editar(i)}>
                <span className="rt">{i.desc}</span>
                <span className="rv"><Anim txt={`${rec ? "+" : "−"} ${brl(i.valor)}`} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ============ Campo de valor com formatação ao digitar ============ */
// Os dígitos preenchem da direita para a esquerda: 1 → 0,01 · 15 → 0,15 · 1500 → 15,00 · 150000 → 1.500,00
const fmtCents = (c) =>
  (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ValorInput({ cents, neg = false, onChange, autoFocus }) {
  const txt = (neg && cents > 0 ? "−" : "") + fmtCents(cents);
  return (
    <div className="amt">
      <span>R$</span>
      <input
        className={cents ? "has" : ""}
        inputMode="numeric"
        aria-label="Valor"
        value={txt}
        style={{ width: `${txt.length}ch` }}
        autoFocus={autoFocus}
        onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, "").slice(0, 11) || "0", 10))}
      />
    </div>
  );
}

/* ============ Sheet ============ */
function Sheet({ inicial, tipoInicial, onSalvar, onRemover, onFechar }) {
  const [tipo, setTipo] = useState(inicial?.tipo || tipoInicial);
  const [cents, setCents] = useState(inicial ? Math.round(inicial.valor * 100) : 0);
  const [desc, setDesc] = useState(inicial?.desc || "");
  const [saindo, setSaindo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const ok = cents > 0 && desc.trim().length > 0;

  const fechar = () => {
    setSaindo(true);
    setTimeout(onFechar, 220);
  };
  const salvar = () =>
    onSalvar({ id: inicial?.id || Date.now(), tipo, valor: cents / 100, desc: desc.trim(), data: inicial?.data || hoje() });

  return (
    <div className={"ov " + (saindo ? "out" : "")} onClick={fechar}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <button onClick={fechar}>Cancelar</button>
          <span>{inicial ? "Editar" : "Novo lançamento"}</span>
          <i />
        </div>

        <div className="seg">
          <div className="thumb" style={{ transform: tipo === "receita" ? "none" : "translateX(100%)" }} />
          <button className={tipo === "receita" ? "on" : ""} onClick={() => setTipo("receita")}>Receita</button>
          <button className={tipo === "despesa" ? "on" : ""} onClick={() => setTipo("despesa")}>Despesa</button>
        </div>

        <ValorInput cents={cents} onChange={setCents} autoFocus={!inicial} />

        <div className="rows">
          <label className="rw">
            <span>Descrição</span>
            <input placeholder="Ex.: Mercado" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
        </div>

        <button className="cta" disabled={!ok} onClick={salvar}>
          {inicial ? "Salvar alterações" : tipo === "receita" ? "Adicionar receita" : "Adicionar despesa"}
        </button>
        {inicial && <button className="del" onClick={() => setConfirmando(true)}>Excluir lançamento</button>}
      </div>

      {confirmando && (
        <div className="cf" onClick={(e) => { e.stopPropagation(); setConfirmando(false); }}>
          <div className="cfb" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Excluir lançamento?</h3>
            <p>Essa ação não pode ser desfeita.</p>
            <button className="cfd" onClick={() => onRemover(inicial.id)}>Excluir</button>
            <button className="cfc" onClick={() => setConfirmando(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Ícones (traço fino) ============ */
const Svg = ({ children, s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const IHome = () => <Svg><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></Svg>;
const IUp = () => <Svg><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></Svg>;
const IDown = () => <Svg><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></Svg>;
const IBack = () => <Svg s={22}><path d="M14.5 6 8.5 12l6 6" /></Svg>;
const IPlus = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;

/* ============ Estilos ============ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600&display=swap');
:root{--bg:#EDEDEA;--ink:#25262A;--mute:#9C9C90;--line:#D6D6D1;--dock:#26282C;--acc:#E8601C}
*{box-sizing:border-box;margin:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;background:var(--bg)}
body{font-family:"Inter Tight",-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left}
input{font:inherit;color:inherit;border:0;outline:0;background:none}
.app{position:relative;max-width:440px;height:100dvh;margin:0 auto;background:radial-gradient(130% 65% at 100% 0%,rgba(232,96,28,.13) 0%,rgba(232,96,28,0) 62%),linear-gradient(180deg,#F8F8F5 0%,#EDEDEA 45%,#D9D9D3 100%);overflow:hidden}
.scroll{height:100%;overflow-y:auto;padding:calc(env(safe-area-inset-top,0px) + 20px) 16px 104px;animation:fade .3s ease;scrollbar-width:none}
.scroll::-webkit-scrollbar{display:none}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.scroll>.greet{animation:rise .55s cubic-bezier(.2,.8,.2,1) backwards}
.scroll>.panel{animation:rise .6s cubic-bezier(.2,.8,.2,1) .07s backwards}
.scroll>.lista{animation:rise .6s cubic-bezier(.2,.8,.2,1) .14s backwards}
.row{animation:rise .5s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i,0)*40ms + .18s)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;transition-duration:.01ms!important}}

.greet{position:relative;padding:0 0 32px}
.greet h1{font-size:26px;font-weight:400;line-height:1.18;letter-spacing:-.6px;color:var(--ink)}
.greet h1 span{display:block;color:var(--mute)}
.back{display:inline-flex;align-items:center;gap:2px;margin:-7px 0 18px;padding:7px 14px 7px 0;background:none;box-shadow:none;font-size:18px;color:var(--acc);transition:opacity .15s}
.back:active{opacity:.55}
.nm{display:block;padding:0;font:inherit;letter-spacing:inherit;color:var(--ink)}


.panel{position:relative;background:none;border-radius:0;padding:0 0 8px;box-shadow:none}
.panel.tall{display:flex;flex-direction:column;justify-content:center}
.scroll.fit{overflow:hidden;display:flex;flex-direction:column;padding-top:calc(env(safe-area-inset-top,0px) + 20px);padding-bottom:0}
.scroll.fit .greet{flex:none;padding:0 0 32px}
.scroll.fit .panel{flex:none}
.scroll.fit .panel.tall{flex:1;min-height:0;overflow:hidden;margin-bottom:86px}
.big{text-indent:-.05em;font-size:76px;font-weight:300;letter-spacing:-3.5px;line-height:1;margin-top:4px;font-variant-numeric:tabular-nums}
.big{white-space:pre}
.ch{display:inline-block;white-space:pre;animation:chIn .9s cubic-bezier(.16,1,.3,1) backwards;animation-delay:calc(var(--k,0)*40ms)}
@keyframes chIn{from{opacity:0;transform:translateY(.3em);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}
.cap{font-size:14px;color:var(--mute);margin-top:8px}
.ttl{font-size:14px;color:var(--mute)}

.split{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:0;padding-top:92px}
.split>div{display:flex;flex-direction:column;gap:4px}
.split b{font-size:23px;font-weight:300;letter-spacing:-1px}
.lbl{font-size:13px;color:var(--mute);display:flex;align-items:center;gap:6px}
.d{width:7px;height:7px;border-radius:50%;display:inline-block}
.d.g{background:#25262A}.d.o{background:var(--acc)}
.ratio{height:3px;background:var(--acc);border-radius:9px;margin:16px 0 18px;overflow:hidden}
.ratio>div{height:100%;background:var(--ink);transition:width .9s cubic-bezier(.2,.8,.2,1) .15s}
.note{font-size:12.5px;line-height:1.4;color:#8A8A80;letter-spacing:-.1px}


.lista{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px 100px}
.lista::-webkit-scrollbar{display:none}
.dia{margin-top:12px}
.dia h2{font-size:13px;font-weight:400;color:var(--mute);margin:0 20px 4px;text-transform:capitalize}
.row{display:flex;align-items:center;gap:13px;width:100%;padding:20px 0;border-bottom:.5px solid #ababa7;transition:opacity .15s}
.row:active{opacity:.55}
.rt{flex:1;min-width:0;font-size:16px;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv{font-size:16px;letter-spacing:-.3px;font-variant-numeric:tabular-nums;white-space:nowrap}
.vazio{text-align:center;color:var(--mute);font-size:15px;padding:44px 28px;line-height:1.4}

.dock{position:absolute;left:0;right:0;width:max-content;margin:0 auto;bottom:10px;display:flex;gap:4px;padding:8px;background:rgba(38,40,44,.88);-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);border-radius:22px;box-shadow:0 10px 30px rgba(0,0,0,.22);z-index:5}
@keyframes dockUp{from{transform:translateY(160%);opacity:0}to{transform:none;opacity:1}}
@keyframes dockPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
.dock{animation:dockUp .55s cubic-bezier(.22,1.25,.36,1) .2s backwards}
.dock .dk{animation:dockPop .4s cubic-bezier(.22,1.4,.36,1) backwards}
.dock .dk:nth-child(1){animation-delay:.42s}
.dock .dk:nth-child(2){animation-delay:.48s}
.dock .dk:nth-child(3){animation-delay:.54s}
@media (hover:hover){.dk:hover{transform:translateY(-3px) scale(1.1)}.dk:active{transform:scale(.92)}}
.dk{flex:none;width:64px;height:44px;display:grid;place-items:center;color:#9FA1A6;border-radius:15px;transition:background .25s ease,color .25s ease,transform .2s cubic-bezier(.3,.9,.3,1)}
.dk.on{color:#fff;background:rgba(255,255,255,.1)}
.dk:active{transform:scale(.92)}
.dk.add{color:#fff;background:var(--acc)}

.ov{position:absolute;inset:0;background:rgba(30,30,28,.32);z-index:20;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:fade .2s}
.ov.out{opacity:0;transition:opacity .22s}
.sheet{width:100%;max-height:100%;overflow-y:auto;background:linear-gradient(180deg,#F8F8F5 0%,#E9E9E5 100%);border-radius:28px;padding:22px 18px 20px;box-shadow:0 20px 50px rgba(0,0,0,.25);animation:pop .26s cubic-bezier(.2,.9,.25,1)}
.ov.out .sheet{transform:scale(.95);opacity:0;transition:transform .22s ease-in,opacity .22s}
.seg{position:relative;display:grid;grid-template-columns:1fr 1fr;background:#E0E0DC;border-radius:14px;padding:3px}
.thumb{position:absolute;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);background:var(--ink);border-radius:11px;transition:transform .28s cubic-bezier(.3,.9,.3,1)}
.seg button{position:relative;text-align:center;padding:9px;font-size:14px;color:#6D6D66;transition:color .2s}
.seg button.on{color:#fff}
.top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:18px;font-size:15px}
.top button{color:var(--acc);justify-self:start}
.top span{color:var(--mute)}
.amt{display:flex;justify-content:center;align-items:baseline;gap:8px;padding:28px 0 22px}
.amt span{font-size:18px;font-weight:300;color:var(--mute)}
.amt input{font-size:46px;font-weight:300;letter-spacing:-1.5px;text-align:center;color:#C3C3BC;font-variant-numeric:tabular-nums;max-width:75%;caret-color:var(--acc)}
.amt input.has{color:var(--ink)}
.rows{border-top:.5px solid var(--line)}
.rw{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 4px;border-bottom:.5px solid var(--line);font-size:16px;letter-spacing:-.2px}
.rw>span{color:var(--mute)}
.rw input{flex:1;min-width:0;text-align:right;color:var(--ink)}
.rw input::placeholder{color:#B9B9B2}
.cta{display:block;width:100%;margin-top:26px;padding:16px;border-radius:20px;background:var(--dock);color:#fff;text-align:center;font-size:16px;letter-spacing:-.2px;transition:opacity .2s,transform .15s}
.cta:active{transform:scale(.985)}
.cta:disabled{background:#DCDCD7;color:#A5A59D;cursor:default}
.cf{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(30,30,28,.38);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:fade .2s}
.cfb{width:min(300px,calc(100% - 48px));background:linear-gradient(180deg,#F8F8F5 0%,#E9E9E5 100%);border-radius:24px;padding:24px 0 0;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;animation:pop .22s cubic-bezier(.2,.9,.25,1)}
.cfb h3{font-size:18px;font-weight:500;letter-spacing:-.4px;padding:0 20px}
.cfb p{font-size:14px;color:var(--mute);margin:6px 0 22px;padding:0 20px}
.cfb button{display:block;width:100%;padding:15px;text-align:center;font-size:16px;letter-spacing:-.2px;border-top:.5px solid var(--line);transition:opacity .15s}
.cfb button:active{opacity:.55}
.cfd{color:#B8503E;font-weight:500}
.cfc{color:var(--ink)}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
.del{display:block;width:100%;margin-top:6px;padding:14px;text-align:center;color:#B8503E;font-size:15px}
`;