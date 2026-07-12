import { AlertTriangle, LoaderCircle } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmModal({ title, message, confirmLabel = "Confirmer", loading, onConfirm, onClose }) {
  return <Modal title={title} onClose={loading ? () => {} : onClose}>
    <div className="confirm-dialog">
      <div className="confirm-icon"><AlertTriangle size={26}/></div>
      <p>{message}</p>
      <div className="confirm-actions"><button type="button" className="secondary" disabled={loading} onClick={onClose}>Annuler</button><button type="button" className="confirm-danger" disabled={loading} onClick={onConfirm}>{loading ? <><LoaderCircle className="spin" size={17}/> Suppression…</> : confirmLabel}</button></div>
    </div>
  </Modal>;
}
