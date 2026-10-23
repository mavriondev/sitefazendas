import { Secoes, useConteudo } from "../components/Conteudo";

export default function Privacidade() {
  const {texto:t}=useConteudo("privacidade");
  return (
    <div className="container pagina" style={{ maxWidth: 760 }}>
      <Secoes pagina="privacidade" blocos={{
        topo:<section><h1>{t("topo.titulo")}</h1>{t("topo.aviso")&&<p className="msg aviso cms-rich-text">{t("topo.aviso")}</p>}</section>,
        ...Object.fromEntries(["dados","finalidade","direitos","imoveis"].map(id=>[id,<section key={id} data-cms-secao={id}><h3>{t(`${id}.titulo`)}</h3><p className="cms-rich-text">{t(`${id}.texto`)}</p></section>])),
      }}/>
    </div>
  );
}
