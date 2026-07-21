import { useEffect, useId, useRef, useState } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function Modal({ title, children, onClose, page = false, dialogRole = "dialog", className = "" }) {
  const backdropRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const [pageMode] = useState(() => page || (/^\/capsules\/(?!new$)[^/]+$/.test(window.location.pathname) && !document.querySelector(".page-dialog")));
  const close = () => pageMode ? window.location.assign("/capsules") : onCloseRef.current?.();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (pageMode) return undefined;
    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      const preferredTarget = dialogRef.current?.querySelector("[autofocus]");
      const firstTarget = preferredTarget || dialogRef.current?.querySelector(focusableSelector);
      (firstTarget || dialogRef.current)?.focus();
    });

    const handleKeyDown = event => {
      const openModals = document.querySelectorAll(".modal-backdrop");
      if (openModals[openModals.length - 1] !== backdropRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = [...(dialogRef.current?.querySelectorAll(focusableSelector) || [])];
      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) previousFocusRef.current.focus();
    };
  }, [pageMode]);

  return <div ref={backdropRef} className={`modal-backdrop${pageMode ? " page-dialog" : ""}`} onMouseDown={pageMode ? undefined : close}>
    <section ref={dialogRef} className={`modal${pageMode ? " page-dialog-content" : ""}${className ? ` ${className}` : ""}`} role={pageMode ? undefined : dialogRole} aria-modal={pageMode ? undefined : "true"} aria-labelledby={pageMode ? undefined : titleId} tabIndex={pageMode ? undefined : -1} onMouseDown={event => event.stopPropagation()}>
      <header><h2 id={titleId}>{title}</h2><button type="button" aria-label={pageMode ? "Retour aux capsules" : "Fermer"} onClick={close}>{pageMode ? "← Capsules" : "×"}</button></header>
      {children}
    </section>
  </div>;
}
