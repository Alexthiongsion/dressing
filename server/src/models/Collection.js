import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  capsuleMode: { type: String, enum: ["travel", "simple"], default: "travel" },
  targetPieces: { type: Number, min: 1, max: 100, default: 15 },
  notes: { type: String, trim: true, default: "" },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  coverUrl: { type: String, trim: true, default: "" },
  clothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing" }],
  manualClothes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Clothing" }],
  outfits: [{ type: mongoose.Schema.Types.ObjectId, ref: "Outfit" }],
  travel: {
    destination: { type: String, trim: true, default: "" },
    latitude: Number,
    longitude: Number,
    timezone: { type: String, default: "auto" },
    startDate: String,
    endDate: String,
    destinations: [{
      destination: { type: String, trim: true, default: "" },
      latitude: Number,
      longitude: Number,
      timezone: { type: String, default: "auto" },
      startDate: String,
      endDate: String
    }]
  },
  weather: {
    type: { type: String, enum: ["forecast", "seasonal", "climate", ""], default: "" },
    updatedAt: Date,
    daily: { type: [mongoose.Schema.Types.Mixed], default: [] },
    locations: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  packingRequirements: {
    tops: { type: Number, min: 0 },
    bottoms: { type: Number, min: 0 },
    shoes: { type: Number, min: 0 },
    inters: { type: Number, min: 0 },
    coats: { type: Number, min: 0 }
  }
}, { timestamps: true });
export default mongoose.model("Collection", schema);
