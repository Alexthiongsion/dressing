import { useEffect, useState } from "react";
import { ArrowDownWideNarrow, FolderPlus, LoaderCircle, Luggage, Network, Plus, Tags } from "lucide-react";
import { api, uploadImage } from "../services/api";
import ClothingCard from "../components/ClothingCard";
import ImageDropzone from "../components/ImageDropzone";
import ItemSetupWizard from "../components/ItemSetupWizard";
import CompatibilityWizard from "../components/CompatibilityWizard";
import CapsuleWizard from "../components/CapsuleWizard";
import Modal from "../components/Modal";

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
  const [showCompatibilityWizard, setShowCompatibilityWizard] = useState(false);
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [capsuleItems, setCapsuleItems] = useState([]);
  const [showCapsuleWizard, setShowCapsuleWizard] = useState(false);
  const [imageFile, setImageFile] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    try {
      const allItems = await api("/clothes");
      setCompatibilityItems(allItems);
      if (!allItems.some(item => !item.compatibilityConfigured)) {
        window.alert("Toutes les pièces ont déjà été configurées.");
        return;
      }
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

  const openEditor = item => { setEditing(item); setImageFile(undefined); setError(""); };
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
  const remove=async id=>{if(confirm("Supprimer ce vêtement ?")){await api(`/clothes/${id}`,{method:"DELETE"});load()}};
  const favorite=async item=>{await api(`/clothes/${item._id}`,{method:"PUT",body:JSON.stringify({favorite:!item.favorite})});load()};

  const displayedItems = items
    .filter(item => !selectedCollections.length || selectedCollections.some(collectionId => collections.find(collection => collection._id === collectionId)?.clothes.some(clothing => (clothing._id || clothing) === item._id)))
    .sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : 0);

  return <><header className="page-header"><div><span className="eyebrow">Inventaire</span><h1>Garde-robe</h1></div><div className="page-actions">{unclassifiedItems.length > 0 && <button className="secondary" onClick={()=>setShowSetupWizard(true)}><Tags size={18}/> Classer les imports <span>{unclassifiedItems.length}</span></button>}<button className={`secondary ${sortByCompatibility ? "active" : ""}`} aria-pressed={sortByCompatibility} onClick={()=>setSortByCompatibility(value=>!value)}><ArrowDownWideNarrow size={18}/> Plus compatibles</button><button className="secondary" onClick={openCompatibilityWizard}><Network size={18}/> Compatibilités</button><button className="secondary" onClick={openCapsuleWizard}><Luggage size={18}/> Capsule bagage</button><button className="primary" onClick={()=>openEditor(empty)}><Plus size={18}/> Ajouter</button></div></header>
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
    <div className="filter-group">
      <span>Collections</span>
      <div className="collection-filter-row">
        <div className="category-pills" aria-label="Filtrer par collection">
          <button type="button" className={!selectedCollections.length ? "active" : ""} aria-pressed={!selectedCollections.length} onClick={()=>setSelectedCollections([])}>Toutes</button>
          {collections.map(collection=><button type="button" key={collection._id} className={selectedCollections.includes(collection._id) ? "active" : ""} aria-pressed={selectedCollections.includes(collection._id)} onClick={()=>toggleFilter(collection._id, setSelectedCollections)}>{collection.name}</button>)}
        </div>
        <button type="button" className="add-collection-button" onClick={openCollectionModal}><FolderPlus size={16}/> Ajouter une collection</button>
      </div>
    </div>
  </div>
  <div className="cards-grid">{displayedItems.map(item=><ClothingCard key={item._id} item={item} onEdit={openEditor} onDelete={remove} onFavorite={favorite}/>)}</div>
  {showSetupWizard && unclassifiedItems.length > 0 && <ItemSetupWizard items={unclassifiedItems} onClose={()=>{setShowSetupWizard(false);load();}} onComplete={()=>{setShowSetupWizard(false);load();}}/>}
  {showCompatibilityWizard && compatibilityItems.length > 0 && <CompatibilityWizard items={compatibilityItems.filter(item => !item.compatibilityConfigured)} allItems={compatibilityItems} onClose={()=>{setShowCompatibilityWizard(false);load();}} onComplete={()=>{setShowCompatibilityWizard(false);load();}}/>}
  {showCapsuleWizard && capsuleItems.length > 0 && <CapsuleWizard items={capsuleItems} onClose={()=>setShowCapsuleWizard(false)} onComplete={()=>{setShowCapsuleWizard(false);load();}}/>}
  {showCollectionModal&&<Modal title="Ajouter une collection" onClose={()=>setShowCollectionModal(false)}><form className="stack" onSubmit={createCollection}>
    <label>Nom<input name="name" required autoFocus placeholder="Ex. Travail, Vacances…"/></label>
    <fieldset><legend>Vêtements de la collection</legend><div className="collection-item-list">{collectionCandidates.map(item=><label className="collection-item-check" key={item._id}><input type="checkbox" name="clothes" value={item._id}/>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<span/>}<b>{item.name || item.category || "Sans nom"}</b></label>)}</div></fieldset>
    {error&&<p className="field-error">{error}</p>}
    <button className="primary" disabled={saving}>{saving&&<LoaderCircle className="spin" size={18}/>} {saving?"Création…":"Créer la collection"}</button>
  </form></Modal>}
  {editing&&<Modal title={editing._id?"Modifier le vêtement":"Ajouter un vêtement"} onClose={()=>setEditing(null)}><form className="form-grid" onSubmit={save}>
    <ImageDropzone initialUrl={editing.imageUrl} onChange={setImageFile}/>
    <label>Nom<input name="name" defaultValue={editing.name} /></label><label>Catégorie<select name="category" defaultValue={editing.category}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Marque<input name="brand" defaultValue={editing.brand}/></label><label>Couleur<input name="color" defaultValue={editing.color}/></label><label>Style<input name="style" defaultValue={editing.style}/></label><label>Taille<input name="size" defaultValue={editing.size}/></label>
    <fieldset className="full"><legend>Saisons</legend>{seasons.map(x=><label className="check" key={x}><input type="checkbox" name="season" value={x} defaultChecked={editing.season?.includes(x)}/>{x}</label>)}</fieldset>
    {error && <p className="field-error full">{error}</p>}
    <button className="primary full" type="submit" disabled={saving} aria-busy={saving}>
      {saving && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {saving ? (editing._id ? "Modification en cours…" : "Traitement et ajout en cours…") : "Enregistrer"}
    </button>
  </form></Modal>}</>;
}
