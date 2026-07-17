import { useState } from "react";
import { Check, ChevronDown, RotateCcw, Save } from "lucide-react";
import { applyPackingProfile, defaultPackingSettings, getPackingSettings, packingProfiles, savePackingSettings } from "../utils/packingRules";

const NumberRule = ({ label, hint, value, min = 0, max = 30, suffix, onChange }) => <label className="packing-number-rule"><span><b>{label}</b><small>{hint}</small></span><div><input type="number" min={min} max={max} value={value} onChange={event => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))}/><em>{suffix}</em></div></label>;

export default function Settings() {
  const [rules, setRules] = useState(getPackingSettings);
  const [saved, setSaved] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const update = (key, value) => { setSaved(false); setRules(current => ({ ...current, profile: "custom", [key]: value })); };
  const chooseProfile = profile => { setSaved(false); setRules(applyPackingProfile(profile)); };
  const save = () => { savePackingSettings(rules); setSaved(true); };

  return <div className="settings-page">
    <header className="page-header"><h1>Réglages</h1><button className="primary" onClick={save}><Save size={18}/>{saved ? "Enregistré" : "Enregistrer"}</button></header>
    <section className="packing-settings-card">
      <header><div><span><h2>Profil de bagage</h2><p>Choisissez votre équilibre entre volume et confort.</p></span></div>{saved && <strong><Check size={15}/> Modifications appliquées</strong>}</header>
      <div className="packing-profile-grid">{Object.entries(packingProfiles).map(([key, profile]) => <button type="button" key={key} className={rules.profile === key ? "active" : ""} onClick={() => chooseProfile(key)}><span>{rules.profile === key && <Check size={15}/>}<b>{profile.label}</b></span><small>{profile.description}</small></button>)}</div>
      {rules.profile === "custom" && <span className="custom-profile-badge">Profil personnalisé</span>}
      <button type="button" className={`settings-advanced-toggle ${advanced ? "open" : ""}`} aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>Personnaliser les règles <ChevronDown size={18}/></button>
      {advanced && <><div className="packing-rules-grid">
        <fieldset><legend>Renouvellement des vêtements</legend><NumberRule label="Hauts par temps chaud" hint="Avant d’utiliser un nouveau haut" value={rules.hotTopDays} min={1} suffix="jour(s)" onChange={value => update("hotTopDays", value)}/><NumberRule label="Hauts par temps doux ou froid" hint="Avant d’utiliser un nouveau haut" value={rules.mildTopDays} min={1} suffix="jour(s)" onChange={value => update("mildTopDays", value)}/><NumberRule label="Bas par temps chaud" hint="Avant d’utiliser un nouveau bas" value={rules.hotBottomDays} min={1} suffix="jour(s)" onChange={value => update("hotBottomDays", value)}/><NumberRule label="Bas par temps doux ou froid" hint="Avant d’utiliser un nouveau bas" value={rules.mildBottomDays} min={1} suffix="jour(s)" onChange={value => update("mildBottomDays", value)}/></fieldset>
        <fieldset><legend>Chaussures et météo</legend><NumberRule label="Une seule paire jusqu’à" hint="Au-delà, deux paires sont recommandées" value={rules.oneShoeMaxDays} min={1} suffix="jour(s)" onChange={value => update("oneShoeMaxDays", value)}/><NumberRule label="Deux paires jusqu’à" hint="Au-delà, trois paires sont recommandées" value={rules.twoShoesMaxDays} min={2} suffix="jour(s)" onChange={value => update("twoShoesMaxDays", value)}/><NumberRule label="Inter nécessaire sous" hint="Seuil de température minimale" value={rules.interTemperature} min={-10} max={35} suffix="°C" onChange={value => update("interTemperature", value)}/><NumberRule label="Manteau nécessaire sous" hint="Seuil de température minimale" value={rules.coatTemperature} min={-10} max={35} suffix="°C" onChange={value => update("coatTemperature", value)}/></fieldset>
        <fieldset><legend>Organisation du séjour</legend><NumberRule label="Lessive tous les" hint="0 signifie qu’aucune lessive n’est prévue" value={rules.laundryEveryDays} min={0} suffix="jour(s)" onChange={value => update("laundryEveryDays", value)}/><NumberRule label="Marge de sécurité" hint="Pièces supplémentaires par catégorie" value={rules.safetyMargin} min={0} max={3} suffix="pièce(s)" onChange={value => update("safetyMargin", value)}/><label className="packing-toggle"><span><b>Paire adaptée à la pluie</b><small>Recommandée lorsqu’une journée pluvieuse est prévue</small></span><input type="checkbox" checked={rules.rainShoes} onChange={event => update("rainShoes", event.target.checked)}/></label></fieldset>
      </div>
      <footer><button type="button" className="secondary" onClick={() => { setSaved(false); setRules(defaultPackingSettings); }}><RotateCcw size={16}/> Réinitialiser</button></footer></>}
    </section>
  </div>;
}
