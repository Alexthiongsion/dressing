export const packingRulesKey = "wearsense:packing-rules";

export const packingProfiles = {
  light: {
    label: "Léger",
    description: "Réutilisation maximale et bagage compact.",
    hotTopDays: 2, mildTopDays: 3, hotBottomDays: 3, mildBottomDays: 4,
    oneShoeMaxDays: 5, twoShoesMaxDays: 14, interTemperature: 18, coatTemperature: 12,
    laundryEveryDays: 7, safetyMargin: 0, rainShoes: true,
  },
  balanced: {
    label: "Équilibré",
    description: "Un bon compromis entre confort et volume.",
    hotTopDays: 1, mildTopDays: 2, hotBottomDays: 2, mildBottomDays: 3,
    oneShoeMaxDays: 3, twoShoesMaxDays: 10, interTemperature: 22, coatTemperature: 18,
    laundryEveryDays: 0, safetyMargin: 0, rainShoes: true,
  },
  comfort: {
    label: "Confort",
    description: "Davantage de changements et une pièce de secours.",
    hotTopDays: 1, mildTopDays: 1, hotBottomDays: 2, mildBottomDays: 2,
    oneShoeMaxDays: 2, twoShoesMaxDays: 7, interTemperature: 24, coatTemperature: 20,
    laundryEveryDays: 0, safetyMargin: 1, rainShoes: true,
  },
};

export const defaultPackingSettings = { profile: "balanced", ...packingProfiles.balanced };

export function getPackingSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(packingRulesKey));
    return stored ? { ...defaultPackingSettings, ...stored } : defaultPackingSettings;
  } catch {
    return defaultPackingSettings;
  }
}

export function savePackingSettings(settings) {
  localStorage.setItem(packingRulesKey, JSON.stringify(settings));
}

export function applyPackingProfile(profile) {
  return { profile, ...packingProfiles[profile] };
}
