const categoryOrder = ["Haut", "Inter", "Manteau", "Accessoire", "Bas", "Chaussures"];
const requiredCategories = ["Haut", "Bas", "Chaussures"];

const idOf = value => String(value?._id || value);
const linksTo = (item, id) => item?.compatibleWith?.some(link => idOf(link) === id);
const areCompatible = (first, second) => linksTo(first, idOf(second)) || linksTo(second, idOf(first));
const outfitKey = items => items.map(item => idOf(item)).sort().join(":");

export function buildCompatibleCapsuleOutfits(clothes, existingOutfits = [], limit = 5000) {
  const groups = new Map(categoryOrder.map(category => [category, clothes.filter(item => item.category === category)]));
  if (requiredCategories.some(category => !groups.get(category)?.length)) return [];

  const existingKeys = new Set(existingOutfits.map(outfit => outfitKey(outfit.clothes || [])));
  const proposals = [];

  const visit = (categoryIndex, selected) => {
    if (proposals.length >= limit) return;
    if (categoryIndex === categoryOrder.length) {
      const key = outfitKey(selected);
      if (!existingKeys.has(key)) proposals.push([...selected]);
      return;
    }

    const category = categoryOrder[categoryIndex];
    const candidates = groups.get(category) || [];
    if (!requiredCategories.includes(category)) visit(categoryIndex + 1, selected);
    for (const candidate of candidates) {
      if (selected.every(item => areCompatible(item, candidate))) visit(categoryIndex + 1, [...selected, candidate]);
      if (proposals.length >= limit) return;
    }
  };

  visit(0, []);
  return proposals;
}
