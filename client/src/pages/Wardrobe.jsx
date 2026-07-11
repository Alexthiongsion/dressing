import { useEffect, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { api, uploadImage } from "../services/api";
import ClothingCard from "../components/ClothingCard";
import ImageDropzone from "../components/ImageDropzone";
import Modal from "../components/Modal";

const empty = { name:"", category:"Haut", brand:"", color:"", season:[], style:"", size:"", imageUrl:"", favorite:false };

export default function Wardrobe() {
  const [items,setItems]=useState([]),[editing,setEditing]=useState(null),[search,setSearch]=useState(""),[category,setCategory]=useState("");
  const [imageFile, setImageFile] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load=()=>api(`/clothes?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`).then(setItems);
  useEffect(() => {
  load();
}, [search, category]);

useEffect(() => {
  const refresh = () => load();

  window.addEventListener("clothes-updated", refresh);

  return () => {
    window.removeEventListener("clothes-updated", refresh);
  };
}, [search, category]);

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

  return <><header className="page-header"><div><span className="eyebrow">Inventaire</span><h1>Garde-robe</h1></div><button className="primary" onClick={()=>openEditor(empty)}><Plus size={18}/> Ajouter</button></header>
  <div className="toolbar"><input placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes les catégories</option>{["Haut","Bas","Robe/Combinaison","Chaussures","Accessoire","Manteau"].map(x=><option key={x}>{x}</option>)}</select></div>
  <div className="cards-grid">{items.map(item=><ClothingCard key={item._id} item={item} onEdit={openEditor} onDelete={remove} onFavorite={favorite}/>)}</div>
  {editing&&<Modal title={editing._id?"Modifier le vêtement":"Ajouter un vêtement"} onClose={()=>setEditing(null)}><form className="form-grid" onSubmit={save}>
    <ImageDropzone initialUrl={editing.imageUrl} onChange={setImageFile}/>
    <label>Nom<input name="name" defaultValue={editing.name} /></label><label>Catégorie<select name="category" defaultValue={editing.category}>{["Haut","Bas","Robe/Combinaison","Chaussures","Accessoire","Manteau"].map(x=><option key={x}>{x}</option>)}</select></label><label>Marque<input name="brand" defaultValue={editing.brand}/></label><label>Couleur<input name="color" defaultValue={editing.color}/></label><label>Style<input name="style" defaultValue={editing.style}/></label><label>Taille<input name="size" defaultValue={editing.size}/></label>
    <fieldset className="full"><legend>Saisons</legend>{["Printemps","Été","Automne","Hiver"].map(x=><label className="check" key={x}><input type="checkbox" name="season" value={x} defaultChecked={editing.season?.includes(x)}/>{x}</label>)}</fieldset>
    {error && <p className="field-error full">{error}</p>}
    <button className="primary full" type="submit" disabled={saving} aria-busy={saving}>
      {saving && <LoaderCircle className="spin" size={18} aria-hidden="true" />}
      {saving ? (editing._id ? "Modification en cours…" : "Traitement et ajout en cours…") : "Enregistrer"}
    </button>
  </form></Modal>}</>;
}
