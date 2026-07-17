import { Eye, Heart, Network, Trash2 } from "lucide-react";
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
      aria-label={!selectable && onEdit ? `Voir ${item.name || "ce vêtement"}` : undefined}
    >{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <span>{item.category}</span>}<span className="compatibility-count" title={`${item.compatibleWith?.length || 0} compatibilité${item.compatibleWith?.length === 1 ? "" : "s"}`}><Network size={13}/>{item.compatibleWith?.length || 0}</span></div>
    {selectable ? <div className="card-body"><div className="card-title"><h3>{item.name || item.category}</h3></div><p>{[item.brand, item.color].filter(Boolean).join(" · ") || item.category}</p></div> : <footer className="wardrobe-card-footer"><div><b>{item.name || item.category}</b>{item.name && item.name !== item.category && <small>{item.category}</small>}</div><div><button type="button" aria-label={item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} title={item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={e => { e.stopPropagation(); onFavorite?.(item); }}><Heart size={17} fill={item.favorite ? "currentColor" : "none"}/></button><button type="button" aria-label={`Voir ${item.name || item.category}`} title="Voir" onClick={e => { e.stopPropagation(); onEdit(item); }}><Eye size={17}/></button><button type="button" className="danger" aria-label={`Supprimer ${item.name || item.category}`} title="Supprimer" onClick={e => { e.stopPropagation(); onDelete(item._id); }}><Trash2 size={17}/></button></div></footer>}
  </article>;
}
