import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function OutfitCreate() {
  const navigate = useNavigate();
  const [clothes, setClothes] = useState([]);
  const [selected, setSelected] = useState([]);
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [draggingOver, setDraggingOver] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { api("/clothes").then(setClothes); }, []);

  const selectedItems = selected.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const availableItems = clothes.filter(item => {
    if (selected.includes(item._id)) return false;
    if (category && item.category !== category) return false;
    if (season && !item.season?.includes(season)) return false;
    if (selectedItems.some(value => value.category === item.category)) return false;
    return selectedItems.every(value => value.compatibleWith?.some(link => (link._id || link) === item._id));
  });

  const addItem = id => {
    const item = clothes.find(value => value._id === id);
    if (!item) return;
    if (selectedItems.some(value => value.category === item.category)) return setError(`La catégorie ${item.category} est déjà présente.`);
    if (!selectedItems.every(value => value.compatibleWith?.some(link => (link._id || link) === item._id))) return setError("Cette pièce n’est pas compatible avec la tenue.");
    setError(""); setSelected(current => [...current, id]);
  };
  const dropItem = event => {
    event.preventDefault(); setDraggingOver(false);
    addItem(event.dataTransfer.getData("text/plain"));
  };
  const save = async event => {
    event.preventDefault(); setSaving(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.clothes = selected; body.season = season;
    await api("/outfits", { method: "POST", body: JSON.stringify(body) });
    navigate("/outfits");
  };
  const renderSelectedItem = item => <article className="outfit-selected-image" key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<button type="button" aria-label={`Retirer ${item.name || item.category}`} title="Retirer" onClick={() => setSelected(current => current.filter(id => id !== item._id))}><Trash2 size={16}/></button></article>;

  return <><header className="page-header"><div><span className="eyebrow">Nouvelle combinaison</span><h1>Créer un outfit</h1></div><button className="secondary" onClick={() => navigate("/outfits")}><ArrowLeft size={18}/> Retour</button></header><form className="creation-page outfit-builder-page" onSubmit={save}><section className="creation-settings"><label>Nom<input name="name" required autoFocus placeholder="Ex. Dîner en ville"/></label><label>Occasion<input name="occasion" placeholder="Travail, soirée, week-end…"/></label><div><span>Saison</span><div className="category-pills"><button type="button" className={!season ? "active" : ""} onClick={() => setSeason("")}>Toutes</button>{seasons.map(value => <button type="button" key={value} className={season === value ? "active" : ""} onClick={() => setSeason(value)}>{value}</button>)}</div></div></section>
    <section className={`outfit-build-zone ${draggingOver ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDraggingOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingOver(false); }} onDrop={dropItem}>
      <header><div><span className="eyebrow">Votre tenue</span><h2>Composition</h2></div><strong>{selected.length} pièce{selected.length > 1 ? "s" : ""}</strong></header>
      {selectedItems.length ? <div className="outfit-vertical-stack">{selectedItems.filter(item => !["Inter", "Manteau"].includes(item.category)).map(renderSelectedItem)}{selectedItems.some(item => ["Inter", "Manteau"].includes(item.category)) && <div className="outfit-horizontal-layer">{selectedItems.filter(item => ["Inter", "Manteau"].includes(item.category)).map(renderSelectedItem)}</div>}</div> : <div className="outfit-build-empty"><strong>Glissez vos vêtements ici</strong><span>Les pièces s’empileront de haut en bas.</span></div>}
      {error && <p className="field-error">{error}</p>}
    </section>
    <section className="outfit-item-drawer"><div className="creation-list-heading"><div><h2>Ajouter des pièces</h2><p>Filtrez une catégorie puis glissez une vignette vers la tenue.</p></div></div><div className="category-pills outfit-category-pills"><button type="button" className={!category ? "active" : ""} onClick={() => setCategory("")}>Tout</button>{categories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="outfit-drag-items">{availableItems.map(item => <button type="button" draggable key={item._id} onDragStart={event => { event.dataTransfer.setData("text/plain", item._id); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addItem(item._id)}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}<b>{item.name || item.category}</b><small>{item.category}</small></button>)}</div>{!availableItems.length && <p className="empty-filter-message">Aucune pièce compatible dans cette catégorie.</p>}</section>
    <footer><button className="primary" disabled={saving || !selected.length}><Save size={18}/> {saving ? "Création…" : "Créer l’outfit"}</button></footer>
  </form></>;
}
