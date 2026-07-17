export const outfitCategories = ["Haut", "Inter", "Manteau", "Accessoire", "Bas", "Chaussures"];

const idOf = value => value?._id || value;
const linksTo = (item, id) => item?.compatibleWith?.some(link => idOf(link) === id);
export const areCompatible = (first, second) => linksTo(first, second._id) || linksTo(second, first._id);

export function completeOutfit({ clothes, seedIds, lockedIds = seedIds, season = "", offset = 0, includeAccessories = true, excludedCategories = [] }) {
  const locked = lockedIds.map(id => clothes.find(item => item._id === id)).filter(Boolean);
  const result = [...locked];
  const wanted = (includeAccessories ? outfitCategories : outfitCategories.filter(category => category !== "Accessoire")).filter(category => !excludedCategories.includes(category));

  wanted.forEach(category => {
    if (result.some(item => item.category === category)) return;
    const candidates = clothes
      .filter(item => item.category === category)
      .filter(item => !season || item.season?.includes(season))
      .filter(item => result.every(selected => areCompatible(selected, item)))
      .sort((a, b) => (b.compatibleWith?.length || 0) - (a.compatibleWith?.length || 0));
    if (candidates.length) result.push(candidates[offset % candidates.length]);
  });

  return result.sort((a, b) => outfitCategories.indexOf(a.category) - outfitCategories.indexOf(b.category));
}

export function generateProposals(options, count = 3) {
  const seen = new Set();
  const proposals = [];
  for (let offset = 0; offset < Math.max(count * 4, 8) && proposals.length < count; offset += 1) {
    const proposal = completeOutfit({ ...options, offset });
    const key = proposal.map(item => item._id).join(":");
    if (proposal.length && !seen.has(key)) { seen.add(key); proposals.push(proposal); }
  }
  return proposals;
}
