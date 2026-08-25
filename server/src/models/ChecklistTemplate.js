import mongoose from "mongoose";

export const defaultChecklistItems = [
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
  label
}));

const checklistTemplateItemSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true }
}, { _id: false });

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  items: { type: [checklistTemplateItemSchema], default: [] }
}, { timestamps: true });

export default mongoose.model("ChecklistTemplate", schema);
