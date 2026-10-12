 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronDown,
  CircleHelp, ClipboardList, Download, LayoutDashboard, LogOut, Menu, Plus,
  Search, Settings, ShieldCheck, Target, TrendingUp, Wallet, X
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { supabase } from "@/lib/supabase";

type Trade = {
  id: string; user_id: string; trade_date: string; symbol: string;
  direction: "Long" | "Short"; pnl: number; mistakes: string | null;
  notes: string | null; created_at: string;
};
type Profile = { user_id: string; starting_balance: number; currency: string };
type Page = "Overview" | "Trade Journal" | "Analytics" | "Calendar" | "Settings";

const nav: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Trade Journal", icon: ClipboardList },
  { label: "Analytics", icon: BarChart3 },
  { label: "Calendar", icon: CalendarDays },
  { label: "Settings", icon: Settings },
];
const usd = (n: number) => `${n < 0 ? "-$" : "$"}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [page, setPage] = useState<Page>("Overview");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [startBalance, setStartBalance] = useState("1000");
  const [tradeForm, setTradeForm] = useState({ trade_date: new Date().toISOString().slice(0,10), symbol: "XAUUSDT", direction: "Long", pnl: "", mistakes: "", notes: "" });

  const loadData = useCallback(async (userId: string) => {
    if (!supabase) { setError("Supabase config is missing. Check .env.local."); setLoading(false); return; }
    const [tradesRes, profileRes] = await Promise.all([
      supabase.from("journal_trades").select("*").eq("user_id", userId).order("trade_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("journal_profiles").select("*").eq("user_id", userId).maybeSingle()
    ]);
    if (tradesRes.error) setError(tradesRes.error.message);
    else setTrades((tradesRes.data || []) as Trade[]);
    if (profileRes.error) setError(profileRes.error.message);
    else {
      const p = profileRes.data as Profile | null;
      setProfile(p);
      setStartBalance(String(p?.starting_balance ?? 1000));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    async function init() {
      if (!supabase) { setError("Supabase configuration is missing."); setLoading(false); return; }
      const { data, error: e } = await supabase.auth.getSession();
      if (!alive) return;
      if (e) setError(e.message);
      setSession(data.session);
      if (data.session?.user) await loadData(data.session.user.id);
      else setLoading(false);
      supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        if (next?.user) { setLoading(true); void loadData(next.user.id); }
        else { setTrades([]); setProfile(null); setLoading(false); }
      });
    }
    void init();
    return () => { alive = false; };
  }, [loadData]);

  const stats = useMemo(() => {
    const total = trades.reduce((s,t) => s + Number(t.pnl), 0);
    const wins = trades.filter(t => Number(t.pnl) > 0);
    const losses = trades.filter(t => Number(t.pnl) < 0);
    const grossWin = wins.reduce((s,t) => s + Number(t.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((s,t) => s + Number(t.pnl), 0));
    const winRate = trades.length ? wins.length / trades.length * 100 : 0;
    const pf = grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0;
    const balance = Number(profile?.starting_balance || 0) + total;
    return { total, count: trades.length, wins: wins.length, losses: losses.length, winRate, pf, balance, grossWin, grossLoss };
  }, [trades, profile]);

  const chartData = useMemo(() => {
    const asc = [...trades].sort((a,b) => a.trade_date.localeCompare(b.trade_date) || a.created_at.localeCompare(b.created_at));
    let running = Number(profile?.starting_balance || 0);
    const daily = new Map<string, number>();
    asc.forEach(t => { running += Number(t.pnl); daily.set(t.trade_date, running); });
    return Array.from(daily.entries()).map(([date, balance]) => ({ date: dayLabel(date), balance: Number(balance.toFixed(2)) }));
  }, [trades, profile]);

  const filteredTrades = trades.filter(t => `${t.symbol} ${t.direction} ${t.notes || ""} ${t.mistakes || ""}`.toLowerCase().includes(search.toLowerCase()));
  const monthTrades = trades.filter(t => t.trade_date.startsWith(month));
  const monthPnl = monthTrades.reduce((s,t) => s + Number(t.pnl), 0);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); if (!supabase) return setError("Supabase config is missing.");
    setBusy(true); setError("");
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (authMode === "signup" && !result.data.session) setError("Account created. Check your email to confirm, then log in.");
  }
  async function addTrade(e: React.FormEvent) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    const pnl = Number(tradeForm.pnl);
    if (!Number.isFinite(pnl) || tradeForm.pnl.trim() === "") return setError("Enter the final P&L amount (use a minus sign for a loss).");
    setBusy(true); setError("");
    const { error: e2 } = await supabase.from("journal_trades").insert({
      user_id: session.user.id, trade_date: tradeForm.trade_date,
      symbol: tradeForm.symbol.trim().toUpperCase() || "XAUUSDT",
      direction: tradeForm.direction, pnl, mistakes: tradeForm.mistakes || null, notes: tradeForm.notes || null
    });
    setBusy(false);
    if (e2) setError(e2.message);
    else { setShowTrade(false); setTradeForm({ trade_date: new Date().toISOString().slice(0,10), symbol: "XAUUSDT", direction: "Long", pnl: "", mistakes: "", notes: "" }); await loadData(session.user.id); }
  }
  async function deleteTrade(id: string) {
    if (!supabase || !session?.user || !confirm("Delete this trade?")) return;
    const { error: e } = await supabase.from("journal_trades").delete().eq("id", id).eq("user_id", session.user.id);
    if (e) setError(e.message); else await loadData(session.user.id);
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!supabase || !session?.user) return;
    const amount = Number(startBalance);
    if (!Number.isFinite(amount) || amount < 0) return setError("Starting balance must be zero or more.");
    setBusy(true); setError("");
    const { error: e } = await supabase.from("journal_profiles").upsert({ user_id: session.user.id, starting_balance: amount, currency: "USD", updated_at: new Date().toISOString() });
    setBusy(false);
    if (e) setError(e.message); else { setProfile({ user_id: session.user.id, starting_balance: amount, currency: "USD" }); setError("Settings saved."); }
  }
  async function exportCsv() {
    const rows = [["Date","Symbol","Direction","Final P&L (USD)","Mistakes","Notes"], ...trades.map(t => [t.trade_date,t.symbol,t.direction,String(t.pnl),t.mistakes || "",t.notes || ""])];
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "quantiva-trades.csv"; a.click(); URL.revokeObjectURL(url);
  }

  if (!session) return (
    <main className="auth-screen">
      <div className="auth-brand"><div className="brand-mark">Q</div><span>QUANTIVA</span></div>
      <section className="auth-card">
        <div className="eyebrow">YOUR EDGE, MEASURED</div>
        <h1>{authMode === "login" ? "Welcome back." : "Create your account."}</h1>
        <p className="muted">A clear view of your trading decisions and performance.</p>
        <form onSubmit={authenticate} className="form-stack">
          <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete={authMode==="login"?"current-password":"new-password"} /></label>
          {error && <div className="notice">{error}</div>}
          <button className="primary full" disabled={busy}>{busy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="switch-auth">{authMode==="login" ? "New to QUANTIVA?" : "Already have an account?"} <button className="link-btn" onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setError("");}}>{authMode==="login"?"Create account":"Sign in"}</button></p>
        <div className="auth-safe"><ShieldCheck size={15}/> Your trades are private to your account.</div>
      </section>
      <p className="auth-foot">Built for process. Not promises.</p>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row"><div className="brand-mark">Q</div><div><strong>QUANTIVA</strong><small>TRADING JOURNAL</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
        <div className="workspace"><div className="workspace-dot"/><div><b>Personal workspace</b><small>Private journal</small></div><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>{nav.map(item => { const Icon=item.icon; return <button key={item.label} className={`nav-item ${page===item.label?"active":""}`} onClick={()=>{setPage(item.label);setMobileNav(false);}}><Icon size={18}/><span>{item.label}</span>{item.label==="Trade Journal" && <span className="nav-count">{trades.length}</span>}</button>; })}</nav>
        <div className="sidebar-bottom"><div className="help-box"><CircleHelp size={18}/><div><b>Stay consistent</b><small>Review the process, not just P&L.</small></div></div><button className="nav-item logout" onClick={()=>supabase?.auth.signOut()}><LogOut size={18}/><span>Sign out</span></button><div className="user-mini"><div className="avatar">{String(session.user.email || "Q").slice(0,1).toUpperCase()}</div><div className="user-details"><b>{session.user.email}</b><small>QUANTIVA member</small></div><ShieldCheck size={16}/></div></div>
      </aside>
      {mobileNav && <div className="scrim" onClick={()=>setMobileNav(false)}/>}
      <main className="main-area">
        <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="live-dot"/> <span className="top-status">Private workspace</span><div className="top-avatar">{String(session.user.email || "Q").slice(0,1).toUpperCase()}</div></div></header>
        <div className="page-content">
          {error && <div className={`notice ${error==="Settings saved."?"success-notice":""}`}><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
          {page==="Overview" && <>
            <div className="page-heading"><div><div className="eyebrow">PERFORMANCE OVERVIEW</div><h1>Good trading starts with good records.</h1><p>Track the decisions behind every result.</p></div><button className="primary" onClick={()=>setShowTrade(true)}><Plus size={17}/> Add trade</button></div>
            <div className="metric-grid">
              <Metric title="Net P&L" value={usd(stats.total)} sub={`${stats.count} recorded trades`} positive={stats.total>=0} icon={Wallet}/>
              <Metric title="Win rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.wins} wins · ${stats.losses} losses`} icon={Target}/>
              <Metric title="Profit factor" value={stats.pf===Infinity?"∞":stats.pf.toFixed(2)} sub="Gross profit ÷ gross loss" icon={Activity}/>
              <Metric title="Current balance" value={usd(stats.balance)} sub={`Start ${usd(Number(profile?.starting_balance || 0))}`} positive={stats.total>=0} icon={TrendingUp}/>
            </div>
            <div className="content-grid">
              <section className="panel chart-panel"><div className="panel-heading"><div><h2>Equity curve</h2><p>Balance progression from recorded trades</p></div><span className="tag"><span className="tiny-dot"/> All time</span></div>
                {chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70e0b1" stopOpacity={0.22}/><stop offset="100%" stopColor="#70e0b1" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#26313c" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tick={{fill:"#84909e",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#84909e",fontSize:11}} axisLine={false} tickLine={false} width={65} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={{background:"#141c24",border:"1px solid #2a3743",borderRadius:10,color:"#e8eef4"}} formatter={(v:any)=>[usd(Number(v)),"Balance"]}/><Area type="monotone" dataKey="balance" stroke="#70e0b1" strokeWidth={2.5} fill="url(#equityFill)" /></AreaChart></ResponsiveContainer></div> : <Empty icon={Activity} title="Your equity curve starts here" text="Add your first trade to see your balance progression."/>}
              </section>
              <section className="panel summary-panel"><div className="panel-heading"><div><h2>Trade outcomes</h2><p>Your recorded results</p></div></div><div className="outcome-total"><span>Net result</span><strong className={stats.total>=0?"positive-text":"negative-text"}>{usd(stats.total)}</strong></div><div className="bar-line"><div className="bar-label"><span>Winning trades</span><b>{stats.wins}</b></div><div className="progress"><span style={{width:`${stats.count?stats.wins/stats.count*100:0}%`}}/></div></div><div className="bar-line"><div className="bar-label"><span>Losing trades</span><b>{stats.losses}</b></div><div className="progress loss-progress"><span style={{width:`${stats.count?stats.losses/stats.count*100:0}%`}}/></div></div><div className="summary-foot"><div><small>Gross profit</small><b className="positive-text">{usd(stats.grossWin)}</b></div><div><small>Gross loss</small><b className="negative-text">{usd(-stats.grossLoss)}</b></div></div></section>
            </div>
            <section className="panel table-panel"><div className="panel-heading"><div><h2>Recent trades</h2><p>Most recently recorded results</p></div><button className="text-action" onClick={()=>setPage("Trade Journal")}>View journal <ArrowUpRight size={15}/></button></div><TradeTable trades={trades.slice(0,5)} onDelete={deleteTrade}/></section>
          </>}
          {page==="Trade Journal" && <><div className="page-heading"><div><div className="eyebrow">YOUR RECORDS</div><h1>Trade journal</h1><p>Record the final outcome. No lot-size calculations required.</p></div><button className="primary" onClick={()=>setShowTrade(true)}><Plus size={17}/> Add trade</button></div><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search symbol, notes, mistakes…"/></div><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div><section className="panel table-panel"><TradeTable trades={filteredTrades} onDelete={deleteTrade} showNotes/></section></>}
          {page==="Analytics" && <><div className="page-heading"><div><div className="eyebrow">DATA, NOT GUESSES</div><h1>Performance analytics</h1><p>Use your records to identify repeatable patterns.</p></div><button className="secondary" onClick={exportCsv}><Download size={16}/> Export CSV</button></div><div className="metric-grid"><Metric title="Net P&L" value={usd(stats.total)} sub="All recorded trades" positive={stats.total>=0} icon={Wallet}/><Metric title="Average per trade" value={usd(stats.count?stats.total/stats.count:0)} sub="Net P&L ÷ trades" positive={stats.total>=0} icon={BarChart3}/><Metric title="Average win" value={usd(stats.wins?stats.grossWin/stats.wins:0)} sub={`${stats.wins} winning trades`} positive icon={ArrowUpRight}/><Metric title="Average loss" value={usd(stats.losses?-stats.grossLoss/stats.losses:0)} sub={`${stats.losses} losing trades`} icon={ArrowDownRight}/></div><div className="content-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Equity curve</h2><p>Balance by trade date</p></div></div>{chartData.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid stroke="#26313c" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tick={{fill:"#84909e",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#84909e",fontSize:11}} axisLine={false} tickLine={false} width={65} tickFormatter={v=>`$${v}`}/><Tooltip contentStyle={{background:"#141c24",border:"1px solid #2a3743",borderRadius:10}} formatter={(v:any)=>[usd(Number(v)),"Balance"]}/><Area dataKey="balance" type="monotone" stroke="#70e0b1" fill="#70e0b1" fillOpacity={0.12}/></AreaChart></ResponsiveContainer></div>:<Empty icon={BarChart3} title="Not enough data yet" text="Record trades to populate analytics."/>}</section><section className="panel summary-panel"><div className="panel-heading"><div><h2>Direction breakdown</h2><p>Net result by trade direction</p></div></div>{(["Long","Short"] as const).map(d=>{const list=trades.filter(t=>t.direction===d);const pnl=list.reduce((s,t)=>s+Number(t.pnl),0);return <div className="direction-row" key={d}><div className={`direction-icon ${d.toLowerCase()}`}>{d==="Long"?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}</div><div className="direction-info"><b>{d}</b><small>{list.length} trades</small></div><strong className={pnl>=0?"positive-text":"negative-text"}>{usd(pnl)}</strong></div>})}<div className="analytics-note"><ShieldCheck size={17}/><span>Small samples can mislead. Review a meaningful series of trades before changing your strategy.</span></div></section></div></>}
          {page==="Calendar" && <><div className="page-heading"><div><div className="eyebrow">CONSISTENCY OVER TIME</div><h1>Trading calendar</h1><p>See which days contributed to your monthly result.</p></div><input className="month-picker" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div><section className="panel calendar-panel"><div className="calendar-total"><div><small>Monthly net P&L</small><strong className={monthPnl>=0?"positive-text":"negative-text"}>{usd(monthPnl)}</strong></div><div><small>Trades this month</small><strong>{monthTrades.length}</strong></div></div><CalendarGrid month={month} trades={trades}/></section></>}
          {page==="Settings" && <><div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Settings</h1><p>Manage your starting balance and account details.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h2>Account preferences</h2><p>Used to calculate your current balance.</p></div></div><form className="form-stack" onSubmit={saveSettings}><label>Starting balance (USD)<input type="number" min="0" step="0.01" value={startBalance} onChange={e=>setStartBalance(e.target.value)} required/></label><div className="settings-hint"><Wallet size={17}/><span>Current balance = starting balance + all saved final P&L values.</span></div><button className="primary" disabled={busy}>Save settings</button></form></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>Account security</h2><p>Signed in account</p></div></div><div className="account-email"><div className="avatar">{String(session.user.email||"Q").slice(0,1).toUpperCase()}</div><div><b>{session.user.email}</b><small>Email login</small></div></div><div className="settings-hint"><ShieldCheck size={17}/><span>Row-level security is enabled. Your account can only read and change its own trades.</span></div><button className="secondary" onClick={()=>supabase?.auth.signOut()}><LogOut size={16}/> Sign out</button></section></div></>}
          {loading && <div className="loading-overlay"><div className="spinner"/>Loading your journal…</div>}
        </div>
      </main>
      {showTrade && <div className="modal-backdrop" onClick={()=>setShowTrade(false)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><div className="eyebrow">TRADE ENTRY</div><h2>Record final P&L</h2><p>Enter the result shown by your exchange. No lots or prices needed.</p></div><button className="icon-btn" onClick={()=>setShowTrade(false)}><X size={20}/></button></div><form onSubmit={addTrade} className="form-stack"><div className="form-row"><label>Trade date<input type="date" value={tradeForm.trade_date} onChange={e=>setTradeForm({...tradeForm,trade_date:e.target.value})} required/></label><label>Symbol<input value={tradeForm.symbol} onChange={e=>setTradeForm({...tradeForm,symbol:e.target.value})} placeholder="XAUUSDT" required/></label></div><label>Final P&L (USD)<input type="number" step="0.01" value={tradeForm.pnl} onChange={e=>setTradeForm({...tradeForm,pnl:e.target.value})} placeholder="e.g. 12.50 or -8.25" required/><small className="field-help">Profit: 12.50 · Loss: -8.25. Enter your final net result after fees.</small><label>Direction<select value={tradeForm.direction} onChange={e=>setTradeForm({...tradeForm,direction:e.target.value})}><option>Long</option><option>Short</option></select></label><label>Mistake (optional)<input value={tradeForm.mistakes} onChange={e=>setTradeForm({...tradeForm,mistakes:e.target.value})} placeholder="e.g. moved stop loss"/></label><label>Notes (optional)<textarea rows={3} value={tradeForm.notes} onChange={e=>setTradeForm({...tradeForm,notes:e.target.value})} placeholder="Setup, emotions, lesson learned…"/></label>{error && <div className="notice">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowTrade(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving…":"Save trade"}</button></div></form></section></div>}
    </div>
  );
}

function Metric({title,value,sub,positive,icon:Icon}: {title:string;value:string;sub:string;positive?:boolean;icon:typeof Wallet}) {
  return <section className="metric-card"><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={17}/></div></div><strong className={positive===undefined?"":positive?"positive-text":"negative-text"}>{value}</strong><small>{sub}</small></section>;
}
function Empty({icon:Icon,title,text}:{icon:typeof Activity;title:string;text:string}) { return <div className="empty-state"><div className="empty-icon"><Icon size={22}/></div><b>{title}</b><p>{text}</p></div>; }
function TradeTable({trades,onDelete,showNotes=false}:{trades:Trade[];onDelete:(id:string)=>void;showNotes?:boolean}) {
  if(!trades.length) return <Empty icon={ClipboardList} title="No trades recorded yet" text="Add your first trade using only the final P&L amount."/>;
  return <div className="table-scroll"><table><thead><tr><th>Date</th><th>Symbol</th><th>Direction</th><th>Final P&L</th>{showNotes&&<th>Notes / mistakes</th>}<th></th></tr></thead><tbody>{trades.map(t=><tr key={t.id}><td>{dayLabel(t.trade_date)}</td><td><span className="symbol-pill">{t.symbol}</span></td><td><span className={`direction-pill ${t.direction.toLowerCase()}`}>{t.direction}</span></td><td className={`pnl-cell ${Number(t.pnl)>=0?"positive-text":"negative-text"}`}>{usd(Number(t.pnl))}</td>{showNotes&&<td className="notes-cell">{[t.mistakes,t.notes].filter(Boolean).join(" · ") || "—"}</td>}<td><button className="delete-btn" onClick={()=>onDelete(t.id)} aria-label="Delete trade"><X size={15}/></button></td></tr>)}</tbody></table></div>;
}
function CalendarGrid({month,trades}:{month:string;trades:Trade[]}) {
  const [year,mo]=month.split("-").map(Number);
  const first=new Date(year,mo-1,1).getDay(), days=new Date(year,mo,0).getDate();
  const grouped=new Map<number,number>();
  trades.filter(t=>t.trade_date.startsWith(month)).forEach(t=>{const d=Number(t.trade_date.slice(8,10));grouped.set(d,(grouped.get(d)||0)+Number(t.pnl));});
  const cells=(Array.from({length:first},()=>null) as (number|null)[]).concat(Array.from({length:days},(_,i)=>i+1));
  return <div className="calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div className="calendar-weekday" key={d}>{d}</div>)}{cells.map((d,i)=><div className={`calendar-day ${d===null?"blank":grouped.has(d)?"has-trade":""}`} key={i}>{d!==null&&<><span>{d}</span>{grouped.has(d)&&<b className={grouped.get(d)!>=0?"positive-text":"negative-text"}>{usd(grouped.get(d)!)}</b>}</>}</div>)}</div>;
}