export function notFound(req, res) { res.status(404).json({ message: "Route introuvable" }); }
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: "Cette valeur existe déjà" });
  res.status(err.status || 500).json({ message: err.message || "Erreur serveur" });
}
