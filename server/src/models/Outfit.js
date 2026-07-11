import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  clothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing", required: true }],
  occasion: { type: String, trim: true, default: "" },
  season: { type: String, trim: true, default: "" },
  notes: { type: String, trim: true, default: "" },
  favorite: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model("Outfit", schema);
