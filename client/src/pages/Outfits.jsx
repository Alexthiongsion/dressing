import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, ChevronRight, CirclePlus, Luggage, MoreHorizontal, Pencil, Plus, Shirt, Sparkles, Star, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { fetchItineraryWeather } from "../services/travelWeather";
import ClothingCard from "../components/ClothingCard";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import PageState from "../components/PageState";
import { useNavigate, useParams } from "react-router";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const capsuleOutfitLabel = name => name?.match(/(?:^| · )(Tenue \d+)$/)?.[1] || name;

export default function Outfits({ capsulesOnly = false }) {
  const navigate = useNavigate();
  const { capsuleId } = useParams();
  const [outfits, setOutfits] = useState([]);
  const [clothes, setClothes] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [capsules, setCapsules] = useState([]);
  const [openCapsule, setOpenCapsule] = useState(null);
  const [capsuleDetailTab, setCapsuleDetailTab] = useState("outfits");
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
  const [editingCapsuleId, setEditingCapsuleId] = useState(null);
  const [editingCapsuleName, setEditingCapsuleName] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [creatingCapsuleOutfit, setCreatingCapsuleOutfit] = useState(false);
  const [newCapsuleOutfitItems, setNewCapsuleOutfitItems] = useState([]);
  const [draggedOutfitItem, setDraggedOutfitItem] = useState(null);
  const [reorderTargetItem, setReorderTargetItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const load = async () => {
    setLoadError("");
    try {
      const [nextOutfits, nextClothes, nextCollections] = await Promise.all([api("/outfits"), api("/clothes"), api("/collections")]);
      setOutfits(nextOutfits);
      setClothes(nextClothes);
      setCapsules(nextCollections.filter(collection => collection.description === "Capsule bagage"));
    } catch (error) {
      setLoadError(error.message || "Impossible de charger vos données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!capsuleId || openCapsule?._id === capsuleId) return;
    const capsule = capsules.find(item => item._id === capsuleId);
    if (capsule) openCapsuleDetail(capsule);
  }, [capsuleId, capsules, openCapsule]);

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
  const openCapsuleDetail = async capsule => {
    if (capsulesOnly && !capsuleId) { navigate(`/capsules/${capsule._id}`); return; }
    setPackedItems([]); setCapsuleDetailTab("outfits"); setCapsuleRating(capsule.rating || 0); setCapsuleActionError(""); setOpenCapsule(capsule);
    const destinations = capsule.travel?.destinations?.length ? capsule.travel.destinations : [capsule.travel];
    if (!destinations.some(destination => destination?.latitude != null && destination?.startDate)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (destinations.every(destination => destination?.endDate && destination.endDate < today)) return;
    const refreshDelay = capsule.weather?.type === "seasonal" ? 12 : 3;
    const stale = !capsule.weather?.updatedAt || Date.now() - new Date(capsule.weather.updatedAt).getTime() > refreshDelay * 60 * 60 * 1000;
    if (!stale) return;
    try {
      const weather = await fetchItineraryWeather({ destinations });
      const updated = await api(`/collections/${capsule._id}`, { method: "PUT", body: JSON.stringify({ weather }) });
      setOpenCapsule(updated); setCapsules(current => current.map(item => item._id === updated._id ? updated : item));
    } catch {
      // Le rafraîchissement est une tâche de fond : la capsule reste utilisable
      // et conserve sa dernière météo connue si le fournisseur est indisponible.
    }
  };
  const replacementCandidates = replaceTarget ? clothes.filter(candidate => {
    if (candidate.category !== replaceTarget.item.category || candidate._id === replaceTarget.item._id) return false;
    return replaceTarget.outfit.clothes.filter(item => item._id !== replaceTarget.item._id).every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const additionCandidates = addTarget ? clothes.filter(candidate => {
    if (addTarget.clothes.some(item => item.category === candidate.category)) return false;
    return addTarget.clothes.every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const capsuleClothes = openCapsule?.clothes || [];
  const newOutfitCandidates = capsuleClothes.filter(candidate => {
    if (newCapsuleOutfitItems.includes(candidate._id)) return true;
    if (newCapsuleOutfitItems.some(id => capsuleClothes.find(item => item._id === id)?.category === candidate.category)) return false;
    return newCapsuleOutfitItems.every(id => capsuleClothes.find(item => item._id === id)?.compatibleWith?.some(value => (value._id || value) === candidate._id));
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
    setEditingOutfitName(openCapsule ? capsuleOutfitLabel(outfit.name) : outfit.name);
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
  const startCapsuleNameEdit = capsule => {
    setEditingCapsuleId(capsule._id);
    setEditingCapsuleName(capsule.name);
  };
  const saveInlineCapsuleName = async capsule => {
    const name = editingCapsuleName.trim();
    setEditingCapsuleId(null);
    if (!name || name === capsule.name) return;
    const updated = await api(`/collections/${capsule._id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setCapsules(current => current.map(item => item._id === updated._id ? updated : item));
    if (openCapsule?._id === updated._id) setOpenCapsule(updated);
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
  const removeCapsule = capsule => setConfirmDialog({
    title: "Supprimer cette capsule ?",
    message: `La capsule « ${capsule.name} » et ses ${capsule.outfits.length} tenue${capsule.outfits.length > 1 ? "s" : ""} internes seront définitivement supprimées. Vos vêtements resteront dans la garde-robe.`,
    label: "Supprimer la capsule",
    action: async () => {
      await api(`/collections/${capsule._id}?confirm=capsule`, { method: "DELETE" });
      setCapsules(current => current.filter(item => item._id !== capsule._id));
      if (openCapsule?._id === capsule._id) setOpenCapsule(null);
    }
  });
  const toggleNewOutfitItem = id => setNewCapsuleOutfitItems(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const createOutfitInCapsule = async event => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name")?.trim();
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
    {!capsuleId && <header className="page-header"><h1>{capsulesOnly ? "Capsules bagage" : "Outfits"}</h1>{capsulesOnly ? <button className="primary" onClick={() => navigate("/capsules/new")}><Plus size={18}/> Créer</button> : <details className="create-menu"><summary><Plus size={18}/> Créer</summary><div><button type="button" onClick={() => navigate("/outfits/new")}><Plus size={17}/> Une tenue</button><button type="button" onClick={() => navigate("/outfits/assist")}><Sparkles size={17}/> Tenue assistée</button><button type="button" onClick={() => navigate("/outfits/new/multiple")}><Plus size={17}/> Plusieurs tenues</button></div></details>}</header>}
    {!capsuleId && loading && <PageState loading title={capsulesOnly ? "Chargement des capsules…" : "Chargement des tenues…"}/>}
    {!capsuleId && !loading && loadError && <PageState title="Le contenu n’a pas pu être chargé" message="Vos données sont intactes. Réessayez dans un instant." onAction={() => { setLoading(true); load(); }}/>}
    {!capsuleId && !loading && !loadError && ((capsulesOnly && capsules.length === 0) || (!capsulesOnly && standaloneOutfits.length === 0)) && <PageState title={capsulesOnly ? "Aucune capsule" : "Aucune tenue"} message={capsulesOnly ? "Préparez votre première capsule pour un voyage." : "Créez une tenue à partir des pièces de votre garde-robe."} actionLabel={capsulesOnly ? "Créer une capsule" : "Créer une tenue"} actionIcon={Plus} onAction={() => navigate(capsulesOnly ? "/capsules/new" : "/outfits/new")}/>}
    {!capsuleId && !loading && !loadError && <div className={`outfit-grid ${!capsulesOnly ? "outfit-page-grid" : ""}`}>
      {capsulesOnly && capsules.map(capsule => <article className="outfit-card reviewable capsule-card" key={capsule._id} role="button" tabIndex="0" onClick={() => openCapsuleDetail(capsule)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCapsuleDetail(capsule); } }}><div className="outfit-collage">{capsule.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div className="outfit-card-footer"><div className="outfit-card-name">{editingCapsuleId === capsule._id ? <input value={editingCapsuleName} autoFocus aria-label="Nom de la capsule" onClick={event => event.stopPropagation()} onChange={event => setEditingCapsuleName(event.target.value)} onBlur={() => saveInlineCapsuleName(capsule)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingCapsuleId(null); }}/> : <><h3>{capsule.name}</h3><button type="button" aria-label={`Renommer ${capsule.name}`} title="Renommer" onClick={event => { event.stopPropagation(); startCapsuleNameEdit(capsule); }}><Pencil size={15}/></button></>}</div><div className="outfit-card-meta"><button type="button" className={capsule.rating ? "rated" : ""} aria-label="Noter la capsule" title="Note" onClick={event => { event.stopPropagation(); openCapsuleReview(capsule); }}><Star size={16} fill={capsule.rating ? "currentColor" : "none"}/>{capsule.rating || "–"}</button><span title={`${capsule.outfits.length} tenues`}><Luggage size={16}/>{capsule.outfits.length}</span><span title={`${capsule.clothes.length} pièces`}><Shirt size={16}/>{capsule.clothes.length}</span><button type="button" className="outfit-card-delete" aria-label={`Supprimer la capsule ${capsule.name}`} title="Supprimer" onClick={event => { event.stopPropagation(); removeCapsule(capsule); }}><Trash2 size={16}/></button><ChevronRight size={20}/></div></div></article>)}
      {!capsulesOnly && standaloneOutfits.map(outfit => <article className="outfit-card reviewable" key={outfit._id} role="button" tabIndex="0" onClick={() => openOutfitReview(outfit)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") openOutfitReview(outfit); }}><div className="outfit-collage">{outfit.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div className="outfit-card-footer"><div className="outfit-card-name">{editingOutfitId === outfit._id ? <input value={editingOutfitName} autoFocus aria-label="Nom de l’outfit" onClick={event => event.stopPropagation()} onChange={event => setEditingOutfitName(event.target.value)} onBlur={() => saveInlineOutfitName(outfit)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingOutfitId(null); }}/> : <><h3>{outfit.name}</h3><button type="button" aria-label={`Renommer ${outfit.name}`} title="Renommer" onClick={event => { event.stopPropagation(); startOutfitNameEdit(outfit); }}><Pencil size={15}/></button></>}</div><div className="outfit-card-meta"><span className={outfit.rating ? "rated" : ""} title="Note"><Star size={16} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "–"}</span><span title={`${outfit.clothes.length} pièces`}><Shirt size={16}/>{outfit.clothes.length}</span><button type="button" className="outfit-card-delete" aria-label={`Supprimer ${outfit.name}`} title="Supprimer" onClick={event => { event.stopPropagation(); remove(outfit._id); }}><Trash2 size={16}/></button></div></div></article>)}
    </div>}
    {openCapsule && <Modal title={openCapsule.name} onClose={() => setOpenCapsule(null)}>
      <div className="capsule-detail capsule-detail-tabbed">
        <div className="capsule-detail-summary">
          <div><strong>{openCapsule.outfits.length}</strong><span>Tenues</span></div>
          <div><strong>{openCapsule.clothes.length}</strong><span>Pièces</span></div>
          <button type="button" onClick={() => { setNewCapsuleOutfitItems([]); setCreatingCapsuleOutfit(true); }}><CirclePlus size={16}/> Ajouter une tenue</button>
        </div>
        {capsuleActionError && <p className="capsule-action-error">{capsuleActionError}</p>}
        <nav className="capsule-detail-tabs" aria-label="Contenu de la capsule">
          <button type="button" className={capsuleDetailTab === "outfits" ? "active" : ""} aria-pressed={capsuleDetailTab === "outfits"} onClick={() => setCapsuleDetailTab("outfits")}>Tenues <span>{openCapsule.outfits.length}</span></button>
          <button type="button" className={capsuleDetailTab === "packing" ? "active" : ""} aria-pressed={capsuleDetailTab === "packing"} onClick={() => setCapsuleDetailTab("packing")}>Bagages <span>{openCapsule.clothes.length}</span></button>
        </nav>
        <div className="capsule-detail-content">
          {capsuleDetailTab === "packing" ? <section className="packing-list packing-list-tab">
            <header><div><h3>Liste bagages</h3><p>Cochez les pièces déjà placées dans la valise.</p></div><div className="packing-list-controls"><strong>{packedItems.length}/{openCapsule.clothes.length}</strong><button type="button" onClick={openPackingSelector}><CirclePlus size={15}/> Ajouter une pièce</button></div></header>
            <div>{openCapsule.clothes.map(item => <div key={item._id} className={`packing-list-row ${packedItems.includes(item._id) ? "packed" : ""}`}><label><input type="checkbox" checked={packedItems.includes(item._id)} onChange={() => setPackedItems(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}/>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}<span><b>{item.name || item.category}</b><small>{item.category}</small></span></label><button type="button" aria-label={`Retirer ${item.name || item.category} de la capsule`} onClick={() => removeItemFromCapsule(item)}><Trash2 size={14}/></button></div>)}</div>
          </section> : <div className="capsule-outfits-list capsule-outfits-rows">
            {openCapsule.outfits.map(outfit => <article key={outfit._id} className={dropTargetOutfit === outfit._id ? "drop-active" : ""} onDragOver={event => { if (!draggedOutfitItem) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDropTargetOutfit(outfit._id); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetOutfit(null); }} onDrop={event => { if (!draggedOutfitItem) dropPackingItem(event, outfit._id); }}>
              <header className="capsule-outfit-row-header">
                {editingOutfitId === outfit._id ? <input className="inline-outfit-name" value={editingOutfitName} autoFocus onChange={event => setEditingOutfitName(event.target.value)} onBlur={() => saveInlineOutfitName(outfit)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingOutfitId(null); }}/> : <button type="button" className="editable-outfit-name" title="Cliquer pour renommer" onClick={() => startOutfitNameEdit(outfit)}>{capsuleOutfitLabel(outfit.name)}<Pencil size={14}/></button>}
                <button type="button" className={`capsule-rating ${outfit.rating ? "rated" : ""}`} onClick={() => openOutfitReview(outfit)} aria-label={`Noter ${capsuleOutfitLabel(outfit.name)}`}><Star size={15} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "–"}</button>
              </header>
              <div className="capsule-outfit-items">{outfit.clothes.map(item => <div key={item._id} draggable onDragStart={event => { event.stopPropagation(); setDraggedOutfitItem({ outfitId: outfit._id, itemId: item._id }); event.dataTransfer.setData("application/x-outfit-item", item._id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={event => { if (draggedOutfitItem?.outfitId === outfit._id) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setReorderTargetItem(`${outfit._id}:${item._id}`); } }} onDrop={event => reorderOutfitItems(event, outfit, item._id)} onDragEnd={() => { setDraggedOutfitItem(null); setReorderTargetItem(null); }} className={`capsule-outfit-item reorderable ${reorderTargetItem === `${outfit._id}:${item._id}` ? "reorder-target" : ""}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span>{item.category}</span>}<small>{item.category}</small><div className="capsule-item-actions"><button type="button" aria-label={`Remplacer ${item.name || item.category}`} onClick={() => setReplaceTarget({ outfit, item })}><Pencil size={14}/></button><button type="button" className="remove" aria-label={`Retirer ${item.name || item.category}`} onClick={() => removeCapsuleItem(outfit, item)}><Trash2 size={14}/></button></div></div>)}</div>
              <details className="capsule-outfit-menu"><summary aria-label={`Actions pour ${capsuleOutfitLabel(outfit.name)}`}><MoreHorizontal size={19}/></summary><div><button type="button" onClick={() => openOutfitReview(outfit)}><Star size={15}/> Noter</button><button type="button" onClick={() => setAddTarget(outfit)}><CirclePlus size={15}/> Ajouter une pièce</button><button type="button" className="danger" onClick={() => removeCapsuleOutfit(outfit)}><Trash2 size={15}/> Supprimer</button></div></details>
            </article>)}
          </div>}
        </div>
      </div>
    </Modal>}
    {replaceTarget && <Modal title={`Remplacer ${replaceTarget.item.name || replaceTarget.item.category}`} onClose={() => setReplaceTarget(null)}><p>Choisissez une pièce compatible de la catégorie {replaceTarget.item.category}.</p><div className="selector-grid replacement-grid">{replacementCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={replaceCapsuleItem}/>)}</div>{!replacementCandidates.length && <p className="empty-filter-message">Aucune autre pièce compatible disponible.</p>}</Modal>}
    {addTarget && <Modal title="Ajouter une pièce à la tenue" onClose={() => setAddTarget(null)}><p>Choisissez une pièce compatible dans une catégorie absente de cette tenue.</p><div className="selector-grid replacement-grid">{additionCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addCapsuleItem}/>)}</div>{!additionCandidates.length && <p className="empty-filter-message">Aucune pièce compatible à ajouter.</p>}</Modal>}
    {addingPackingItem && <Modal title="Ajouter à la liste bagages" onClose={() => setAddingPackingItem(false)}><p>Choisissez une pièce à emporter, même si elle ne fait partie d’aucune tenue.</p><div className="packing-item-filters"><div><span>Catégories</span><div className="category-pills"><button type="button" className={!packingCategory ? "active" : ""} onClick={() => setPackingCategory("")}>Toutes</button>{categories.map(category => <button type="button" key={category} className={packingCategory === category ? "active" : ""} onClick={() => setPackingCategory(category)}>{category}</button>)}</div></div><div><span>Saisons</span><div className="category-pills"><button type="button" className={!packingSeason ? "active" : ""} onClick={() => setPackingSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={packingSeason === season ? "active" : ""} onClick={() => setPackingSeason(season)}>{season}</button>)}</div></div></div><div className="selector-grid replacement-grid">{packingCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addItemToPackingList}/>)}</div>{!packingCandidates.length && <p className="empty-filter-message">Aucune pièce ne correspond à ces filtres.</p>}</Modal>}
    {openOutfit && <Modal title={openOutfit.name} onClose={() => setOpenOutfit(null)}><form className="outfit-review" onSubmit={saveOutfitReview}><label>Nom de la tenue<input name="name" required defaultValue={openOutfit.name} placeholder="Ex. Dîner en ville"/></label><div className="outfit-review-items">{openOutfit.clothes.map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<small>{item.name || item.category}</small></div>)}</div><fieldset><legend>Votre note</legend><div className="rating-stars" aria-label={`Note : ${reviewRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setReviewRating(value)}><Star size={27} fill={value <= reviewRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour d’expérience<textarea name="notes" rows="6" defaultValue={openOutfit.notes} placeholder="Confort, associations, occasion, améliorations…"/></label><button className="primary" disabled={reviewSaving}>{reviewSaving ? "Enregistrement…" : "Enregistrer les modifications"}</button></form></Modal>}
    {reviewCapsule && <Modal title={`Noter ${reviewCapsule.name}`} onClose={() => setReviewCapsule(null)}><form className="outfit-review" onSubmit={saveCapsuleReview}><fieldset><legend>Note globale de la capsule</legend><div className="rating-stars" aria-label={`Note : ${capsuleRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setCapsuleRating(value)}><Star size={27} fill={value <= capsuleRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour sur la capsule<textarea name="notes" rows="6" defaultValue={reviewCapsule.notes} placeholder="Variété, efficacité, pièces manquantes, bilan du voyage…"/></label><button className="primary" disabled={capsuleReviewSaving}>{capsuleReviewSaving ? "Enregistrement…" : "Enregistrer la note"}</button></form></Modal>}
    {creatingCapsuleOutfit && <Modal title="Ajouter une tenue à la capsule" onClose={() => setCreatingCapsuleOutfit(false)}><form className="stack" onSubmit={createOutfitInCapsule}><label>Nom de la tenue <small>(facultatif)</small><input name="name" autoFocus placeholder={`Tenue ${openCapsule.outfits.length + 1}`}/></label><p>Sélectionnez des pièces compatibles. Une seule pièce par catégorie peut être choisie.</p><div className="selector-grid replacement-grid">{newOutfitCandidates.map(item => <ClothingCard key={item._id} item={item} selectable selected={newCapsuleOutfitItems.includes(item._id)} onSelect={toggleNewOutfitItem}/>)}</div><button className="primary" disabled={!newCapsuleOutfitItems.length}><CirclePlus size={17}/> Ajouter la tenue</button></form></Modal>}
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
