import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ChevronRight, CirclePlus, Luggage, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import ClothingCard from "../components/ClothingCard";
import Modal from "../components/Modal";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function Outfits() {
  const [outfits, setOutfits] = useState([]);
  const [clothes, setClothes] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [capsules, setCapsules] = useState([]);
  const [openCapsule, setOpenCapsule] = useState(null);
  const [packedItems, setPackedItems] = useState([]);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [addTarget, setAddTarget] = useState(null);
  const [addingPackingItem, setAddingPackingItem] = useState(false);
  const [packingCategory, setPackingCategory] = useState("");
  const [packingSeason, setPackingSeason] = useState("");
  const load = () => Promise.all([api("/outfits"), api("/clothes"), api("/collections")]).then(([nextOutfits, nextClothes, nextCollections]) => { setOutfits(nextOutfits); setClothes(nextClothes); setCapsules(nextCollections.filter(collection => collection.description === "Capsule bagage")); });

  useEffect(() => { load(); }, []);

  const closeCreator = () => { setOpen(false); setSelected([]); setSelectedSeason(""); setSortByCompatibility(false); };
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const save = async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.clothes = selected;
    body.season = selectedSeason;
    await api("/outfits", { method: "POST", body: JSON.stringify(body) });
    closeCreator(); load();
  };
  const remove = async id => { await api(`/outfits/${id}`, { method: "DELETE" }); load(); };
  const visibleClothes = clothes.filter(item => {
    if (selected.includes(item._id)) return true;
    if (selectedSeason && !item.season?.includes(selectedSeason)) return false;
    if (selected.some(selectedId => clothes.find(candidate => candidate._id === selectedId)?.category === item.category)) return false;
    return selected.every(selectedId => {
      const selectedItem = clothes.find(candidate => candidate._id === selectedId);
      return selectedItem?.compatibleWith?.some(value => (value._id || value) === item._id);
    });
  }).sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : 0);
  const capsuleOutfitIds = new Set(capsules.flatMap(capsule => capsule.outfits.map(outfit => outfit._id || outfit)));
  const standaloneOutfits = outfits.filter(outfit => !capsuleOutfitIds.has(outfit._id));
  const openCapsuleDetail = capsule => { setPackedItems([]); setOpenCapsule(capsule); };
  const replacementCandidates = replaceTarget ? clothes.filter(candidate => {
    if (candidate.category !== replaceTarget.item.category || candidate._id === replaceTarget.item._id) return false;
    return replaceTarget.outfit.clothes.filter(item => item._id !== replaceTarget.item._id).every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const additionCandidates = addTarget ? clothes.filter(candidate => {
    if (addTarget.clothes.some(item => item.category === candidate.category)) return false;
    return addTarget.clothes.every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const packingCandidates = openCapsule ? clothes.filter(candidate => {
    if (openCapsule.clothes.some(item => item._id === candidate._id)) return false;
    if (packingCategory && candidate.category !== packingCategory) return false;
    if (packingSeason && !candidate.season?.includes(packingSeason)) return false;
    return true;
  }) : [];
  const applyCapsuleUpdate = updatedCapsule => {
    setOpenCapsule(updatedCapsule);
    setCapsules(current => current.map(capsule => capsule._id === updatedCapsule._id ? updatedCapsule : capsule));
    setPackedItems([]);
  };
  const replaceCapsuleItem = async replacementId => {
    const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${replaceTarget.outfit._id}/replace`, { method: "PUT", body: JSON.stringify({ itemId: replaceTarget.item._id, replacementId }) });
    applyCapsuleUpdate(updatedCapsule);
    setReplaceTarget(null);
  };
  const addCapsuleItem = async itemId => {
    const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${addTarget._id}/add`, { method: "PUT", body: JSON.stringify({ itemId }) });
    applyCapsuleUpdate(updatedCapsule);
    setAddTarget(null);
  };
  const removeCapsuleItem = async (outfit, item) => {
    if (!window.confirm(`Retirer ${item.name || item.category} de cette tenue ?`)) return;
    const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${outfit._id}/items/${item._id}`, { method: "DELETE" });
    applyCapsuleUpdate(updatedCapsule);
  };
  const removeItemFromCapsule = async item => {
    if (!window.confirm(`Retirer ${item.name || item.category} de toute la capsule et de toutes les tenues ?`)) return;
    const updatedCapsule = await api(`/collections/${openCapsule._id}/items/${item._id}`, { method: "DELETE" });
    applyCapsuleUpdate(updatedCapsule);
  };
  const addItemToPackingList = async itemId => {
    const updatedCapsule = await api(`/collections/${openCapsule._id}/items`, { method: "PUT", body: JSON.stringify({ itemId }) });
    applyCapsuleUpdate(updatedCapsule);
    setAddingPackingItem(false);
  };
  const openPackingSelector = () => {
    setPackingCategory("");
    setPackingSeason("");
    setAddingPackingItem(true);
  };

  return <>
    <header className="page-header"><div><span className="eyebrow">Combinaisons</span><h1>Outfits</h1></div><button className="primary" onClick={() => { setSelected([]); setSelectedSeason(""); setSortByCompatibility(false); setOpen(true); }}><Plus size={18}/> Créer</button></header>
    <div className="outfit-grid">
      {capsules.map(capsule => <article className="outfit-card capsule-card" key={capsule._id} role="button" tabIndex="0" onClick={() => openCapsuleDetail(capsule)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCapsuleDetail(capsule); } }}><div className="outfit-collage">{capsule.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div className="capsule-card-body"><div><span className="capsule-label"><Luggage size={14}/> Capsule bagage</span><h3>{capsule.name}</h3><p>{capsule.outfits.length} tenue{capsule.outfits.length > 1 ? "s" : ""} · {capsule.clothes.length} pièces</p></div><ChevronRight size={22}/></div></article>)}
      {standaloneOutfits.map(outfit => <article className="outfit-card" key={outfit._id}><div className="outfit-collage">{outfit.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div><h3>{outfit.name}</h3><p>{outfit.occasion || "Sans occasion"} · {outfit.clothes.length} pièce(s)</p><button className="danger" onClick={() => remove(outfit._id)}><Trash2 size={16}/> Supprimer</button></div></article>)}
    </div>
    {openCapsule && <Modal title={openCapsule.name} onClose={() => setOpenCapsule(null)}><div className="capsule-detail"><div className="capsule-detail-summary"><Luggage size={20}/><span>{openCapsule.outfits.length} tenue{openCapsule.outfits.length > 1 ? "s" : ""} dans cette capsule</span></div><section className="packing-list"><header><div><span className="eyebrow">Résumé</span><h3>Liste bagages</h3></div><div className="packing-list-controls"><strong>{packedItems.length}/{openCapsule.clothes.length}</strong><button type="button" onClick={openPackingSelector}><CirclePlus size={15}/> Ajouter une pièce</button></div></header><div>{openCapsule.clothes.map(item => <div key={item._id} className={`packing-list-row ${packedItems.includes(item._id) ? "packed" : ""}`}><label><input type="checkbox" checked={packedItems.includes(item._id)} onChange={() => setPackedItems(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}/>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}<span><b>{item.name || item.category}</b><small>{item.category}</small></span></label><button type="button" aria-label={`Retirer ${item.name || item.category} de la capsule`} onClick={() => removeItemFromCapsule(item)}><Trash2 size={14}/></button></div>)}</div></section><div className="capsule-outfits-list">{openCapsule.outfits.map((outfit, index) => <article key={outfit._id}><header><span>Tenue {index + 1}</span><b>{outfit.name}</b><button type="button" className="add-outfit-item" onClick={() => setAddTarget(outfit)}><CirclePlus size={15}/> Ajouter une pièce</button></header><div className="capsule-outfit-items">{outfit.clothes.map(item => <div key={item._id} className="capsule-outfit-item">{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span>{item.category}</span>}<small>{item.name || item.category}</small><div className="capsule-item-actions"><button type="button" aria-label={`Remplacer ${item.name || item.category}`} onClick={() => setReplaceTarget({ outfit, item })}><Pencil size={14}/></button><button type="button" className="remove" aria-label={`Retirer ${item.name || item.category}`} onClick={() => removeCapsuleItem(outfit, item)}><Trash2 size={14}/></button></div></div>)}</div></article>)}</div></div></Modal>}
    {replaceTarget && <Modal title={`Remplacer ${replaceTarget.item.name || replaceTarget.item.category}`} onClose={() => setReplaceTarget(null)}><p>Choisissez une pièce compatible de la catégorie {replaceTarget.item.category}.</p><div className="selector-grid replacement-grid">{replacementCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={replaceCapsuleItem}/>)}</div>{!replacementCandidates.length && <p className="empty-filter-message">Aucune autre pièce compatible disponible.</p>}</Modal>}
    {addTarget && <Modal title="Ajouter une pièce à la tenue" onClose={() => setAddTarget(null)}><p>Choisissez une pièce compatible dans une catégorie absente de cette tenue.</p><div className="selector-grid replacement-grid">{additionCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addCapsuleItem}/>)}</div>{!additionCandidates.length && <p className="empty-filter-message">Aucune pièce compatible à ajouter.</p>}</Modal>}
    {addingPackingItem && <Modal title="Ajouter à la liste bagages" onClose={() => setAddingPackingItem(false)}><p>Choisissez une pièce à emporter, même si elle ne fait partie d’aucune tenue.</p><div className="packing-item-filters"><div><span>Catégories</span><div className="category-pills"><button type="button" className={!packingCategory ? "active" : ""} onClick={() => setPackingCategory("")}>Toutes</button>{categories.map(category => <button type="button" key={category} className={packingCategory === category ? "active" : ""} onClick={() => setPackingCategory(category)}>{category}</button>)}</div></div><div><span>Saisons</span><div className="category-pills"><button type="button" className={!packingSeason ? "active" : ""} onClick={() => setPackingSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={packingSeason === season ? "active" : ""} onClick={() => setPackingSeason(season)}>{season}</button>)}</div></div></div><div className="selector-grid replacement-grid">{packingCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addItemToPackingList}/>)}</div>{!packingCandidates.length && <p className="empty-filter-message">Aucune pièce ne correspond à ces filtres.</p>}</Modal>}
    {open && <Modal title="Créer un outfit" onClose={closeCreator}><form onSubmit={save}>
      <div className="form-grid"><label>Nom<input name="name" required/></label><label>Occasion<input name="occasion" placeholder="Travail, soirée…"/></label></div>
      <div className="outfit-season-filter"><h3>Saison</h3><div className="category-pills" aria-label="Filtrer les vêtements par saison"><button type="button" className={!selectedSeason ? "active" : ""} aria-pressed={!selectedSeason} onClick={() => setSelectedSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={selectedSeason === season ? "active" : ""} aria-pressed={selectedSeason === season} onClick={() => setSelectedSeason(season)}>{season}</button>)}</div></div>
      <div className="outfit-selector-heading"><h3>Sélectionnez les pièces</h3><div><span>{selected.length} sélectionnée{selected.length > 1 ? "s" : ""}</span><button type="button" className={`secondary compact ${sortByCompatibility ? "active" : ""}`} aria-pressed={sortByCompatibility} onClick={() => setSortByCompatibility(value => !value)}><ArrowDownWideNarrow size={16}/> Plus compatibles</button></div></div>
      <div className="selector-grid">{visibleClothes.map(item => <ClothingCard key={item._id} item={item} selectable selected={selected.includes(item._id)} onSelect={toggle}/>)}</div>
      {!visibleClothes.length && <p className="empty-filter-message">Aucun vêtement compatible ne correspond à cette sélection.</p>}
      <button className="primary full-width" disabled={!selected.length}>Enregistrer l’outfit</button>
    </form></Modal>}
  </>;
}
