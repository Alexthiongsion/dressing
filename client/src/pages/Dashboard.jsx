import { useEffect, useState } from "react";
import { api } from "../services/api";
export default function Dashboard() {
 const [data, setData] = useState(null); useEffect(() => { api("/dashboard").then(setData); }, []);
 if (!data) return <p>Chargement…</p>;
 return <><header className="page-header"><div><span className="eyebrow">Vue d’ensemble</span><h1>Votre dressing</h1></div></header><section className="stats"><article><strong>{data.clothesCount}</strong><span>Vêtements</span></article><article><strong>{data.outfitsCount}</strong><span>Outfits</span></article><article><strong>{data.collectionsCount}</strong><span>Collections</span></article><article><strong>{data.favorites}</strong><span>Favoris</span></article></section><section><h2>Derniers vêtements</h2><div className="mini-grid">{data.recentClothes.map(i => <article className="mini-card" key={i._id}>{i.imageUrl ? <img src={i.imageUrl} alt=""/> : <div/>}<b>{i.name}</b><span>{i.category}</span></article>)}</div></section></>;
}
