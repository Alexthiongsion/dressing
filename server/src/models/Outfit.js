import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  clothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing", required: true }],
  occasion: { type: String, trim: true, default: "" },
  season: {
    type: [{ type: String, enum: ["Printemps", "Été", "Automne", "Hiver"] }],
    default: [],
    set: value => (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean)
  },
  notes: { type: String, trim: true, default: "" },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  favorite: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model("Outfit", schema);
