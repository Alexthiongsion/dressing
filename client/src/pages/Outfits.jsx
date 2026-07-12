import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ChevronRight, CirclePlus, Luggage, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../services/api";
import ClothingCard from "../components/ClothingCard";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { useNavigate } from "react-router";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function Outfits({ capsulesOnly = false }) {
  const navigate = useNavigate();
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
  const [openOutfit, setOpenOutfit] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [capsuleRating, setCapsuleRating] = useState(0);
  const [capsuleReviewSaving, setCapsuleReviewSaving] = useState(false);
  const [reviewCapsule, setReviewCapsule] = useState(null);
  const [draggedPackingItem, setDraggedPackingItem] = useState(null);
  const [dropTargetOutfit, setDropTargetOutfit] = useState(null);
  const [capsuleActionError, setCapsuleActionError] = useState("");
  const [editingOutfitId, setEditingOutfitId] = useState(null);
  const [editingOutfitName, setEditingOutfitName] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [creatingCapsuleOutfit, setCreatingCapsuleOutfit] = useState(false);
  const [newCapsuleOutfitItems, setNewCapsuleOutfitItems] = useState([]);
  const [draggedOutfitItem, setDraggedOutfitItem] = useState(null);
  const [reorderTargetItem, setReorderTargetItem] = useState(null);
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
  const standaloneOutfits = outfits;
  const openCapsuleDetail = capsule => { setPackedItems([]); setCapsuleRating(capsule.rating || 0); setCapsuleActionError(""); setOpenCapsule(capsule); };
  const replacementCandidates = replaceTarget ? clothes.filter(candidate => {
    if (candidate.category !== replaceTarget.item.category || candidate._id === replaceTarget.item._id) return false;
    return replaceTarget.outfit.clothes.filter(item => item._id !== replaceTarget.item._id).every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const additionCandidates = addTarget ? clothes.filter(candidate => {
    if (addTarget.clothes.some(item => item.category === candidate.category)) return false;
    return addTarget.clothes.every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const newOutfitCandidates = clothes.filter(candidate => {
    if (newCapsuleOutfitItems.includes(candidate._id)) return true;
    if (newCapsuleOutfitItems.some(id => clothes.find(item => item._id === id)?.category === candidate.category)) return false;
    return newCapsuleOutfitItems.every(id => clothes.find(item => item._id === id)?.compatibleWith?.some(value => (value._id || value) === candidate._id));
  });
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
    const added = await addItemToOutfit(addTarget._id, itemId);
    if (added) setAddTarget(null);
  };
  const addItemToOutfit = async (outfitId, itemId) => {
    setCapsuleActionError("");
    try {
      const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${outfitId}/add`, { method: "PUT", body: JSON.stringify({ itemId }) });
      applyCapsuleUpdate(updatedCapsule);
      return true;
    } catch (error) {
      setCapsuleActionError(error.message);
      return false;
    }
  };
  const dropPackingItem = async (event, outfitId) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggedPackingItem;
    setDropTargetOutfit(null);
    setDraggedPackingItem(null);
    if (itemId) await addItemToOutfit(outfitId, itemId);
  };
  const startOutfitNameEdit = outfit => {
    setEditingOutfitId(outfit._id);
    setEditingOutfitName(outfit.name);
  };
  const saveInlineOutfitName = async outfit => {
    const name = editingOutfitName.trim();
    setEditingOutfitId(null);
    if (!name || name === outfit.name) return;
    const updated = await api(`/outfits/${outfit._id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setOutfits(current => current.map(item => item._id === updated._id ? updated : item));
    setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(item => item._id === updated._id ? updated : item) })));
    if (openCapsule) setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(item => item._id === updated._id ? updated : item) }));
  };
  const removeCapsuleItem = async (outfit, item) => {
    setConfirmDialog({ title: "Retirer cette pièce ?", message: `${item.name || item.category} sera retiré uniquement de la tenue « ${outfit.name} ».`, label: "Retirer la pièce", action: async () => applyCapsuleUpdate(await api(`/collections/${openCapsule._id}/outfits/${outfit._id}/items/${item._id}`, { method: "DELETE" })) });
  };
  const removeItemFromCapsule = async item => {
    setConfirmDialog({ title: "Retirer de toute la capsule ?", message: `${item.name || item.category} sera supprimé de la liste bagages et de toutes les tenues qui l’utilisent.`, label: "Retirer de la capsule", action: async () => applyCapsuleUpdate(await api(`/collections/${openCapsule._id}/items/${item._id}`, { method: "DELETE" })) });
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
  const openOutfitReview = outfit => {
    setReviewRating(outfit.rating || 0);
    setOpenOutfit(outfit);
  };
  const saveOutfitReview = async event => {
    event.preventDefault();
    setReviewSaving(true);
    const form = new FormData(event.currentTarget);
    const notes = form.get("notes");
    const name = form.get("name")?.trim();
    try {
      const updated = await api(`/outfits/${openOutfit._id}`, { method: "PUT", body: JSON.stringify({ name, rating: reviewRating, notes }) });
      setOutfits(current => current.map(outfit => outfit._id === updated._id ? updated : outfit));
      setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(outfit => outfit._id === updated._id ? updated : outfit) })));
      if (openCapsule) setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(outfit => outfit._id === updated._id ? updated : outfit) }));
      setOpenOutfit(null);
    } finally { setReviewSaving(false); }
  };
  const saveCapsuleReview = async event => {
    event.preventDefault();
    setCapsuleReviewSaving(true);
    const notes = new FormData(event.currentTarget).get("notes");
    try {
      const updated = await api(`/collections/${reviewCapsule._id}`, { method: "PUT", body: JSON.stringify({ rating: capsuleRating, notes }) });
      if (openCapsule?._id === updated._id) setOpenCapsule(updated);
      setCapsules(current => current.map(capsule => capsule._id === updated._id ? updated : capsule));
      setReviewCapsule(null);
    } finally { setCapsuleReviewSaving(false); }
  };
  const openCapsuleReview = capsule => { setCapsuleRating(capsule.rating || 0); setReviewCapsule(capsule); };
  const confirmCurrentAction = async () => {
    setConfirmLoading(true);
    try { await confirmDialog.action(); setConfirmDialog(null); }
    finally { setConfirmLoading(false); }
  };
  const removeCapsuleOutfit = outfit => setConfirmDialog({ title: "Supprimer cette tenue ?", message: `La tenue « ${outfit.name} » sera supprimée de la capsule. Les pièces utilisées ailleurs resteront dans les bagages.`, label: "Supprimer la tenue", action: async () => applyCapsuleUpdate(await api(`/collections/${openCapsule._id}/outfits/${outfit._id}`, { method: "DELETE" })) });
  const toggleNewOutfitItem = id => setNewCapsuleOutfitItems(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const createOutfitInCapsule = async event => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    const updated = await api(`/collections/${openCapsule._id}/outfits`, { method: "POST", body: JSON.stringify({ name, clothes: newCapsuleOutfitItems }) });
    applyCapsuleUpdate(updated);
    setCreatingCapsuleOutfit(false);
    setNewCapsuleOutfitItems([]);
  };
  const reorderOutfitItems = async (event, outfit, targetItemId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggedOutfitItem || draggedOutfitItem.outfitId !== outfit._id || draggedOutfitItem.itemId === targetItemId) {
      setReorderTargetItem(null);
      return;
    }
    const orderedIds = outfit.clothes.map(item => item._id);
    const fromIndex = orderedIds.indexOf(draggedOutfitItem.itemId);
    const targetIndex = orderedIds.indexOf(targetItemId);
    [orderedIds[fromIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[fromIndex]];
    const updated = await api(`/outfits/${outfit._id}`, { method: "PUT", body: JSON.stringify({ clothes: orderedIds }) });
    setOutfits(current => current.map(item => item._id === updated._id ? updated : item));
    setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(item => item._id === updated._id ? updated : item) })));
    setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(item => item._id === updated._id ? updated : item) }));
    setDraggedOutfitItem(null);
    setReorderTargetItem(null);
  };

  return <>
    <header className="page-header"><div><span className="eyebrow">{capsulesOnly ? "Voyages" : "Combinaisons"}</span><h1>{capsulesOnly ? "Capsules bagage" : "Outfits"}</h1></div>{capsulesOnly ? <button className="primary" onClick={() => navigate("/capsules/new")}><Plus size={18}/> Créer</button> : <div className="page-actions"><button className="secondary" onClick={() => navigate("/outfits/new/multiple")}><Plus size={18}/> Plusieurs tenues</button><button className="primary" onClick={() => navigate("/outfits/new")}><Plus size={18}/> Une tenue</button></div>}</header>
    <div className="outfit-grid">
      {capsulesOnly && capsules.map(capsule => <article className="outfit-card capsule-card" key={capsule._id} role="button" tabIndex="0" onClick={() => openCapsuleDetail(capsule)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCapsuleDetail(capsule); } }}><div className="outfit-collage">{capsule.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div className="capsule-card-body"><div><span className="capsule-label"><Luggage size={14}/> Capsule bagage</span><h3>{capsule.name}</h3><p>{capsule.outfits.length} tenue{capsule.outfits.length > 1 ? "s" : ""} · {capsule.clothes.length} pièces</p></div><div className="capsule-card-rating"><button type="button" className={capsule.rating ? "rated" : ""} aria-label="Noter la capsule" onClick={event => { event.stopPropagation(); openCapsuleReview(capsule); }}><Star size={16} fill={capsule.rating ? "currentColor" : "none"}/>{capsule.rating || "Noter"}</button><ChevronRight size={22}/></div></div></article>)}
      {!capsulesOnly && standaloneOutfits.map(outfit => <article className="outfit-card reviewable" key={outfit._id} role="button" tabIndex="0" onClick={() => openOutfitReview(outfit)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") openOutfitReview(outfit); }}><div className="outfit-collage">{outfit.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div><div className="outfit-card-title"><h3>{outfit.name}</h3><span className={outfit.rating ? "rated" : ""}><Star size={16} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "–"}</span></div><p>{outfit.occasion || "Sans occasion"} · {outfit.clothes.length} pièce(s)</p><button className="danger" onClick={event => { event.stopPropagation(); remove(outfit._id); }}><Trash2 size={16}/> Supprimer</button></div></article>)}
    </div>
    {openCapsule && <Modal title={openCapsule.name} onClose={() => setOpenCapsule(null)}><div className="capsule-detail"><div className="capsule-detail-summary"><Luggage size={20}/><span>{openCapsule.outfits.length} tenue{openCapsule.outfits.length > 1 ? "s" : ""} dans cette capsule</span><button type="button" onClick={() => { setNewCapsuleOutfitItems([]); setCreatingCapsuleOutfit(true); }}><CirclePlus size={16}/> Ajouter une tenue</button></div>{capsuleActionError && <p className="capsule-action-error">{capsuleActionError}</p>}<section className="packing-list"><header><div><span className="eyebrow">Résumé</span><h3>Liste bagages</h3></div><div className="packing-list-controls"><strong>{packedItems.length}/{openCapsule.clothes.length}</strong><button type="button" onClick={openPackingSelector}><CirclePlus size={15}/> Ajouter une pièce</button></div></header><div>{openCapsule.clothes.map(item => <div key={item._id} draggable onDragStart={event => { setDraggedPackingItem(item._id); setCapsuleActionError(""); event.dataTransfer.setData("text/plain", item._id); event.dataTransfer.effectAllowed = "copy"; }} onDragEnd={() => { setDraggedPackingItem(null); setDropTargetOutfit(null); }} className={`packing-list-row draggable ${packedItems.includes(item._id) ? "packed" : ""}`}><label><input type="checkbox" checked={packedItems.includes(item._id)} onChange={() => setPackedItems(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}/>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}<span><b>{item.name || item.category}</b><small>{item.category}</small></span></label><button type="button" aria-label={`Retirer ${item.name || item.category} de la capsule`} onClick={() => removeItemFromCapsule(item)}><Trash2 size={14}/></button></div>)}</div></section><div className="capsule-outfits-list">{openCapsule.outfits.map(outfit => <article key={outfit._id} className={dropTargetOutfit === outfit._id ? "drop-active" : ""} onDragOver={event => { if (!draggedOutfitItem) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDropTargetOutfit(outfit._id); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetOutfit(null); }} onDrop={event => { if (!draggedOutfitItem) dropPackingItem(event, outfit._id); }}><header>{editingOutfitId === outfit._id ? <input className="inline-outfit-name" value={editingOutfitName} autoFocus onChange={event => setEditingOutfitName(event.target.value)} onBlur={() => saveInlineOutfitName(outfit)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { setEditingOutfitId(null); } }}/> : <button type="button" className="editable-outfit-name" title="Cliquer pour renommer" onClick={() => startOutfitNameEdit(outfit)}>{outfit.name}<Pencil size={14}/></button>}<button type="button" className={`capsule-rating ${outfit.rating ? "rated" : ""}`} onClick={() => openOutfitReview(outfit)}><Star size={15} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "Noter"}</button><button type="button" className="add-outfit-item" onClick={() => setAddTarget(outfit)}><CirclePlus size={15}/> Ajouter une pièce</button><button type="button" className="delete-capsule-outfit" onClick={() => removeCapsuleOutfit(outfit)}><Trash2 size={15}/> Supprimer</button></header><div className="capsule-outfit-items">{outfit.clothes.map(item => <div key={item._id} draggable onDragStart={event => { event.stopPropagation(); setDraggedOutfitItem({ outfitId: outfit._id, itemId: item._id }); event.dataTransfer.setData("application/x-outfit-item", item._id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={event => { if (draggedOutfitItem?.outfitId === outfit._id) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setReorderTargetItem(`${outfit._id}:${item._id}`); } }} onDrop={event => reorderOutfitItems(event, outfit, item._id)} onDragEnd={() => { setDraggedOutfitItem(null); setReorderTargetItem(null); }} className={`capsule-outfit-item reorderable ${reorderTargetItem === `${outfit._id}:${item._id}` ? "reorder-target" : ""}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span>{item.category}</span>}<small>{item.name || item.category}</small><div className="capsule-item-actions"><button type="button" aria-label={`Remplacer ${item.name || item.category}`} onClick={() => setReplaceTarget({ outfit, item })}><Pencil size={14}/></button><button type="button" className="remove" aria-label={`Retirer ${item.name || item.category}`} onClick={() => removeCapsuleItem(outfit, item)}><Trash2 size={14}/></button></div></div>)}</div></article>)}</div></div></Modal>}
    {replaceTarget && <Modal title={`Remplacer ${replaceTarget.item.name || replaceTarget.item.category}`} onClose={() => setReplaceTarget(null)}><p>Choisissez une pièce compatible de la catégorie {replaceTarget.item.category}.</p><div className="selector-grid replacement-grid">{replacementCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={replaceCapsuleItem}/>)}</div>{!replacementCandidates.length && <p className="empty-filter-message">Aucune autre pièce compatible disponible.</p>}</Modal>}
    {addTarget && <Modal title="Ajouter une pièce à la tenue" onClose={() => setAddTarget(null)}><p>Choisissez une pièce compatible dans une catégorie absente de cette tenue.</p><div className="selector-grid replacement-grid">{additionCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addCapsuleItem}/>)}</div>{!additionCandidates.length && <p className="empty-filter-message">Aucune pièce compatible à ajouter.</p>}</Modal>}
    {addingPackingItem && <Modal title="Ajouter à la liste bagages" onClose={() => setAddingPackingItem(false)}><p>Choisissez une pièce à emporter, même si elle ne fait partie d’aucune tenue.</p><div className="packing-item-filters"><div><span>Catégories</span><div className="category-pills"><button type="button" className={!packingCategory ? "active" : ""} onClick={() => setPackingCategory("")}>Toutes</button>{categories.map(category => <button type="button" key={category} className={packingCategory === category ? "active" : ""} onClick={() => setPackingCategory(category)}>{category}</button>)}</div></div><div><span>Saisons</span><div className="category-pills"><button type="button" className={!packingSeason ? "active" : ""} onClick={() => setPackingSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={packingSeason === season ? "active" : ""} onClick={() => setPackingSeason(season)}>{season}</button>)}</div></div></div><div className="selector-grid replacement-grid">{packingCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addItemToPackingList}/>)}</div>{!packingCandidates.length && <p className="empty-filter-message">Aucune pièce ne correspond à ces filtres.</p>}</Modal>}
    {openOutfit && <Modal title={openOutfit.name} onClose={() => setOpenOutfit(null)}><form className="outfit-review" onSubmit={saveOutfitReview}><label>Nom de la tenue<input name="name" required defaultValue={openOutfit.name} placeholder="Ex. Dîner en ville"/></label><div className="outfit-review-items">{openOutfit.clothes.map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<small>{item.name || item.category}</small></div>)}</div><fieldset><legend>Votre note</legend><div className="rating-stars" aria-label={`Note : ${reviewRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setReviewRating(value)}><Star size={27} fill={value <= reviewRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour d’expérience<textarea name="notes" rows="6" defaultValue={openOutfit.notes} placeholder="Confort, associations, occasion, améliorations…"/></label><button className="primary" disabled={reviewSaving}>{reviewSaving ? "Enregistrement…" : "Enregistrer les modifications"}</button></form></Modal>}
    {reviewCapsule && <Modal title={`Noter ${reviewCapsule.name}`} onClose={() => setReviewCapsule(null)}><form className="outfit-review" onSubmit={saveCapsuleReview}><fieldset><legend>Note globale de la capsule</legend><div className="rating-stars" aria-label={`Note : ${capsuleRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setCapsuleRating(value)}><Star size={27} fill={value <= capsuleRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour sur la capsule<textarea name="notes" rows="6" defaultValue={reviewCapsule.notes} placeholder="Variété, efficacité, pièces manquantes, bilan du voyage…"/></label><button className="primary" disabled={capsuleReviewSaving}>{capsuleReviewSaving ? "Enregistrement…" : "Enregistrer la note"}</button></form></Modal>}
    {creatingCapsuleOutfit && <Modal title="Ajouter une tenue à la capsule" onClose={() => setCreatingCapsuleOutfit(false)}><form className="stack" onSubmit={createOutfitInCapsule}><label>Nom de la tenue<input name="name" required autoFocus placeholder="Ex. Balade en ville"/></label><p>Sélectionnez des pièces compatibles. Une seule pièce par catégorie peut être choisie.</p><div className="selector-grid replacement-grid">{newOutfitCandidates.map(item => <ClothingCard key={item._id} item={item} selectable selected={newCapsuleOutfitItems.includes(item._id)} onSelect={toggleNewOutfitItem}/>)}</div><button className="primary" disabled={!newCapsuleOutfitItems.length}><CirclePlus size={17}/> Ajouter la tenue</button></form></Modal>}
    {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.label} loading={confirmLoading} onClose={() => setConfirmDialog(null)} onConfirm={confirmCurrentAction}/>}
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
