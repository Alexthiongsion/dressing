import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const router = express.Router();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.resolve(currentDir, "../../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const extension = ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif" })[file.mimetype] || "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => allowedTypes.has(file.mimetype) ? cb(null, true) : cb(new Error("Format d’image non accepté"))
});

router.post("/image", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Aucune image reçue" });
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.status(201).json({ imageUrl: `${baseUrl}/uploads/${req.file.filename}` });
});

export default router;
