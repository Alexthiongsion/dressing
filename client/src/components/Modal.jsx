import { useEffect, useRef, useState } from "react";

export default function Modal({ title, children, onClose, page = false }) {
  const backdropRef = useRef(null);
  const [pageMode] = useState(() => page || (/^\/capsules\/(?!new$)[^/]+$/.test(window.location.pathname) && !document.querySelector(".page-dialog")));
  const close = pageMode ? () => window.location.assign("/capsules") : onClose;

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key !== "Escape") return;
      const openModals = document.querySelectorAll(".modal-backdrop");
      if (openModals[openModals.length - 1] !== backdropRef.current) return;
      event.preventDefault();
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  return <div ref={backdropRef} className={`modal-backdrop${pageMode ? " page-dialog" : ""}`} onMouseDown={pageMode ? undefined : close}>
    <section className={`modal${pageMode ? " page-dialog-content" : ""}`} role={pageMode ? undefined : "dialog"} aria-modal={pageMode ? undefined : "true"} aria-label={typeof title === "string" ? title : undefined} onMouseDown={event => event.stopPropagation()}>
      <header><h2>{title}</h2><button type="button" aria-label={pageMode ? "Retour aux capsules" : "Fermer"} onClick={close}>{pageMode ? "← Capsules" : "×"}</button></header>
      {children}
    </section>
  </div>;
}
