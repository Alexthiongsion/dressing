import express from "express";
import Clothing from "../models/Clothing.js";
import Outfit from "../models/Outfit.js";
import Collection from "../models/Collection.js";
const router = express.Router();
router.get("/", async (req, res) => {
  const q = {};
  if (req.query.category) q.category = { $in: req.query.category.split(",").filter(Boolean) };
  if (req.query.season) q.season = { $in: req.query.season.split(",").filter(Boolean) };
  if (req.query.favorite === "true") q.favorite = true;
  if (req.query.search) q.$or = ["name", "brand", "color", "style"].map(key => ({ [key]: { $regex: req.query.search, $options: "i" } }));
  res.json(await Clothing.find(q).sort({ createdAt: -1 }));
});
router.post("/", async (req, res) => res.status(201).json(await Clothing.create(req.body)));
router.put("/:id/compatibility", async (req, res) => {
  const item = await Clothing.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Vêtement introuvable" });

  const requestedIds = [...new Set((req.body.compatibleWith || []).map(String))].filter(id => id !== req.params.id);
  const validIds = await Clothing.distinct("_id", { _id: { $in: requestedIds }, category: { $ne: item.category } });
  const nextIds = validIds.map(String);
  const previousIds = item.compatibleWith.map(String);
  const removedIds = previousIds.filter(id => !nextIds.includes(id));

  await Promise.all([
    removedIds.length ? Clothing.updateMany({ _id: { $in: removedIds } }, { $pull: { compatibleWith: item._id } }) : null,
    nextIds.length ? Clothing.updateMany({ _id: { $in: nextIds } }, { $addToSet: { compatibleWith: item._id } }) : null,
  ]);
  item.compatibleWith = validIds;
  item.compatibilityConfigured = true;
  await item.save();
  res.json(item);
});
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
  await Clothing.updateMany({}, { $pull: { compatibleWith: item._id } });
  res.status(204).end();
});
export default router;
