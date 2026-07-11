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
