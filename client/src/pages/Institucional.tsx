import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, linkWhatsapp } from "../api";
import { useSite } from "../contexto";
import { FormContato } from "../components/FormContato";

function Topo({ rotulo, titulo, texto }: { rotulo: string; titulo: string; texto?: string }) {
  useEffect(() => { document.title = titulo; }, [titulo]);
  return (
    <section className="topo-pagina"><div className="container">
      <span className="rotulo-sec">{rotulo}</span><h1>{titulo}</h1>{texto && <p>{texto}</p>}
    </div></section>
  );
}

export function Sobre() {
  const { config } = useSite();
  const zap = linkWhatsapp(config?.whatsapp_padrao, "Olá! Gostaria de conversar sobre fazendas.");
  return (
    <>
      <Topo rotulo="Quem somos" titulo={config?.sobre_titulo || "Sobre nós"} />
      <div className="container pagina" style={{ maxWidth: 820 }}>
        {(config?.sobre_texto ?? "").split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i} className="texto-longo">{p}</p>)}
        <div className="passos" style={{ marginTop: 32 }}>
          <div className="passo"><div className="n">01</div><h3>Dados claros</h3><p>Cada informação mostra se foi confirmada com vendedor, documento ou visita, ou se vem de bases públicas e modelos.</p></div>
          <div className="passo"><div className="n">02</div><h3>Sigilo do proprietário</h3><p>Localização exata, CAR e limites do imóvel só são informados em atendimento direto.</p></div>
          <div className="passo"><div className="n">03</div><h3>Atendimento direto</h3><p>Visitas, documentos e negociação são conduzidos por um corretor, do primeiro contato ao fechamento.</p></div>
        </div>
        <div className="linha" style={{ marginTop: 28 }}>
          <Link className="btn" to="/fazendas">Ver fazendas</Link>
          <Link className="btn sec" to="/venda-sua-fazenda">Quero vender minha fazenda</Link>
          {zap && <a className="btn sec" href={zap} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>}
        </div>
      </div>
    </>
  );
}

export function Parceiros() {
  const [l, setL] = useState<Array<{ id: number; nome: string; logo: string | null; url: string | null }> | null>(null);
  useEffect(() => { void api.get("/api/public/parceiros").then((r) => setL(r.parceiros)).catch(() => setL([])); }, []);
  return (
    <>
      <Topo rotulo="Quem trabalha conosco" titulo="Parceiros" texto="Empresas e instituições que fazem parte da nossa rede." />
      <div className="container pagina">
        {l === null ? <p className="suave" role="status">Carregando…</p> : l.length === 0 ? (
          <div className="vazio"><h3>Em breve</h3><p>Nossos parceiros serão apresentados aqui.</p></div>
        ) : (
          <div className="parceiros-grade">
            {l.map((p) => {
              const corpo = (
                <>
                  <div className="logo">{p.logo ? <img src={p.logo} alt={p.nome} loading="lazy" /> : <span>{p.nome}</span>}</div>
                  <div className="nome-parceiro">{p.nome}</div>
                </>
              );
              return p.url
                ? <a key={p.id} className="parceiro" href={p.url} target="_blank" rel="noopener noreferrer">{corpo}</a>
                : <div key={p.id} className="parceiro">{corpo}</div>;
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function Contato() {
  const { config } = useSite();
  const zap = linkWhatsapp(config?.whatsapp_padrao, "Olá! Vim pelo site e gostaria de falar com o corretor.");
  return (
    <>
      <Topo rotulo="Fale conosco" titulo="Contato" texto="Tire dúvidas, peça informações sobre uma fazenda ou fale com o corretor." />
      <div className="container pagina">
        <div className="detalhe-grid">
          <FormContato tipo="contato" />
          <aside className="lateral">
            <div className="painel">
              <h3>Atendimento</h3>
              {zap && <p><a className="btn" href={zap} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a></p>}
              {config?.contato_email && <p><strong>E-mail</strong><br /><a href={`mailto:${config.contato_email}`}>{config.contato_email}</a></p>}
              {config?.contato_endereco && <p><strong>Endereço</strong><br />{config.contato_endereco}</p>}
              {config?.contato_horario && <p><strong>Horário</strong><br />{config.contato_horario}</p>}
              {config?.texto_creci && <p className="suave pequeno">{config.texto_creci}</p>}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

export function VendaSuaFazenda() {
  return (
    <>
      <Topo rotulo="Para proprietários" titulo="Venda sua fazenda" texto="Cadastre sua propriedade com ou sem o código do CAR. Nós completamos os dados com você e cuidamos da divulgação com sigilo." />
      <div className="container pagina">
        <div className="detalhe-grid">
          <FormContato tipo="anuncio" />
          <aside className="lateral">
            <div className="painel">
              <h3>Como funciona</h3>
              <ol style={{ paddingLeft: 18 }}>
                <li>Você envia os dados básicos da fazenda.</li>
                <li>Conferimos as informações com você e enriquecemos com dados de bases públicas.</li>
                <li>Divulgamos sem expor a localização exata nem o CAR.</li>
                <li>Apresentamos a compradores interessados, com registro de cada apresentação.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
