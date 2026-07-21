import { useEffect, useState } from "react";
import { ArrowLeft, Lock, LockOpen, RefreshCw, Save, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";
import { generateProposals } from "../utils/outfitSuggestions";
import PageState from "../components/PageState";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function OutfitAssist() {
  const navigate = useNavigate();
  const [clothes, setClothes] = useState([]), [selected, setSelected] = useState([]), [locked, setLocked] = useState([]);
  const [season, setSeason] = useState(""), [category, setCategory] = useState(""), [proposals, setProposals] = useState([]), [generation, setGeneration] = useState(0), [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const loadClothes = async signal => {
    setLoading(true); setError("");
    try { setClothes(await api("/clothes", { signal })); }
    catch (loadFailure) { if (!signal?.aborted) setError(loadFailure.message || "Impossible de charger la garde-robe."); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    loadClothes(controller.signal);
    return () => controller.abort();
  }, []);

  const visible = clothes.filter(item => (!category || item.category === category) && (!season || item.season?.includes(season)));
  const toggleSeed = item => {
    setProposals([]);
    setSelected(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current.filter(id => clothes.find(value => value._id === id)?.category !== item.category), item._id]);
    setLocked(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current.filter(id => clothes.find(value => value._id === id)?.category !== item.category), item._id]);
  };
  const generate = () => { setProposals(generateProposals({ clothes, seedIds: selected, lockedIds: locked, season, offset: generation }, 3)); setGeneration(value => value + 1); };
  const save = async (items, index) => {
    setSaving(index); setError("");
    try {
      await api("/outfits", { method: "POST", body: JSON.stringify({ name: `Tenue suggérée ${new Date().toLocaleDateString("fr-FR")}`, clothes: items.map(item => item._id), season }) });
      navigate("/outfits");
    } catch (saveError) {
      setError(saveError.message || "Impossible d’enregistrer la tenue.");
    } finally { setSaving(null); }
  };

  if (loading) return <PageState loading title="Chargement de votre garde-robe…"/>;
  if (error && !clothes.length) return <PageState title="La génération assistée n’est pas disponible" message={error} onAction={() => loadClothes()}/>;

  return <div className="assist-page"><header className="page-header"><div><span className="eyebrow">Composition intelligente</span><h1>Tenue assistée</h1></div><div className="page-actions"><button type="button" className="secondary" onClick={() => navigate("/outfits")}><ArrowLeft size={18}/> Retour</button><button type="button" className="primary" disabled={!selected.length} onClick={generate}><Sparkles size={18}/> {proposals.length ? "Autres propositions" : "Générer 3 tenues"}</button></div></header>{error && <p className="page-notice error" role="alert">{error}</p>}<section className="assist-controls"><div className="outfit-filter-row"><span>Saison</span><div className="category-pills"> <button type="button" className={!season ? "active" : ""} onClick={() => setSeason("")}>Toutes</button>{seasons.map(value => <button type="button" key={value} className={season === value ? "active" : ""} onClick={() => setSeason(value)}>{value}</button>)}</div></div><div className="outfit-filter-row"><span>Catégorie</span><div className="category-pills"><button type="button" className={!category ? "active" : ""} onClick={() => setCategory("")}>Tout</button>{categories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div></div></section><section className="assist-picker">{visible.map(item => { const active = selected.includes(item._id); return <button type="button" className={active ? "selected" : ""} key={item._id} onClick={() => toggleSeed(item)}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}{active && <i><Lock size={14}/></i>}</button>; })}</section>{selected.length > 0 && <div className="assist-selection"><b>{selected.length} pièce{selected.length > 1 ? "s" : ""} de départ</b><span><Lock size={14}/> verrouillée{selected.length > 1 ? "s" : ""}</span></div>}{proposals.length > 0 && <section className="assist-proposals">{proposals.map((proposal, index) => <article key={proposal.map(item => item._id).join(":")}><header><div><span>Proposition {index + 1}</span><b>{proposal.length} pièces</b></div><button type="button" className="primary" disabled={saving !== null} onClick={() => save(proposal, index)}><Save size={16}/>{saving === index ? "Enregistrement…" : "Enregistrer"}</button></header><div>{proposal.map(item => <figure key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}<i className={locked.includes(item._id) ? "locked" : "suggested"}>{locked.includes(item._id) ? <Lock size={14}/> : <Sparkles size={14}/>}</i></figure>)}</div></article>)}</section>}</div>;
}
