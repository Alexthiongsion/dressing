import { useEffect, useState } from "react";
import { ArrowLeft, CirclePlus, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const newLook = id => ({ id, name: `Tenue ${id}`, items: [] });

export default function OutfitMultiCreate() {
  const navigate = useNavigate();
  const [clothes, setClothes] = useState([]), [looks, setLooks] = useState([newLook(1), newLook(2)]);
  const [category, setCategory] = useState(""), [season, setSeason] = useState(""), [dropTarget, setDropTarget] = useState(null), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  useEffect(() => { api("/clothes").then(setClothes); }, []);
  const available = clothes.filter(item => (!category || item.category === category) && (!season || item.season?.includes(season)));
  const addToLook = (lookId, itemId) => {
    const item = clothes.find(value => value._id === itemId), look = looks.find(value => value.id === lookId);
    const currentItems = look.items.map(id => clothes.find(value => value._id === id));
    if (!item || look.items.includes(itemId)) return;
    if (currentItems.some(value => value.category === item.category)) return setError(`La catégorie ${item.category} est déjà présente dans ${look.name}.`);
    if (!currentItems.every(value => value.compatibleWith?.some(link => (link._id || link) === itemId))) return setError(`${item.name || item.category} n’est pas compatible avec ${look.name}.`);
    setError(""); setLooks(current => current.map(value => value.id === lookId ? { ...value, items: [...value.items, itemId] } : value));
  };
  const save = async () => {
    if (looks.some(look => !look.name.trim() || !look.items.length)) return setError("Chaque tenue doit avoir un nom et au moins une pièce.");
    setSaving(true); await Promise.all(looks.map(look => api("/outfits", { method: "POST", body: JSON.stringify({ name: look.name.trim(), clothes: look.items, season }) }))); navigate("/outfits");
  };
  return <><header className="page-header"><div><span className="eyebrow">Création multiple</span><h1>Créer plusieurs tenues</h1></div><button className="secondary" onClick={() => navigate("/outfits/new")}><ArrowLeft size={18}/> Tenue unique</button></header><div className="multi-outfit-page"><section className="multi-outfit-toolbar"><div><span>Saison</span><div className="category-pills"><button className={!season ? "active" : ""} onClick={() => setSeason("")}>Toutes</button>{seasons.map(value => <button key={value} className={season === value ? "active" : ""} onClick={() => setSeason(value)}>{value}</button>)}</div></div><button className="secondary" onClick={() => setLooks(current => [...current, newLook(Math.max(...current.map(value => value.id)) + 1)])}><CirclePlus size={17}/> Ajouter une tenue</button></section>{error && <p className="capsule-action-error">{error}</p>}<section className="multi-look-grid">{looks.map(look => <article key={look.id} className={`multi-look ${dropTarget === look.id ? "drop-active" : ""}`} onDragOver={event => { event.preventDefault(); setDropTarget(look.id); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }} onDrop={event => { event.preventDefault(); setDropTarget(null); addToLook(look.id, event.dataTransfer.getData("text/plain")); }}><header><input value={look.name} aria-label="Nom de la tenue" onChange={event => setLooks(current => current.map(value => value.id === look.id ? { ...value, name: event.target.value } : value))}/>{looks.length > 1 && <button aria-label="Supprimer la tenue" onClick={() => setLooks(current => current.filter(value => value.id !== look.id))}><Trash2 size={16}/></button>}</header><div>{look.items.length ? look.items.map(itemId => { const item = clothes.find(value => value._id === itemId); return <div className="multi-look-item" key={itemId}>{item?.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}<b>{item?.name || item?.category}</b><button onClick={() => setLooks(current => current.map(value => value.id === look.id ? { ...value, items: value.items.filter(id => id !== itemId) } : value))}><Trash2 size={14}/></button></div>; }) : <p>Glissez des pièces ici</p>}</div></article>)}</section><section className="outfit-item-drawer"><div className="creation-list-heading"><div><h2>Garde-robe</h2><p>Glissez une pièce vers la tenue de votre choix.</p></div></div><div className="category-pills"><button className={!category ? "active" : ""} onClick={() => setCategory("")}>Tout</button>{categories.map(value => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div><div className="outfit-drag-items">{available.map(item => <button draggable key={item._id} onDragStart={event => { event.dataTransfer.setData("text/plain", item._id); event.dataTransfer.effectAllowed = "copy"; }}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}<b>{item.name || item.category}</b><small>{item.category}</small></button>)}</div></section><footer className="multi-save"><button className="primary" disabled={saving} onClick={save}><Save size={18}/>{saving ? "Création…" : `Créer ${looks.length} tenues`}</button></footer></div></>;
}
