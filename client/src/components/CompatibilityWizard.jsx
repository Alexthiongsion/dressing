import { useEffect, useState } from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { api } from "../services/api";

const categoryOrder = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];

export default function CompatibilityWizard({ items, allItems = items, onClose, onComplete }) {
  const [workingItems, setWorkingItems] = useState(allItems);
  const queueIds = items.map(item => item._id);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = workingItems.find(candidate => candidate._id === queueIds[index]);

  useEffect(() => {
    const allowedIds = new Set(workingItems.filter(candidate => candidate.category !== item?.category).map(candidate => candidate._id));
    setSelected((item?.compatibleWith || []).map(value => value._id || value).filter(id => allowedIds.has(id)));
    setError("");
  }, [item, workingItems]);

  const toggle = id => setSelected(current => current.includes(id)
    ? current.filter(value => value !== id)
    : [...current, id]);

  const toggleGroup = groupItems => {
    const groupIds = groupItems.map(candidate => candidate._id);
    const allSelected = groupIds.every(id => selected.includes(id));
    setSelected(current => allSelected
      ? current.filter(id => !groupIds.includes(id))
      : [...new Set([...current, ...groupIds])]);
  };

  const saveAndContinue = async () => {
    setSaving(true); setError("");
    try {
      await api(`/clothes/${item._id}/compatibility`, { method: "PUT", body: JSON.stringify({ compatibleWith: selected }) });
      setWorkingItems(current => current.map(candidate => {
        const links = (candidate.compatibleWith || []).map(value => value._id || value);
        if (candidate._id === item._id) return { ...candidate, compatibleWith: selected, compatibilityConfigured: true };
        if (selected.includes(candidate._id)) return { ...candidate, compatibleWith: [...new Set([...links, item._id])] };
        return { ...candidate, compatibleWith: links.filter(id => id !== item._id) };
      }));
      if (index === queueIds.length - 1) onComplete();
      else setIndex(current => current + 1);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (!item) return null;
  const groups = categoryOrder
    .filter(category => category !== item.category)
    .map(category => ({ category, items: workingItems.filter(candidate => candidate.category === category) }))
    .filter(group => group.items.length);
  const isLast = index === queueIds.length - 1;

  return <div className="wizard-backdrop"><section className="compatibility-wizard" role="dialog" aria-modal="true" aria-labelledby="compatibility-title">
    <header><div><span className="eyebrow">Compatibilité {index + 1} sur {queueIds.length}</span><h2 id="compatibility-title">Qu’est-ce qui va avec cette pièce ?</h2></div><button type="button" className="wizard-close" aria-label="Fermer" onClick={onClose}><X size={22}/></button></header>
    <div className="compatibility-layout">
      <aside><div className="compatibility-reference">{item.imageUrl ? <img src={item.imageUrl} alt="Pièce de référence"/> : <span>{item.category}</span>}</div><b>{item.name || item.category || "Sans nom"}</b><small>{selected.length} pièce{selected.length > 1 ? "s" : ""} compatible{selected.length > 1 ? "s" : ""}</small></aside>
      <div className="compatibility-groups">{groups.map(group => {
        const allSelected = group.items.every(candidate => selected.includes(candidate._id));
        return <section key={group.category}><div className="compatibility-group-heading"><h3>{group.category}</h3><button type="button" className={allSelected ? "active" : ""} aria-pressed={allSelected} onClick={() => toggleGroup(group.items)}>{allSelected ? "Tout retirer" : "Tout"}</button></div><div className="compatibility-grid">{group.items.map(candidate => <button type="button" key={candidate._id} className={selected.includes(candidate._id) ? "selected" : ""} aria-pressed={selected.includes(candidate._id)} onClick={() => toggle(candidate._id)}>{candidate.imageUrl ? <img src={candidate.imageUrl} alt=""/> : <span/>}<b>{candidate.name || candidate.category}</b>{selected.includes(candidate._id) && <Check size={17}/>}</button>)}</div></section>;
      })}</div>
    </div>
    {error && <p className="field-error">{error}</p>}
    <footer><div className="wizard-progress"><span style={{ width: `${((index + 1) / queueIds.length) * 100}%` }}/></div><button type="button" className="primary" disabled={saving} onClick={saveAndContinue}>{saving ? <><LoaderCircle className="spin" size={18}/> Enregistrement…</> : <>{isLast ? <Check size={18}/> : <ArrowRight size={18}/>} {isLast ? "Terminer" : "Enregistrer et suivant"}</>}</button></footer>
  </section></div>;
}
