import mongoose from "mongoose";
const schema = new mongoose.Schema({
name: { type: String, trim: true, default: "" },

category: {
  type: String,
  trim: true,
  default: "",
  enum: ["", "Haut", "Bas", "Inter", "Chaussures", "Accessoire", "Manteau"]
},
  brand: { type: String, trim: true, default: "" },
  color: { type: String, trim: true, default: "" },
  season: [{ type: String, enum: ["Printemps", "Été", "Automne", "Hiver"] }],
  style: { type: String, trim: true, default: "" },
  size: { type: String, trim: true, default: "" },
  imageUrl: { type: String, trim: true, default: "" },
  favorite: { type: Boolean, default: false },
  compatibleWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing" }],
  compatibilityConfigured: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  wornCount: { type: Number, default: 0, min: 0 },
  lastWornAt: Date
}, { timestamps: true });
export default mongoose.model("Clothing", schema);
