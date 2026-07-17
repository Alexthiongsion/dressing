import { NavLink, Outlet } from "react-router";
import { Home, Luggage, Settings2, Shirt, Sparkles } from "lucide-react";
export default function Layout() {
  const links = [["/", Home, "Accueil"], ["/wardrobe", Shirt, "Garde-robe"], ["/outfits", Sparkles, "Outfits"], ["/capsules", Luggage, "Capsules"], ["/settings", Settings2, "Réglages"]];
  return <div className="app-shell"><aside><div className="brand">Wearsense <b>II</b></div><nav>{links.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === "/"} aria-label={label} title={label} className={to === "/settings" ? "nav-settings" : undefined}><Icon size={19}/><span>{label}</span></NavLink>)}</nav></aside><main><Outlet/></main></div>;
}
