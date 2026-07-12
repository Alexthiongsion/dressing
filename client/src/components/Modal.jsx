import { useEffect, useRef } from "react";

export default function Modal({ title, children, onClose }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key !== "Escape") return;
      const openModals = document.querySelectorAll(".modal-backdrop");
      if (openModals[openModals.length - 1] !== backdropRef.current) return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div ref={backdropRef} className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} onMouseDown={event => event.stopPropagation()}>
      <header><h2>{title}</h2><button type="button" aria-label="Fermer" onClick={onClose}>×</button></header>
      {children}
    </section>
  </div>;
}
