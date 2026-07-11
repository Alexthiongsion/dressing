import express from "express";
import Collection from "../models/Collection.js";
import Clothing from "../models/Clothing.js";
import Outfit from "../models/Outfit.js";
const router = express.Router();
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
  const collection = await Collection.create({ name: req.body.name, description: "Capsule bagage", clothes: clothes.map(item => item._id), outfits: createdOutfits.map(outfit => outfit._id) });
  res.status(201).json(await collection.populate(["clothes", "outfits"]));
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
router.delete("/:id/items/:itemId", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  if (!collection || !collection.clothes.map(String).includes(req.params.itemId)) return res.status(404).json({ message: "Pièce introuvable dans cette capsule" });
  const capsuleOutfits = await Outfit.find({ _id: { $in: collection.outfits } });
  const emptyOutfitIds = [];
  for (const outfit of capsuleOutfits) {
    if (!outfit.clothes.map(String).includes(req.params.itemId)) continue;
    if (outfit.clothes.length === 1) emptyOutfitIds.push(outfit._id);
    else {
      outfit.clothes = outfit.clothes.filter(itemId => String(itemId) !== req.params.itemId);
      await outfit.save();
    }
  }
  if (emptyOutfitIds.length) {
    await Outfit.deleteMany({ _id: { $in: emptyOutfitIds } });
    collection.outfits = collection.outfits.filter(outfitId => !emptyOutfitIds.map(String).includes(String(outfitId)));
  }
  const remainingOutfits = await Outfit.find({ _id: { $in: collection.outfits } });
  collection.manualClothes = collection.manualClothes.filter(itemId => String(itemId) !== req.params.itemId);
  collection.clothes = [...new Set([...remainingOutfits.flatMap(outfit => outfit.clothes.map(String)), ...collection.manualClothes.map(String)])];
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id/items", async (req, res) => {
  const collection = await Collection.findById(req.params.id);
  const item = await Clothing.findById(req.body.itemId);
  if (!collection || !item) return res.status(404).json({ message: "Capsule ou pièce introuvable" });
  if (!collection.manualClothes.map(String).includes(String(item._id))) collection.manualClothes.push(item._id);
  if (!collection.clothes.map(String).includes(String(item._id))) collection.clothes.push(item._id);
  await collection.save();
  res.json(await Collection.findById(collection._id).populate("clothes").populate({ path: "outfits", populate: { path: "clothes" } }));
});
router.put("/:id", async (req, res) => {
  const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate("clothes").populate("outfits");
  if (!collection) return res.status(404).json({ message: "Collection introuvable" });
  res.json(collection);
});
router.delete("/:id", async (req, res) => {
  const result = await Collection.deleteOne({ _id: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ message: "Collection introuvable" });
  res.status(204).end();
});
export default router;
