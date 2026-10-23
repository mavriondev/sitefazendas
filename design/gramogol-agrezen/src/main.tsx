import { createRoot } from "react-dom/client";
import { Inicio } from "./Inicio";
import { Fazenda } from "./Fazenda";
import "./reset.css";

const isFarm = window.location.pathname.endsWith("/Fazenda");
document.title = `${isFarm ? "Fazenda" : "Início"} — Gramogol · Proposta visual`;
createRoot(document.getElementById("root")!).render(isFarm ? <Fazenda /> : <Inicio />);
