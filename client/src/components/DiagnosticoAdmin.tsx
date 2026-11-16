import { idGa4Valido, idPixelValido, type ConfigRastreamento } from "../../../shared/rastreamento";
import "./DiagnosticoAdmin.css";

type Est = { rotulo: string; cls: string; texto: string };
export function estadoProvedor(ativo: boolean, id: string, valido: (s: string) => boolean): Est {
  if (!ativo) return { rotulo: "Desligado", cls: "", texto: "Não será carregado no site." };
  if (!valido(id)) return { rotulo: "ID inválido", cls: "ruim", texto: "Ativado, mas o ID salvo tem formato inválido. Corrija e salve." };
  return { rotulo: "Configuração válida, navegador não testado", cls: "med", texto: "O painel não carrega nada: o teste real acontece na página de diagnóstico." };
}

export function DiagnosticoAdmin({ salvo, sujo }: { salvo: ConfigRastreamento; sujo: boolean }) {
  const ga = estadoProvedor(salvo.ga4_ativo, salvo.ga4_id, idGa4Valido);
  const meta = estadoProvedor(salvo.meta_pixel_ativo, salvo.meta_pixel_id, idPixelValido);
  return (
    <section className="dg-card" aria-labelledby="dg-t">
      <h3 id="dg-t">Diagnóstico da integração</h3>
      <p className="suave pequeno">Mostra a configuração <strong>salva</strong> no servidor, não o rascunho. Salve antes de testar.</p>
      {sujo && <div className="msg aviso" role="status">Há alterações não salvas. O diagnóstico usa somente a versão salva; salve para testar as mudanças.</div>}
      <ul className="dg-lista" aria-live="polite">
        <li><strong>Google Analytics 4</strong><span className={`dg-sel ${ga.cls}`}>{ga.rotulo}</span><span className="pequeno">{salvo.ga4_id || "sem ID"}. {ga.texto}</span></li>
        <li><strong>Pixel da Meta</strong><span className={`dg-sel ${meta.cls}`}>{meta.rotulo}</span><span className="pequeno">{salvo.meta_pixel_id || "sem ID"}. {meta.texto}</span></li>
      </ul>
      <p><a className="btn mini" href="/diagnostico-rastreamento" target="_blank" rel="noopener noreferrer">Abrir teste no navegador (nova aba)</a></p>
      <p className="pequeno"><strong>Como conferir:</strong></p>
      <ul className="pequeno">
        <li>GA4: Administrador &gt; Fluxos de dados &gt; Web, confirme o ID G- igual ao salvo. Depois, Relatórios &gt; Tempo real e procure o evento page_view (pode demorar). O DebugView só funciona com depuração ativada, o que não é automático aqui.</li>
        <li>Meta: Gerenciador de Eventos &gt; fonte de dados com o mesmo ID do Pixel &gt; Testar eventos &gt; abra o site ou use o fluxo de teste e procure PageView.</li>
        <li>Evento na fila do navegador não significa recebido pela conta. Bloqueadores e extensões não são contornados.</li>
      </ul>
    </section>
  );
}
