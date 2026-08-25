import express from "express";
import ChecklistTemplate, { defaultChecklistItems } from "../models/ChecklistTemplate.js";

const router = express.Router();

const normalizeItems = rawItems => {
  if (!Array.isArray(rawItems) || rawItems.length > 200) throw new Error("Checklist invalide");
  const keys = new Set();
  return rawItems.map((item, index) => {
    const key = String(item?.key || `checklist-${Date.now()}-${index}`).trim().slice(0, 120);
    const category = String(item?.category || "").trim().slice(0, 80);
    const label = String(item?.label || "").trim().slice(0, 140);
    if (!key || !category || !label || keys.has(key)) throw new Error("Chaque élément doit avoir un nom et une catégorie");
    keys.add(key);
    return { key, category, label };
  });
};

const ensureDefaultChecklist = async () => {
  if (await ChecklistTemplate.exists({})) return;
  await ChecklistTemplate.create({ name: "Voyage", items: defaultChecklistItems });
};

router.get("/", async (req, res) => {
  await ensureDefaultChecklist();
  res.json(await ChecklistTemplate.find().sort({ createdAt: 1 }));
});

router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ message: "Donnez un nom à la checklist" });
  try {
    const checklist = await ChecklistTemplate.create({ name, items: normalizeItems(req.body.items || []) });
    res.status(201).json(checklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ message: "Donnez un nom à la checklist" });
  try {
    const checklist = await ChecklistTemplate.findByIdAndUpdate(
      req.params.id,
      { name, items: normalizeItems(req.body.items || []) },
      { new: true, runValidators: true }
    );
    if (!checklist) return res.status(404).json({ message: "Checklist introuvable" });
    res.json(checklist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const checklist = await ChecklistTemplate.findByIdAndDelete(req.params.id);
  if (!checklist) return res.status(404).json({ message: "Checklist introuvable" });
  res.status(204).end();
});

export default router;
