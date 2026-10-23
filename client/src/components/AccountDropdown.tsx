import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useSite } from "../contexto";

export function AccountDropdown() {
  const { usuario, sair } = useSite();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => { setOpen(false); }, [location, usuario]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="ga-account" ref={container}>
      <button
        ref={trigger}
        className="ga-account-trigger"
        type="button"
        aria-label="Opções da conta"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
      >
        <UserRound aria-hidden="true" />
      </button>
      <div id={panelId} className="ga-account-panel" hidden={!open}>
        {usuario ? <>
          <Link to="/conta" onClick={() => setOpen(false)}>Minha conta</Link>
          <button type="button" onClick={() => { setOpen(false); void sair(); }}>Sair</button>
        </> : <>
          <Link to="/entrar" onClick={() => setOpen(false)}>Entrar</Link>
          <Link to="/cadastro" onClick={() => setOpen(false)}>Cadastrar</Link>
        </>}
      </div>
    </div>
  );
}
