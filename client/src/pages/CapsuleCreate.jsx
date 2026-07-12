import { useEffect, useState } from "react";
import { ArrowLeft, Luggage, Save } from "lucide-react";
import { useNavigate } from "react-router";
import ClothingCard from "../components/ClothingCard";
import { api } from "../services/api";

export default function CapsuleCreate() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("clothes");
  const [clothes, setClothes] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [selectedClothes, setSelectedClothes] = useState([]);
  const [selectedOutfits, setSelectedOutfits] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { Promise.all([api("/clothes"), api("/outfits")]).then(([items, looks]) => { setClothes(items); setOutfits(looks); }); }, []);
  const toggle = (id, setter) => setter(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const save = async event => {
    event.preventDefault(); setSaving(true);
    const name = new FormData(event.currentTarget).get("name");
    const chosenOutfits = outfits.filter(outfit => selectedOutfits.includes(outfit._id));
    const outfitClothes = [...new Set(chosenOutfits.flatMap(outfit => outfit.clothes.map(item => item._id)))];
    await api("/collections", { method: "POST", body: JSON.stringify({ name, description: "Capsule bagage", clothes: mode === "clothes" ? selectedClothes : outfitClothes, outfits: mode === "outfits" ? selectedOutfits : [] }) });
    navigate("/capsules");
  };
  const count = mode === "clothes" ? selectedClothes.length : selectedOutfits.length;

  return <><header className="page-header"><div><span className="eyebrow">Voyage</span><h1>Créer une capsule</h1></div><button className="secondary" onClick={() => navigate("/capsules")}><ArrowLeft size={18}/> Retour</button></header><form className="creation-page" onSubmit={save}><section className="creation-settings"><label>Nom de la capsule<input name="name" required autoFocus placeholder="Ex. Semaine à Rome"/></label><div><span>Construire avec</span><div className="category-pills"><button type="button" className={mode === "clothes" ? "active" : ""} onClick={() => setMode("clothes")}>Pièces séparées</button><button type="button" className={mode === "outfits" ? "active" : ""} onClick={() => setMode("outfits")}>Tenues existantes</button></div></div></section><section><div className="creation-list-heading"><div><h2>{mode === "clothes" ? "Sélectionnez les pièces" : "Sélectionnez les tenues"}</h2><p>{mode === "clothes" ? "Composez librement votre liste bagages." : "Les vêtements des tenues seront ajoutés automatiquement."}</p></div><strong>{count} sélectionné{count > 1 ? "s" : ""}</strong></div>{mode === "clothes" ? <div className="selector-grid">{clothes.map(item => <ClothingCard key={item._id} item={item} selectable selected={selectedClothes.includes(item._id)} onSelect={id => toggle(id, setSelectedClothes)}/>)}</div> : <div className="outfit-grid capsule-outfit-selector">{outfits.map(outfit => <button type="button" key={outfit._id} className={selectedOutfits.includes(outfit._id) ? "selected" : ""} onClick={() => toggle(outfit._id, setSelectedOutfits)}><div className="outfit-collage">{outfit.clothes.slice(0,4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}</div>)}</div><b>{outfit.name}</b><span>{outfit.clothes.length} pièces</span></button>)}</div>}</section><footer><button className="primary" disabled={saving || !count}><Luggage size={18}/>{saving ? "Création…" : "Créer la capsule"}</button></footer></form></>;
}
