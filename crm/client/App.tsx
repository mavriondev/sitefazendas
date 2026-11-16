import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, Handshake, KeyRound, LogOut, Map, Menu, RefreshCw, Upload, UserRound, UsersRound } from "lucide-react";
import { api, type User } from "./api";
import { AuthCtx, confirmLeave, resetDirty, useAction, useAuth, useNavigationGuard } from "./ui";
import { ContactDetail, Contacts, Deals, Home } from "./pages-atendimento";
import { Account, FarmDetail, Farms, Import, Team } from "./pages-gestao";

function Login({ onLogin, expired }: { onLogin: (u: User) => void; expired: boolean }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const act = useAction();
  return (
    <div className="login">
      <div className="login-art">
        <div style={{ position: "relative", zIndex: 1 }}><div className="brand" style={{ padding: 0 }}>Gramogol</div><div className="brand-sub" style={{ padding: 0 }}>Área da equipe</div></div>
        <div className="big" style={{ position: "relative", zIndex: 1 }}>Quem ligou,<br />qual fazenda,<br /><em>quando voltar.</em></div>
      </div>
      <div className="login-form">
        <form className="form" onSubmit={async (e) => { e.preventDefault(); const r = await act.run(() => api.login(email.trim(), senha)); if (r) { setSenha(""); onLogin(r.usuario); } }}>
          <div><h1 style={{ fontSize: 30 }}>Entrar</h1><p className="muted" style={{ margin: "4px 0 0" }}>Acesso restrito a corretores Gramogol.</p></div>
          {expired && !act.error && <div className="alert warn"><AlertTriangle size={17} />Sua sessão terminou. Entre novamente.</div>}
          <label className="f">E-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" /></label>
          <label className="f">Senha<input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required data-testid="input-password" /></label>
          <ErrorLine error={act.error} />
          <button className="btn primary" disabled={act.busy} data-testid="button-login">{act.busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}
function ErrorLine({ error }: { error: Error | null }) {
  return error ? <div className="alert bad" role="alert"><AlertTriangle size={17} />{error.message}</div> : null;
}

function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const { user } = useAuth();
  const admin = user.papel === "admin";
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const links = [
    { to: "/", label: "Retornos", short: "Retornos", icon: CalendarClock, end: true },
    { to: "/contatos", label: "Contatos", short: "Contatos", icon: UserRound },
    { to: "/negociacoes", label: "Negociações", short: "Negócios", icon: Handshake },
    { to: "/fazendas", label: "Fazendas", short: "Fazendas", icon: Map },
    { to: "/equipe", label: "Equipe", short: "Equipe", icon: UsersRound },
    ...(admin ? [{ to: "/importacao", label: "Importação", short: "Importar", icon: Upload }] : []),
    { to: "/conta", label: "Minha conta", short: "Conta", icon: KeyRound },
  ];
  const side = (
    <aside className="side">
      <div className="brand">Gramogol</div>
      <div className="brand-sub">CRM da equipe</div>
      <nav className="nav">{links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} data-testid={`nav-${l.to.slice(1) || "home"}`}><l.icon size={17} />{l.label}</NavLink>)}</nav>
      <div className="side-foot">
        <div style={{ fontWeight: 600 }}>{user.nome}</div>
        <div style={{ opacity: .6 }}>{admin ? "Administrador" : "Membro"}</div>
        <button onClick={onLogout} data-testid="button-logout"><LogOut size={15} />Sair</button>
      </div>
    </aside>
  );
  return (
    <div className="shell">
      {side}
      <header className="topbar">
        <Link to="/" className="brand" style={{ color: "inherit", textDecoration: "none" }}>Gramogol</Link>
        <button onClick={() => setOpen(true)} aria-label="Menu" data-testid="button-menu"><Menu size={22} /></button>
      </header>
      {open && <div className="drawer" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>{side}</div>}
      <main className="main">{children}</main>
      <nav className="tabbar">{links.slice(0, 5).map((l) => <NavLink key={l.to} to={l.to} end={l.end}><l.icon size={19} />{l.short}</NavLink>)}</nav>
    </div>
  );
}

function NotFound() {
  return <div className="page"><div className="empty"><h3>Página não encontrada</h3><div className="small" style={{ marginBottom: 12 }}>O endereço não existe ou você não tem acesso.</div><Link className="btn" to="/">Voltar aos retornos</Link></div></div>;
}

function App() {
  useNavigationGuard();
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [expired, setExpired] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();

  const boot = () => {
    setState("loading");
    api.me().then((r) => { setUser(r.usuario); setState("ready"); }).catch((e: Error & { status?: number }) => {
      if (e.status === 401) { setUser(null); setState("ready"); } else setState("error");
    });
  };
  useEffect(boot, []);
  useEffect(() => {
    const h = () => { resetDirty(); setUser(null); setExpired(true); setEpoch((n) => n + 1); };
    window.addEventListener("crm-expired", h);
    return () => window.removeEventListener("crm-expired", h);
  }, []);

  const logout = async () => {
    if (!confirmLeave()) return;
    try { await api.logout(); } catch (e) {
      if ((e as { status?: number }).status !== 401) { window.alert("Não foi possível encerrar a sessão. Tente novamente."); return; }
    }
    resetDirty();
    setUser(null); setExpired(false); setEpoch((n) => n + 1); nav("/login", { replace: true });
  };

  if (state === "loading") return <div className="login-form" style={{ minHeight: "100dvh" }}><div className="brand" style={{ color: "hsl(var(--ink))", opacity: .5 }}>Gramogol</div></div>;
  if (state === "error") return (
    <div className="login-form" style={{ minHeight: "100dvh" }}>
      <div className="empty" style={{ maxWidth: 380 }}><h3>Sem conexão com o CRM</h3><div className="small" style={{ marginBottom: 12 }}>Verifique a internet e tente de novo.</div><button className="btn primary" onClick={boot} data-testid="button-retry-boot"><RefreshCw size={15} />Tentar de novo</button></div>
    </div>
  );
  if (!user) {
    if (loc.pathname !== "/login") return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
    return <Login expired={expired} onLogin={(u) => { setExpired(false); setUser(u); const from = (loc.state as { from?: string } | null)?.from; nav(from && from !== "/login" ? from : "/", { replace: true }); }} />;
  }
  const admin = user.papel === "admin";
  return (
    <AuthCtx.Provider value={{ user, setUser }} key={`${user.id}-${epoch}`}>
      <Shell onLogout={logout}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Home />} />
          <Route path="/contatos" element={<Contacts />} />
          <Route path="/contatos/:id" element={<ContactDetail />} />
          <Route path="/negociacoes" element={<Deals />} />
          <Route path="/fazendas" element={<Farms />} />
          <Route path="/fazendas/:id" element={<FarmDetail />} />
          <Route path="/equipe" element={<Team />} />
          <Route path="/conta" element={<Account />} />
          <Route path="/importacao" element={admin ? <Import /> : <NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </AuthCtx.Provider>
  );
}

export default App;
