import { LoaderCircle, RefreshCw } from "lucide-react";

export default function PageState({ loading = false, title, message, actionLabel, onAction, actionIcon: ActionIcon = RefreshCw }) {
  return <section className="page-state" role={loading ? "status" : undefined} aria-live="polite">
    {loading && <LoaderCircle className="spin" size={25} aria-hidden="true"/>}
    <div>
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
    {onAction && <button type="button" className="secondary" onClick={onAction}><ActionIcon size={16} aria-hidden="true"/>{actionLabel || "Réessayer"}</button>}
  </section>;
}
