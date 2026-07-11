import express from "express";
import Outfit from "../models/Outfit.js";
import Clothing from "../models/Clothing.js";
import Collection from "../models/Collection.js";
const router = express.Router();
router.get("/", async (req, res) => res.json(await Outfit.find().populate("clothes").sort({ createdAt: -1 })));
router.post("/", async (req, res) => {
  const count = await Clothing.countDocuments({ _id: { $in: req.body.clothes || [] } });
  if (!req.body.clothes?.length || count !== req.body.clothes.length) return res.status(400).json({ message: "Sélection de vêtements invalide" });
  const outfit = await Outfit.create(req.body);
  res.status(201).json(await outfit.populate("clothes"));
});
router.put("/:id", async (req, res) => {
  if (req.body.clothes) {
    const count = await Clothing.countDocuments({ _id: { $in: req.body.clothes } });
    if (count !== req.body.clothes.length) return res.status(400).json({ message: "Sélection invalide" });
  }
  const outfit = await Outfit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate("clothes");
  if (!outfit) return res.status(404).json({ message: "Outfit introuvable" });
  res.json(outfit);
});
router.delete("/:id", async (req, res) => {
  const outfit = await Outfit.findByIdAndDelete(req.params.id);
  if (!outfit) return res.status(404).json({ message: "Outfit introuvable" });
  await Collection.updateMany({}, { $pull: { outfits: outfit._id } });
  res.status(204).end();
});
export default router;
