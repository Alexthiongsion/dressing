import express from "express";
import Clothing from "../models/Clothing.js";
import Outfit from "../models/Outfit.js";
import Collection from "../models/Collection.js";
const router = express.Router();
router.get("/", async (req, res) => {
  const q = {};
  if (req.query.category) q.category = req.query.category;
  if (req.query.favorite === "true") q.favorite = true;
  if (req.query.search) q.$or = ["name", "brand", "color", "style"].map(key => ({ [key]: { $regex: req.query.search, $options: "i" } }));
  res.json(await Clothing.find(q).sort({ createdAt: -1 }));
});
router.post("/", async (req, res) => res.status(201).json(await Clothing.create(req.body)));
router.put("/:id", async (req, res) => {
  const item = await Clothing.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: "Vêtement introuvable" });
  res.json(item);
});
router.delete("/:id", async (req, res) => {
  const item = await Clothing.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Vêtement introuvable" });
  await Outfit.updateMany({}, { $pull: { clothes: item._id } });
  await Collection.updateMany({}, { $pull: { clothes: item._id } });
  res.status(204).end();
});
export default router;
