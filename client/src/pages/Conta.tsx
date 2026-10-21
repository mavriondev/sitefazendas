import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useSite } from "../contexto";
import { Erro } from "../components/Avisos";

export function Entrar() {
  const { recarregar } = useSite();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const [v, setV] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/auth/entrar", v); await recarregar(); const d = p.get("de"); nav(d && d.startsWith("/") && !d.startsWith("//") ? d : "/"); }
    catch (x) { setErro(x); } finally { setEnv(false); }
  };
  return (
    <div className="container pagina" style={{ maxWidth: 440 }}>
      <h1>Entrar</h1>
      <form className="painel" onSubmit={enviar}>
        <Erro erro={erro} />
        <label htmlFor="e">E-mail</label><input id="e" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <label htmlFor="s">Senha</label><input id="s" type="password" required autoComplete="current-password" value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} />
        <button className="btn" disabled={env} type="submit">Entrar</button>
      </form>
      <p>Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </div>
  );
}

export function Cadastro() {
  const { recarregar } = useSite();
  const nav = useNavigate();
  const [v, setV] = useState({ nome: "", email: "", whatsapp: "", senha: "", aceite: false });
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/auth/registrar", v); await recarregar(); nav("/"); }
    catch (x) { setErro(x); } finally { setEnv(false); }
  };
  return (
    <div className="container pagina" style={{ maxWidth: 440 }}>
      <h1>Criar conta</h1>
      <form className="painel" onSubmit={enviar}>
        <Erro erro={erro} />
        <label htmlFor="n">Nome</label><input id="n" required autoComplete="name" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
        <label htmlFor="e">E-mail</label><input id="e" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <label htmlFor="w">WhatsApp (com DDD)</label><input id="w" required inputMode="tel" autoComplete="tel" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} />
        <label htmlFor="s">Senha</label><input id="s" type="password" required autoComplete="new-password" value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} />
        <label className="linha" style={{ fontWeight: 400 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={v.aceite} onChange={(e) => setV({ ...v, aceite: e.target.checked })} />
          <span>Li e aceito a <Link to="/privacidade">política de privacidade</Link>.</span>
        </label>
        <button className="btn" disabled={env} type="submit">Criar conta</button>
      </form>
      <p>Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </div>
  );
}
