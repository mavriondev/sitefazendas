import { retornoSeguro } from "../../../shared/navegacao";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, linkWhatsapp } from "../api";
import { useSite } from "../contexto";
import { Erro, Ok } from "../components/Avisos";

export function Entrar() {
  const { recarregar } = useSite();
  const nav = useNavigate();
  const [p] = useSearchParams();
  const [v, setV] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState<unknown>(null);
  const [env, setEnv] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setEnv(true);
    try { await api.post("/api/auth/entrar", v); await recarregar(); nav(retornoSeguro(p.get("de"))); }
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
      <EsqueciSenha />
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
        <label htmlFor="n">Nome</label><input id="n" required minLength={2} maxLength={120} autoComplete="name" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
        <label htmlFor="e">E-mail</label><input id="e" type="email" required maxLength={200} autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <label htmlFor="w">WhatsApp (com DDD)</label><input id="w" required maxLength={32} inputMode="tel" autoComplete="tel" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} />
        <label htmlFor="s">Senha (mínimo 12 caracteres)</label><input id="s" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={v.senha} onChange={(e) => setV({ ...v, senha: e.target.value })} />
        <label className="linha" style={{ fontWeight: 400 }}>
          <input type="checkbox" required style={{ width: "auto" }} checked={v.aceite} onChange={(e) => setV({ ...v, aceite: e.target.checked })} />
          <span>Li e aceito a <Link to="/privacidade">política de privacidade</Link>.</span>
        </label>
        <button className="btn" disabled={env} type="submit">Criar conta</button>
      </form>
      <p>Já tem conta? <Link to="/entrar">Entrar</Link></p>
    </div>
  );
}

function EsqueciSenha() {
  const { config } = useSite();
  const wa = linkWhatsapp(config?.whatsapp_padrao, "Olá! Esqueci minha senha do site e preciso de um link para redefinir.");
  return (
    <p className="suave pequeno">
      Esqueceu a senha? {wa ? <a href={wa} target="_blank" rel="noopener noreferrer">Peça um link de redefinição pelo WhatsApp</a> : "Peça um link de redefinição ao corretor."}
    </p>
  );
}

export function RedefinirSenha() {
  const [p] = useSearchParams();
  const token = p.get("token") ?? "";
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [feito, setFeito] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    try { await api.post("/api/auth/redefinir", { token, senha }); setFeito(true); } catch (x) { setErro(x); }
  };
  if (feito) return <div className="container pagina" style={{ maxWidth: 440 }}><Ok>Senha alterada.</Ok><p><Link to="/entrar">Entrar</Link></p></div>;
  return (
    <div className="container pagina" style={{ maxWidth: 440 }}>
      <h1>Nova senha</h1>
      <form className="painel" onSubmit={enviar}>
        <Erro erro={erro} />
        <label htmlFor="ns">Nova senha (mínimo 12 caracteres)</label><input id="ns" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <button className="btn" type="submit" disabled={!token}>Salvar</button>
      </form>
    </div>
  );
}

export function MinhaConta() {
  const { usuario, carregando } = useSite();
  const [v, setV] = useState({ senha_atual: "", senha_nova: "" });
  const [erro, setErro] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  if (carregando) return null;
  if (!usuario) return <div className="container pagina"><p><Link to="/entrar?de=/conta">Entre</Link> para ver sua conta.</p></div>;
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null); setOk(false);
    try { await api.put("/api/auth/senha", v); setOk(true); setV({ senha_atual: "", senha_nova: "" }); } catch (x) { setErro(x); }
  };
  return (
    <div className="container pagina" style={{ maxWidth: 440 }}>
      <h1>Minha conta</h1>
      <p>{usuario.nome} · {usuario.email}</p>
      <form className="painel" onSubmit={enviar}>
        <h3>Trocar senha</h3>
        <Erro erro={erro} />{ok && <Ok>Senha alterada.</Ok>}
        <label htmlFor="sa">Senha atual</label><input id="sa" type="password" required autoComplete="current-password" value={v.senha_atual} onChange={(e) => setV({ ...v, senha_atual: e.target.value })} />
        <label htmlFor="sn">Nova senha (mínimo 12 caracteres)</label><input id="sn" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={v.senha_nova} onChange={(e) => setV({ ...v, senha_nova: e.target.value })} />
        <button className="btn" type="submit">Trocar</button>
      </form>
      <p className="suave pequeno">Para excluir sua conta e seus dados, fale com o corretor.</p>
    </div>
  );
}
