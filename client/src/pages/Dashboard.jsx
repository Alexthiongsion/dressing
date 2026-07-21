import { useEffect, useState } from "react";
import { ArrowRight, Layers3, Luggage, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { api } from "../services/api";
import WeatherForecast from "../components/WeatherForecast";
import PageState from "../components/PageState";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadDashboard = async signal => {
    setLoading(true);
    setError("");
    try { setData(await api("/dashboard", { signal })); }
    catch (err) { if (!signal?.aborted) setError(err.message || "Impossible de charger votre dressing."); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, []);

  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return <div className="dashboard-page dashboard-minimal">
    <header className="dashboard-header">
      <div><span className="eyebrow">{date}</span><h1>Votre dressing</h1>{data && <div className="dashboard-summary"><Link to="/wardrobe">{data.clothesCount} pièces</Link><Link to="/outfits">{data.outfitsCount} tenues</Link><Link to="/capsules">{data.collectionsCount} capsule{data.collectionsCount > 1 ? "s" : ""}</Link></div>}</div>
      <Link className="primary" to="/outfits/new"><Sparkles size={18}/> Créer une tenue</Link>
    </header>

    <section className="dashboard-shortcuts dashboard-actions">
      <Link to="/wardrobe"><Plus size={20}/><b>Ajouter une pièce</b><ArrowRight size={17}/></Link>
      <Link to="/outfits/new/multiple"><Layers3 size={20}/><b>Créer plusieurs tenues</b><ArrowRight size={17}/></Link>
      <Link to="/capsules/new"><Luggage size={20}/><b>Préparer une capsule</b><ArrowRight size={17}/></Link>
    </section>

    <WeatherForecast/>

    {loading ? <PageState loading title="Chargement de votre dressing…"/> : error ? <PageState title="Votre dressing n’a pas pu être chargé" message="Vérifiez la connexion au serveur puis réessayez." onAction={() => loadDashboard()}/> : data ? <>
      <section className="dashboard-recent">
        <header><h2>Dernières pièces</h2><Link to="/wardrobe">Tout voir <ArrowRight size={16}/></Link></header>
        {data.recentClothes.length ? <div>{data.recentClothes.map(item => <Link className="dashboard-recent-card" to="/wardrobe" key={item._id}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name || item.category}/> : <span/>}<footer><b>{item.name || item.category}</b><small>{item.category}</small></footer></Link>)}</div> : <p className="dashboard-empty">Ajoutez votre première pièce pour la retrouver ici.</p>}
      </section>
    </> : null}
  </div>;
}
