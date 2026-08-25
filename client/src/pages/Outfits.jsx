import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, Check, ChevronDown, ChevronRight, CirclePlus, GripVertical, Link2, ListChecks, Luggage, Minus, MoreHorizontal, Pencil, Plus, RefreshCw, Shirt, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { api } from "../services/api";
import { fetchItineraryWeather } from "../services/travelWeather";
import ClothingCard from "../components/ClothingCard";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import PageState from "../components/PageState";
import { buildCompatibleCapsuleOutfits } from "../utils/capsuleOutfitCombinations";
import { useNavigate, useParams } from "react-router";

const seasons = ["Printemps", "Été", "Automne", "Hiver"];
const categories = ["Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"];
const capsuleCategoryCounters = [
  { category: "Haut", label: "Hauts", requirement: "tops" },
  { category: "Bas", label: "Bas", requirement: "bottoms" },
  { category: "Chaussures", label: "Chaussures", requirement: "shoes" },
  { category: "Inter", label: "Inters", requirement: "inters" },
  { category: "Manteau", label: "Manteaux", requirement: "coats" },
];
const simpleCapsuleTiers = [
  { key: "upper", label: "Haut du corps", categories: ["Haut", "Inter", "Manteau", "Accessoire"], addCategory: "Haut" },
  { key: "bottom", label: "Bas", categories: ["Bas"], addCategory: "Bas" },
  { key: "shoes", label: "Chaussures", categories: ["Chaussures"], addCategory: "Chaussures" },
];
const capsuleDraftKey = "wearsense:capsule-draft";
const defaultTravelChecklist = [
  ["Hygiène / santé", "Brosse à dents"],
  ["Hygiène / santé", "Dentifrice"],
  ["Hygiène / santé", "Lingettes"],
  ["Hygiène / santé", "Savon"],
  ["Hygiène / santé", "Serviette"],
  ["Hygiène / santé", "Papier toilette"],
  ["Hygiène / santé", "Préservatifs"],
  ["Hygiène / santé", "Dexeryl"],
  ["Hygiène / santé", "Cétirizine"],
  ["Hygiène / santé", "Ventoline"],
  ["Hygiène / santé", "Prednisolone"],
  ["Hygiène / santé", "Ordonnances des médicaments"],
  ["Électronique", "Batterie externe"],
  ["Électronique", "Chargeur iPhone"],
  ["Électronique", "Chargeur du casque Bluetooth"],
  ["Documents / paiement", "Carte bancaire n°1"],
  ["Documents / paiement", "Carte bancaire n°2"],
  ["Documents / paiement", "Carte de transport"],
  ["Documents / paiement", "Carte d’identité"],
  ["Pratique", "Gourde"]
].map(([category, label], index) => ({ key: `travel-default-${index + 1}`, category, label, checked: false }));
const checklistTemplateId = value => String(value?._id || value || "");
const checklistKey = checklist => String(checklist?._clientKey || checklist?._id || checklistTemplateId(checklist?.templateId) || `name:${checklist?.name || "Checklist"}`);
const capsuleChecklistInstances = capsule => {
  // `checklists: []` is an intentional state: the user removed every checklist.
  // Falling back in that case would immediately recreate the legacy "Voyage" list.
  if (Array.isArray(capsule?.checklists)) return capsule.checklists.map(item => ({ ...item, items: (item.items || []).map(entry => ({ ...entry })) }));
  const legacyItems = Array.isArray(capsule?.travelChecklist) && capsule.travelChecklist.length ? capsule.travelChecklist : defaultTravelChecklist;
  return [{ _clientKey: "legacy-voyage", name: "Voyage", items: legacyItems.map(item => ({ ...item })) }];
};
const capsuleOutfitLabel = name => name?.match(/(?:^| · )(Tenue \d+)$/)?.[1] || name;
const outfitSelectionKey = items => items.map(item => item._id).sort().join(":");
const outfitSeasons = outfit => Array.isArray(outfit.season) ? outfit.season : outfit.season ? [outfit.season] : [];
const capsuleSeasonLabels = capsule => {
  const explicit = Array.isArray(capsule?.season)
    ? capsule.season.filter(value => seasons.includes(value))
    : seasons.includes(capsule?.season) ? [capsule.season] : [];
  if (explicit.length) return explicit;
  const inferred = seasons.filter(value => (capsule?.clothes || []).some(item => (
    Array.isArray(item?.season) ? item.season.includes(value) : item?.season === value
  )));
  return !inferred.length || inferred.length === seasons.length ? ["Toutes saisons"] : inferred;
};
const travelDestinations = capsule => capsule?.travel?.destinations?.length ? capsule.travel.destinations : capsule?.travel?.destination ? [capsule.travel] : [];
const weatherDaysForDestination = (weather, destination, index) => {
  const locations = weather?.locations || [];
  const location = locations.find(item => item.destination === destination.destination) || locations[index];
  const days = location?.daily?.length ? location.daily : weather?.daily || [];
  return days.filter(day => (!destination.startDate || day.date >= destination.startDate) && (!destination.endDate || day.date <= destination.endDate));
};
const weatherRangeForDestination = (weather, destination, index) => {
  const days = weatherDaysForDestination(weather, destination, index);
  const minimums = days.map(day => Number(day.min)).filter(Number.isFinite);
  const maximums = days.map(day => Number(day.max)).filter(Number.isFinite);
  if (!minimums.length || !maximums.length) return null;
  return { min: Math.round(Math.min(...minimums)), max: Math.round(Math.max(...maximums)) };
};
const formatTravelDate = value => {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(date);
};
const formatTravelPeriod = destination => {
  const start = formatTravelDate(destination.startDate);
  const end = formatTravelDate(destination.endDate);
  return start && end && start !== end ? `${start} – ${end}` : start || end;
};

export default function Outfits({ capsulesOnly = false }) {
  const navigate = useNavigate();
  const { capsuleId } = useParams();
  const [outfits, setOutfits] = useState([]);
  const [clothes, setClothes] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [sortByCompatibility, setSortByCompatibility] = useState(false);
  const [capsules, setCapsules] = useState([]);
  const [openCapsule, setOpenCapsule] = useState(null);
  const [capsuleDetailTab, setCapsuleDetailTab] = useState("packing");
  const [capsulePackingCategory, setCapsulePackingCategory] = useState("");
  const [packedItems, setPackedItems] = useState([]);
  const [travelChecklist, setTravelChecklist] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [capsuleChecklists, setCapsuleChecklists] = useState([]);
  const [activeChecklistKey, setActiveChecklistKey] = useState("");
  const [managingCapsuleChecklists, setManagingCapsuleChecklists] = useState(false);
  const [selectedChecklistTemplateIds, setSelectedChecklistTemplateIds] = useState([]);
  const [travelChecklistSaving, setTravelChecklistSaving] = useState(false);
  const [syncingChecklistId, setSyncingChecklistId] = useState("");
  const [publishingChecklistId, setPublishingChecklistId] = useState("");
  const [travelChecklistLabel, setTravelChecklistLabel] = useState("");
  const [travelChecklistCategory, setTravelChecklistCategory] = useState("Pratique");
  const [newTravelChecklistCategory, setNewTravelChecklistCategory] = useState("");
  const [quickTravelChecklistCategory, setQuickTravelChecklistCategory] = useState("");
  const [quickTravelChecklistLabel, setQuickTravelChecklistLabel] = useState("");
  const [editingTravelChecklistCategory, setEditingTravelChecklistCategory] = useState("");
  const [editingTravelChecklistCategoryName, setEditingTravelChecklistCategoryName] = useState("");
  const [draggedTravelChecklistKey, setDraggedTravelChecklistKey] = useState("");
  const [travelChecklistDropTarget, setTravelChecklistDropTarget] = useState("");
  const travelChecklistCategoryMenuRef = useRef(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [addTarget, setAddTarget] = useState(null);
  const [addingPackingItem, setAddingPackingItem] = useState(false);
  const [packingCategory, setPackingCategory] = useState("");
  const [packingSeason, setPackingSeason] = useState("");
  const [packingDetailItem, setPackingDetailItem] = useState(null);
  const [openOutfit, setOpenOutfit] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [capsuleRating, setCapsuleRating] = useState(0);
  const [capsuleReviewSaving, setCapsuleReviewSaving] = useState(false);
  const [reviewCapsule, setReviewCapsule] = useState(null);
  const [draggedPackingItem, setDraggedPackingItem] = useState(null);
  const [dropTargetOutfit, setDropTargetOutfit] = useState(null);
  const [draggedCapsuleItemId, setDraggedCapsuleItemId] = useState("");
  const [capsuleItemDropTargetId, setCapsuleItemDropTargetId] = useState("");
  const [capsuleOrderSaving, setCapsuleOrderSaving] = useState(false);
  const [capsuleActionError, setCapsuleActionError] = useState("");
  const [editingOutfitId, setEditingOutfitId] = useState(null);
  const [editingOutfitName, setEditingOutfitName] = useState("");
  const [editingCapsuleId, setEditingCapsuleId] = useState(null);
  const [editingCapsuleName, setEditingCapsuleName] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [creatingCapsuleOutfit, setCreatingCapsuleOutfit] = useState(false);
  const [newCapsuleOutfitItems, setNewCapsuleOutfitItems] = useState([]);
  const [generatedOutfitReview, setGeneratedOutfitReview] = useState(null);
  const [savingGeneratedOutfits, setSavingGeneratedOutfits] = useState(false);
  const [seasonSavingOutfitId, setSeasonSavingOutfitId] = useState(null);
  const [draggedOutfitItem, setDraggedOutfitItem] = useState(null);
  const [reorderTargetItem, setReorderTargetItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const loadRequestRef = useRef(0);
  const capsuleOutfitScrollerRef = useRef(null);
  const load = async ({ showLoading = false } = {}) => {
    const requestId = ++loadRequestRef.current;
    if (showLoading) setLoading(true);
    setLoadError("");
    try {
      const [nextOutfits, nextClothes, nextCollections, nextChecklists] = await Promise.all([api("/outfits"), api("/clothes"), api("/collections"), api("/checklists")]);
      if (requestId !== loadRequestRef.current) return;
      setOutfits(nextOutfits);
      setClothes(nextClothes);
      setCapsules(nextCollections.filter(collection => collection.description?.startsWith("Capsule")));
      setChecklistTemplates(nextChecklists);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(error.message || "Impossible de charger vos données.");
    } finally {
      if (requestId !== loadRequestRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!capsuleId || openCapsule?._id === capsuleId) return;
    const capsule = capsules.find(item => item._id === capsuleId);
    if (capsule) openCapsuleDetail(capsule);
  }, [capsuleId, capsules, openCapsule]);
  useEffect(() => {
    if (!openCapsule || capsuleDetailTab !== "outfits" || generatedOutfitReview || creatingCapsuleOutfit || openOutfit || confirmDialog) return undefined;
    const handleCapsuleCarouselKeys = event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const scroller = capsuleOutfitScrollerRef.current;
      const card = scroller?.querySelector(":scope > article");
      if (!scroller || !card) return;
      event.preventDefault();
      const gap = Number.parseFloat(window.getComputedStyle(scroller).columnGap) || 0;
      scroller.scrollBy({ left: (card.getBoundingClientRect().width + gap) * (event.key === "ArrowLeft" ? -1 : 1), behavior: "smooth" });
    };
    window.addEventListener("keydown", handleCapsuleCarouselKeys);
    return () => window.removeEventListener("keydown", handleCapsuleCarouselKeys);
  }, [openCapsule?._id, capsuleDetailTab, Boolean(generatedOutfitReview), creatingCapsuleOutfit, Boolean(openOutfit), Boolean(confirmDialog)]);

  const closeCreator = () => { setOpen(false); setSelected([]); setSelectedSeason(""); setSortByCompatibility(false); };
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const save = async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.clothes = selected;
    body.season = selectedSeason;
    await api("/outfits", { method: "POST", body: JSON.stringify(body) });
    closeCreator(); load();
  };
  const remove = outfit => setConfirmDialog({
    title: "Supprimer cette tenue ?",
    message: `La tenue « ${outfit.name} » sera définitivement supprimée. Les vêtements resteront dans votre garde-robe.`,
    label: "Supprimer la tenue",
    action: async () => { await api(`/outfits/${outfit._id}`, { method: "DELETE" }); await load(); },
  });
  const visibleClothes = clothes.filter(item => {
    if (selected.includes(item._id)) return true;
    if (selectedSeason && !item.season?.includes(selectedSeason)) return false;
    if (selected.some(selectedId => clothes.find(candidate => candidate._id === selectedId)?.category === item.category)) return false;
    return selected.every(selectedId => {
      const selectedItem = clothes.find(candidate => candidate._id === selectedId);
      return selectedItem?.compatibleWith?.some(value => (value._id || value) === item._id);
    });
  }).sort((a, b) => sortByCompatibility ? (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0) : 0);
  const openCapsuleDetail = async capsule => {
    if (capsulesOnly && !capsuleId) { navigate(`/capsules/${capsule._id}`); return; }
    const checklistInstances = capsuleChecklistInstances(capsule);
    setPackedItems([]);
    setCapsuleChecklists(checklistInstances);
    setActiveChecklistKey(checklistKey(checklistInstances[0]));
    setTravelChecklist(checklistInstances[0]?.items || []);
    setCapsuleDetailTab("packing"); setCapsulePackingCategory(""); setPackingDetailItem(null); setCapsuleRating(capsule.rating || 0); setCapsuleActionError(""); setOpenCapsule(capsule);
    const destinations = capsule.travel?.destinations?.length ? capsule.travel.destinations : [capsule.travel];
    if (!destinations.some(destination => destination?.latitude != null && destination?.startDate)) return;
    const today = new Date().toISOString().slice(0, 10);
    if (destinations.every(destination => destination?.endDate && destination.endDate < today)) return;
    const refreshDelay = capsule.weather?.type === "seasonal" ? 12 : 3;
    const stale = !capsule.weather?.updatedAt || Date.now() - new Date(capsule.weather.updatedAt).getTime() > refreshDelay * 60 * 60 * 1000;
    if (!stale) return;
    try {
      const weather = await fetchItineraryWeather({ destinations });
      const weatherUpdate = { weather };
      if (!capsule.weatherSnapshot?.updatedAt && capsule.weather?.updatedAt) weatherUpdate.weatherSnapshot = capsule.weather;
      const updated = await api(`/collections/${capsule._id}`, { method: "PUT", body: JSON.stringify(weatherUpdate) });
      setOpenCapsule(updated); setCapsules(current => current.map(item => item._id === updated._id ? updated : item));
    } catch {
      // Le rafraîchissement est une tâche de fond : la capsule reste utilisable
      // et conserve sa dernière météo connue si le fournisseur est indisponible.
    }
  };
  const replacementCandidates = replaceTarget ? clothes.filter(candidate => {
    if (candidate.category !== replaceTarget.item.category || candidate._id === replaceTarget.item._id) return false;
    return replaceTarget.outfit.clothes.filter(item => item._id !== replaceTarget.item._id).every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const additionCandidates = addTarget ? clothes.filter(candidate => {
    if (addTarget.clothes.some(item => item.category === candidate.category)) return false;
    return addTarget.clothes.every(item => candidate.compatibleWith?.some(value => (value._id || value) === item._id));
  }) : [];
  const capsuleClothes = openCapsule?.clothes || [];
  const packingDetailSource = packingDetailItem ? clothes.find(item => item._id === packingDetailItem._id) || packingDetailItem : null;
  const compatibilityIds = item => new Set((item?.compatibleWith || []).map(value => value._id || value));
  const capsuleCompatibilityStats = item => {
    const source = clothes.find(candidate => candidate._id === item._id) || item;
    const eligibleItems = capsuleClothes.filter(candidate => candidate._id !== source._id && candidate.category !== source.category);
    const compatibleItems = eligibleItems.filter(candidate => {
      return compatibilityIds(source).has(candidate._id) || compatibilityIds(candidate).has(source._id);
    });
    const compatibleItemIds = new Set(compatibleItems.map(candidate => candidate._id));
    const incompatibleItems = eligibleItems.filter(candidate => !compatibleItemIds.has(candidate._id));
    return { compatibleItems, incompatibleItems, eligibleCount: eligibleItems.length };
  };
  const packingDetailCompatibility = packingDetailSource ? capsuleCompatibilityStats(packingDetailSource) : { compatibleItems: [], incompatibleItems: [], eligibleCount: 0 };
  const capsuleCompatibilityItems = packingDetailCompatibility.compatibleItems;
  const capsuleIncompatibilityItems = packingDetailCompatibility.incompatibleItems;
  const capsuleDestinations = travelDestinations(openCapsule);
  const isTravelCapsule = openCapsule?.capsuleMode === "travel" || capsuleDestinations.length > 0;
  const capsuleWeatherReference = openCapsule?.weatherSnapshot?.updatedAt ? openCapsule.weatherSnapshot : openCapsule?.weather;
  const newOutfitCandidates = capsuleClothes.filter(candidate => {
    if (newCapsuleOutfitItems.includes(candidate._id)) return true;
    if (newCapsuleOutfitItems.some(id => capsuleClothes.find(item => item._id === id)?.category === candidate.category)) return false;
    return newCapsuleOutfitItems.every(id => capsuleClothes.find(item => item._id === id)?.compatibleWith?.some(value => (value._id || value) === candidate._id));
  });
  const packingCandidates = openCapsule ? clothes.filter(candidate => {
    if (openCapsule.clothes.some(item => item._id === candidate._id)) return false;
    if (packingCategory && candidate.category !== packingCategory) return false;
    if (packingSeason && !candidate.season?.includes(packingSeason)) return false;
    return true;
  }) : [];
  const checkedTravelItems = travelChecklist.filter(item => item.checked).length;
  const activeChecklist = capsuleChecklists.find(item => checklistKey(item) === activeChecklistKey) || capsuleChecklists[0];
  const travelChecklistGroups = travelChecklist.reduce((groups, item) => {
    const category = item.category || "Autres";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});
  const activeChecklistCategories = [...new Set([
    ...travelChecklist.map(item => item.category),
    travelChecklistCategory
  ].filter(Boolean))];
  const travelChecklistCategories = activeChecklistCategories.length ? activeChecklistCategories : ["Autres"];
  const serializeCapsuleChecklists = checklists => checklists.map(checklist => ({
    _id: checklist._id || undefined,
    templateId: checklistTemplateId(checklist.templateId) || undefined,
    name: checklist.name || "Checklist",
    items: (checklist.items || []).map(item => ({
      key: item.key,
      category: item.category,
      label: item.label,
      checked: Boolean(item.checked)
    }))
  }));
  const applySavedCapsuleChecklists = (updated, checklistToKeep = activeChecklist) => {
    const savedChecklists = capsuleChecklistInstances(updated);
    const savedActive = savedChecklists.find(checklist => String(checklist._id || "") === String(checklistToKeep?._id || ""))
      || savedChecklists.find(checklist => checklistTemplateId(checklist.templateId) === checklistTemplateId(checklistToKeep?.templateId))
      || savedChecklists.find(checklist => checklist.name?.toLocaleLowerCase("fr") === checklistToKeep?.name?.toLocaleLowerCase("fr"))
      || savedChecklists[0];
    setCapsuleChecklists(savedChecklists);
    setActiveChecklistKey(checklistKey(savedActive));
    setTravelChecklist(savedActive?.items || []);
    setOpenCapsule(updated);
    setCapsules(current => current.map(capsule => capsule._id === updated._id ? updated : capsule));
    return { capsule: updated, checklist: savedActive };
  };
  const ensureActiveChecklistPersisted = async () => {
    if (activeChecklist?._id) return { capsule: openCapsule, checklist: activeChecklist };
    if (!openCapsule || !activeChecklist) throw new Error("Checklist introuvable dans cette capsule.");
    const updated = await api(`/collections/${openCapsule._id}/checklists`, {
      method: "PUT",
      body: JSON.stringify({ checklists: serializeCapsuleChecklists(capsuleChecklists) })
    });
    return applySavedCapsuleChecklists(updated, activeChecklist);
  };
  const persistTravelChecklist = async nextItems => {
    if (!openCapsule || travelChecklistSaving) return;
    const previousItems = travelChecklist;
    const previousChecklists = capsuleChecklists;
    const nextChecklists = capsuleChecklists.map(checklist => checklistKey(checklist) === activeChecklistKey ? { ...checklist, items: nextItems } : checklist);
    setTravelChecklist(nextItems);
    setCapsuleChecklists(nextChecklists);
    setTravelChecklistSaving(true);
    setCapsuleActionError("");
    try {
      const updated = await api(`/collections/${openCapsule._id}/checklists`, {
        method: "PUT",
        body: JSON.stringify({ checklists: serializeCapsuleChecklists(nextChecklists) })
      });
      applySavedCapsuleChecklists(updated, activeChecklist);
    } catch (error) {
      setTravelChecklist(previousItems);
      setCapsuleChecklists(previousChecklists);
      setCapsuleActionError(error.message || "Impossible d’enregistrer la checklist.");
    } finally {
      setTravelChecklistSaving(false);
    }
  };
  const selectCapsuleChecklist = checklist => {
    setActiveChecklistKey(checklistKey(checklist));
    setTravelChecklist(checklist.items || []);
    setCapsuleDetailTab("checklist");
    setTravelChecklistCategory(checklist.items?.[0]?.category || "Autres");
  };
  const openCapsuleChecklistManager = () => {
    const ids = capsuleChecklists.map(checklist => {
      const directId = checklistTemplateId(checklist.templateId);
      if (directId) return directId;
      return checklistTemplates.find(template => template.name.toLocaleLowerCase("fr") === checklist.name?.toLocaleLowerCase("fr"))?._id;
    }).filter(Boolean);
    setSelectedChecklistTemplateIds(ids);
    setManagingCapsuleChecklists(true);
  };
  const saveCapsuleChecklistSelection = async () => {
    if (!openCapsule || travelChecklistSaving || (isTravelCapsule && !selectedChecklistTemplateIds.length)) return;
    setTravelChecklistSaving(true);
    setCapsuleActionError("");
    try {
      const checklists = selectedChecklistTemplateIds.map(templateId => checklistTemplates.find(item => item._id === templateId)).filter(Boolean).map(template => {
        const templateId = template._id;
        const existing = capsuleChecklists.find(item => checklistTemplateId(item.templateId) === templateId || item.name?.toLocaleLowerCase("fr") === template.name?.toLocaleLowerCase("fr"));
        const checkedByKey = new Map((existing?.items || []).map(item => [item.key, Boolean(item.checked)]));
        return {
          templateId,
          name: template.name,
          items: template.items.map(item => ({ ...item, checked: checkedByKey.get(item.key) || false }))
        };
      });
      const updated = await api(`/collections/${openCapsule._id}/checklists`, {
        method: "PUT",
        body: JSON.stringify({ checklists })
      });
      const savedChecklists = capsuleChecklistInstances(updated);
      const first = savedChecklists[0];
      setCapsuleChecklists(savedChecklists);
      setActiveChecklistKey(first ? checklistKey(first) : "");
      setTravelChecklist(first?.items || []);
      setOpenCapsule(updated);
      setCapsules(current => current.map(capsule => capsule._id === updated._id ? updated : capsule));
      setManagingCapsuleChecklists(false);
      if (!savedChecklists.length) setCapsuleDetailTab("packing");
    } catch (error) {
      setCapsuleActionError(error.message || "Impossible de modifier les checklists de la capsule.");
    } finally {
      setTravelChecklistSaving(false);
    }
  };
  const syncCapsuleChecklist = async () => {
    if (!openCapsule || !activeChecklist || travelChecklistSaving || syncingChecklistId || publishingChecklistId) return;
    setSyncingChecklistId(checklistKey(activeChecklist));
    setCapsuleActionError("");
    try {
      const persisted = await ensureActiveChecklistPersisted();
      const checklistId = String(persisted.checklist._id);
      const updated = await api(`/collections/${persisted.capsule._id}/checklists/${checklistId}/sync`, { method: "POST" });
      const savedChecklists = capsuleChecklistInstances(updated);
      const savedActive = savedChecklists.find(checklist => String(checklist._id) === checklistId)
        || savedChecklists.find(checklist => checklistTemplateId(checklist.templateId) === checklistTemplateId(persisted.checklist.templateId))
        || savedChecklists.find(checklist => checklist.name === persisted.checklist.name)
        || savedChecklists[0];
      setCapsuleChecklists(savedChecklists);
      setActiveChecklistKey(checklistKey(savedActive));
      setTravelChecklist(savedActive?.items || []);
      setOpenCapsule(updated);
      setCapsules(current => current.map(capsule => capsule._id === updated._id ? updated : capsule));
    } catch (error) {
      setCapsuleActionError(error.message || "Impossible d’actualiser cette checklist.");
    } finally {
      setSyncingChecklistId("");
    }
  };
  const publishCapsuleChecklist = async () => {
    if (!openCapsule || !activeChecklist || travelChecklistSaving || publishingChecklistId || syncingChecklistId) return;
    setPublishingChecklistId(checklistKey(activeChecklist));
    setCapsuleActionError("");
    try {
      const persisted = await ensureActiveChecklistPersisted();
      const checklistId = String(persisted.checklist._id);
      const template = await api(`/collections/${persisted.capsule._id}/checklists/${checklistId}/publish`, { method: "POST" });
      setChecklistTemplates(current => {
        const exists = current.some(item => item._id === template._id);
        return exists
          ? current.map(item => item._id === template._id ? template : item)
          : [...current, template];
      });
      setCapsuleChecklists(current => current.map(checklist => String(checklist._id) === checklistId
        ? { ...checklist, templateId: template._id }
        : checklist));
    } catch (error) {
      setCapsuleActionError(error.message || "Impossible de mettre à jour la checklist globale.");
    } finally {
      setPublishingChecklistId("");
    }
  };
  const toggleTravelChecklistItem = key => {
    persistTravelChecklist(travelChecklist.map(item => item.key === key ? { ...item, checked: !item.checked } : item));
  };
  const removeTravelChecklistItem = key => {
    persistTravelChecklist(travelChecklist.filter(item => item.key !== key));
  };
  const appendTravelChecklistItem = (rawLabel, rawCategory) => {
    if (travelChecklistSaving) return;
    const label = rawLabel.trim();
    const category = rawCategory.trim();
    if (!label || !category) return;
    const key = `travel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    persistTravelChecklist([...travelChecklist, { key, category, label, checked: false }]);
    return true;
  };
  const addTravelChecklistItem = event => {
    event.preventDefault();
    if (!appendTravelChecklistItem(travelChecklistLabel, travelChecklistCategory)) return;
    setTravelChecklistLabel("");
  };
  const addQuickTravelChecklistItem = (event, category) => {
    event.preventDefault();
    if (!appendTravelChecklistItem(quickTravelChecklistLabel, category)) return;
    setQuickTravelChecklistLabel("");
  };
  const startTravelChecklistCategoryRename = category => {
    setQuickTravelChecklistCategory("");
    setQuickTravelChecklistLabel("");
    setEditingTravelChecklistCategory(category);
    setEditingTravelChecklistCategoryName(category);
  };
  const saveTravelChecklistCategoryRename = (event, category) => {
    event.preventDefault();
    const nextCategory = editingTravelChecklistCategoryName.trim();
    if (nextCategory && nextCategory !== category) {
      persistTravelChecklist(travelChecklist.map(item => item.category === category ? { ...item, category: nextCategory } : item));
      if (travelChecklistCategory === category) setTravelChecklistCategory(nextCategory);
    }
    setEditingTravelChecklistCategory("");
    setEditingTravelChecklistCategoryName("");
  };
  const selectTravelChecklistCategory = category => {
    setTravelChecklistCategory(category);
    travelChecklistCategoryMenuRef.current?.removeAttribute("open");
  };
  const createTravelChecklistCategory = () => {
    const category = newTravelChecklistCategory.trim();
    if (!category) return;
    setNewTravelChecklistCategory("");
    selectTravelChecklistCategory(category);
  };
  const moveTravelChecklistItem = (sourceKey, targetCategory, targetKey = "") => {
    if (!sourceKey || travelChecklistSaving) return;
    const sourceItem = travelChecklist.find(item => item.key === sourceKey);
    if (!sourceItem) return;
    const nextItems = travelChecklist.filter(item => item.key !== sourceKey);
    const movedItem = { ...sourceItem, category: targetCategory || sourceItem.category };
    const targetIndex = targetKey ? nextItems.findIndex(item => item.key === targetKey) : -1;
    if (targetIndex >= 0) {
      nextItems.splice(targetIndex, 0, movedItem);
    } else {
      const lastCategoryIndex = nextItems.reduce((lastIndex, item, index) => item.category === movedItem.category ? index : lastIndex, -1);
      nextItems.splice(lastCategoryIndex + 1, 0, movedItem);
    }
    setDraggedTravelChecklistKey("");
    setTravelChecklistDropTarget("");
    persistTravelChecklist(nextItems);
  };
  const startTravelChecklistDrag = (event, key) => {
    if (travelChecklistSaving) {
      event.preventDefault();
      return;
    }
    setDraggedTravelChecklistKey(key);
    event.dataTransfer.setData("application/x-travel-checklist-item", key);
    event.dataTransfer.effectAllowed = "move";
  };
  const endTravelChecklistDrag = () => {
    setDraggedTravelChecklistKey("");
    setTravelChecklistDropTarget("");
  };
  const applyCapsuleUpdate = updatedCapsule => {
    const previousOutfitIds = new Set((openCapsule?.outfits || []).map(outfit => outfit._id || outfit));
    const updatedOutfitIds = new Set((updatedCapsule.outfits || []).map(outfit => outfit._id || outfit));
    const removedOutfitIds = new Set([...previousOutfitIds].filter(id => !updatedOutfitIds.has(id)));
    setOutfits(current => {
      const byId = new Map(current.filter(outfit => !removedOutfitIds.has(outfit._id)).map(outfit => [outfit._id, outfit]));
      updatedCapsule.outfits.forEach(outfit => byId.set(outfit._id, outfit));
      return [...byId.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    });
    setOpenCapsule(updatedCapsule);
    setCapsules(current => current.map(capsule => capsule._id === updatedCapsule._id ? updatedCapsule : capsule));
    setPackedItems([]);
  };
  const clearCapsuleItemDrag = () => {
    setDraggedCapsuleItemId("");
    setCapsuleItemDropTargetId("");
  };
  const capsuleItemTier = item => simpleCapsuleTiers.find(tier => tier.categories.includes(item.category))?.key;
  const canReorderCapsuleItem = (sourceId, targetId) => {
    if (!sourceId || !targetId || String(sourceId) === String(targetId) || !openCapsule) return false;
    const source = openCapsule.clothes.find(item => String(item._id) === String(sourceId));
    const target = openCapsule.clothes.find(item => String(item._id) === String(targetId));
    if (!source || !target) return false;
    if (isTravelCapsule) return true;
    return capsuleItemTier(source) && capsuleItemTier(source) === capsuleItemTier(target);
  };
  const startCapsuleItemDrag = (event, item) => {
    if (capsuleOrderSaving || event.target.closest("button, input, label")) {
      event.preventDefault();
      return;
    }
    const itemId = String(item._id);
    setDraggedCapsuleItemId(itemId);
    event.dataTransfer.setData("application/x-capsule-item", itemId);
    event.dataTransfer.effectAllowed = "move";
  };
  const dragOverCapsuleItem = (event, targetId) => {
    const sourceId = event.dataTransfer.getData("application/x-capsule-item") || draggedCapsuleItemId;
    if (!canReorderCapsuleItem(sourceId, targetId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setCapsuleItemDropTargetId(String(targetId));
  };
  const reorderCapsuleItems = async (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("application/x-capsule-item") || draggedCapsuleItemId;
    if (!canReorderCapsuleItem(sourceId, targetId)) {
      clearCapsuleItemDrag();
      return;
    }
    const previousCapsule = openCapsule;
    const orderedClothes = [...previousCapsule.clothes];
    const sourceIndex = orderedClothes.findIndex(item => String(item._id) === String(sourceId));
    const targetIndex = orderedClothes.findIndex(item => String(item._id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0) {
      clearCapsuleItemDrag();
      return;
    }
    const [movedItem] = orderedClothes.splice(sourceIndex, 1);
    orderedClothes.splice(targetIndex, 0, movedItem);
    const optimisticCapsule = { ...previousCapsule, clothes: orderedClothes };
    setOpenCapsule(optimisticCapsule);
    setCapsules(current => current.map(capsule => capsule._id === optimisticCapsule._id ? optimisticCapsule : capsule));
    setCapsuleOrderSaving(true);
    setCapsuleActionError("");
    clearCapsuleItemDrag();
    try {
      const updatedCapsule = await api(`/collections/${previousCapsule._id}/items/order`, {
        method: "PUT",
        body: JSON.stringify({ clothes: orderedClothes.map(item => item._id) })
      });
      setOpenCapsule(updatedCapsule);
      setCapsules(current => current.map(capsule => capsule._id === updatedCapsule._id ? updatedCapsule : capsule));
    } catch (error) {
      setOpenCapsule(previousCapsule);
      setCapsules(current => current.map(capsule => capsule._id === previousCapsule._id ? previousCapsule : capsule));
      setCapsuleActionError(error.message || "Impossible d’enregistrer l’ordre des pièces.");
    } finally {
      setCapsuleOrderSaving(false);
      clearCapsuleItemDrag();
    }
  };
  const adjustCapsuleTarget = async delta => {
    const targetPieces = Math.min(100, Math.max(1, (openCapsule.targetPieces || 15) + delta));
    applyCapsuleUpdate(await api(`/collections/${openCapsule._id}`, { method: "PUT", body: JSON.stringify({ targetPieces }) }));
  };
  const startGeneratedOutfitReview = () => {
    const proposals = buildCompatibleCapsuleOutfits(openCapsule.clothes, openCapsule.outfits);
    if (!proposals.length) {
      setCapsuleActionError("Aucune nouvelle tenue complète et compatible ne peut être générée avec ces pièces.");
      return;
    }
    setCapsuleActionError("");
    setGeneratedOutfitReview({ proposals, index: 0, accepted: [], done: false, error: "" });
  };
  const answerGeneratedOutfit = accepted => {
    setGeneratedOutfitReview(current => {
      const currentProposal = current.proposals[current.index];
      const currentKey = outfitSelectionKey(currentProposal);
      const otherAccepted = current.accepted.filter(items => outfitSelectionKey(items) !== currentKey);
      const nextAccepted = accepted ? [...otherAccepted, currentProposal] : otherAccepted;
      const isLast = current.index === current.proposals.length - 1;
      return { ...current, accepted: nextAccepted, index: isLast ? current.index : current.index + 1, done: isLast, error: "" };
    });
  };
  const saveGeneratedOutfits = async () => {
    if (!generatedOutfitReview.accepted.length) { setGeneratedOutfitReview(null); return; }
    setSavingGeneratedOutfits(true);
    try {
      const updated = await api(`/collections/${openCapsule._id}/outfits/bulk`, {
        method: "POST",
        body: JSON.stringify({ outfits: generatedOutfitReview.accepted.map(items => ({ clothes: items.map(item => item._id) })) })
      });
      applyCapsuleUpdate(updated);
      setCapsuleDetailTab("packing");
      setGeneratedOutfitReview(null);
    } catch (error) {
      setGeneratedOutfitReview(current => ({ ...current, error: error.message }));
    } finally { setSavingGeneratedOutfits(false); }
  };
  const toggleOutfitSeason = async (outfit, season) => {
    const currentSeasons = outfitSeasons(outfit);
    const nextSeasons = currentSeasons.includes(season) ? currentSeasons.filter(value => value !== season) : [...currentSeasons, season];
    setSeasonSavingOutfitId(outfit._id);
    setCapsuleActionError("");
    try {
      const updated = await api(`/outfits/${outfit._id}`, { method: "PUT", body: JSON.stringify({ season: nextSeasons }) });
      setOutfits(current => current.map(item => item._id === updated._id ? updated : item));
      setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(item => item._id === updated._id ? updated : item) })));
      setOpenCapsule(current => current ? { ...current, outfits: current.outfits.map(item => item._id === updated._id ? updated : item) } : current);
    } catch (error) {
      setCapsuleActionError(error.message || "La saison de cette tenue n’a pas pu être modifiée.");
    } finally {
      setSeasonSavingOutfitId(null);
    }
  };
  const replaceCapsuleItem = async replacementId => {
    const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${replaceTarget.outfit._id}/replace`, { method: "PUT", body: JSON.stringify({ itemId: replaceTarget.item._id, replacementId }) });
    applyCapsuleUpdate(updatedCapsule);
    setReplaceTarget(null);
  };
  const addCapsuleItem = async itemId => {
    const added = await addItemToOutfit(addTarget._id, itemId);
    if (added) setAddTarget(null);
  };
  const addItemToOutfit = async (outfitId, itemId) => {
    setCapsuleActionError("");
    try {
      const updatedCapsule = await api(`/collections/${openCapsule._id}/outfits/${outfitId}/add`, { method: "PUT", body: JSON.stringify({ itemId }) });
      applyCapsuleUpdate(updatedCapsule);
      return true;
    } catch (error) {
      setCapsuleActionError(error.message);
      return false;
    }
  };
  const dropPackingItem = async (event, outfitId) => {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggedPackingItem;
    setDropTargetOutfit(null);
    setDraggedPackingItem(null);
    if (itemId) await addItemToOutfit(outfitId, itemId);
  };
  const startOutfitNameEdit = outfit => {
    setEditingOutfitId(outfit._id);
    setEditingOutfitName(openCapsule ? capsuleOutfitLabel(outfit.name) : outfit.name);
  };
  const saveInlineOutfitName = async outfit => {
    const name = editingOutfitName.trim();
    setEditingOutfitId(null);
    if (!name || name === outfit.name) return;
    const updated = await api(`/outfits/${outfit._id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setOutfits(current => current.map(item => item._id === updated._id ? updated : item));
    setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(item => item._id === updated._id ? updated : item) })));
    if (openCapsule) setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(item => item._id === updated._id ? updated : item) }));
  };
  const startCapsuleNameEdit = capsule => {
    setEditingCapsuleId(capsule._id);
    setEditingCapsuleName(capsule.name);
  };

  const editCapsule = capsule => {
    const selectedIds = capsule.clothes.map(item => item._id);
    const destinations = capsule.travel?.destinations?.length
      ? capsule.travel.destinations
      : capsule.travel?.destination
        ? [capsule.travel]
        : [];
    const firstSeason = capsule.season || capsule.outfits.flatMap(outfitSeasons)[0] || "";
    localStorage.setItem(capsuleDraftKey, JSON.stringify({
      version: 1,
      editingCapsuleId: capsule._id,
      capsuleMode: capsule.capsuleMode || (destinations.length ? "travel" : "simple"),
      stage: "suggest",
      count: Math.max(1, capsule.outfits.length || 1),
      targetPieces: capsule.targetPieces || capsule.clothes.length || 15,
      name: capsule.name || "",
      season: firstSeason,
      category: "",
      selected: selectedIds,
      included: selectedIds,
      selectionBaseline: selectedIds,
      suggestionCategory: "",
      suggestionSeason: "",
      suggestionSort: "",
      outfits: [],
      generation: 0,
      destinations: destinations.map((destination, index) => ({
        id: `edit-${index}-${Date.now()}`,
        query: destination.destination || "",
        ...destination,
      })),
      weather: capsule.weather || null,
      workshopLocks: [],
      requirementOverrides: capsule.packingRequirements || {},
      updatedAt: new Date().toISOString(),
    }));
    navigate("/capsules/new");
  };
  const saveInlineCapsuleName = async capsule => {
    const name = editingCapsuleName.trim();
    setEditingCapsuleId(null);
    if (!name || name === capsule.name) return;
    const updated = await api(`/collections/${capsule._id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setCapsules(current => current.map(item => item._id === updated._id ? updated : item));
    if (openCapsule?._id === updated._id) setOpenCapsule(updated);
  };
  const removeCapsuleItem = async (outfit, item) => {
    setConfirmDialog({ title: "Retirer cette pièce ?", message: `${item.name || item.category} sera retiré uniquement de la tenue « ${outfit.name} ».`, label: "Retirer la pièce", action: async () => applyCapsuleUpdate(await api(`/collections/${openCapsule._id}/outfits/${outfit._id}/items/${item._id}`, { method: "DELETE" })) });
  };
  const removeItemFromCapsule = async item => {
    const affectedOutfits = openCapsule.outfits.filter(outfit => outfit.clothes.some(clothing => clothing._id === item._id));
    setConfirmDialog({
      title: "Retirer cette pièce de la capsule ?",
      message: `${item.name || item.category} sera retiré des bagages. ${affectedOutfits.length ? `${affectedOutfits.length} tenue${affectedOutfits.length > 1 ? "s" : ""} qui l’utilise${affectedOutfits.length > 1 ? "nt" : ""} sera${affectedOutfits.length > 1 ? "ont" : ""} également supprimée${affectedOutfits.length > 1 ? "s" : ""}.` : "Aucune tenue ne sera supprimée."}`,
      label: "Retirer la pièce",
      action: async () => {
        const updated = await api(`/collections/${openCapsule._id}/items/${item._id}`, { method: "DELETE" });
        setPackedItems(current => current.filter(id => id !== item._id));
        applyCapsuleUpdate(updated);
      }
    });
  };
  const addItemToPackingList = async itemId => {
    const updatedCapsule = await api(`/collections/${openCapsule._id}/items`, { method: "PUT", body: JSON.stringify({ itemId }) });
    applyCapsuleUpdate(updatedCapsule);
    setAddingPackingItem(false);
  };
  const openPackingSelector = (category = "") => {
    setPackingCategory(category);
    setPackingSeason("");
    setAddingPackingItem(true);
  };
  const openOutfitReview = outfit => {
    setReviewRating(outfit.rating || 0);
    setOpenOutfit(outfit);
  };
  const saveOutfitReview = async event => {
    event.preventDefault();
    setReviewSaving(true);
    const form = new FormData(event.currentTarget);
    const notes = form.get("notes");
    const name = form.get("name")?.trim();
    try {
      const updated = await api(`/outfits/${openOutfit._id}`, { method: "PUT", body: JSON.stringify({ name, rating: reviewRating, notes }) });
      setOutfits(current => current.map(outfit => outfit._id === updated._id ? updated : outfit));
      setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(outfit => outfit._id === updated._id ? updated : outfit) })));
      if (openCapsule) setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(outfit => outfit._id === updated._id ? updated : outfit) }));
      setOpenOutfit(null);
    } finally { setReviewSaving(false); }
  };
  const saveCapsuleReview = async event => {
    event.preventDefault();
    setCapsuleReviewSaving(true);
    const notes = new FormData(event.currentTarget).get("notes");
    try {
      const updated = await api(`/collections/${reviewCapsule._id}`, { method: "PUT", body: JSON.stringify({ rating: capsuleRating, notes }) });
      if (openCapsule?._id === updated._id) setOpenCapsule(updated);
      setCapsules(current => current.map(capsule => capsule._id === updated._id ? updated : capsule));
      setReviewCapsule(null);
    } finally { setCapsuleReviewSaving(false); }
  };
  const openCapsuleReview = capsule => { setCapsuleRating(capsule.rating || 0); setReviewCapsule(capsule); };
  const confirmCurrentAction = async () => {
    setConfirmLoading(true);
    try { await confirmDialog.action(); setConfirmDialog(null); }
    finally { setConfirmLoading(false); }
  };
  const removeCapsuleOutfit = outfit => setConfirmDialog({ title: "Supprimer cette tenue ?", message: `La tenue « ${outfit.name} » sera supprimée de la capsule. Les pièces utilisées ailleurs resteront dans les bagages.`, label: "Supprimer la tenue", action: async () => applyCapsuleUpdate(await api(`/collections/${openCapsule._id}/outfits/${outfit._id}`, { method: "DELETE" })) });
  const removeCapsule = capsule => setConfirmDialog({
    title: "Supprimer cette capsule ?",
    message: `La capsule « ${capsule.name} » et ses ${capsule.outfits.length} tenue${capsule.outfits.length > 1 ? "s" : ""} internes seront définitivement supprimées. Vos vêtements resteront dans la garde-robe.`,
    label: "Supprimer la capsule",
    action: async () => {
      await api(`/collections/${capsule._id}?confirm=capsule`, { method: "DELETE" });
      setCapsules(current => current.filter(item => item._id !== capsule._id));
      if (openCapsule?._id === capsule._id) setOpenCapsule(null);
    }
  });
  const toggleNewOutfitItem = id => setNewCapsuleOutfitItems(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const createOutfitInCapsule = async event => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name")?.trim();
    const updated = await api(`/collections/${openCapsule._id}/outfits`, { method: "POST", body: JSON.stringify({ name, clothes: newCapsuleOutfitItems }) });
    applyCapsuleUpdate(updated);
    setCreatingCapsuleOutfit(false);
    setNewCapsuleOutfitItems([]);
  };
  const reorderOutfitItems = async (event, outfit, targetItemId) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggedOutfitItem || draggedOutfitItem.outfitId !== outfit._id || draggedOutfitItem.itemId === targetItemId) {
      setReorderTargetItem(null);
      return;
    }
    const orderedIds = outfit.clothes.map(item => item._id);
    const fromIndex = orderedIds.indexOf(draggedOutfitItem.itemId);
    const targetIndex = orderedIds.indexOf(targetItemId);
    [orderedIds[fromIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[fromIndex]];
    const updated = await api(`/outfits/${outfit._id}`, { method: "PUT", body: JSON.stringify({ clothes: orderedIds }) });
    setOutfits(current => current.map(item => item._id === updated._id ? updated : item));
    setCapsules(current => current.map(capsule => ({ ...capsule, outfits: capsule.outfits.map(item => item._id === updated._id ? updated : item) })));
    setOpenCapsule(current => ({ ...current, outfits: current.outfits.map(item => item._id === updated._id ? updated : item) }));
    setDraggedOutfitItem(null);
    setReorderTargetItem(null);
  };

  return <>
    {!capsuleId && <header className="page-header"><h1>{capsulesOnly ? "Capsules" : "Outfits"}</h1>{capsulesOnly ? <button className="primary" onClick={() => navigate("/capsules/new")}><Plus size={18}/> Créer</button> : <details className="create-menu"><summary><Plus size={18}/> Créer</summary><div><button type="button" onClick={() => navigate("/outfits/new")}><Plus size={17}/> Une tenue</button><button type="button" onClick={() => navigate("/outfits/assist")}><Sparkles size={17}/> Tenue assistée</button><button type="button" onClick={() => navigate("/outfits/new/multiple")}><Plus size={17}/> Plusieurs tenues</button></div></details>}</header>}
    {!capsuleId && loading && <PageState loading title={capsulesOnly ? "Chargement des capsules…" : "Chargement des tenues…"}/>}
    {!capsuleId && !loading && loadError && <PageState title="Le contenu n’a pas pu être chargé" message="Vos données sont intactes. Réessayez dans un instant." onAction={() => load({ showLoading: true })}/>}
    {capsuleId && loading && <PageState loading title="Chargement de la capsule…"/>}
    {capsuleId && !loading && loadError && <PageState title="La capsule n’a pas pu être chargée" message={loadError} onAction={() => load({ showLoading: true })}/>}
    {!capsuleId && !loading && !loadError && ((capsulesOnly && capsules.length === 0) || (!capsulesOnly && outfits.length === 0)) && <PageState title={capsulesOnly ? "Aucune capsule" : "Aucune tenue"} message={capsulesOnly ? "Préparez votre première capsule pour un voyage." : "Créez une tenue à partir des pièces de votre garde-robe."} actionLabel={capsulesOnly ? "Créer une capsule" : "Créer une tenue"} actionIcon={Plus} onAction={() => navigate(capsulesOnly ? "/capsules/new" : "/outfits/new")}/>}
    {!capsuleId && !loading && !loadError && <div className={`outfit-grid ${!capsulesOnly ? "outfit-page-grid" : ""}`}>
      {capsulesOnly && capsules.map(capsule => <article className="outfit-card reviewable capsule-card" key={capsule._id} role="button" tabIndex="0" onClick={() => openCapsuleDetail(capsule)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCapsuleDetail(capsule); } }}>
        <div className="capsule-card-media">
          <div className="outfit-collage">{capsule.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div>
          <div className="capsule-card-actions">
            <button type="button" aria-label={`Renommer ${capsule.name}`} title="Renommer" onClick={event => { event.stopPropagation(); startCapsuleNameEdit(capsule); }}><Pencil size={16}/></button>
            <button type="button" className="danger" aria-label={`Supprimer la capsule ${capsule.name}`} title="Supprimer" onClick={event => { event.stopPropagation(); removeCapsule(capsule); }}><Trash2 size={16}/></button>
          </div>
        </div>
        <div className="outfit-card-footer capsule-card-footer">
          <div className="outfit-card-name">{editingCapsuleId === capsule._id ? <input value={editingCapsuleName} autoFocus aria-label="Nom de la capsule" onClick={event => event.stopPropagation()} onChange={event => setEditingCapsuleName(event.target.value)} onBlur={() => saveInlineCapsuleName(capsule)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingCapsuleId(null); }}/> : <h3>{capsule.name}</h3>}</div>
          <div className="capsule-card-seasons" aria-label="Saisons de la capsule">{capsuleSeasonLabels(capsule).map(value => <span key={value}>{value}</span>)}</div>
          <div className="capsule-card-details">
            <button type="button" className={capsule.rating ? "rated" : ""} aria-label="Noter la capsule" title="Note" onClick={event => { event.stopPropagation(); openCapsuleReview(capsule); }}><Star size={16} fill={capsule.rating ? "currentColor" : "none"}/>{capsule.rating || "–"}</button>
            <span><Shirt size={16}/>{capsule.clothes.length} pièce{capsule.clothes.length > 1 ? "s" : ""}</span>
            <ChevronRight className="capsule-card-chevron" size={21}/>
          </div>
        </div>
      </article>)}
      {!capsulesOnly && outfits.map(outfit => <article className="outfit-card reviewable" key={outfit._id} role="button" tabIndex="0" onClick={() => openOutfitReview(outfit)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") openOutfitReview(outfit); }}><div className="outfit-collage">{outfit.clothes.slice(0, 4).map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>{item.category}</span>}</div>)}</div><div className="outfit-card-footer"><div className="outfit-card-name">{editingOutfitId === outfit._id ? <input value={editingOutfitName} autoFocus aria-label="Nom de l’outfit" onClick={event => event.stopPropagation()} onChange={event => setEditingOutfitName(event.target.value)} onBlur={() => saveInlineOutfitName(outfit)} onKeyDown={event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingOutfitId(null); }}/> : <><h3>{outfit.name}</h3><button type="button" aria-label={`Renommer ${outfit.name}`} title="Renommer" onClick={event => { event.stopPropagation(); startOutfitNameEdit(outfit); }}><Pencil size={15}/></button></>}</div><div className="outfit-card-meta"><span className={outfit.rating ? "rated" : ""} title="Note"><Star size={16} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "–"}</span><span title={`${outfit.clothes.length} pièces`}><Shirt size={16}/>{outfit.clothes.length}</span><button type="button" className="outfit-card-delete" aria-label={`Supprimer ${outfit.name}`} title="Supprimer" onClick={event => { event.stopPropagation(); remove(outfit); }}><Trash2 size={16}/></button></div></div></article>)}
    </div>}
    {openCapsule && <Modal title={editingCapsuleId === openCapsule._id ? <input className="inline-capsule-name" value={editingCapsuleName} autoFocus aria-label="Nom de la capsule" onChange={event => setEditingCapsuleName(event.target.value)} onBlur={() => saveInlineCapsuleName(openCapsule)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") { setEditingCapsuleName(openCapsule.name); setEditingCapsuleId(null); } }}/> : <button type="button" className="editable-capsule-name" title="Cliquer pour renommer" onClick={() => startCapsuleNameEdit(openCapsule)}>{openCapsule.name}<Pencil size={17}/></button>} onClose={() => { setPackingDetailItem(null); setOpenCapsule(null); }}>
      <div className={`capsule-detail capsule-detail-tabbed ${!isTravelCapsule ? "simple-capsule-detail" : ""}`}>
        <div className="capsule-detail-summary">
          <div><strong>{openCapsule.clothes.length}</strong><span>Pièces</span></div>
          {openCapsule.capsuleMode === "simple" && <div className="capsule-target-editor"><span>Objectif</span><button type="button" aria-label="Réduire l’objectif de pièces" onClick={() => adjustCapsuleTarget(-1)}><Minus size={14}/></button><strong>{openCapsule.targetPieces || 15}</strong><button type="button" aria-label="Augmenter l’objectif de pièces" onClick={() => adjustCapsuleTarget(1)}><Plus size={14}/></button></div>}
          <div className="capsule-category-summary" aria-label="Répartition des pièces par catégorie">
            {capsuleCategoryCounters.map(counter => {
              const current = openCapsule.clothes.filter(item => item.category === counter.category).length;
              const target = openCapsule.packingRequirements?.[counter.requirement];
              const active = capsuleDetailTab === "packing" && capsulePackingCategory === counter.category;
              return <button type="button" key={counter.category} className={active ? "active" : ""} aria-pressed={active} onClick={() => {
                setCapsuleDetailTab("packing");
                setCapsulePackingCategory(active ? "" : counter.category);
              }}><b>{current}{Number.isFinite(target) ? `/${target}` : ""}</b> {counter.label}</button>;
            })}
          </div>
          <div className="capsule-detail-actions"><button type="button" className="capsule-edit-button" onClick={() => editCapsule(openCapsule)}><Pencil size={16}/> Modifier la capsule</button></div>
        </div>
        {openCapsule.capsuleMode === "travel" && capsuleDestinations.length > 0 && <section className="capsule-travel-history" aria-label="Météo du voyage">
          {capsuleDestinations.map((destination, index) => {
            const reference = weatherRangeForDestination(capsuleWeatherReference, destination, index);
            const current = weatherRangeForDestination(openCapsule.weather, destination, index);
            const changed = reference && current && (Math.abs(current.min - reference.min) > 2 || Math.abs(current.max - reference.max) > 2);
            return <article key={`${destination.destination}-${destination.startDate}-${index}`} className={changed ? "changed" : ""}>
              <div><strong>{destination.destination}</strong><span>{formatTravelPeriod(destination)}</span></div>
              <div className="capsule-temperature-comparison">
                <span><small>Référence</small><b>{reference ? `${reference.min}°–${reference.max}°` : "Indisponible"}</b></span>
                <ChevronRight size={16}/>
                <span><small>Actuellement</small><b>{current ? `${current.min}°–${current.max}°` : "Indisponible"}</b></span>
              </div>
              <em>{changed ? "Températures à vérifier" : current ? "Températures cohérentes" : "En attente d’actualisation"}</em>
            </article>;
          })}
          <p>Référence enregistrée lors de la création · dernière actualisation {openCapsule.weather?.updatedAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(openCapsule.weather.updatedAt)) : "indisponible"}</p>
        </section>}
        {capsuleActionError && <p className="capsule-action-error">{capsuleActionError}</p>}
        <nav className="capsule-baggage-tabs" aria-label="Contenu des bagages">
          <button type="button" className={capsuleDetailTab === "packing" ? "active" : ""} aria-pressed={capsuleDetailTab === "packing"} onClick={() => setCapsuleDetailTab("packing")}>
            <Shirt size={17}/> Vêtements <span>{packedItems.length}/{openCapsule.clothes.length}</span>
          </button>
          {capsuleChecklists.map(checklist => {
            const checked = (checklist.items || []).filter(item => item.checked).length;
            const active = capsuleDetailTab === "checklist" && checklistKey(checklist) === activeChecklistKey;
            return <button type="button" key={checklistKey(checklist)} className={active ? "active" : ""} aria-pressed={active} onClick={() => selectCapsuleChecklist(checklist)}>
              <Check size={17}/> {checklist.name} <span>{checked}/{checklist.items?.length || 0}</span>
            </button>;
          })}
          <button type="button" className="manage-checklists" onClick={openCapsuleChecklistManager}><Plus size={17}/> Checklists</button>
        </nav>
        <div className="capsule-detail-content">
          {capsuleDetailTab === "packing" ? !isTravelCapsule ? <section className="simple-capsule-composition">
            <header className="simple-capsule-composition-header">
              <div>
                <h3>Composition</h3>
                <p>{openCapsule.clothes.length} pièce{openCapsule.clothes.length > 1 ? "s" : ""}, organisées comme une silhouette.</p>
              </div>
              <button type="button" onClick={() => openPackingSelector()}><CirclePlus size={17}/> Ajouter une pièce</button>
            </header>
            <div className="simple-capsule-tiers">
              {simpleCapsuleTiers
                .filter(tier => !capsulePackingCategory || tier.categories.includes(capsulePackingCategory))
                .map((tier, tierIndex) => {
                  const tierItems = openCapsule.clothes
                    .filter(item => tier.categories.includes(item.category));
                  return <section className={`simple-capsule-tier simple-capsule-tier-${tier.key}`} key={tier.key}>
                    <header>
                      <span>{String(tierIndex + 1).padStart(2, "0")}</span>
                      <div><h4>{tier.label}</h4><small>{tierItems.length} pièce{tierItems.length > 1 ? "s" : ""}</small></div>
                    </header>
                    <div className="simple-capsule-tier-track">
                      {tierItems.map(item => {
                        const compatibility = capsuleCompatibilityStats(item);
                        const compatibilityCount = compatibility.compatibleItems.length;
                        const itemId = String(item._id);
                        return <article
                          className={`simple-capsule-piece ${draggedCapsuleItemId === itemId ? "capsule-item-dragging" : ""} ${capsuleItemDropTargetId === itemId ? "capsule-item-drop-target" : ""}`}
                          key={item._id}
                          draggable={!capsuleOrderSaving}
                          aria-grabbed={draggedCapsuleItemId === itemId}
                          onDragStart={event => startCapsuleItemDrag(event, item)}
                          onDragOver={event => dragOverCapsuleItem(event, item._id)}
                          onDrop={event => reorderCapsuleItems(event, item._id)}
                          onDragEnd={clearCapsuleItemDrag}
                        >
                          <span className="capsule-item-drag-handle" title="Déplacer la pièce" aria-hidden="true"><GripVertical size={18}/></span>
                          <button type="button" className="simple-capsule-piece-open" onClick={() => setPackingDetailItem(item)} aria-label={`Voir les détails de ${item.name || item.category}`}>
                            {item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}
                            <span className="simple-capsule-piece-category">{item.category}</span>
                            <strong className="simple-capsule-piece-score" title={`${compatibilityCount} compatibilité${compatibilityCount > 1 ? "s" : ""} sur ${compatibility.eligibleCount} pièce${compatibility.eligibleCount > 1 ? "s" : ""} associable${compatibility.eligibleCount > 1 ? "s" : ""}`}>
                              <Link2 size={13}/>{compatibilityCount}/{compatibility.eligibleCount}
                            </strong>
                          </button>
                          <button type="button" className="simple-capsule-piece-remove" aria-label={`Retirer ${item.name || item.category} de la capsule`} onClick={() => removeItemFromCapsule(item)}><Trash2 size={14}/></button>
                        </article>;
                      })}
                      <button type="button" className="simple-capsule-tier-add" onClick={() => openPackingSelector(tier.addCategory)} aria-label={`Ajouter une pièce : ${tier.label}`}>
                        <Plus size={24}/><span>Ajouter</span>
                      </button>
                    </div>
                  </section>;
                })}
            </div>
          </section> : <section className="packing-list packing-list-tab">
            <header><div><h3>Liste bagages</h3><p>Cochez les pièces déjà placées dans la valise.</p></div><div className="packing-list-controls"><strong>{packedItems.length}/{openCapsule.clothes.length}</strong><button type="button" onClick={() => openPackingSelector()}><CirclePlus size={15}/> Ajouter une pièce</button></div></header>
            <div>
              {openCapsule.clothes.filter(item => !capsulePackingCategory || item.category === capsulePackingCategory).map(item => {
                const compatibility = capsuleCompatibilityStats(item);
                const compatibilityCount = compatibility.compatibleItems.length;
                const itemId = String(item._id);
                return <div
                  key={item._id}
                  className={`packing-list-row ${packedItems.includes(item._id) ? "packed" : ""} ${draggedCapsuleItemId === itemId ? "capsule-item-dragging" : ""} ${capsuleItemDropTargetId === itemId ? "capsule-item-drop-target" : ""}`}
                  draggable={!capsuleOrderSaving}
                  aria-grabbed={draggedCapsuleItemId === itemId}
                  onDragStart={event => startCapsuleItemDrag(event, item)}
                  onDragOver={event => dragOverCapsuleItem(event, item._id)}
                  onDrop={event => reorderCapsuleItems(event, item._id)}
                  onDragEnd={clearCapsuleItemDrag}
                >
                  <label className="packing-check"><input type="checkbox" checked={packedItems.includes(item._id)} onChange={() => setPackedItems(current => current.includes(item._id) ? current.filter(id => id !== item._id) : [...current, item._id])}/><span>Marquer comme placé dans la valise</span></label>
                  <span className="capsule-item-drag-handle" title="Déplacer la pièce" aria-hidden="true"><GripVertical size={18}/></span>
                  <button type="button" className="packing-item-open" onClick={() => setPackingDetailItem(item)} aria-label={`Voir les détails de ${item.name || item.category}`}>
                    {item.imageUrl ? <img src={item.imageUrl} alt=""/> : <i/>}
                    <span><b>{item.name || item.category}</b><small>{item.category}</small></span>
                  </button>
                  <strong className="packing-compatibility-score" title={`${compatibilityCount} compatibilité${compatibilityCount > 1 ? "s" : ""} sur ${compatibility.eligibleCount} pièce${compatibility.eligibleCount > 1 ? "s" : ""} associable${compatibility.eligibleCount > 1 ? "s" : ""} dans cette capsule`}><Link2 size={14}/>{compatibilityCount}/{compatibility.eligibleCount}</strong>
                  <button type="button" className="packing-remove-item" aria-label={`Retirer ${item.name || item.category} de la capsule`} onClick={() => removeItemFromCapsule(item)}><Trash2 size={14}/></button>
                </div>;
              })}
              {capsulePackingCategory && <button type="button" className="packing-add-category-card" onClick={() => openPackingSelector(capsulePackingCategory)} aria-label={`Ajouter une pièce de la catégorie ${capsulePackingCategory}`}>
                <Plus size={30}/>
                <b>{capsulePackingCategory === "Chaussures" ? "Ajouter des chaussures" : `Ajouter un ${capsulePackingCategory.toLowerCase()}`}</b>
              </button>}
            </div>
          </section> : capsuleDetailTab === "checklist" ? <section className="travel-checklist-panel">
            <header>
              <div><h3>Checklist {activeChecklist?.name || ""}</h3><p>Ajoutez puis cochez les objets placés dans vos bagages.</p></div>
              <div className="travel-checklist-header-actions">
                {activeChecklist && <button type="button" onClick={syncCapsuleChecklist} disabled={travelChecklistSaving || Boolean(syncingChecklistId) || Boolean(publishingChecklistId)}>
                  <RefreshCw size={16} className={syncingChecklistId ? "spinning" : ""}/>
                  {syncingChecklistId ? "Récupération…" : "Récupérer les nouveautés"}
                </button>}
                {activeChecklist && <button type="button" onClick={publishCapsuleChecklist} disabled={travelChecklistSaving || Boolean(publishingChecklistId) || Boolean(syncingChecklistId)}>
                  <Upload size={16}/>
                  {publishingChecklistId ? "Mise à jour…" : "Mettre à jour la globale"}
                </button>}
                <strong>{checkedTravelItems}/{travelChecklist.length}</strong>
              </div>
            </header>
            <form className="travel-checklist-add" onSubmit={addTravelChecklistItem}>
              <input name="label" required maxLength="140" placeholder="Ajouter un élément…" value={travelChecklistLabel} onChange={event => setTravelChecklistLabel(event.target.value)}/>
              <details className="travel-checklist-category-picker" ref={travelChecklistCategoryMenuRef}>
                <summary aria-label={`Catégorie : ${travelChecklistCategory}`}>
                  <span><small>Catégorie</small>{travelChecklistCategory}</span>
                  <ChevronDown size={17}/>
                </summary>
                <div className="travel-checklist-category-menu">
                  <strong>Choisir une catégorie</strong>
                  <div className="travel-checklist-category-options">
                    {travelChecklistCategories.map(category => <button type="button" key={category} className={travelChecklistCategory === category ? "active" : ""} onClick={() => selectTravelChecklistCategory(category)}>{category}</button>)}
                  </div>
                  <div className="travel-checklist-new-category">
                    <input
                      type="text"
                      maxLength="80"
                      placeholder="Nouvelle catégorie"
                      aria-label="Nom de la nouvelle catégorie"
                      value={newTravelChecklistCategory}
                      onChange={event => setNewTravelChecklistCategory(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          createTravelChecklistCategory();
                        }
                      }}
                    />
                    <button type="button" disabled={!newTravelChecklistCategory.trim()} onClick={createTravelChecklistCategory} aria-label="Créer la catégorie"><Plus size={17}/></button>
                  </div>
                </div>
              </details>
              <button className="travel-checklist-submit" type="submit" disabled={travelChecklistSaving || !travelChecklistLabel.trim()}><Plus size={17}/> Ajouter</button>
            </form>
            <div className="travel-checklist-groups">
              {Object.entries(travelChecklistGroups).map(([category, items]) => <section
                key={category}
                className={`travel-checklist-group ${travelChecklistDropTarget === `category:${category}` ? "drop-target" : ""}`}
                onDragOver={event => {
                  if (!draggedTravelChecklistKey) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setTravelChecklistDropTarget(`category:${category}`);
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget) && travelChecklistDropTarget === `category:${category}`) setTravelChecklistDropTarget("");
                }}
                onDrop={event => {
                  event.preventDefault();
                  moveTravelChecklistItem(event.dataTransfer.getData("application/x-travel-checklist-item") || draggedTravelChecklistKey, category);
                }}
              >
                <header>
                  {editingTravelChecklistCategory === category ? <form className="checklist-category-rename" onSubmit={event => saveTravelChecklistCategoryRename(event, category)}>
                    <input
                      autoFocus
                      value={editingTravelChecklistCategoryName}
                      onChange={event => setEditingTravelChecklistCategoryName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Escape") {
                          setEditingTravelChecklistCategory("");
                          setEditingTravelChecklistCategoryName("");
                        }
                      }}
                      aria-label={`Renommer la catégorie ${category}`}
                    />
                    <button type="submit" aria-label="Valider le nouveau nom"><Check size={16}/></button>
                    <button type="button" onClick={() => {
                      setEditingTravelChecklistCategory("");
                      setEditingTravelChecklistCategoryName("");
                    }} aria-label="Annuler le renommage"><X size={16}/></button>
                  </form> : <button type="button" className="checklist-category-title" onClick={() => startTravelChecklistCategoryRename(category)} title="Renommer la catégorie">
                    <h4>{category}</h4><Pencil size={14}/>
                  </button>}
                  <span className="checklist-category-actions">
                    <span>{items.filter(item => item.checked).length}/{items.length}</span>
                    <button type="button" className="checklist-category-icon-button" onClick={() => {
                      setEditingTravelChecklistCategory("");
                      setEditingTravelChecklistCategoryName("");
                      setQuickTravelChecklistCategory(current => current === category ? "" : category);
                      setQuickTravelChecklistLabel("");
                    }} aria-label={`Ajouter un élément dans ${category}`} title={`Ajouter dans ${category}`}><Plus size={17}/></button>
                  </span>
                </header>
                {quickTravelChecklistCategory === category && <form className="checklist-category-quick-add" onSubmit={event => addQuickTravelChecklistItem(event, category)}>
                  <input
                    autoFocus
                    value={quickTravelChecklistLabel}
                    onChange={event => setQuickTravelChecklistLabel(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Escape") {
                        setQuickTravelChecklistCategory("");
                        setQuickTravelChecklistLabel("");
                      }
                    }}
                    placeholder={`Ajouter dans ${category}`}
                    aria-label={`Nouvel élément dans ${category}`}
                  />
                  <button type="submit" disabled={!quickTravelChecklistLabel.trim()}><Plus size={16}/> Ajouter</button>
                  <button type="button" className="is-icon-only" onClick={() => {
                    setQuickTravelChecklistCategory("");
                    setQuickTravelChecklistLabel("");
                  }} aria-label="Fermer"><X size={16}/></button>
                </form>}
                <div>{items.map(item => <div
                  key={item.key}
                  draggable={!travelChecklistSaving}
                  className={`travel-checklist-row ${item.checked ? "checked" : ""} ${draggedTravelChecklistKey === item.key ? "dragging" : ""} ${travelChecklistDropTarget === `item:${item.key}` ? "drop-target" : ""}`}
                  title="Glisser pour déplacer"
                  onDragStart={event => startTravelChecklistDrag(event, item.key)}
                  onDragEnd={endTravelChecklistDrag}
                  onDragOver={event => {
                    if (!draggedTravelChecklistKey || draggedTravelChecklistKey === item.key) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    setTravelChecklistDropTarget(`item:${item.key}`);
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveTravelChecklistItem(event.dataTransfer.getData("application/x-travel-checklist-item") || draggedTravelChecklistKey, category, item.key);
                  }}
                >
                  <GripVertical className="travel-checklist-drag-handle" size={16} aria-hidden="true"/>
                  <label><input type="checkbox" checked={item.checked} disabled={travelChecklistSaving} onChange={() => toggleTravelChecklistItem(item.key)}/><span>{item.label}</span></label>
                  <button type="button" disabled={travelChecklistSaving} aria-label={`Supprimer ${item.label}`} onClick={() => removeTravelChecklistItem(item.key)}><Trash2 size={15}/></button>
                </div>)}</div>
              </section>)}
              {!travelChecklist.length && <p className="travel-checklist-empty">Cette checklist ne contient encore aucun élément.</p>}
            </div>
            {travelChecklistSaving && <span className="travel-checklist-saving">Enregistrement…</span>}
          </section> : <div ref={capsuleOutfitScrollerRef} className="capsule-outfits-list capsule-outfits-rows" tabIndex={openCapsule.outfits.length ? 0 : -1} aria-label="Tenues de la capsule. Utilisez les flèches gauche et droite pour les faire défiler.">
            {openCapsule.outfits.map(outfit => <article key={outfit._id} className={dropTargetOutfit === outfit._id ? "drop-active" : ""} onDragOver={event => { if (!draggedOutfitItem) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDropTargetOutfit(outfit._id); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetOutfit(null); }} onDrop={event => { if (!draggedOutfitItem) dropPackingItem(event, outfit._id); }}>
              <header className="capsule-outfit-row-header">
                {editingOutfitId === outfit._id ? <input className="inline-outfit-name" value={editingOutfitName} autoFocus onChange={event => setEditingOutfitName(event.target.value)} onBlur={() => saveInlineOutfitName(outfit)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") setEditingOutfitId(null); }}/> : <button type="button" className="editable-outfit-name" title="Cliquer pour renommer" onClick={() => startOutfitNameEdit(outfit)}>{capsuleOutfitLabel(outfit.name)}<Pencil size={14}/></button>}
                <div className="capsule-outfit-seasons" aria-label={`Saisons de ${capsuleOutfitLabel(outfit.name)}`}>{seasons.map(season => <button type="button" key={season} className={outfitSeasons(outfit).includes(season) ? "active" : ""} aria-pressed={outfitSeasons(outfit).includes(season)} disabled={seasonSavingOutfitId === outfit._id} onClick={() => toggleOutfitSeason(outfit, season)}>{season}</button>)}</div>
                <button type="button" className={`capsule-rating ${outfit.rating ? "rated" : ""}`} onClick={() => openOutfitReview(outfit)} aria-label={`Noter ${capsuleOutfitLabel(outfit.name)}`}><Star size={15} fill={outfit.rating ? "currentColor" : "none"}/>{outfit.rating || "–"}</button>
              </header>
              <div className="capsule-outfit-items">{outfit.clothes.map(item => <div key={item._id} draggable onDragStart={event => { event.stopPropagation(); setDraggedOutfitItem({ outfitId: outfit._id, itemId: item._id }); event.dataTransfer.setData("application/x-outfit-item", item._id); event.dataTransfer.effectAllowed = "move"; }} onDragOver={event => { if (draggedOutfitItem?.outfitId === outfit._id) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setReorderTargetItem(`${outfit._id}:${item._id}`); } }} onDrop={event => reorderOutfitItems(event, outfit, item._id)} onDragEnd={() => { setDraggedOutfitItem(null); setReorderTargetItem(null); }} className={`capsule-outfit-item reorderable ${reorderTargetItem === `${outfit._id}:${item._id}` ? "reorder-target" : ""}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span>{item.category}</span>}<small>{item.category}</small><div className="capsule-item-actions"><button type="button" aria-label={`Remplacer ${item.name || item.category}`} onClick={() => setReplaceTarget({ outfit, item })}><Pencil size={14}/></button><button type="button" className="remove" aria-label={`Retirer ${item.name || item.category}`} onClick={() => removeCapsuleItem(outfit, item)}><Trash2 size={14}/></button></div></div>)}</div>
              <details className="capsule-outfit-menu"><summary aria-label={`Actions pour ${capsuleOutfitLabel(outfit.name)}`}><MoreHorizontal size={19}/></summary><div><button type="button" onClick={() => openOutfitReview(outfit)}><Star size={15}/> Noter</button><button type="button" onClick={() => setAddTarget(outfit)}><CirclePlus size={15}/> Ajouter une pièce</button><button type="button" className="danger" onClick={() => removeCapsuleOutfit(outfit)}><Trash2 size={15}/> Supprimer</button></div></details>
            </article>)}
          </div>}
        </div>
      </div>
    </Modal>}
    {managingCapsuleChecklists && <Modal title="Checklists de la capsule" onClose={() => setManagingCapsuleChecklists(false)}>
      <section className="capsule-checklist-manager">
        <p>Choisissez les checklists à utiliser dans cette capsule. Chaque liste conservera ici son propre état.</p>
        <div className="capsule-checklist-picker">
          {checklistTemplates.map(template => <label key={template._id} className={selectedChecklistTemplateIds.includes(template._id) ? "selected" : ""}>
            <input
              type="checkbox"
              checked={selectedChecklistTemplateIds.includes(template._id)}
              onChange={() => setSelectedChecklistTemplateIds(current => current.includes(template._id) ? current.filter(id => id !== template._id) : [...current, template._id])}
            />
            <ListChecks size={20}/>
            <span><strong>{template.name}</strong><small>{template.items.length} élément{template.items.length > 1 ? "s" : ""}</small></span>
          </label>)}
        </div>
        {!checklistTemplates.length && <p className="empty-filter-message">Aucune checklist globale n’est disponible.</p>}
        <footer>
          <button type="button" className="secondary" onClick={() => { setManagingCapsuleChecklists(false); navigate("/checklists"); }}>Gérer les modèles</button>
          <button type="button" className="primary" disabled={travelChecklistSaving || (isTravelCapsule && !selectedChecklistTemplateIds.length)} onClick={saveCapsuleChecklistSelection}>{travelChecklistSaving ? "Enregistrement…" : "Appliquer"}</button>
        </footer>
        {isTravelCapsule && !selectedChecklistTemplateIds.length && <small className="capsule-checklist-hint">Sélectionnez au moins une checklist.</small>}
      </section>
    </Modal>}
    {replaceTarget && <Modal title={`Remplacer ${replaceTarget.item.name || replaceTarget.item.category}`} onClose={() => setReplaceTarget(null)}><p>Choisissez une pièce compatible de la catégorie {replaceTarget.item.category}.</p><div className="selector-grid replacement-grid">{replacementCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={replaceCapsuleItem}/>)}</div>{!replacementCandidates.length && <p className="empty-filter-message">Aucune autre pièce compatible disponible.</p>}</Modal>}
    {addTarget && <Modal title="Ajouter une pièce à la tenue" onClose={() => setAddTarget(null)}><p>Choisissez une pièce compatible dans une catégorie absente de cette tenue.</p><div className="selector-grid replacement-grid">{additionCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addCapsuleItem}/>)}</div>{!additionCandidates.length && <p className="empty-filter-message">Aucune pièce compatible à ajouter.</p>}</Modal>}
    {addingPackingItem && <Modal title="Ajouter à la liste bagages" onClose={() => setAddingPackingItem(false)}><p>Choisissez une pièce à emporter, même si elle ne fait partie d’aucune tenue.</p><div className="packing-item-filters"><div><span>Catégories</span><div className="category-pills"><button type="button" className={!packingCategory ? "active" : ""} onClick={() => setPackingCategory("")}>Toutes</button>{categories.map(category => <button type="button" key={category} className={packingCategory === category ? "active" : ""} onClick={() => setPackingCategory(category)}>{category}</button>)}</div></div><div><span>Saisons</span><div className="category-pills"><button type="button" className={!packingSeason ? "active" : ""} onClick={() => setPackingSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={packingSeason === season ? "active" : ""} onClick={() => setPackingSeason(season)}>{season}</button>)}</div></div></div><div className="selector-grid replacement-grid">{packingCandidates.map(item => <ClothingCard key={item._id} item={item} selectable onSelect={addItemToPackingList}/>)}</div>{!packingCandidates.length && <p className="empty-filter-message">Aucune pièce ne correspond à ces filtres.</p>}</Modal>}
    {packingDetailSource && <Modal title={packingDetailSource.name || packingDetailSource.category} onClose={() => setPackingDetailItem(null)} className="packing-item-detail-modal">
      <section className="packing-item-detail-summary">
        {packingDetailSource.imageUrl ? <img src={packingDetailSource.imageUrl} alt={packingDetailSource.name || packingDetailSource.category}/> : <span/>}
        <div><span className="eyebrow">{packingDetailSource.category}</span><h3>{packingDetailSource.name || packingDetailSource.category}</h3>{[packingDetailSource.brand, packingDetailSource.color, packingDetailSource.style, packingDetailSource.size].filter(Boolean).length > 0 && <p>{[packingDetailSource.brand, packingDetailSource.color, packingDetailSource.style, packingDetailSource.size].filter(Boolean).join(" · ")}</p>}<div className="packing-item-seasons">{packingDetailSource.season?.length ? packingDetailSource.season.map(season => <span key={season}>{season}</span>) : <span>Toutes saisons</span>}</div></div>
      </section>
      <section className="packing-item-compatibilities">
        <header><div><Link2 size={18}/><h3>Compatibilités dans la capsule</h3></div><strong>{capsuleCompatibilityItems.length}/{packingDetailCompatibility.eligibleCount}</strong></header>
        {capsuleCompatibilityItems.length ? <div>{capsuleCompatibilityItems.map(item => <article key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<footer><b>{item.name || item.category}</b><small>{item.category}</small></footer></article>)}</div> : <p>Aucune compatibilité renseignée avec les autres pièces de cette capsule.</p>}
      </section>
      <section className="packing-item-compatibilities packing-item-incompatibilities">
        <header><div><Minus size={18}/><h3>Incompatibilités dans la capsule</h3></div><strong>{capsuleIncompatibilityItems.length}/{packingDetailCompatibility.eligibleCount}</strong></header>
        {capsuleIncompatibilityItems.length ? <div>{capsuleIncompatibilityItems.map(item => <article key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<footer><b>{item.name || item.category}</b><small>{item.category}</small></footer></article>)}</div> : <p>Cette pièce est compatible avec toutes les pièces associables de la capsule.</p>}
      </section>
    </Modal>}
    {openOutfit && <Modal title={openOutfit.name} onClose={() => setOpenOutfit(null)}><form className="outfit-review" onSubmit={saveOutfitReview}><label>Nom de la tenue<input name="name" required defaultValue={openOutfit.name} placeholder="Ex. Dîner en ville"/></label><div className="outfit-review-items">{openOutfit.clothes.map(item => <div key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<small>{item.name || item.category}</small></div>)}</div><fieldset><legend>Votre note</legend><div className="rating-stars" aria-label={`Note : ${reviewRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setReviewRating(value)}><Star size={27} fill={value <= reviewRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour d’expérience<textarea name="notes" rows="6" defaultValue={openOutfit.notes} placeholder="Confort, associations, occasion, améliorations…"/></label><button className="primary" disabled={reviewSaving}>{reviewSaving ? "Enregistrement…" : "Enregistrer les modifications"}</button></form></Modal>}
    {reviewCapsule && <Modal title={`Noter ${reviewCapsule.name}`} onClose={() => setReviewCapsule(null)}><form className="outfit-review" onSubmit={saveCapsuleReview}><fieldset><legend>Note globale de la capsule</legend><div className="rating-stars" aria-label={`Note : ${capsuleRating} sur 5`}>{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} onClick={() => setCapsuleRating(value)}><Star size={27} fill={value <= capsuleRating ? "currentColor" : "none"}/></button>)}</div></fieldset><label>Retour sur la capsule<textarea name="notes" rows="6" defaultValue={reviewCapsule.notes} placeholder="Variété, efficacité, pièces manquantes, bilan du voyage…"/></label><button className="primary" disabled={capsuleReviewSaving}>{capsuleReviewSaving ? "Enregistrement…" : "Enregistrer la note"}</button></form></Modal>}
    {creatingCapsuleOutfit && <Modal title="Ajouter une tenue à la capsule" onClose={() => setCreatingCapsuleOutfit(false)}><form className="stack" onSubmit={createOutfitInCapsule}><label>Nom de la tenue <small>(facultatif)</small><input name="name" autoFocus placeholder={`Tenue ${openCapsule.outfits.length + 1}`}/></label><p>Sélectionnez des pièces compatibles. Une seule pièce par catégorie peut être choisie.</p><div className="selector-grid replacement-grid">{newOutfitCandidates.map(item => <ClothingCard key={item._id} item={item} selectable selected={newCapsuleOutfitItems.includes(item._id)} onSelect={toggleNewOutfitItem}/>)}</div><button className="primary" disabled={!newCapsuleOutfitItems.length}><CirclePlus size={17}/> Ajouter la tenue</button></form></Modal>}
    {generatedOutfitReview && <div className="wizard-backdrop"><section className="capsule-outfit-review-wizard" role="dialog" aria-modal="true" aria-labelledby="generated-outfit-title">
      <header><div><span className="eyebrow">Tenues possibles</span><h2 id="generated-outfit-title">{generatedOutfitReview.done ? "Votre sélection" : `Tenue ${generatedOutfitReview.index + 1} sur ${generatedOutfitReview.proposals.length}`}</h2></div><button type="button" className="wizard-close" aria-label="Fermer" onClick={() => setGeneratedOutfitReview(null)}><X size={22}/></button></header>
      {!generatedOutfitReview.done ? <>
        <div className="wizard-progress"><span style={{ width: `${((generatedOutfitReview.index + 1) / generatedOutfitReview.proposals.length) * 100}%` }}/></div>
        <div className="generated-outfit-preview">{generatedOutfitReview.proposals[generatedOutfitReview.index].map(item => <figure key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<figcaption>{item.category}</figcaption></figure>)}</div>
        <footer><button type="button" className="generated-reject" onClick={() => answerGeneratedOutfit(false)}><X size={20}/> Non</button><span>{generatedOutfitReview.accepted.length} validée{generatedOutfitReview.accepted.length > 1 ? "s" : ""}</span><button type="button" className="generated-accept" onClick={() => answerGeneratedOutfit(true)}><Check size={20}/> Oui</button></footer>
      </> : <div className="generated-outfit-summary"><strong>{generatedOutfitReview.accepted.length}</strong><p>tenue{generatedOutfitReview.accepted.length > 1 ? "s" : ""} validée{generatedOutfitReview.accepted.length > 1 ? "s" : ""}</p>{generatedOutfitReview.error && <p className="capsule-action-error">{generatedOutfitReview.error}</p>}<button type="button" className="primary" disabled={savingGeneratedOutfits} onClick={saveGeneratedOutfits}>{savingGeneratedOutfits ? "Enregistrement…" : generatedOutfitReview.accepted.length ? `Enregistrer ${generatedOutfitReview.accepted.length} tenue${generatedOutfitReview.accepted.length > 1 ? "s" : ""}` : "Terminer"}</button></div>}
    </section></div>}
    {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} confirmLabel={confirmDialog.label} loading={confirmLoading} onClose={() => setConfirmDialog(null)} onConfirm={confirmCurrentAction}/>}
    {open && <Modal title="Créer un outfit" onClose={closeCreator}><form onSubmit={save}>
      <div className="form-grid"><label>Nom<input name="name" required/></label><label>Occasion<input name="occasion" placeholder="Travail, soirée…"/></label></div>
      <div className="outfit-season-filter"><h3>Saison</h3><div className="category-pills" aria-label="Filtrer les vêtements par saison"><button type="button" className={!selectedSeason ? "active" : ""} aria-pressed={!selectedSeason} onClick={() => setSelectedSeason("")}>Toutes</button>{seasons.map(season => <button type="button" key={season} className={selectedSeason === season ? "active" : ""} aria-pressed={selectedSeason === season} onClick={() => setSelectedSeason(season)}>{season}</button>)}</div></div>
      <div className="outfit-selector-heading"><h3>Sélectionnez les pièces</h3><div><span>{selected.length} sélectionnée{selected.length > 1 ? "s" : ""}</span><button type="button" className={`secondary compact ${sortByCompatibility ? "active" : ""}`} aria-pressed={sortByCompatibility} onClick={() => setSortByCompatibility(value => !value)}><ArrowDownWideNarrow size={16}/> Plus compatibles</button></div></div>
      <div className="selector-grid">{visibleClothes.map(item => <ClothingCard key={item._id} item={item} selectable selected={selected.includes(item._id)} onSelect={toggle}/>)}</div>
      {!visibleClothes.length && <p className="empty-filter-message">Aucun vêtement compatible ne correspond à cette sélection.</p>}
      <button className="primary full-width" disabled={!selected.length}>Enregistrer l’outfit</button>
    </form></Modal>}
  </>;
}
