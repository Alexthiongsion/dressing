import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
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
  }
}, { timestamps: true });
export default mongoose.model("Collection", schema);
