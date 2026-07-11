import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  coverUrl: { type: String, trim: true, default: "" },
  clothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing" }],
  manualClothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing" }],
  outfits: [{ type: mongoose.Schema.Types.ObjectId, ref: "Outfit" }]
}, { timestamps: true });
export default mongoose.model("Collection", schema);
