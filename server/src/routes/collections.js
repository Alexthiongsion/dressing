import express from "express";
import Collection from "../models/Collection.js";
import Clothing from "../models/Clothing.js";
import ChecklistTemplate from "../models/ChecklistTemplate.js";
import Outfit from "../models/Outfit.js";
const router = express.Router();
const capsuleSeasons = ["Printemps", "Été", "Automne", "Hiver"];
const normalizedCapsuleSeason = value => capsuleSeasons.includes(value) ? value : "";
router.get("/", async (req, res) => res.json(await Collection.find().populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }).sort({ createdAt: -1 })));
router.post("/", async (req, res) => {
  const clothes = req.body.clothes || [], outfits = req.body.outfits || [];
  const [cCount, oCount] = await Promise.all([
    Clothing.countDocuments({ _id: { $in: clothes } }),
    Outfit.countDocuments({ _id: { $in: outfits } })
  ]);
  if (cCount !== clothes.length || oCount !== outfits.length) return res.status(400).json({ message: "Contenu de collection invalide" });
  const collection = await Collection.create(req.body);
  res.status(201).json(await collection.populate(["clothes", "outfits"]));
});
router.post("/capsule", async (req, res) => {
  const outfitCount = Math.min(20, Math.max(1, Number(req.body.outfitCount) || 1));
  const clothes = await Clothing.find({ _id: { $in: req.body.clothes || [] } });
  if (clothes.length !== (req.body.clothes || []).length) return res.status(400).json({ message: "Sélection de vêtements invalide" });
  const groups = [...new Set(clothes.map(item => item.category))].map(category => clothes.filter(item => item.category === category));
  if (groups.length < 2) return res.status(400).json({ message: "Choisissez des vêtements dans au moins deux catégories" });
  let combinations = [[]];
  for (const group of groups) {
    combinations = combinations.flatMap(combination => group.map(item => [...combination, item]));
    if (combinations.length > 5000) combinations = combinations.slice(0, 5000);
  }
  combinations = combinations.filter(combination => combination.every((item, index) => combination.slice(index + 1).every(other => item.compatibleWith.map(String).includes(String(other._id)))));
  if (combinations.length < outfitCount) return res.status(400).json({ message: `Seulement ${combinations.length} tenue${combinations.length > 1 ? "s" : ""} compatible${combinations.length > 1 ? "s" : ""} possible${combinations.length > 1 ? "s" : ""}` });
  const createdOutfits = await Outfit.insertMany(combinations.slice(0, outfitCount).map((combination, index) => ({ name: `${req.body.name} · Tenue ${index + 1}`, clothes: combination.map(item => item._id), occasion: "Voyage" })));
  const collection = await Collection.create({ name: req.body.name, season: normalizedCapsuleSeason(req.body.season), description: "Capsule bagage", clothes: clothes.map(item => item._id), outfits: createdOutfits.map(outfit => outfit._id) });
  res.status(201).json(await collection.populate(["clothes", "outfits"]));
});
router.post("/capsule/generated", async (req, res) => {
  const name = req.body.name?.trim();
  const capsuleMode = req.body.capsuleMode === "simple" ? "simple" : "travel";
  const requestedClothes = Array.isArray(req.body.clothes) ? req.body.clothes : [];
  if (!name || !requestedClothes.length) return res.status(400).json({ message: "Capsule invalide" });
  const ids = [...new Set(requestedClothes)];
  const clothes = await Clothing.find({ _id: { $in: ids } });
  if (clothes.length !== ids.length) return res.status(400).json({ message: "Certaines pièces sont introuvables" });
  if (capsuleMode === "simple") {
    const missingCategories = ["Haut", "Bas", "Chaussures"].filter(category => !clothes.some(item => item.category === category));
    if (missingCategories.length) return res.status(400).json({ message: `Une capsule doit contenir au minimum un haut, un bas et une paire de chaussures. Il manque : ${missingCategories.join(" · ")}` });
  }
  const collection = await Collection.create({ name, capsuleMode, season: normalizedCapsuleSeason(req.body.season), targetPieces: capsuleMode === "simple" ? Math.min(100, Math.max(1, Number(req.body.targetPieces) || 15)) : undefined, description: capsuleMode === "simple" ? "Capsule" : "Capsule bagage", clothes: ids, manualClothes: ids, outfits: [], travel: capsuleMode === "travel" ? req.body.travel : undefined, weather: capsuleMode === "travel" ? req.body.weather : undefined, weatherSnapshot: capsuleMode === "travel" ? req.body.weather : undefined, packingRequirements: req.body.packingRequirements });
  await collection.populate("clothes");
  await collection.populate({ path: "outfits", populate: { path: "clothes" } });
  res.status(201).json(collection);
});
router.post("/:id/outfits/bulk", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  const proposals = Array.isArray(req.body.outfits) ? req.body.outfits : [];
  if (!collection || !proposals.length || proposals.length > 5000) return res.status(400).json({ message: "Sélection de tenues invalide" });

  const capsuleIds = new Set(collection.clothes.map(String));
  const requestedIds = [...new Set(proposals.flatMap(proposal => proposal.clothes || []).map(String))];
  if (requestedIds.some(id => !capsuleIds.has(id))) return res.status(400).json({ message: "Une tenue contient une pièce absente de la capsule" });
  const clothes = await Clothing.find({ _id: { $in: requestedIds } });
  if (clothes.length !== requestedIds.length) return res.status(400).json({ message: "Certaines pièces sont introuvables" });

  const byId = new Map(clothes.map(item => [String(item._id), item]));
  const currentOutfits = await Outfit.find({ _id: { $in: collection.outfits } });
  const knownKeys = new Set(currentOutfits.map(outfit => outfit.clothes.map(String).sort().join(":")));
  const validProposals = [];
  for (const proposal of proposals) {
    const items = [...new Set((proposal.clothes || []).map(String))].map(id => byId.get(id)).filter(Boolean);
    const categories = new Set(items.map(item => item.category));
    if (items.length !== (proposal.clothes || []).length || categories.size !== items.length || !["Haut", "Bas", "Chaussures"].every(category => categories.has(category))) return res.status(400).json({ message: "Une tenue validée est incomplète ou invalide" });
    const compatible = items.every((item, index) => items.slice(index + 1).every(other => item.compatibleWith.map(String).includes(String(other._id)) || other.compatibleWith.map(String).includes(String(item._id))));
    if (!compatible) return res.status(400).json({ message: "Une tenue validée contient des pièces incompatibles" });
    const key = items.map(item => String(item._id)).sort().join(":");
    if (knownKeys.has(key)) continue;
    knownKeys.add(key);
    validProposals.push({ name: proposal.name?.trim(), clothes: items.map(item => item._id) });
  }
  if (!validProposals.length) return res.status(400).json({ message: "Ces tenues sont déjà enregistrées dans la capsule" });

  const created = await Outfit.insertMany(validProposals.map((proposal, index) => ({
    name: proposal.name || `${collection.name} · Tenue ${collection.outfits.length + index + 1}`,
    clothes: proposal.clothes,
    occasion: collection.capsuleMode === "travel" ? "Voyage" : "Capsule"
  })));
  collection.outfits.push(...created.map(outfit => outfit._id));
  await collection.save();
  res.status(201).json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.post("/:id/outfits", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  const clothes = await Clothing.find({ _id: { $in: req.body.clothes || [] } });
  if (!collection || !clothes.length || clothes.length !== (req.body.clothes || []).length) return res.status(400).json({ message: "Nouvelle tenue invalide" });
  if (new Set(clothes.map(item => item.category)).size !== clothes.length) return res.status(400).json({ message: "Une seule pièce par catégorie est autorisée" });
  const compatible = clothes.every((item, index) => clothes.slice(index + 1).every(other => item.compatibleWith.map(String).includes(String(other._id))));
  if (!compatible) return res.status(400).json({ message: "Certaines pièces ne sont pas compatibles" });
  const name = req.body.name?.trim() || `Tenue ${collection.outfits.length + 1}`;
  const outfit = await Outfit.create({ name, clothes: clothes.map(item => item._id), occasion: "Voyage" });
  collection.outfits.push(outfit._id);
  collection.clothes = [...new Set([...collection.clothes.map(String), ...clothes.map(item => String(item._id))])];
  await collection.save();
  res.status(201).json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/outfits/:outfitId/replace", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.outfits.map(String).includes(req.params.outfitId)) return res.status(404).json({ message: "Tenue de capsule introuvable" });
  const outfit = await Outfit.findById(req.params.outfitId).populate("clothes");
  const replacement = await Clothing.findById(req.body.replacementId);
  const currentIndex = outfit?.clothes.findIndex(item => String(item._id) === String(req.body.itemId));
  if (!outfit || !replacement || currentIndex < 0) return res.status(400).json({ message: "Remplacement invalide" });
  const currentItem = outfit.clothes[currentIndex];
  if (replacement.category !== currentItem.category) return res.status(400).json({ message: "Choisissez une pièce de la même catégorie" });
  const otherItems = outfit.clothes.filter((_, index) => index !== currentIndex);
  if (!otherItems.every(item => replacement.compatibleWith.map(String).includes(String(item._id)))) return res.status(400).json({ message: "Cette pièce n’est pas compatible avec la tenue" });
  outfit.clothes = outfit.clothes.map((item, index) => index === currentIndex ? replacement._id : item._id);
  await outfit.save();
  const capsuleOutfits = await Outfit.find({ _id: { $in: collection.outfits } });
  collection.clothes = [...new Set([...capsuleOutfits.flatMap(item => item.clothes.map(String)), ...collection.manualClothes.map(String)])];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/outfits/:outfitId/add", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.outfits.map(String).includes(req.params.outfitId)) return res.status(404).json({ message: "Tenue de capsule introuvable" });
  const outfit = await Outfit.findById(req.params.outfitId).populate("clothes");
  const addition = await Clothing.findById(req.body.itemId);
  if (!outfit || !addition) return res.status(400).json({ message: "Pièce invalide" });
  if (outfit.clothes.some(item => item.category === addition.category)) return res.status(400).json({ message: "Cette catégorie est déjà présente dans la tenue" });
  if (!outfit.clothes.every(item => addition.compatibleWith.map(String).includes(String(item._id)))) return res.status(400).json({ message: "Cette pièce n’est pas compatible avec la tenue" });
  outfit.clothes.push(addition._id);
  await outfit.save();
  collection.clothes = [...new Set([...collection.clothes.map(String), String(addition._id)])];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.delete("/:id/outfits/:outfitId/items/:itemId", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.outfits.map(String).includes(req.params.outfitId)) return res.status(404).json({ message: "Tenue de capsule introuvable" });
  const outfit = await Outfit.findById(req.params.outfitId);
  if (!outfit || !outfit.clothes.map(String).includes(req.params.itemId)) return res.status(404).json({ message: "Pièce introuvable dans cette tenue" });
  if (outfit.clothes.length <= 1) return res.status(400).json({ message: "Une tenue doit conserver au moins une pièce" });
  outfit.clothes = outfit.clothes.filter(itemId => String(itemId) !== req.params.itemId);
  await outfit.save();
  const capsuleOutfits = await Outfit.find({ _id: { $in: collection.outfits } });
  collection.clothes = [...new Set([...capsuleOutfits.flatMap(item => item.clothes.map(String)), ...collection.manualClothes.map(String)])];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.delete("/:id/outfits/:outfitId", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.outfits.map(String).includes(req.params.outfitId)) return res.status(404).json({ message: "Tenue de capsule introuvable" });
  await Outfit.findByIdAndDelete(req.params.outfitId);
  collection.outfits = collection.outfits.filter(outfitId => String(outfitId) !== req.params.outfitId);
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.delete("/:id/items/:itemId", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.clothes.map(String).includes(req.params.itemId)) return res.status(404).json({ message: "Pièce introuvable dans cette capsule" });
  collection.manualClothes = collection.manualClothes.filter(itemId => String(itemId) !== req.params.itemId);
  collection.clothes = collection.clothes.filter(itemId => String(itemId) !== req.params.itemId);
  collection.outfits = [];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/items/order", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return res.status(404).json({ message: "Capsule introuvable" });

  const requestedIds = Array.isArray(req.body.clothes) ? req.body.clothes.map(String) : [];
  const currentIds = collection.clothes.map(String);
  const currentIdSet = new Set(currentIds);
  const orderIsValid = requestedIds.length === currentIds.length
    && new Set(requestedIds).size === requestedIds.length
    && requestedIds.every(itemId => currentIdSet.has(itemId));

  if (!orderIsValid) return res.status(400).json({ message: "Ordre des pièces invalide" });

  collection.clothes = requestedIds;
  const manualIdSet = new Set(collection.manualClothes.map(String));
  collection.manualClothes = requestedIds.filter(itemId => manualIdSet.has(itemId));
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/items", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  const item = await Clothing.findById(req.body.itemId);
  if (!collection || !item) return res.status(404).json({ message: "Capsule ou pièce introuvable" });
  if (!collection.manualClothes.map(String).includes(String(item._id))) collection.manualClothes.push(item._id);
  if (!collection.clothes.map(String).includes(String(item._id))) collection.clothes.push(item._id);
  collection.outfits = [];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/capsule", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return res.status(404).json({ message: "Capsule introuvable" });

  const requestedIds = [...new Set((req.body.clothes || []).map(String))];
  if (!requestedIds.length) return res.status(400).json({ message: "Ajoutez au moins une pièce à la capsule" });
  const clothes = await Clothing.find({ _id: { $in: requestedIds } });
  if (clothes.length !== requestedIds.length) return res.status(400).json({ message: "Certaines pièces sont introuvables" });

  const capsuleMode = req.body.capsuleMode === "simple" ? "simple" : "travel";
  if (capsuleMode === "simple") {
    const missingCategories = ["Haut", "Bas", "Chaussures"].filter(category => !clothes.some(item => item.category === category));
    if (missingCategories.length) return res.status(400).json({ message: "Une capsule doit conserver au minimum un haut, un bas et une paire de chaussures" });
  }

  collection.name = req.body.name?.trim() || collection.name;
  collection.capsuleMode = capsuleMode;
  if (Object.prototype.hasOwnProperty.call(req.body, "season")) collection.season = normalizedCapsuleSeason(req.body.season);
  collection.description = capsuleMode === "simple" ? "Capsule" : "Capsule bagage";
  collection.targetPieces = capsuleMode === "simple" ? Math.min(100, Math.max(1, Number(req.body.targetPieces) || collection.targetPieces || 15)) : collection.targetPieces;
  collection.clothes = requestedIds;
  collection.manualClothes = requestedIds;
  collection.outfits = [];
  if (capsuleMode === "travel") {
    collection.travel = req.body.travel;
    collection.weather = req.body.weather;
    collection.weatherSnapshot = req.body.weather;
    collection.packingRequirements = req.body.packingRequirements;
  }
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/travel-checklist", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return res.status(404).json({ message: "Capsule introuvable" });
  if (!Array.isArray(req.body.items) || req.body.items.length > 200) {
    return res.status(400).json({ message: "Checklist invalide" });
  }

  const keys = new Set();
  const items = [];
  for (let index = 0; index < req.body.items.length; index += 1) {
    const item = req.body.items[index] || {};
    const key = String(item.key || `travel-${Date.now()}-${index}`).trim().slice(0, 120);
    const category = String(item.category || "").trim().slice(0, 80);
    const label = String(item.label || "").trim().slice(0, 140);
    if (!key || !category || !label || keys.has(key)) {
      return res.status(400).json({ message: "Chaque élément doit avoir un nom et une catégorie uniques" });
    }
    keys.add(key);
    items.push({ key, category, label, checked: Boolean(item.checked) });
  }

  collection.travelChecklist = items;
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/checklists", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return res.status(404).json({ message: "Capsule introuvable" });
  if (!Array.isArray(req.body.checklists) || req.body.checklists.length > 20) {
    return res.status(400).json({ message: "Sélection de checklists invalide" });
  }

  try {
    collection.checklists = req.body.checklists.map((checklist, checklistIndex) => {
      const name = String(checklist?.name || "").trim().slice(0, 80);
      if (!name || !Array.isArray(checklist.items) || checklist.items.length > 200) throw new Error("Checklist invalide");
      const keys = new Set();
      const items = checklist.items.map((item, itemIndex) => {
        const key = String(item?.key || `checklist-${checklistIndex}-${itemIndex}-${Date.now()}`).trim().slice(0, 120);
        const category = String(item?.category || "").trim().slice(0, 80);
        const label = String(item?.label || "").trim().slice(0, 140);
        if (!key || !category || !label || keys.has(key)) throw new Error("Chaque élément doit avoir un nom et une catégorie");
        keys.add(key);
        return { key, category, label, checked: Boolean(item.checked) };
      });
      return {
        _id: checklist._id || undefined,
        templateId: checklist.templateId || undefined,
        name,
        items
      };
    });
    await collection.save();
    res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
router.post("/:id/checklists/:checklistId/sync", async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: "Capsule introuvable" });

    const checklist = collection.checklists.id(req.params.checklistId);
    if (!checklist) return res.status(404).json({ message: "Checklist introuvable dans cette capsule" });

    let template = checklist.templateId
      ? await ChecklistTemplate.findById(checklist.templateId)
      : null;
    if (!template) {
      template = await ChecklistTemplate.findOne({
        name: { $regex: `^${String(checklist.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
      });
    }
    if (!template) return res.status(404).json({ message: "Le modèle global de cette checklist est introuvable" });

    const existingByKey = new Map(checklist.items.map(item => [item.key, item]));
    const templateKeys = new Set(template.items.map(item => item.key));
    const synchronizedItems = template.items.map(item => ({
      key: item.key,
      category: item.category,
      label: item.label,
      checked: Boolean(existingByKey.get(item.key)?.checked)
    }));
    checklist.items.forEach(item => {
      if (!templateKeys.has(item.key)) {
        synchronizedItems.push({
          key: item.key,
          category: item.category,
          label: item.label,
          checked: Boolean(item.checked)
        });
      }
    });

    checklist.templateId = template._id;
    checklist.name = template.name;
    checklist.items = synchronizedItems;
    await collection.save();

    res.json(await Collection.findById(collection._id)
      .populate("clothes")
      .populate({ path: "outfits", populate: { path: "clothes" } }));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
router.post("/:id/checklists/:checklistId/publish", async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: "Capsule introuvable" });

    const checklist = collection.checklists.id(req.params.checklistId);
    if (!checklist) return res.status(404).json({ message: "Checklist introuvable dans cette capsule" });

    let template = checklist.templateId
      ? await ChecklistTemplate.findById(checklist.templateId)
      : null;
    if (!template) {
      template = await ChecklistTemplate.findOne({
        name: { $regex: `^${String(checklist.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
      });
    }
    if (!template) {
      template = new ChecklistTemplate({ name: checklist.name || "Checklist", items: [] });
    }

    const itemSignature = item => `${String(item.category).trim().toLocaleLowerCase("fr")}::${String(item.label).trim().toLocaleLowerCase("fr")}`;
    const mergedItems = template.items.map(item => ({
      key: item.key,
      category: item.category,
      label: item.label
    }));
    const itemIndexByKey = new Map(mergedItems.map((item, index) => [item.key, index]));
    const signatures = new Set(mergedItems.map(itemSignature));

    checklist.items.forEach(item => {
      const normalized = {
        key: item.key,
        category: item.category,
        label: item.label
      };
      const existingIndex = itemIndexByKey.get(normalized.key);
      if (existingIndex !== undefined) {
        signatures.delete(itemSignature(mergedItems[existingIndex]));
        mergedItems[existingIndex] = normalized;
        signatures.add(itemSignature(normalized));
        return;
      }
      const signature = itemSignature(normalized);
      if (signatures.has(signature)) return;
      itemIndexByKey.set(normalized.key, mergedItems.length);
      signatures.add(signature);
      mergedItems.push(normalized);
    });

    template.name = checklist.name || template.name;
    template.items = mergedItems;
    await template.save();

    if (!checklist.templateId) {
      checklist.templateId = template._id;
      await collection.save();
    }

    res.json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
router.put("/:id", async (req, res) => {
  const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } });
  if (!collection) return res.status(404).json({ message: "Collection introuvable" });
  res.json(collection);
});
router.delete("/:id", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection) return res.status(404).json({ message: "Collection introuvable" });
  if (collection.description === "Capsule bagage" && req.query.confirm !== "capsule") return res.status(400).json({ message: "Confirmez explicitement la suppression de la capsule" });
  await collection.deleteOne();
  res.status(204).end();
});
export default router;
