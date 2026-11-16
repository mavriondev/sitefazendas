import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FolderDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "./api";
import { DocsDownloadAll, DocsReadOnly, PhotosCard, ShareLinkButton } from "./share";
import { Empty, ErrorBox, Skeleton, initials, publicUrl, useLoad } from "./ui";

/* Área "Materiais": só visualizar e baixar o que foi enviado. Nada aqui edita dados. */

const areaLabel = (v: string | null) => v ? `${Number(v).toLocaleString("pt-BR")} ha` : "";

export function Materiais() {
  const q = useLoad(() => api.farms(), []);
  const [t, setT] = useState("");
  const list = useMemo(() => {
    const s = t.trim().toLowerCase();
    return (q.data?.fazendas ?? []).filter((f) => !s || f.titulo.toLowerCase().includes(s) || (f.regiao ?? "").toLowerCase().includes(s));
  }, [q.data, t]);
  return (
    <div className="page">
      <div className="head"><div><div className="eyebrow">Fotos e documentos</div><h1>Materiais</h1></div></div>
      <p className="muted" style={{ margin: 0 }}>Escolha a fazenda para ver e baixar as fotos e os documentos.</p>
      <div className="search"><Search size={16} /><input type="search" value={t} onChange={(e) => setT(e.target.value)} placeholder="Procurar fazenda" data-testid="input-search-materiais" /></div>
      <ErrorBox error={q.error} retry={q.reload} />
      {q.loading && !q.data ? <Skeleton rows={6} /> : q.data && (list.length ? (
        <div className="list">{list.map((f) => (
          <Link key={f.id} to={`/materiais/${f.id}`} className="item" data-testid={`row-materiais-${f.id}`}>
            {f.fotos[0] ? <img src={api.photoUrl(f.id, f.fotos[0].arquivo)} alt="" loading="lazy" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6, flex: "none" }} /> : <span className="avatar" style={{ borderRadius: 6 }}>{initials(f.titulo)}</span>}
            <div className="item-main"><div className="item-title">{f.titulo}</div><div className="item-sub">{[f.regiao, areaLabel(f.area), `${f.fotos.length} foto(s)`].filter(Boolean).join(" · ")}</div></div>
            <FolderDown size={18} className="muted" />
          </Link>
        ))}</div>
      ) : <Empty title={t ? "Nenhuma fazenda encontrada" : "Nenhuma fazenda liberada"}>{t ? "Tente outro nome." : "Peça ao administrador para liberar fazendas para você."}</Empty>)}
    </div>
  );
}

export function MateriaisFazenda() {
  const id = Number(useParams().id);
  const q = useLoad(() => api.farm(id), [id]);
  if (q.loading && !q.data) return <div className="page"><Skeleton rows={5} /></div>;
  if (!q.data) return <div className="page"><Link className="back" to="/materiais"><ArrowLeft size={14} />Materiais</Link><ErrorBox error={q.error} retry={q.reload} /></div>;
  const { fazenda: f, documentos, site_url } = q.data;
  const pub = f.disponivel && f.status === "publicada";
  return (
    <div className="page">
      <div>
        <Link className="back" to="/materiais"><ArrowLeft size={14} />Materiais</Link>
        <div className="head">
          <div style={{ minWidth: 0 }}><div className="eyebrow">{[f.regiao, areaLabel(f.area)].filter(Boolean).join(" · ") || "Fazenda"}</div><h1 data-testid="text-materiais-title">{f.titulo}</h1></div>
          {pub && <ShareLinkButton f={f} url={publicUrl(site_url, f.slug)} />}
        </div>
      </div>
      <ErrorBox error={q.error} retry={q.reload} />
      {f.fotos.length ? <PhotosCard f={f} /> : <section className="card"><div className="card-h"><h2>Fotos</h2></div><div className="muted small">Nenhuma foto nesta fazenda.</div></section>}
      <section className="card">
        <div className="card-h"><h2>Documentos <span className="tag">{documentos.length}</span></h2><DocsDownloadAll docs={documentos} /></div>
        <DocsReadOnly docs={documentos} />
      </section>
    </div>
  );
}
