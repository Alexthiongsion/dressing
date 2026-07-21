import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpWideNarrow, ChevronLeft, ChevronRight, Lock, LockOpen, RefreshCw, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";
import { areCompatible, completeOutfit } from "../utils/outfitSuggestions";
import PageState from "../components/PageState";
import NormalizedClothingImage from "../components/NormalizedClothingImage";

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
  const [itemPage, setItemPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const loadClothes = async signal => {
    setLoading(true);
    setLoadError("");
    try { setClothes(await api("/clothes", { signal })); }
    catch (loadFailure) { if (!signal?.aborted) setLoadError(loadFailure.message || "Impossible de charger la garde-robe."); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    loadClothes(controller.signal);
    return () => controller.abort();
  }, []);

  const selectedItems = selected.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const availableCategories = categories.filter(value => !selectedItems.some(item => item.category === value));
  const availableItems = clothes.filter(item => {
    if (selected.includes(item._id)) return false;
    if (category && item.category !== category) return false;
    if (season && !item.season?.includes(season)) return false;
    if (selectedItems.some(value => value.category === item.category)) return false;
    return selectedItems.every(value => value.compatibleWith?.some(link => (link._id || link) === item._id));
  }).sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : sortByLeastCompatibility ? (a.compatibleWith?.length || 0) - (b.compatibleWith?.length || 0) : 0);
  const itemPageCount = Math.max(1, Math.ceil(availableItems.length / 10));
  const visibleAvailableItems = availableItems.slice(itemPage * 10, itemPage * 10 + 10);
  useEffect(() => { setItemPage(0); }, [category, season, sortByCompatibility, sortByLeastCompatibility]);
  useEffect(() => { setItemPage(current => Math.min(current, itemPageCount - 1)); }, [itemPageCount]);

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
    event.preventDefault(); setSaving(true); setError("");
    const body = { name: `Tenue du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date())}`, occasion: "", clothes: selected, season };
    try {
      await api("/outfits", { method: "POST", body: JSON.stringify(body) });
      navigate("/outfits");
    } catch (saveError) {
      setError(saveError.message || "Impossible de créer la tenue.");
    } finally { setSaving(false); }
  };
  const renderSelectedItem = item => <article className={`outfit-selected-image category-${item.category.toLowerCase()}`} key={item._id}><div className="outfit-selected-visual">{item.imageUrl ? <NormalizedClothingImage item={item} alt={item.name || item.category} proportionate/> : <span/>}<div className="suggestion-item-actions"><button type="button" className={locked.includes(item._id) ? "locked" : ""} aria-label={locked.includes(item._id) ? "Déverrouiller" : "Verrouiller"} title={locked.includes(item._id) ? "Pièce conservée" : "Verrouiller"} onClick={() => setLocked(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}>{locked.includes(item._id) ? <Lock size={15}/> : <LockOpen size={15}/>}</button><button type="button" className="replace-suggestion" aria-label={`Remplacer automatiquement ${item.name || item.category}`} title="Autre pièce compatible" onClick={() => replaceAutomatically(item)}><RefreshCw size={15}/></button><button type="button" aria-label={`Retirer ${item.name || item.category}`} title="Retirer" onClick={() => { setSelected(current => current.filter(id => id !== item._id)); setLocked(current => current.filter(id => id !== item._id)); setSuggested(current => current.filter(id => id !== item._id)); }}><Trash2 size={15}/></button></div>{suggested.includes(item._id) && <i className="suggested-badge"><Sparkles size={12}/> Suggérée</i>}</div></article>;

  if (loading) return <PageState loading title="Chargement de votre garde-robe…"/>;
  if (loadError) return <PageState title="La création de tenue n’est pas disponible" message={loadError} onAction={() => loadClothes()}/>;

  return <><header className="page-header outfit-create-header"><div><span className="eyebrow">Nouvelle combinaison</span><h1>Créer une tenue</h1></div><div className="page-actions"><button type="button" className="secondary" onClick={() => navigate("/outfits")}><ArrowLeft size={18}/> Retour</button><button type="submit" form="outfit-create-form" className="primary" disabled={saving || !selected.length}><Save size={18}/> {saving ? "Création…" : "Créer la tenue"}</button></div></header><form id="outfit-create-form" className="creation-page outfit-builder-page outfit-capsule-builder" onSubmit={save}>
    <section className={`outfit-build-zone ${draggingOver ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDraggingOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingOver(false); }} onDrop={dropItem}>
      <header className="composition-toolbar"><button type="button" className="composition-reset" disabled={!selected.length} aria-label="Réinitialiser la tenue" title="Réinitialiser" onClick={() => { setSelected([]); setLocked([]); setSuggested([]); setError(""); }}><RotateCcw size={18}/></button></header>
      <div className="composition-assist-bar"><button type="button" className="secondary compact" disabled={!selected.length} onClick={complete}><Sparkles size={16}/> {suggested.length ? "Autre proposition" : "Compléter la tenue"}</button></div>
      {selectedItems.length ? <div className="outfit-vertical-stack">{selectedItems.some(item => ["Haut", "Inter", "Manteau"].includes(item.category)) && <div className="outfit-horizontal-layer">{selectedItems.filter(item => ["Manteau", "Inter", "Haut"].includes(item.category)).map(renderSelectedItem)}</div>}{selectedItems.filter(item => !["Haut", "Inter", "Manteau", "Bas", "Chaussures"].includes(item.category)).map(renderSelectedItem)}{selectedItems.some(item => ["Bas", "Chaussures"].includes(item.category)) && <div className="outfit-horizontal-layer outfit-bottom-layer">{selectedItems.filter(item => ["Bas", "Chaussures"].includes(item.category)).map(renderSelectedItem)}</div>}</div> : <div className="outfit-build-empty"><strong>Glissez vos vêtements ici</strong><span>Les pièces s’empileront automatiquement dans un ordre logique.</span></div>}
      {error && <p className="field-error">{error}</p>}
    </section>
    <section className="outfit-capsule-library completion-library-minimal"><div className="completion-filter-groups"><div className="outfit-filter-row"><span>Catégorie</span><div className="category-pills outfit-category-pills"><button type="button" className={!category ? "active" : ""} aria-pressed={!category} onClick={() => setCategory("")}>Tout</button>{availableCategories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div></div><div className="outfit-filter-row"><span>Saison</span><div className="category-pills outfit-category-pills"><button type="button" className={!season ? "active" : ""} aria-pressed={!season} onClick={() => setSeason("")}>Toutes</button>{seasons.map(value => <button type="button" key={value} className={season === value ? "active" : ""} aria-pressed={season === value} onClick={() => setSeason(value)}>{value}</button>)}</div></div><div className="suggestion-sort"><button type="button" className={sortByCompatibility ? "active" : ""} aria-pressed={sortByCompatibility} onClick={() => { setSortByCompatibility(value => !value); setSortByLeastCompatibility(false); }}><ArrowDownWideNarrow size={15}/> Plus compatibles</button><button type="button" className={sortByLeastCompatibility ? "active" : ""} aria-pressed={sortByLeastCompatibility} onClick={() => { setSortByLeastCompatibility(value => !value); setSortByCompatibility(false); }}><ArrowUpWideNarrow size={15}/> Moins compatibles</button></div></div><div className="outfit-available-grid">{visibleAvailableItems.map(item => <button type="button" draggable key={item._id} className="suggestion-tile" aria-label={`Ajouter ${item.name || item.category}`} title={item.name || item.category} onClick={() => addItem(item._id)} onDragStart={event => { event.dataTransfer.setData("text/plain", item._id); event.dataTransfer.effectAllowed = "copy"; }}>{item.imageUrl ? <NormalizedClothingImage item={item}/> : <span/>}</button>)}{!availableItems.length && <p className="empty-filter-message">Aucune pièce compatible avec ces filtres.</p>}</div>{itemPageCount > 1 && <nav className="completion-pagination" aria-label="Pages de vêtements"><button type="button" aria-label="Page précédente" onClick={() => setItemPage(value => (value - 1 + itemPageCount) % itemPageCount)}><ChevronLeft size={18}/></button><span>{itemPage + 1} / {itemPageCount}</span><button type="button" aria-label="Page suivante" onClick={() => setItemPage(value => (value + 1) % itemPageCount)}><ChevronRight size={18}/></button></nav>}</section>
  </form></>;
}
