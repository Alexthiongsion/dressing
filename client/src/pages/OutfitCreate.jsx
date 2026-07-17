import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpWideNarrow, Lock, LockOpen, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";
import { areCompatible, completeOutfit } from "../utils/outfitSuggestions";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const compositionOrder = ["Manteau", "Inter", "Haut", "Accessoire", "Bas", "Chaussures"];

export default function OutfitCreate() {
  const navigate = useNavigate();
  const [clothes, setClothes] = useState([]);
  const [selected, setSelected] = useState([]);
  const [locked, setLocked] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("");
  const [draggingOver, setDraggingOver] = useState(false);
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [sortByLeastCompatibility, setSortByLeastCompatibility] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  useEffect(() => { api("/clothes").then(setClothes); }, []);
  useEffect(() => {
    if (!showItemDrawer) return undefined;
    const closeOnEscape = event => { if (event.key === "Escape") setShowItemDrawer(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showItemDrawer]);

  const selectedItems = selected.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const availableCategories = categories.filter(value => !selectedItems.some(item => item.category === value));
  const availableItems = clothes.filter(item => {
    if (selected.includes(item._id)) return false;
    if (category && item.category !== category) return false;
    if (season && !item.season?.includes(season)) return false;
    if (selectedItems.some(value => value.category === item.category)) return false;
    return selectedItems.every(value => value.compatibleWith?.some(link => (link._id || link) === item._id));
  }).sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : sortByLeastCompatibility ? (a.compatibleWith?.length || 0) - (b.compatibleWith?.length || 0) : 0);

  const addItem = id => {
    const item = clothes.find(value => value._id === id);
    if (!item) return;
    if (selectedItems.some(value => value.category === item.category)) return setError(`La catégorie ${item.category} est déjà présente.`);
    if (!selectedItems.every(value => value.compatibleWith?.some(link => (link._id || link) === item._id))) return setError("Cette pièce n’est pas compatible avec la tenue.");
    setError("");
    setLocked(current => [...new Set([...current, id])]);
    setSuggested(current => current.filter(value => value !== id));
    if (category === item.category) setCategory("");
    setSelected(current => [...current, id].sort((firstId, secondId) => {
      const first = clothes.find(value => value._id === firstId);
      const second = clothes.find(value => value._id === secondId);
      return compositionOrder.indexOf(first?.category) - compositionOrder.indexOf(second?.category);
    }));
  };
  const dropItem = event => {
    event.preventDefault(); setDraggingOver(false);
    addItem(event.dataTransfer.getData("text/plain"));
  };
  const complete = () => {
    if (!selected.length) return setError("Choisissez au moins une pièce de départ.");
    const result = completeOutfit({ clothes, seedIds: selected, lockedIds: locked.length ? locked : selected, season, offset: suggestionOffset });
    const ids = result.map(item => item._id);
    setSelected(ids);
    setSuggested(ids.filter(id => !locked.includes(id)));
    setSuggestionOffset(value => value + 1);
    setError(result.length === (locked.length || selected.length) ? "Aucune autre pièce compatible n’a été trouvée." : "");
  };
  const replaceAutomatically = item => {
    const otherItems = selectedItems.filter(value => value._id !== item._id);
    const candidates = clothes
      .filter(value => value.category === item.category && value._id !== item._id && !selected.includes(value._id))
      .filter(value => !season || value.season?.includes(season))
      .filter(value => otherItems.every(other => areCompatible(other, value)))
      .sort((a, b) => (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0));
    if (!candidates.length) return setError(`Aucune autre pièce compatible dans la catégorie ${item.category}.`);
    const replacement = candidates[suggestionOffset % candidates.length];
    setSelected(current => current.map(id => id === item._id ? replacement._id : id));
    setLocked(current => current.filter(id => id !== item._id && id !== replacement._id));
    setSuggested(current => [...current.filter(id => id !== item._id), replacement._id]);
    setSuggestionOffset(value => value + 1);
    setError("");
  };
  const save = async event => {
    event.preventDefault(); setSaving(true);
    const body = { name: `Tenue du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date())}`, occasion: "", clothes: selected, season };
    await api("/outfits", { method: "POST", body: JSON.stringify(body) });
    navigate("/outfits");
  };
  const renderSelectedItem = item => <article className="outfit-selected-image" key={item._id}><div className="outfit-selected-visual">{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<div className="suggestion-item-actions"><button type="button" className={locked.includes(item._id) ? "locked" : ""} aria-label={locked.includes(item._id) ? "Déverrouiller" : "Verrouiller"} title={locked.includes(item._id) ? "Pièce conservée" : "Verrouiller"} onClick={() => setLocked(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}>{locked.includes(item._id) ? <Lock size={15}/> : <LockOpen size={15}/>}</button><button type="button" className="replace-suggestion" aria-label={`Remplacer automatiquement ${item.name || item.category}`} title="Autre pièce compatible" onClick={() => replaceAutomatically(item)}><RefreshCw size={15}/></button><button type="button" aria-label={`Retirer ${item.name || item.category}`} title="Retirer" onClick={() => { setSelected(current => current.filter(id => id !== item._id)); setLocked(current => current.filter(id => id !== item._id)); setSuggested(current => current.filter(id => id !== item._id)); }}><Trash2 size={15}/></button></div>{suggested.includes(item._id) && <i className="suggested-badge"><Sparkles size={12}/> Suggérée</i>}</div></article>;

  return <><header className="page-header outfit-create-header"><div><span className="eyebrow">Nouvelle combinaison</span><h1>Créer un outfit</h1></div><div className="page-actions"><button type="button" className="secondary" onClick={() => navigate("/outfits")}><ArrowLeft size={18}/> Retour</button><button type="submit" form="outfit-create-form" className="primary" disabled={saving || !selected.length}><Save size={18}/> {saving ? "Création…" : "Créer l’outfit"}</button></div></header><form id="outfit-create-form" className="creation-page outfit-builder-page composition-fullscreen" onSubmit={save}>
    <section className={`outfit-build-zone ${draggingOver ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDraggingOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingOver(false); }} onDrop={dropItem}>
      <header className="composition-toolbar"><button type="button" className="composition-reset" disabled={!selected.length} aria-label="Réinitialiser la tenue" title="Réinitialiser" onClick={() => { setSelected([]); setLocked([]); setSuggested([]); setError(""); }}><RotateCcw size={18}/></button></header>
      <div className="composition-assist-bar"><button type="button" className="secondary compact" onClick={() => setShowItemDrawer(true)}><Plus size={16}/> Ajouter des pièces</button><button type="button" className="secondary compact" disabled={!selected.length} onClick={complete}><Sparkles size={16}/> {suggested.length ? "Autre proposition" : "Compléter la tenue"}</button></div>
      {selectedItems.length ? <div className="outfit-vertical-stack">{selectedItems.some(item => ["Haut", "Inter", "Manteau"].includes(item.category)) && <div className="outfit-horizontal-layer">{selectedItems.filter(item => ["Manteau", "Inter", "Haut"].includes(item.category)).map(renderSelectedItem)}</div>}{selectedItems.filter(item => !["Haut", "Inter", "Manteau", "Bas", "Chaussures"].includes(item.category)).map(renderSelectedItem)}{selectedItems.some(item => ["Bas", "Chaussures"].includes(item.category)) && <div className="outfit-horizontal-layer outfit-bottom-layer">{selectedItems.filter(item => ["Bas", "Chaussures"].includes(item.category)).map(renderSelectedItem)}</div>}</div> : <div className="outfit-build-empty"><strong>Glissez vos vêtements ici</strong><span>Les pièces s’empileront automatiquement dans un ordre logique.</span></div>}
      {error && <p className="field-error">{error}</p>}
    </section>
    {showItemDrawer && <div className="modal-backdrop outfit-drawer-backdrop" onMouseDown={() => setShowItemDrawer(false)}><section className="modal outfit-items-modal" onMouseDown={event => event.stopPropagation()}><header><div><span className="eyebrow">Garde-robe</span><h2>Ajouter des pièces</h2></div><button type="button" aria-label="Fermer" onClick={() => setShowItemDrawer(false)}>×</button></header><section className="outfit-item-drawer"><div className="creation-list-heading"><div><p>Filtrez puis cliquez sur une vignette pour l’ajouter.</p></div><div className="compatibility-sort-actions"><button type="button" className={`secondary compact ${sortByCompatibility ? "active" : ""}`} aria-pressed={sortByCompatibility} onClick={() => { setSortByCompatibility(value => !value); setSortByLeastCompatibility(false); }}><ArrowDownWideNarrow size={16}/> Plus compatibles</button><button type="button" className={`secondary compact ${sortByLeastCompatibility ? "active" : ""}`} aria-pressed={sortByLeastCompatibility} onClick={() => { setSortByLeastCompatibility(value => !value); setSortByCompatibility(false); }}><ArrowUpWideNarrow size={16}/> Moins compatibles</button></div></div><div className="outfit-filter-row"><span>Catégorie</span><div className="category-pills outfit-category-pills"><button type="button" className={!category ? "active" : ""} onClick={() => setCategory("")}>Tout</button>{availableCategories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div></div><div className="outfit-filter-row"><span>Saison</span><div className="category-pills outfit-category-pills"><button type="button" className={!season ? "active" : ""} onClick={() => setSeason("")}>Toutes</button>{seasons.map(value => <button type="button" key={value} className={season === value ? "active" : ""} onClick={() => setSeason(value)}>{value}</button>)}</div></div><div className="outfit-drag-items">{availableItems.map(item => <button type="button" key={item._id} onClick={() => addItem(item._id)}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}</button>)}</div>{!availableItems.length && <p className="empty-filter-message">Aucune pièce compatible avec ces filtres.</p>}</section></section></div>}
  </form></>;
}
