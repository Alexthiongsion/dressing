import express from "express";
import Clothing from "../models/Clothing.js";
import Outfit from "../models/Outfit.js";
import Collection from "../models/Collection.js";
const router = express.Router();
router.get("/", async (req, res) => {
  const [clothesCount, outfitsCount, collectionsCount, favorites, recentClothes, recentOutfits] = await Promise.all([
    Clothing.countDocuments(), Outfit.countDocuments(), Collection.countDocuments(),
    Clothing.countDocuments({ favorite: true }), Clothing.find().sort({ createdAt: -1 }).limit(4),
    Outfit.find().populate("clothes").sort({ createdAt: -1 }).limit(3)
  ]);
  res.json({ clothesCount, outfitsCount, collectionsCount, favorites, recentClothes, recentOutfits });
});
export default router;
