import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, CirclePlus, CloudRain, Lock, Luggage, Minus, Plus, RefreshCw, RotateCcw, Settings2, Sparkles, Thermometer, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../services/api";
import { areCompatible, completeOutfit } from "../utils/outfitSuggestions";
import { fetchItineraryWeather, searchLocations, summarizeTravelWeather } from "../services/travelWeather";
import { getPackingSettings } from "../utils/packingRules";
import Modal from "../components/Modal";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const draftKey = "wearsense:capsule-draft";
const emptyDestination = () => ({ id: `${Date.now()}-${Math.random()}`, query: "", destination: "", latitude: null, longitude: null, timezone: "auto", startDate: "", endDate: "" });
const showDatePicker = event => { try { event.currentTarget.showPicker?.(); } catch { /* Le navigateur conserve son comportement natif. */ } };
const loadDraft = () => { try { const value = JSON.parse(localStorage.getItem(draftKey)); return value?.version === 1 ? value : null; } catch { return null; } };
const inferSeason = destination => {
  if (!destination.startDate) return "";
  const start = new Date(`${destination.startDate}T12:00:00`), end = new Date(`${destination.endDate || destination.startDate}T12:00:00`);
  const middle = new Date((start.getTime() + end.getTime()) / 2), month = middle.getMonth() + 1;
  const north = month >= 3 && month <= 5 ? "Printemps" : month >= 6 && month <= 8 ? "Été" : month >= 9 && month <= 11 ? "Automne" : "Hiver";
  if ((destination.latitude ?? 1) >= 0) return north;
  return { Printemps: "Automne", Été: "Hiver", Automne: "Printemps", Hiver: "Été" }[north];
};
const countPossibleOutfits = items => {
  const required = new Set(["Haut", "Bas", "Chaussures"]);
  if ([...required].some(category => !items.some(item => item.category === category))) return 0;
  let combinations = [[]];
  for (const category of categories) {
    const categoryItems = items.filter(item => item.category === category);
    const choices = required.has(category) ? categoryItems : [null, ...categoryItems];
    const next = [];
    for (const combination of combinations) {
      for (const item of choices) {
        if (!item || combination.every(selectedItem => areCompatible(selectedItem, item))) next.push(item ? [...combination, item] : combination);
      }
    }
    combinations = next;
    if (!combinations.length) return 0;
  }
  return combinations.length;
};

function DestinationField({ destination, index, canRemove, recentLocations, onChange, onRemove }) {
  const [locations, setLocations] = useState([]);
  const departureRef = useRef(null);
  const openDeparturePicker = () => {
    departureRef.current?.focus();
    try { departureRef.current?.showPicker?.(); } catch { /* Le focus reste actif si le navigateur bloque l'ouverture native. */ }
  };
  useEffect(() => {
    if (destination.destination && destination.query === destination.destination) { setLocations([]); return undefined; }
    const query = destination.query?.trim() || "";
    const matchingRecent = recentLocations.filter(location => !query || location.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).slice(0, 6);
    if (query.length < 3) { setLocations(matchingRecent); return undefined; }
    const timer = setTimeout(() => searchLocations(query).then(results => {
      const remote = results.map(location => ({ ...location, label: `${location.name}, ${location.country}` }));
      setLocations([...matchingRecent, ...remote].filter((location, locationIndex, values) => values.findIndex(value => value.label === location.label && value.latitude === location.latitude && value.longitude === location.longitude) === locationIndex).slice(0, 8));
    }).catch(() => setLocations(matchingRecent)), 300);
    return () => clearTimeout(timer);
  }, [destination.query, destination.destination, recentLocations]);
  return <div className="travel-destination-row">
    <strong>{index + 1}</strong>
    <label>Destination<div className="location-search"><input value={destination.query} onFocus={() => { if (!destination.query || destination.query === destination.destination) setLocations(recentLocations); }} onChange={event => onChange({ ...destination, query: event.target.value, destination: "", latitude: null, longitude: null })} placeholder={index ? "Ex. Rome" : "Ex. Lisbonne"}/>{locations.length > 0 && <div>{locations.map(location => <button type="button" key={`${location.id}-${location.latitude}-${location.longitude}`} onMouseDown={event => event.preventDefault()} onClick={() => { onChange({ ...destination, query: location.label, destination: location.label, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone || "auto" }); setLocations([]); }}>{location.name || location.label}<small>{location.recent ? "Destination déjà utilisée" : `${location.admin1 ? `${location.admin1}, ` : ""}${location.country}`}</small></button>)}</div>}</div></label>
    <label>Arrivée<input type="date" value={destination.startDate} onClick={showDatePicker} onChange={event => { const nextDate = event.target.value; if (!nextDate || nextDate === destination.startDate) return; onChange({ ...destination, startDate: nextDate }); requestAnimationFrame(openDeparturePicker); }}/></label>
    <label>Départ<input ref={departureRef} type="date" min={destination.startDate} value={destination.endDate} onClick={showDatePicker} onChange={event => onChange({ ...destination, endDate: event.target.value })}/></label>
    {canRemove && <button type="button" className="remove-destination" aria-label={`Supprimer l’étape ${index + 1}`} onClick={onRemove}><Trash2 size={16}/></button>}
  </div>;
}

function ItemPreview({ items, lockedIds = [], onRemove }) {
  return <section className="capsule-selection-preview"><header><div><span className="eyebrow">Votre sélection</span><b>{items.length} pièce{items.length > 1 ? "s" : ""}</b></div><span>Les cadenas seront conservés pendant la génération.</span></header><div>{items.map(item => <figure key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}<figcaption>{item.name || item.category}</figcaption>{lockedIds.includes(item._id) && <em title="Pièce imposée"><Lock size={13}/></em>}{onRemove && <button type="button" aria-label={`Retirer ${item.name || item.category}`} onClick={() => onRemove(item._id)}>×</button>}</figure>)}</div></section>;
}

export default function CapsuleCreate() {
  const navigate = useNavigate();
  const [initialDraft] = useState(loadDraft), [draftRestored] = useState(Boolean(initialDraft));
  const [draftPromptOpen, setDraftPromptOpen] = useState(Boolean(initialDraft));
  const [packingRules] = useState(getPackingSettings);
  const [stage, setStage] = useState(initialDraft?.stage || "count"), [count, setCount] = useState(initialDraft?.count || 3), [clothes, setClothes] = useState([]);
  const [name, setName] = useState(initialDraft?.name || ""), [season, setSeason] = useState(initialDraft?.season || ""), [category, setCategory] = useState(initialDraft?.category || ""), [selected, setSelected] = useState(initialDraft?.selected || []), [included, setIncluded] = useState(initialDraft?.included || []);
  const [suggestionCategory, setSuggestionCategory] = useState(initialDraft?.suggestionCategory || ""), [suggestionSeason, setSuggestionSeason] = useState(initialDraft?.suggestionSeason || ""), [suggestionSort, setSuggestionSort] = useState(initialDraft?.suggestionSort || "more");
  const [outfits, setOutfits] = useState(initialDraft?.outfits || []), [generation, setGeneration] = useState(initialDraft?.generation || 0), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [destinations, setDestinations] = useState(initialDraft?.destinations?.length ? initialDraft.destinations : [emptyDestination()]);
  const [recentLocations, setRecentLocations] = useState([]);
  const [weather, setWeather] = useState(initialDraft?.weather || null), [weatherLoading, setWeatherLoading] = useState(false);
  const [workshopLocks, setWorkshopLocks] = useState(initialDraft?.workshopLocks || []);
  const [workshopPage, setWorkshopPage] = useState(0);
  const [suggestionPage, setSuggestionPage] = useState(0);
  useEffect(() => { api("/clothes").then(nextClothes => { setClothes(nextClothes); if (initialDraft?.outfits?.length) setOutfits(current => current.map(outfit => ({ ...outfit, items: outfit.items.map(value => nextClothes.find(item => item._id === (value?._id || value))).filter(Boolean) }))); }); }, [initialDraft]);
  useEffect(() => { api("/collections").then(collections => {
    const used = collections.flatMap(collection => collection.travel?.destinations?.length ? collection.travel.destinations : collection.travel?.destination ? [collection.travel] : []).filter(location => location?.destination && location.latitude != null && location.longitude != null).map(location => ({ id: `recent-${location.latitude}-${location.longitude}`, label: location.destination, name: location.destination, country: "", latitude: location.latitude, longitude: location.longitude, timezone: location.timezone || "auto", recent: true }));
    setRecentLocations([...new Map(used.map(location => [`${location.label}-${location.latitude}-${location.longitude}`, location])).values()].slice(0, 8));
  }).catch(() => setRecentLocations([])); }, []);
  useEffect(() => {
    const dirty = stage !== "count" || count !== 3 || name || selected.length || destinations.some(destination => destination.query || destination.startDate || destination.endDate);
    if (!dirty) { localStorage.removeItem(draftKey); return; }
    localStorage.setItem(draftKey, JSON.stringify({ version: 1, stage, count, name, season, category, selected, included, suggestionCategory, suggestionSeason, suggestionSort, outfits: outfits.map(outfit => ({ ...outfit, items: outfit.items.map(item => item?._id || item) })), generation, destinations, weather, workshopLocks, updatedAt: new Date().toISOString() }));
  }, [stage, count, name, season, category, selected, included, suggestionCategory, suggestionSeason, suggestionSort, outfits, generation, destinations, weather, workshopLocks]);

  const travel = { destinations: destinations.map(({ id, query, ...destination }) => destination) };
  const reusableLocations = useMemo(() => {
    const currentLocations = destinations.filter(location => location.destination && location.latitude != null && location.longitude != null).map(location => ({ id: `current-${location.latitude}-${location.longitude}`, label: location.destination, name: location.destination, country: "", latitude: location.latitude, longitude: location.longitude, timezone: location.timezone || "auto", recent: true }));
    return [...new Map([...currentLocations, ...recentLocations].map(location => [`${location.label}-${location.latitude}-${location.longitude}`, location])).values()].slice(0, 8);
  }, [destinations, recentLocations]);
  const weatherSummary = summarizeTravelWeather(weather);
  const inferredSeasons = [...new Set(destinations.map(inferSeason).filter(Boolean))];
  const itineraryIsValid = destinations.every(destination => destination.latitude != null && destination.startDate && destination.endDate && destination.endDate >= destination.startDate);
  const selectedItems = selected.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const includedItems = included.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const possibleOutfitCount = useMemo(() => countPossibleOutfits(includedItems), [includedItems]);
  const tripDays = useMemo(() => {
    const dates = destinations.flatMap(destination => [destination.startDate, destination.endDate]).filter(Boolean).map(value => new Date(`${value}T12:00:00`).getTime());
    if (!dates.length) return count;
    return Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1);
  }, [destinations, count]);
  const hotWeather = season === "Été" || weatherSummary?.max >= 24;
  const packingCycleDays = packingRules.laundryEveryDays ? Math.min(tripDays, packingRules.laundryEveryDays) : tripDays;
  const topReuseDays = hotWeather ? packingRules.hotTopDays : packingRules.mildTopDays;
  const bottomReuseDays = hotWeather ? packingRules.hotBottomDays : packingRules.mildBottomDays;
  const requiredTops = Math.max(1, Math.ceil(packingCycleDays / topReuseDays) + packingRules.safetyMargin);
  const requiredBottoms = Math.max(1, Math.ceil(packingCycleDays / bottomReuseDays) + packingRules.safetyMargin);
  let requiredShoes = tripDays <= packingRules.oneShoeMaxDays ? 1 : tripDays <= packingRules.twoShoesMaxDays ? 2 : 3;
  if (packingRules.rainShoes && weatherSummary?.rainDays) requiredShoes = Math.max(2, requiredShoes);
  const requiredInters = weatherSummary?.min < packingRules.interTemperature ? 1 : 0;
  const requiredCoats = weatherSummary?.min < packingRules.coatTemperature ? 1 : 0;
  const freshTopCount = includedItems.filter(item => item.category === "Haut").length;
  const bottomCount = includedItems.filter(item => item.category === "Bas").length;
  const shoeCount = includedItems.filter(item => item.category === "Chaussures").length;
  const interCount = includedItems.filter(item => item.category === "Inter").length;
  const coatCount = includedItems.filter(item => item.category === "Manteau").length;
  const coverageRatios = [freshTopCount / requiredTops, bottomCount / requiredBottoms, shoeCount / requiredShoes]
    .map(value => Number.isFinite(value) ? Math.max(0, value) : 0);
  const coverageRatio = Math.min(1, ...coverageRatios);
  const calculatedCoveredDays = possibleOutfitCount > 0 ? Math.floor(tripDays * coverageRatio) : 0;
  const coveredDays = Number.isFinite(calculatedCoveredDays) ? Math.max(0, Math.min(tripDays, calculatedCoveredDays)) : 0;
  const coveragePercent = tripDays > 0 ? Math.round((coveredDays / tripDays) * 100) : 0;
  const coverageBlockers = [
    freshTopCount === 0 && "un haut",
    bottomCount === 0 && "un bas",
    shoeCount === 0 && "une paire de chaussures",
  ].filter(Boolean);
  const missingFreshTops = Math.max(0, requiredTops - freshTopCount);
  const missingPackingItems = [{ count: missingFreshTops, label: "haut" }, { count: Math.max(0, requiredBottoms - bottomCount), label: "bas" }, { count: Math.max(0, requiredShoes - shoeCount), label: "paire de chaussures", plural: "paires de chaussures" }, { count: Math.max(0, requiredInters - interCount), label: "inter" }, { count: Math.max(0, requiredCoats - coatCount), label: "manteau" }].filter(value => value.count > 0);
  const missingPackingLabel = missingPackingItems.map(value => `${value.count} ${value.count > 1 ? value.plural || `${value.label}s` : value.label}`).join(" · ");
  const visible = clothes.filter(item => (!category || item.category === category) && (!season || item.season?.includes(season)));
  const packedItems = useMemo(() => [...new Map(outfits.flatMap(outfit => outfit.items).map(item => [item._id, item])).values()], [outfits]);
  const workshopPageCount = Math.max(1, Math.ceil(outfits.length / 4));
  const visibleOutfits = outfits.slice(workshopPage * 4, workshopPage * 4 + 4);
  useEffect(() => { setWorkshopPage(current => Math.min(current, workshopPageCount - 1)); }, [workshopPageCount]);
  const suggestions = useMemo(() => clothes.filter(item => !selected.includes(item._id) && (!suggestionSeason || item.season?.includes(suggestionSeason)) && (!suggestionCategory || item.category === suggestionCategory)).map(item => ({ item, links: selectedItems.filter(seed => areCompatible(seed, item)).length })).filter(value => value.links > 0).sort((a, b) => { const scoreA = a.links * 100 + (a.item.compatibleWith?.length || 0), scoreB = b.links * 100 + (b.item.compatibleWith?.length || 0); return suggestionSort === "more" ? scoreB - scoreA : scoreA - scoreB; }).slice(0, 24), [clothes, suggestionCategory, suggestionSeason, suggestionSort, selected, selectedItems]);
  const suggestionPageCount = Math.max(1, Math.ceil(suggestions.length / 10));
  const visibleSuggestions = suggestions.slice(suggestionPage * 10, suggestionPage * 10 + 10);
  useEffect(() => { setSuggestionPage(0); }, [suggestionCategory, suggestionSeason, suggestionSort]);
  useEffect(() => { setSuggestionPage(current => Math.min(current, suggestionPageCount - 1)); }, [suggestionPageCount]);

  const updateDestination = (index, destination) => setDestinations(current => current.map((value, valueIndex) => valueIndex === index ? destination : value));
  const toggleSelected = item => setSelected(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id]);
  const toggleIncluded = id => setIncluded(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const suggestionReason = ({ item, links }) => {
    if (item.category === "Manteau" && weatherSummary?.min < 15) return `Utile pour les journées à partir de ${weatherSummary.min}°`;
    if ((item.category === "Inter" || item.category === "Manteau") && weatherSummary?.rainDays) return `Pratique pour ${weatherSummary.rainDays} jour(s) potentiellement pluvieux`;
    if (links > 1) return `Compatible avec ${links} pièces de votre sélection`;
    return `Ajoute une option ${item.category.toLowerCase()} à la capsule`;
  };
  const excludedCategories = weatherSummary?.min >= 18 ? ["Manteau"] : [];
  const makeOutfit = (offset, lockedIds = []) => completeOutfit({ clothes, seedIds: lockedIds, lockedIds, season, offset, excludedCategories });
  const seedsForOffset = (items, offset) => categories.reduce((seeds, value) => {
    const group = items.filter(item => item.category === value).filter(item => seeds.every(seed => areCompatible(seed, item)));
    if (group.length) seeds.push(group[offset % group.length]);
    return seeds;
  }, []).map(item => item._id);
  const buildProposals = () => {
    const sourceItems = includedItems.length ? includedItems : selectedItems;
    return Array.from({ length: count }, (_, index) => {
      const seedIds = seedsForOffset(sourceItems, generation + index);
      return makeOutfit(generation + index, seedIds);
    }).filter(proposal => proposal.length);
  };
  const generate = () => {
    const proposals = buildProposals();
    if (!proposals.length) return setError("Aucune tenue compatible ne peut être générée avec cette sélection.");
    setOutfits(proposals.map((items, index) => ({ id: `${Date.now()}-${index}`, name: `Tenue ${index + 1}`, items })));
    setWorkshopLocks(selected); setGeneration(value => value + count); setError(""); setStage("workshop");
  };
  const regenerateOutfit = outfitIndex => {
    const lockedIds = outfits[outfitIndex].items.filter(item => workshopLocks.includes(item._id)).map(item => item._id);
    const items = makeOutfit(generation + outfitIndex, lockedIds);
    setGeneration(value => value + 1);
    setOutfits(current => current.map((outfit, index) => index === outfitIndex ? { ...outfit, items } : outfit));
  };
  const replaceItem = (outfitIndex, itemId) => {
    const outfit = outfits[outfitIndex], currentItem = outfit.items.find(item => item._id === itemId), others = outfit.items.filter(item => item._id !== itemId);
    const candidates = clothes.filter(item => item.category === currentItem.category && item._id !== itemId && (!season || item.season?.includes(season)) && others.every(other => areCompatible(other, item))).sort((a, b) => (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0));
    if (!candidates.length) return setError(`Aucune autre pièce ${currentItem.category.toLowerCase()} compatible.`);
    const replacement = candidates[generation % candidates.length];
    setGeneration(value => value + 1); setError("");
    setOutfits(current => current.map((value, index) => index === outfitIndex ? { ...value, items: value.items.map(item => item._id === itemId ? replacement : item) } : value));
  };
  const addOutfit = () => {
    const seedIds = seedsForOffset(includedItems, generation);
    const items = makeOutfit(generation, seedIds);
    setGeneration(value => value + 1); setWorkshopPage(Math.floor(outfits.length / 4)); setOutfits(current => [...current, { id: `${Date.now()}-new`, name: `Tenue ${current.length + 1}`, items }]);
  };
  const save = async (outfitsToSave = outfits) => {
    if (!outfitsToSave.length) return setError("Aucune tenue compatible ne peut être enregistrée.");
    const destinationNames = destinations.map(destination => destination.destination).filter(Boolean);
    const capsuleName = name.trim() || (destinationNames.length ? `Voyage · ${destinationNames.join(" · ")}` : "Ma capsule voyage");
    if (!name.trim()) setName(capsuleName);
    setSaving(true);
    try { await api("/collections/capsule/generated", { method: "POST", body: JSON.stringify({ name: capsuleName, season, travel, weather, outfits: outfitsToSave.map(outfit => ({ name: `${capsuleName} · ${outfit.name}`, clothes: outfit.items.map(item => item._id) })) }) }); localStorage.removeItem(draftKey); navigate("/capsules"); }
    catch (err) { setError(err.message); setSaving(false); }
  };
  const saveFromCompletion = () => {
    const proposals = buildProposals();
    if (!proposals.length) return setError("Aucune tenue compatible ne peut être enregistrée avec cette sélection.");
    const generatedOutfits = proposals.map((items, index) => ({ id: `${Date.now()}-${index}`, name: `Tenue ${index + 1}`, items }));
    setOutfits(generatedOutfits);
    setError("");
    save(generatedOutfits);
  };
  const titles = { count: "Préparez votre voyage", select: "Choisissez vos pièces de départ", suggest: "Complétez votre capsule", workshop: "Atelier de capsule" };
  const goBack = () => { if (stage === "count") navigate("/capsules"); else setStage(stage === "workshop" ? "suggest" : stage === "suggest" ? "select" : "count"); };
  const startNewCapsule = () => { localStorage.removeItem(draftKey); window.location.reload(); };

  return <div className={`capsule-create-flow capsule-stage-${stage}`}>
    {draftPromptOpen && <Modal title="Un brouillon est en cours" onClose={() => setDraftPromptOpen(false)}><div className="draft-choice"><p>Vous avez une capsule non terminée. Voulez-vous reprendre là où vous vous êtes arrêté ou repartir de zéro&nbsp;?</p><div><button type="button" className="secondary" onClick={startNewCapsule}><Plus size={17}/> Créer une nouvelle capsule</button><button type="button" className="primary" onClick={() => setDraftPromptOpen(false)}><RotateCcw size={17}/> Reprendre le brouillon</button></div></div></Modal>}
    <header className="page-header"><div><span className="eyebrow">Capsule bagage</span><h1>{titles[stage]}</h1></div><div className="capsule-header-actions">{draftRestored && !draftPromptOpen && <span className="draft-restored"><Check size={14}/> Brouillon restauré</span>}{stage === "select" && selected.length > 0 && <button type="button" className="secondary capsule-reset-selection" onClick={() => { setSelected([]); setIncluded([]); setCategory(""); setError(""); }}><RotateCcw size={16}/> Réinitialiser</button>}<button className="secondary" onClick={goBack}><ArrowLeft size={18}/> Retour</button></div></header>
    {stage !== "count" && stage !== "suggest" && weather && <section className="travel-weather-summary itinerary-summary"><div><span className="eyebrow">{weather.type === "forecast" ? "Prévisions détaillées" : "Tendances saisonnières estimatives"}</span><h3>{weather.locations?.map(location => location.destination).join(" · ")}</h3><p>{weather.locations?.length} étape{weather.locations?.length > 1 ? "s" : ""} analysée{weather.locations?.length > 1 ? "s" : ""}</p></div>{weatherSummary && <div><strong>{weatherSummary.min}° à {weatherSummary.max}°</strong><span>{weatherSummary.rainDays} jour(s) potentiellement pluvieux</span></div>}<div className="itinerary-weather-locations">{weather.locations?.map(location => { const summary = summarizeTravelWeather(location); return <span key={`${location.destination}-${location.daily?.[0]?.date}`}><b>{location.destination}</b>{summary?.min}° / {summary?.max}°</span>; })}</div></section>}

    {stage === "count" && <section className="capsule-count-step travel-count-step"><Luggage size={38}/><p>Ajoutez toutes les étapes du voyage. La météo et les saisons seront déterminées automatiquement.</p><div className="travel-itinerary">{destinations.map((destination, index) => <DestinationField key={destination.id} destination={destination} index={index} canRemove={destinations.length > 1} recentLocations={reusableLocations} onChange={value => updateDestination(index, value)} onRemove={() => setDestinations(current => current.filter((_, valueIndex) => valueIndex !== index))}/>)}</div><button type="button" className="secondary add-destination" onClick={() => setDestinations(current => [...current, emptyDestination()])}><Plus size={16}/> Ajouter une destination ou une escale</button><div className="trip-count"><button aria-label="Retirer une tenue" onClick={() => setCount(value => Math.max(1, value - 1))}><Minus/></button><strong>{count}</strong><button aria-label="Ajouter une tenue" onClick={() => setCount(value => Math.min(20, value + 1))}><Plus/></button><span>tenue{count > 1 ? "s" : ""}</span></div><button className="primary" disabled={!itineraryIsValid || weatherLoading} onClick={async () => { setWeatherLoading(true); setError(""); setSeason(inferredSeasons[0] || ""); try { setWeather(await fetchItineraryWeather(travel)); setStage("select"); } catch (err) { setError(err.message); } finally { setWeatherLoading(false); } }}>{weatherLoading ? `Analyse de ${destinations.length} étape${destinations.length > 1 ? "s" : ""}…` : "Analyser et commencer"}<ChevronRight size={18}/></button>{error && <p className="field-error">{error}</p>}</section>}

    {stage === "select" && <><section className="capsule-create-settings"><label>Nom de la capsule<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Voyage en Allemagne"/></label><div className="outfit-filter-row"><span>Saison</span><div className="category-pills">{seasons.map(value => <button key={value} className={season === value ? "active" : ""} onClick={() => setSeason(value)}>{value}</button>)}</div></div><div className="outfit-filter-row"><span>Catégorie</span><div className="category-pills"><button className={!category ? "active" : ""} onClick={() => setCategory("")}>Tout</button>{categories.map(value => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div></div></section><section className="capsule-seed-grid">{visible.map(item => <button key={item._id} className={selected.includes(item._id) ? "selected" : ""} onClick={() => toggleSelected(item)}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}{selected.includes(item._id) && <i><Lock size={14}/></i>}</button>)}</section><ItemPreview items={selectedItems} lockedIds={selected} onRemove={id => setSelected(current => current.filter(value => value !== id))}/>{error && <p className="field-error">{error}</p>}<footer className="capsule-flow-actions"><span>Choisissez une ou plusieurs pièces que vous voulez absolument emporter.</span><button className="primary" disabled={!selected.length} onClick={() => { setIncluded(selected); setSuggestionSeason(season); setStage("suggest"); }}><Sparkles size={18}/> Trouver des pièces complémentaires</button></footer></>}

    {stage === "suggest" && <>
      <section className="capsule-completion-minimal">
        <aside className="completion-sidebar">
          <div className="completion-trip"><b>{tripDays} jours · {weather?.locations?.length || 1} destination{weather?.locations?.length > 1 ? "s" : ""}</b>{weatherSummary && <span>{weatherSummary.min}° à {weatherSummary.max}° · {weatherSummary.rainDays} j. de pluie</span>}</div>
          <div className="completion-progress"><strong><span className="completion-days-number">{String(coveredDays)}</span><small>/{tripDays}</small></strong><span>jours couverts</span><i><span style={{ width: `${coveragePercent}%` }}/></i>{coverageBlockers.length > 0 && <p>Ajoutez {coverageBlockers.join(" + ")} pour former une première tenue complète.</p>}</div>
          <div className="completion-sidebar-total"><b>{included.length} pièces</b><span>{possibleOutfitCount} combinaisons possibles</span></div>
          <div className="completion-next">
            <button className="primary" disabled={saving || !possibleOutfitCount} onClick={saveFromCompletion}><Check size={19}/>{saving ? "Enregistrement…" : "Enregistrer la capsule"}</button>
            <button className="secondary" disabled={saving || !possibleOutfitCount} onClick={generate}><Sparkles size={18}/> Vérifier les {count} tenues</button>
            {error && <small className="field-error">{error}</small>}
          </div>
          <div className="completion-needs"><span className={freshTopCount >= requiredTops ? "done" : ""}>Hauts <b>{freshTopCount}/{requiredTops}</b></span><span className={bottomCount >= requiredBottoms ? "done" : ""}>Bas <b>{bottomCount}/{requiredBottoms}</b></span><span className={shoeCount >= requiredShoes ? "done" : ""}>Chaussures <b>{shoeCount}/{requiredShoes}</b></span>{requiredInters > 0 && <span className={interCount >= requiredInters ? "done" : ""}>Inter <b>{interCount}/{requiredInters}</b></span>}{requiredCoats > 0 && <span className={coatCount >= requiredCoats ? "done" : ""}>Manteau <b>{coatCount}/{requiredCoats}</b></span>}</div>
          <div className="completion-coverage-actions"><button type="button" aria-label="Ouvrir les réglages" title={packingRules.profile === "custom" ? "Réglages personnalisés" : `Profil ${packingRules.label}`} onClick={() => navigate("/settings")}><Settings2 size={19}/></button><button type="button" aria-label="Réinitialiser la sélection" title="Réinitialiser la sélection" onClick={() => { setIncluded(selected); setSuggestionCategory(""); setSuggestionSeason(season); }}><RotateCcw size={19}/></button></div>
        </aside>
        <section className="capsule-suggestions completion-library-minimal">
          <div className="completion-filter-groups"><div className="outfit-filter-row"><span>Catégorie</span><div className="category-pills"><button className={!suggestionCategory ? "active" : ""} onClick={() => setSuggestionCategory("")}>Tout</button>{categories.map(value => <button key={value} className={suggestionCategory === value ? "active" : ""} onClick={() => setSuggestionCategory(value)}>{value}</button>)}</div></div><div className="outfit-filter-row"><span>Saison</span><div className="category-pills"><button className={!suggestionSeason ? "active" : ""} onClick={() => setSuggestionSeason("")}>Toutes</button>{seasons.map(value => <button key={value} className={suggestionSeason === value ? "active" : ""} onClick={() => setSuggestionSeason(value)}>{value}</button>)}</div></div><div className="suggestion-sort"><button type="button" className={suggestionSort === "more" ? "active" : ""} onClick={() => setSuggestionSort("more")}>Plus compatibles</button><button type="button" className={suggestionSort === "less" ? "active" : ""} onClick={() => setSuggestionSort("less")}>Moins compatibles</button></div></div>
          <div className="suggestion-carousel">{visibleSuggestions.map(({ item }) => <button type="button" key={item._id} className={`suggestion-tile ${included.includes(item._id) ? "selected" : ""}`} aria-label={`${included.includes(item._id) ? "Retirer" : "Ajouter"} ${item.name || item.category}`} title={item.name || item.category} onClick={() => toggleIncluded(item._id)}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}{included.includes(item._id) && <i><Check size={16}/></i>}</button>)}</div>
          {suggestionPageCount > 1 && <nav className="completion-pagination" aria-label="Pages de vêtements"><button type="button" aria-label="Page précédente" onClick={() => setSuggestionPage(value => (value - 1 + suggestionPageCount) % suggestionPageCount)}><ChevronLeft size={18}/></button><span>{suggestionPage + 1} / {suggestionPageCount}</span><button type="button" aria-label="Page suivante" onClick={() => setSuggestionPage(value => (value + 1) % suggestionPageCount)}><ChevronRight size={18}/></button></nav>}
        </section>
      </section>
    </>}

    {stage === "workshop" && <>
      <section className="capsule-workshop">
        <div className="capsule-workshop-outfits">
          <header>
            <div><span className="eyebrow">Vos tenues</span><h2>{outfits.length} proposition{outfits.length > 1 ? "s" : ""}</h2></div>
            <div className="workshop-toolbar">
              {workshopPageCount > 1 && <nav className="workshop-pagination" aria-label="Pages de propositions">
                <button type="button" aria-label="Propositions précédentes" onClick={() => setWorkshopPage(value => (value - 1 + workshopPageCount) % workshopPageCount)}><ChevronLeft size={17}/></button>
                <span>{outfits.length ? workshopPage * 4 + 1 : 0}–{Math.min((workshopPage + 1) * 4, outfits.length)} <small>sur {outfits.length}</small></span>
                <button type="button" aria-label="Propositions suivantes" onClick={() => setWorkshopPage(value => (value + 1) % workshopPageCount)}><ChevronRight size={17}/></button>
              </nav>}
              <button type="button" className="secondary" onClick={addOutfit}><CirclePlus size={17}/> Ajouter</button>
            </div>
          </header>
          {visibleOutfits.map((outfit, visibleIndex) => {
            const outfitIndex = workshopPage * 4 + visibleIndex;
            return <article key={outfit.id}>
              <header>
                <input value={outfit.name} aria-label="Nom de la tenue" onChange={event => setOutfits(current => current.map((value, index) => index === outfitIndex ? { ...value, name: event.target.value } : value))}/>
                <div><button type="button" title="Régénérer cette tenue" onClick={() => regenerateOutfit(outfitIndex)}><RefreshCw size={16}/><span>Régénérer</span></button><button type="button" className="danger" title="Supprimer cette tenue" onClick={() => setOutfits(current => current.filter((_, index) => index !== outfitIndex))}><Trash2 size={16}/></button></div>
              </header>
              <div className="workshop-outfit-items">{outfit.items.map(item => <figure key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span/>}<figcaption>{item.category}</figcaption><div><button type="button" className={workshopLocks.includes(item._id) ? "locked" : ""} title={workshopLocks.includes(item._id) ? "Déverrouiller" : "Verrouiller"} onClick={() => setWorkshopLocks(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}><Lock size={14}/></button><button type="button" title="Remplacer automatiquement" onClick={() => replaceItem(outfitIndex, item._id)}><Sparkles size={14}/></button><button type="button" className="remove" title="Retirer de cette tenue" onClick={() => setOutfits(current => current.map((value, index) => index === outfitIndex ? { ...value, items: value.items.filter(candidate => candidate._id !== item._id) } : value))}><Trash2 size={14}/></button></div></figure>)}</div>
            </article>;
          })}
        </div>
        <aside className="capsule-workshop-summary">
          <label>Nom de la capsule<input value={name} onChange={event => setName(event.target.value)} placeholder="Nom de la capsule"/></label>
          <section><span className="eyebrow">Liste bagages</span><h2>{packedItems.length} pièces uniques</h2><div className="workshop-packing-list">{packedItems.map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}<span><b>{item.name || item.category}</b><small>Dans {outfits.filter(outfit => outfit.items.some(value => value._id === item._id)).length} tenue(s)</small></span></div>)}</div></section>
          <section className="capsule-coherence"><span className="eyebrow">Cohérence météo</span>{weatherSummary && <div className="coherence-stats"><p><Thermometer size={16}/>{weatherSummary.min}°–{weatherSummary.max}°</p><p><CloudRain size={16}/>{weatherSummary.rainDays} j. de pluie</p></div>}{weatherSummary?.min < 15 && !packedItems.some(item => item.category === "Manteau" || item.category === "Inter") ? <strong className="warning">Ajoutez une couche chaude.</strong> : <strong className="ok"><Check size={15}/> Capsule cohérente</strong>}</section>
          <button className="primary workshop-save" disabled={saving || !outfits.length} onClick={() => save()}><Check size={18}/>{saving ? "Enregistrement…" : "Enregistrer la capsule"}</button>
        </aside>
      </section>
      {error && <p className="field-error">{error}</p>}
    </>}
  </div>;
}
