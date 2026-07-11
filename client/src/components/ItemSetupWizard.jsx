import { useEffect, useState } from "react";
import { ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { api } from "../services/api";

const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const seasons = ["Printemps", "Été", "Automne", "Hiver"];

export default function ItemSetupWizard({ items, onComplete, onClose }) {
  const [index, setIndex] = useState(0);
  const [category, setCategory] = useState("");
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = items[index];

  useEffect(() => {
    setCategory(item?.category || "");
    setSelectedSeasons(item?.season || []);
    setError("");
  }, [item]);

  const toggleSeason = season => {
    setSelectedSeasons(current => current.includes(season)
      ? current.filter(value => value !== season)
      : [...current, season]);
  };

  const saveAndContinue = async () => {
    if (!category || !selectedSeasons.length) {
      setError("Choisissez une catégorie et au moins une saison.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await api(`/clothes/${item._id}`, {
        method: "PUT",
        body: JSON.stringify({ category, season: selectedSeasons }),
      });
      if (index === items.length - 1) onComplete();
      else setIndex(current => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  const isLast = index === items.length - 1;

  return <div className="wizard-backdrop">
    <section className="item-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <header>
        <div className="wizard-heading">
          <div>
          <span className="eyebrow">Vêtement {index + 1} sur {items.length}</span>
          <h2 id="wizard-title">Classez ce vêtement</h2>
          </div>
          <button type="button" className="wizard-close" aria-label="Fermer le classement" onClick={onClose}><X size={22}/></button>
        </div>
        <div className="wizard-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / items.length) * 100}%` }}/></div>
      </header>

      <div className="wizard-content">
        <div className="wizard-preview"><img src={item.imageUrl} alt="Vêtement à classer" /></div>
        <div className="wizard-fields">
          <fieldset>
            <legend>Catégorie</legend>
            <div className="category-pills">
              {categories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Saisons</legend>
            <div className="category-pills">
              {seasons.map(value => <button type="button" key={value} className={selectedSeasons.includes(value) ? "active" : ""} aria-pressed={selectedSeasons.includes(value)} onClick={() => toggleSeason(value)}>{value}</button>)}
            </div>
          </fieldset>
          {error && <p className="field-error">{error}</p>}
          <button type="button" className="primary wizard-next" disabled={saving || !category || !selectedSeasons.length} onClick={saveAndContinue}>
            {saving ? <><LoaderCircle className="spin" size={18}/> Enregistrement…</> : <>{isLast ? <Check size={18}/> : <ArrowRight size={18}/>} {isLast ? "Terminer" : "Enregistrer et suivant"}</>}
          </button>
        </div>
      </div>
    </section>
  </div>;
}
