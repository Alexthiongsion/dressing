import { useEffect, useState } from "react";
import { FolderPlus, LoaderCircle, Luggage, MoreHorizontal, Network, Plus, RotateCcw, Tags } from "lucide-react";
import { api, uploadImage } from "../services/api";
import ClothingCard from "../components/ClothingCard";
import ImageDropzone from "../components/ImageDropzone";
import ItemSetupWizard from "../components/ItemSetupWizard";
import CompatibilityWizard from "../components/CompatibilityWizard";
import CapsuleWizard from "../components/CapsuleWizard";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";

const empty = { name:"", category:"Haut", brand:"", color:"", season:[], style:"", size:"", imageUrl:"", favorite:false };
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const seasons = ["Printemps", "Été", "Automne", "Hiver"];

export default function Wardrobe() {
  const [items,setItems]=useState([]),[editing,setEditing]=useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [collectionCandidates, setCollectionCandidates] = useState([]);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [compatibilityItems, setCompatibilityItems] = useState([]);
  const [compatibilityTarget, setCompatibilityTarget] = useState(null);
  const [compatibilityCatalog, setCompatibilityCatalog] = useState([]);
  const [loadingCompatibilityList, setLoadingCompatibilityList] = useState(false);
  const [showCompatibilityWizard, setShowCompatibilityWizard] = useState(false);
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [sortByLeastCompatibility, setSortByLeastCompatibility] = useState(false);
  const [capsuleItems, setCapsuleItems] = useState([]);
  const [showCapsuleWizard, setShowCapsuleWizard] = useState(false);
  const [imageFile, setImageFile] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const unclassifiedItems = items.filter(item => !item.category || !item.season?.length);
  const load=()=>Promise.all([
    api(`/clothes?category=${encodeURIComponent(selectedCategories.join(","))}&season=${encodeURIComponent(selectedSeasons.join(","))}`),
    api("/collections"),
  ]).then(([clothes, nextCollections]) => { setItems(clothes); setCollections(nextCollections); });
  useEffect(() => {
  load();
}, [selectedCategories, selectedSeasons]);

useEffect(() => {
  const refresh = () => load();

  window.addEventListener("clothes-updated", refresh);

  return () => {
    window.removeEventListener("clothes-updated", refresh);
  };
}, [selectedCategories, selectedSeasons]);

  const toggleFilter = (value, setter) => {
    setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  const openCollectionModal = async () => {
    setError("");
    try {
      setCollectionCandidates(await api("/clothes"));
      setShowCollectionModal(true);
    } catch (err) { setError(err.message); }
  };

  const openCompatibilityWizard = async () => {
    setError("");
    setCompatibilityTarget(null);
    try {
      const allItems = await api("/clothes");
      setCompatibilityItems(allItems);
      if (!allItems.some(item => !item.compatibilityConfigured)) {
        setNotice("Toutes les pièces ont déjà leurs compatibilités configurées.");
        return;
      }
      setShowCompatibilityWizard(true);
    } catch (err) { setError(err.message); }
  };

  const redoCompatibility = async () => {
    const target = editing;
    if (!target?._id) return;
    setError("");
    try {
      const allItems = compatibilityCatalog.length ? compatibilityCatalog : await api("/clothes");
      const freshTarget = allItems.find(item => item._id === target._id) || target;
      setCompatibilityItems(allItems);
      setCompatibilityTarget(freshTarget);
      setEditing(null);
      setShowCompatibilityWizard(true);
    } catch (err) { setError(err.message); }
  };

  const openCapsuleWizard = async () => {
    setError("");
    try {
      setCapsuleItems(await api("/clothes"));
      setShowCapsuleWizard(true);
    } catch (err) { setError(err.message); }
  };

  const createCollection = async event => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const fd = new FormData(event.currentTarget);
      await api("/collections", { method: "POST", body: JSON.stringify({ name: fd.get("name"), clothes: fd.getAll("clothes"), outfits: [] }) });
      setShowCollectionModal(false);
      load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const openEditor = item => {
    setEditing(item);
    setImageFile(undefined);
    setError("");
    setCompatibilityCatalog([]);
    if (!item._id) return;
    setLoadingCompatibilityList(true);
    api("/clothes")
      .then(setCompatibilityCatalog)
      .catch(err => setError(err.message))
      .finally(() => setLoadingCompatibilityList(false));
  };
  const toggleEditingSeason = async season => {
    if (!editing?._id || seasonSaving) return;
    const previousSeasons = editing.season || [];
    const nextSeasons = previousSeasons.includes(season) ? previousSeasons.filter(value => value !== season) : [...previousSeasons, season];
    setEditing(current => ({ ...current, season: nextSeasons }));
    setSeasonSaving(true);
    setError("");
    try {
      await api(`/clothes/${editing._id}`, { method: "PUT", body: JSON.stringify({ season: nextSeasons }) });
      setItems(current => current.map(item => item._id === editing._id ? { ...item, season: nextSeasons } : item));
    } catch (err) {
      setEditing(current => ({ ...current, season: previousSeasons }));
      setError(err.message);
    } finally { setSeasonSaving(false); }
  };
  const save=async e=>{
    e.preventDefault(); setSaving(true); setError("");
    try {
      const fd=new FormData(e.currentTarget);
      const body=Object.fromEntries(fd);
      body.season=fd.getAll("season");
      body.imageUrl = editing.imageUrl || "";
      if (imageFile instanceof File) body.imageUrl = (await uploadImage(imageFile)).imageUrl;
      if (imageFile === null) body.imageUrl = "";
      await api(`/clothes${editing._id?`/${editing._id}`:""}`,{method:editing._id?"PUT":"POST",body:JSON.stringify(body)});
      setEditing(null); setImageFile(undefined); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const requestRemove = id => setDeleteTarget(items.find(item => item._id === id) || { _id: id });
  const confirmRemove = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    setError("");
    try {
      await api(`/clothes/${deleteTarget._id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setNotice("Le vêtement a été supprimé.");
      await load();
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };
  const favorite=async item=>{await api(`/clothes/${item._id}`,{method:"PUT",body:JSON.stringify({favorite:!item.favorite})});load()};

  const displayedItems = items
    .filter(item => !selectedCollections.length || selectedCollections.some(collectionId => collections.find(collection => collection._id === collectionId)?.clothes.some(clothing => (clothing._id || clothing) === item._id)))
    .sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : sortByLeastCompatibility ? (a.compatibleWith?.length || 0) - (b.compatibleWith?.length || 0) : 0);

  const compatibleIds = new Set((editing?.compatibleWith || []).map(value => value._id || value));
  const compatibleItems = compatibilityCatalog.filter(item => compatibleIds.has(item._id));

  return <><header className="page-header wardrobe-header"><div><h1>Garde-robe</h1><span className="page-count">{displayedItems.length} pièce{displayedItems.length > 1 ? "s" : ""}</span></div><button className="primary" onClick={()=>openEditor(empty)}><Plus size={18}/> Ajouter</button></header>
  {notice && <div className="page-notice" role="status">{notice}<button type="button" aria-label="Fermer le message" onClick={()=>setNotice("")}>×</button></div>}
  {error && !editing && !showCollectionModal && <div className="page-notice error" role="alert">{error}<button type="button" aria-label="Fermer le message d’erreur" onClick={()=>setError("")}>×</button></div>}
  <div className="wardrobe-filters">
    <div className="filter-group">
      <span>Catégories</span>
      <div className="category-pills" aria-label="Filtrer par catégorie">
        <button type="button" className={!selectedCategories.length ? "active" : ""} aria-pressed={!selectedCategories.length} onClick={()=>setSelectedCategories([])}>Toutes</button>
        {categories.map(x=><button type="button" key={x} className={selectedCategories.includes(x) ? "active" : ""} aria-pressed={selectedCategories.includes(x)} onClick={()=>toggleFilter(x, setSelectedCategories)}>{x}</button>)}
      </div>
    </div>
    <div className="filter-group">
      <span>Saisons</span>
      <div className="category-pills" aria-label="Filtrer par saison">
        <button type="button" className={!selectedSeasons.length ? "active" : ""} aria-pressed={!selectedSeasons.length} onClick={()=>setSelectedSeasons([])}>Toutes</button>
        {seasons.map(x=><button type="button" key={x} className={selectedSeasons.includes(x) ? "active" : ""} aria-pressed={selectedSeasons.includes(x)} onClick={()=>toggleFilter(x, setSelectedSeasons)}>{x}</button>)}
      </div>
    </div>
    <label className="wardrobe-sort">Trier
      <select value={sortByCompatibility ? "most" : sortByLeastCompatibility ? "least" : "recent"} onChange={event => { setSortByCompatibility(event.target.value === "most"); setSortByLeastCompatibility(event.target.value === "least"); }}>
        <option value="recent">Récents</option>
        <option value="most">Plus compatibles</option>
        <option value="least">Moins compatibles</option>
      </select>
    </label>
    <details className="wardrobe-more">
      <summary aria-label="Plus d’actions" title="Plus d’actions"><MoreHorizontal size={20}/></summary>
      <div>
        {unclassifiedItems.length > 0 && <button type="button" onClick={()=>setShowSetupWizard(true)}><Tags size={17}/> Classer les imports <span>{unclassifiedItems.length}</span></button>}
        <button type="button" onClick={openCompatibilityWizard}><Network size={17}/> Compatibilités</button>
        <button type="button" onClick={openCapsuleWizard}><Luggage size={17}/> Capsule bagage</button>
        <button type="button" onClick={openCollectionModal}><FolderPlus size={17}/> Ajouter une collection</button>
      </div>
    </details>
  </div>
  <div className="cards-grid">{displayedItems.map(item=><ClothingCard key={item._id} item={item} onEdit={openEditor} onDelete={requestRemove} onFavorite={favorite}/>)}</div>
  {showSetupWizard && unclassifiedItems.length > 0 && <ItemSetupWizard items={unclassifiedItems} onClose={()=>{setShowSetupWizard(false);load();}} onComplete={()=>{setShowSetupWizard(false);load();}}/>}
  {showCompatibilityWizard && compatibilityItems.length > 0 && <CompatibilityWizard items={compatibilityTarget ? [compatibilityTarget] : compatibilityItems.filter(item => !item.compatibilityConfigured)} allItems={compatibilityItems} onClose={()=>{setShowCompatibilityWizard(false);setCompatibilityTarget(null);load();}} onComplete={()=>{setShowCompatibilityWizard(false);setCompatibilityTarget(null);load();}}/>}
  {showCapsuleWizard && capsuleItems.length > 0 && <CapsuleWizard items={capsuleItems} onClose={()=>setShowCapsuleWizard(false)} onComplete={()=>{setShowCapsuleWizard(false);load();}}/>}
  {showCollectionModal&&<Modal title="Ajouter une collection" onClose={()=>setShowCollectionModal(false)}><form className="stack" onSubmit={createCollection}>
    <label>Nom<input name="name" required autoFocus placeholder="Ex. Travail, Vacances…"/></label>
    <fieldset><legend>Vêtements de la collection</legend><div className="collection-item-list">{collectionCandidates.map(item=><label className="collection-item-check" key={item._id}><input type="checkbox" name="clothes" value={item._id}/>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<span/>}<b>{item.name || item.category || "Sans nom"}</b></label>)}</div></fieldset>
    {error&&<p className="field-error">{error}</p>}
    <button className="primary" disabled={saving}>{saving&&<LoaderCircle className="spin" size={18}/>} {saving?"Création…":"Créer la collection"}</button>
  </form></Modal>}
  {deleteTarget && <ConfirmModal title="Supprimer ce vêtement ?" message={`${deleteTarget.name || deleteTarget.category || "Ce vêtement"} sera retiré de votre garde-robe et de ses compatibilités.`} confirmLabel="Supprimer" loading={deleting} onConfirm={confirmRemove} onClose={()=>setDeleteTarget(null)}/>} 
  {editing&&<Modal title={editing._id?(editing.name || editing.category || "Vêtement"):"Ajouter un vêtement"} onClose={()=>setEditing(null)}><form className={`form-grid ${editing._id ? "clothing-details-form" : ""}`} onSubmit={save}>
    {editing._id ? <section className="clothing-details-summary full">
      {editing.imageUrl ? <img src={editing.imageUrl} alt={editing.name || editing.category}/> : <span/>}
      <div><span className="eyebrow">{editing.category}</span><h3>{editing.name || editing.category}</h3>{[editing.brand, editing.color, editing.style, editing.size].filter(Boolean).length > 0 && <p>{[editing.brand, editing.color, editing.style, editing.size].filter(Boolean).join(" · ")}</p>}</div>
    </section> : <><ImageDropzone initialUrl={editing.imageUrl} onChange={setImageFile}/>
    <label>Nom<input name="name" defaultValue={editing.name} /></label><label>Catégorie<select name="category" defaultValue={editing.category}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Marque<input name="brand" defaultValue={editing.brand}/></label><label>Couleur<input name="color" defaultValue={editing.color}/></label><label>Style<input name="style" defaultValue={editing.style}/></label><label>Taille<input name="size" defaultValue={editing.size}/></label></>}
    <fieldset className="full"><legend>Saisons {editing._id && seasonSaving && <small>Enregistrement…</small>}</legend>{seasons.map(x=><label className="check" key={x}><input type="checkbox" name="season" value={x} checked={editing._id ? editing.season?.includes(x) : undefined} defaultChecked={editing._id ? undefined : editing.season?.includes(x)} disabled={editing._id && seasonSaving} onChange={editing._id ? ()=>toggleEditingSeason(x) : undefined}/>{x}</label>)}</fieldset>
    {editing._id && <section className="clothing-compatibility-list full" aria-labelledby="clothing-compatibility-title">
      <header><div><Network size={18}/><h3 id="clothing-compatibility-title">Pièces compatibles</h3></div><div className="compatibility-list-actions"><strong>{editing.compatibleWith?.length || 0}</strong><button type="button" onClick={redoCompatibility}><RotateCcw size={15}/> Refaire les compatibilités</button></div></header>
      {loadingCompatibilityList ? <p className="compatibility-list-status"><LoaderCircle className="spin" size={18}/> Chargement…</p> : compatibleItems.length ? <div>{compatibleItems.map(item => <article key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<footer><b>{item.name || item.category}</b><small>{item.category}</small></footer></article>)}</div> : <p className="compatibility-list-status">Aucune pièce compatible renseignée.</p>}
    </section>}
    {error && <p className="field-error full">{error}</p>}
    {!editing._id && <button className="primary full" type="submit" disabled={saving} aria-busy={saving}>
      {saving && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {saving ? "Traitement et ajout en cours…" : "Enregistrer"}
    </button>}
  </form></Modal>}</>;
}
