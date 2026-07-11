import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Luggage, RotateCcw, X } from "lucide-react";
import { api } from "../services/api";

const categoryOrder = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function CapsuleWizard({ items, onClose, onComplete }) {
  const [stage, setStage] = useState("category");
  const [categorySequence, setCategorySequence] = useState([]);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [outfitCount, setOutfitCount] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const availableCategories = categoryOrder.filter(category => items.some(item => item.category === category));
  const currentCategory = categorySequence[categoryIndex];
  const candidates = useMemo(() => items.filter(item => {
    if (item.category !== currentCategory) return false;
    if (selected.includes(item._id)) return true;
    return selected.every(selectedId => {
      const selectedItem = items.find(candidate => candidate._id === selectedId);
      if (selectedItem?.category === currentCategory) return true;
      return selectedItem?.compatibleWith?.some(value => (value._id || value) === item._id);
    });
  }).sort((a, b) => (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0)), [currentCategory, items, selected]);

  const visibleCandidates = candidates.slice(slideIndex, slideIndex + 3);
  const selectedInCategory = selected.filter(id => items.find(item => item._id === id)?.category === currentCategory);
  const selectedCategories = [...new Set(items.filter(item => selected.includes(item._id)).map(item => item.category))];
  const outfitCapacity = selectedCategories.reduce((total, category) => total * items.filter(item => selected.includes(item._id) && item.category === category).length, selectedCategories.length ? 1 : 0);

  const chooseStartCategory = category => {
    setCategorySequence([category, ...availableCategories.filter(value => value !== category)]);
    setCategoryIndex(0); setSlideIndex(0); setStage("pieces");
  };

  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const continueToNextCategory = () => {
    setSlideIndex(0);
    if (categoryIndex < categorySequence.length - 1) setCategoryIndex(value => value + 1);
    else setStage("summary");
  };

  const restart = () => {
    setStage("category"); setCategorySequence([]); setCategoryIndex(0); setSlideIndex(0); setSelected([]); setError("");
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      await api("/collections/capsule", { method: "POST", body: JSON.stringify({ name: name.trim(), clothes: selected, outfitCount }) });
      onComplete();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="wizard-backdrop"><section className="capsule-wizard capsule-step-wizard" role="dialog" aria-modal="true" aria-labelledby="capsule-title">
    <header><div><span className="eyebrow">Capsule bagage</span><h2 id="capsule-title">{stage === "category" ? "Par quelle catégorie commencer ?" : stage === "pieces" ? `Choisissez dans la catégorie ${currentCategory}` : "Finalisez votre capsule"}</h2></div><button type="button" className="wizard-close" aria-label="Fermer" onClick={onClose}><X size={22}/></button></header>

    {stage === "category" && <div className="capsule-category-start"><p>Choisissez la première famille de vêtements à parcourir.</p><div>{availableCategories.map(category => <button type="button" key={category} onClick={() => chooseStartCategory(category)}><Luggage size={22}/><b>{category}</b><span>{items.filter(item => item.category === category).length} pièce(s)</span></button>)}</div></div>}

    {stage === "pieces" && <>
      <div className="capsule-step-progress"><span>Étape {categoryIndex + 1} sur {categorySequence.length}</span><div>{categorySequence.map((category, index) => <i key={category} className={index <= categoryIndex ? "active" : ""}/>)}</div></div>
      <p className="capsule-step-hint">{selected.length ? "Les propositions sont compatibles avec les pièces déjà choisies." : "Sélectionnez une ou plusieurs pièces, puis continuez."}</p>
      <div className="capsule-carousel">
        <button type="button" className="carousel-arrow" disabled={slideIndex === 0} aria-label="Pièces précédentes" onClick={() => setSlideIndex(value => Math.max(0, value - 3))}><ChevronLeft size={28}/></button>
        <div className="capsule-slides">{visibleCandidates.map(item => <button type="button" key={item._id} className={selected.includes(item._id) ? "selected" : ""} aria-pressed={selected.includes(item._id)} onClick={() => toggle(item._id)}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<b>{item.name || item.category}</b><small>{item.compatibleWith?.length || 0} compatibilités</small>{selected.includes(item._id) && <Check className="slide-check" size={20}/>}</button>)}{!visibleCandidates.length && <div className="capsule-no-candidate">Aucune pièce compatible dans cette catégorie.</div>}</div>
        <button type="button" className="carousel-arrow" disabled={slideIndex + 3 >= candidates.length} aria-label="Pièces suivantes" onClick={() => setSlideIndex(value => value + 3)}><ChevronRight size={28}/></button>
      </div>
      <div className="capsule-step-actions"><button type="button" className="secondary" onClick={restart}><RotateCcw size={16}/> Recommencer</button><span>{selectedInCategory.length} sélectionnée{selectedInCategory.length > 1 ? "s" : ""}</span><button type="button" className="primary" onClick={continueToNextCategory}>{categoryIndex === categorySequence.length - 1 ? "Finaliser" : "Catégorie suivante"}<ChevronRight size={18}/></button></div>
    </>}

    {stage === "summary" && <div className="capsule-summary"><div className="capsule-summary-count"><strong>{selected.length}</strong><span>pièces dans {selectedCategories.length} catégories</span></div><div className="capsule-settings"><label className="capsule-name">Nom de la capsule<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Week-end à Lisbonne" autoFocus/></label><label>Nombre de tenues<input type="number" min="1" max="20" value={outfitCount} onChange={event => setOutfitCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}/><small>{outfitCapacity} combinaison{outfitCapacity > 1 ? "s" : ""} possible{outfitCapacity > 1 ? "s" : ""}</small></label></div>{error && <p className="field-error">{error}</p>}<div className="capsule-final-actions"><button type="button" className="secondary" onClick={restart}><RotateCcw size={16}/> Recommencer</button><button type="button" className="primary" disabled={saving || !name.trim() || selectedCategories.length < 2 || outfitCount > outfitCapacity} onClick={save}>{saving ? <><LoaderCircle className="spin" size={18}/> Création…</> : <><Check size={18}/> Créer {outfitCount} tenue{outfitCount > 1 ? "s" : ""}</>}</button></div></div>}
  </section></div>;
}
