import { Heart, Network, Pencil, Trash2 } from "lucide-react";
export default function ClothingCard({ item, onEdit, onDelete, onFavorite, selectable, selected, onSelect }) {
  const editFromImage = (event) => {
    if (selectable || !onEdit) return;
    event.stopPropagation();
    onEdit(item);
  };

  const handleImageKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      editFromImage(event);
    }
  };

  return <article className={`clothing-card ${selected ? "selected" : ""}`} onClick={() => selectable && onSelect(item._id)}>
    <div
      className={`card-image ${!selectable && onEdit ? "editable" : ""}`}
      onClick={editFromImage}
      onKeyDown={handleImageKeyDown}
      role={!selectable && onEdit ? "button" : undefined}
      tabIndex={!selectable && onEdit ? 0 : undefined}
      aria-label={!selectable && onEdit ? `Modifier ${item.name || "ce vêtement"}` : undefined}
    >{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <span>{item.category}</span>}<span className="compatibility-count" title={`${item.compatibleWith?.length || 0} compatibilité${item.compatibleWith?.length === 1 ? "" : "s"}`}><Network size={13}/>{item.compatibleWith?.length || 0}</span></div>
    <div className="card-body"><div className="card-title"><h3>{item.name}</h3><button className="icon-button" onClick={e => { e.stopPropagation(); onFavorite?.(item); }}><Heart size={18} fill={item.favorite ? "currentColor" : "none"}/></button></div><p>{[item.brand, item.color].filter(Boolean).join(" · ") || item.category}</p>
    {!selectable && <div className="card-actions"><button onClick={() => onEdit(item)}><Pencil size={16}/> Modifier</button><button className="danger" onClick={() => onDelete(item._id)}><Trash2 size={16}/></button></div>}</div>
  </article>;
}
