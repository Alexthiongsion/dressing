import { NavLink, Outlet } from "react-router";
import { Home, Shirt, Sparkles, Layers3 } from "lucide-react";
export default function Layout() {
  const links = [["/", Home, "Accueil"], ["/wardrobe", Shirt, "Garde-robe"], ["/outfits", Sparkles, "Outfits"], ["/collections", Layers3, "Collections"]];
  return <div className="app-shell"><aside><div className="brand">Wearsense <b>II</b></div><nav>{links.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === "/"}><Icon size={19}/>{label}</NavLink>)}</nav></aside><main><Outlet/></main></div>;
}
