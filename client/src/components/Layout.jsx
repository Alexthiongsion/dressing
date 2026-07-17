import { NavLink, Outlet } from "react-router";
import { Home, Luggage, Settings2, Shirt, Sparkles } from "lucide-react";
export default function Layout() {
  const links = [["/", Home, "Accueil"], ["/wardrobe", Shirt, "Garde-robe"], ["/outfits", Sparkles, "Outfits"], ["/capsules", Luggage, "Capsules"], ["/settings", Settings2, "Réglages"]];
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <aside aria-label="Navigation principale">
      <div className="brand" aria-label="Wearsense II">Wearsense <b>II</b></div>
      <nav aria-label="Pages principales">{links.map(([to, Icon, label]) => <NavLink key={to} to={to} end={to === "/"} aria-label={label} title={label} className={to === "/settings" ? "nav-settings" : undefined}><Icon size={19} aria-hidden="true"/><span>{label}</span></NavLink>)}</nav>
    </aside>
    <main id="main-content" tabIndex="-1"><Outlet/></main>
  </div>;
}
