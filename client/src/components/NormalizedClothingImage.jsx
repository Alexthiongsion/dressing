import { useEffect, useState } from "react";
import { defaultImageDisplay, getNormalizedClothingImage } from "../utils/normalizeClothingImage";

const compositionScale = {
  Haut: 0.78,
  Inter: 0.9,
  Manteau: 1,
  Bas: 0.96,
  Chaussures: 0.52,
  Accessoire: 0.42,
};

export default function NormalizedClothingImage({ item, alt = "", className = "", proportionate = false }) {
  const [source, setSource] = useState(item?.imageUrl || "");

  useEffect(() => {
    let active = true;
    setSource(item?.imageUrl || "");
    if (item?.imageUrl) getNormalizedClothingImage(item.imageUrl).then(value => { if (active) setSource(value); });
    return () => { active = false; };
  }, [item?.imageUrl]);

  if (!item?.imageUrl) return <span className={`normalized-clothing-image ${className}`.trim()}/>;
  const display = { ...defaultImageDisplay, ...(item.imageDisplay || {}) };
  const scale = display.scale * (proportionate ? compositionScale[item.category] || 0.72 : 1);

  return <span className={`normalized-clothing-image ${proportionate ? "proportionate" : ""} ${className}`.trim()} style={{ "--clothing-scale": scale, "--clothing-x": `${display.offsetX}%`, "--clothing-y": `${display.offsetY}%` }}><img src={source} alt={alt}/></span>;
}
