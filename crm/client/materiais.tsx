import { Navigate, useParams } from "react-router-dom";

/* "Materiais" agora vive dentro da ficha da fazenda (aba Fotos e documentos).
   Os endereços antigos continuam funcionando e levam ao lugar equivalente. */
export function Materiais() {
  return <Navigate to="/fazendas" replace />;
}

export function MateriaisFazenda() {
  const id = useParams().id ?? "";
  return <Navigate to={`/fazendas/${encodeURIComponent(id)}?aba=arquivos`} replace />;
}

export function NegociacaoFazendaRedirect() {
  const id = useParams().id ?? "";
  return <Navigate to={`/fazendas/${encodeURIComponent(id)}?aba=interessados`} replace />;
}
