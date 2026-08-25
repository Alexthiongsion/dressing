import mongoose from "mongoose";

const defaultTravelChecklist = () => [
  ["Hygiène / santé", "Brosse à dents"],
  ["Hygiène / santé", "Dentifrice"],
  ["Hygiène / santé", "Lingettes"],
  ["Hygiène / santé", "Savon"],
  ["Hygiène / santé", "Serviette"],
  ["Hygiène / santé", "Papier toilette"],
  ["Hygiène / santé", "Préservatifs"],
  ["Hygiène / santé", "Dexeryl"],
  ["Hygiène / santé", "Cétirizine"],
  ["Hygiène / santé", "Ventoline"],
  ["Hygiène / santé", "Prednisolone"],
  ["Hygiène / santé", "Ordonnances des médicaments"],
  ["Électronique", "Batterie externe"],
  ["Électronique", "Chargeur iPhone"],
  ["Électronique", "Chargeur du casque Bluetooth"],
  ["Documents / paiement", "Carte bancaire n°1"],
  ["Documents / paiement", "Carte bancaire n°2"],
  ["Documents / paiement", "Carte de transport"],
  ["Documents / paiement", "Carte d’identité"],
  ["Pratique", "Gourde"]
].map(([category, label], index) => ({
  key: `travel-default-${index + 1}`,
  category,
  label,
  checked: false
}));

const travelChecklistItemSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  checked: { type: Boolean, default: false }
}, { _id: false });

const capsuleChecklistSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistTemplate" },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  items: { type: [travelChecklistItemSchema], default: [] }
});

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  capsuleMode: { type: String, enum: ["travel", "simple"], default: "travel" },
  season: { type: String, enum: ["", "Printemps", "Été", "Automne", "Hiver"], default: "" },
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
    type: { type: String, enum: ["forecast", "seasonal", "climate", "historical", "estimated", ""], default: "" },
    updatedAt: Date,
    daily: { type: [mongoose.Schema.Types.Mixed], default: [] },
    locations: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  weatherSnapshot: {
    type: { type: String, enum: ["forecast", "seasonal", "climate", "historical", "estimated", ""], default: "" },
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
  },
  travelChecklist: { type: [travelChecklistItemSchema], default: defaultTravelChecklist },
  checklists: { type: [capsuleChecklistSchema], default: [] }
}, { timestamps: true });
export default mongoose.model("Collection", schema);
