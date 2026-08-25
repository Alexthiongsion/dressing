import { useEffect, useMemo, useState } from "react";
import { Check, ListChecks, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "../services/api";
import ConfirmModal from "../components/ConfirmModal";
import PageState from "../components/PageState";

const newKey = () => globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cloneTemplate = template => ({
  ...template,
  items: (template?.items || []).map(item => ({ ...item }))
});

export default function Checklists() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [quickAddCategory, setQuickAddCategory] = useState("");
  const [quickAddLabel, setQuickAddLabel] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/checklists");
      setTemplates(result);
      const selected = result.find(item => item._id === selectedId) || result[0];
      setSelectedId(selected?._id || "");
      setDraft(selected ? cloneTemplate(selected) : null);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger les checklists.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(
    () => [...new Set((draft?.items || []).map(item => item.category).filter(Boolean))],
    [draft?.items]
  );
  const groups = useMemo(() => (draft?.items || []).reduce((result, item) => {
    const category = item.category || "Autres";
    if (!result[category]) result[category] = [];
    result[category].push(item);
    return result;
  }, {}), [draft?.items]);

  const selectTemplate = template => {
    setSelectedId(template._id);
    setDraft(cloneTemplate(template));
    setNewLabel("");
    setNewCategory("");
    setQuickAddCategory("");
    setQuickAddLabel("");
    setEditingCategory("");
    setEditingCategoryName("");
    setError("");
  };

  const createTemplate = async () => {
    setSaving(true);
    setError("");
    try {
      const created = await api("/checklists", {
        method: "POST",
        body: JSON.stringify({ name: "Nouvelle checklist", items: [] })
      });
      setTemplates(current => [...current, created]);
      selectTemplate(created);
    } catch (createError) {
      setError(createError.message || "Impossible de créer la checklist.");
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!draft || !draft.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api(`/checklists/${draft._id}`, {
        method: "PUT",
        body: JSON.stringify({ name: draft.name.trim(), items: draft.items })
      });
      setTemplates(current => current.map(item => item._id === updated._id ? updated : item));
      setDraft(cloneTemplate(updated));
    } catch (saveError) {
      setError(saveError.message || "Impossible d’enregistrer la checklist.");
    } finally {
      setSaving(false);
    }
  };

  const appendItem = (rawLabel, rawCategory) => {
    const label = rawLabel.trim();
    const category = rawCategory.trim();
    if (!draft || !label || !category) return;
    setDraft(current => ({
      ...current,
      items: [...current.items, { key: newKey(), label, category }]
    }));
    return true;
  };

  const addItem = () => {
    if (!appendItem(newLabel, newCategory)) return;
    setNewLabel("");
  };

  const addQuickItem = (event, category) => {
    event.preventDefault();
    if (!appendItem(quickAddLabel, category)) return;
    setQuickAddLabel("");
    setQuickAddCategory("");
  };

  const startCategoryRename = category => {
    setQuickAddCategory("");
    setQuickAddLabel("");
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const saveCategoryRename = (event, category) => {
    event.preventDefault();
    const nextCategory = editingCategoryName.trim();
    if (nextCategory && nextCategory !== category) {
      setDraft(current => ({
        ...current,
        items: current.items.map(item =>
          item.category === category ? { ...item, category: nextCategory } : item
        )
      }));
      if (newCategory === category) setNewCategory(nextCategory);
    }
    setEditingCategory("");
    setEditingCategoryName("");
  };

  const deleteTemplate = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await api(`/checklists/${draft._id}`, { method: "DELETE" });
      const next = templates.filter(item => item._id !== draft._id);
      setTemplates(next);
      setSelectedId(next[0]?._id || "");
      setDraft(next[0] ? cloneTemplate(next[0]) : null);
      setConfirmDelete(false);
    } catch (deleteError) {
      setError(deleteError.message || "Impossible de supprimer la checklist.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageState loading title="Chargement des checklists" />;

  return <section className="checklists-page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Modèles globaux</p>
        <h1>Checklists</h1>
      </div>
      <button className="primary" onClick={createTemplate} disabled={saving}><Plus size={19}/> Nouvelle checklist</button>
    </header>

    {error && <p className="form-error" role="alert">{error}</p>}

    <div className="checklist-manager">
      <aside className="checklist-template-list" aria-label="Vos checklists">
        {templates.map(template => <button
          key={template._id}
          className={template._id === selectedId ? "active" : ""}
          onClick={() => selectTemplate(template)}
        >
          <ListChecks size={20}/>
          <span><strong>{template.name}</strong><small>{template.items.length} élément{template.items.length > 1 ? "s" : ""}</small></span>
        </button>)}
        {!templates.length && <div className="empty-inline">Créez votre première checklist.</div>}
      </aside>

      <section className="checklist-template-editor">
        {draft ? <>
          <div className="checklist-editor-heading">
            <label>
              <span>Nom de la checklist</span>
              <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}/>
            </label>
            <div className="checklist-editor-actions">
              <button className="secondary danger" onClick={() => setConfirmDelete(true)}><Trash2 size={18}/><span>Supprimer</span></button>
              <button className="primary" onClick={saveTemplate} disabled={saving || !draft.name.trim()}><Save size={18}/>{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </div>

          <div className="checklist-add-item">
            <label><span>Élément</span><input value={newLabel} onChange={event => setNewLabel(event.target.value)} placeholder="Ex. Câble guitare"/></label>
            <label><span>Catégorie</span><input list="checklist-categories" value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Ex. Musique"/></label>
            <datalist id="checklist-categories">{categories.map(category => <option key={category} value={category}/>)}</datalist>
            <button className="secondary" onClick={addItem} disabled={!newLabel.trim() || !newCategory.trim()}><Plus size={18}/> Ajouter</button>
          </div>

          <div className="checklist-groups">
            {Object.entries(groups).map(([category, items]) => <section key={category}>
              <h2>
                {editingCategory === category ? (
                  <form className="checklist-category-rename" onSubmit={event => saveCategoryRename(event, category)}>
                    <input
                      autoFocus
                      value={editingCategoryName}
                      onChange={event => setEditingCategoryName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Escape") {
                          setEditingCategory("");
                          setEditingCategoryName("");
                        }
                      }}
                      aria-label={`Renommer la catégorie ${category}`}
                    />
                    <button type="submit" aria-label="Valider le nouveau nom"><Check size={16}/></button>
                    <button type="button" onClick={() => {
                      setEditingCategory("");
                      setEditingCategoryName("");
                    }} aria-label="Annuler le renommage"><X size={16}/></button>
                  </form>
                ) : (
                  <button type="button" className="checklist-category-title" onClick={() => startCategoryRename(category)} title="Renommer la catégorie">
                    <span>{category}</span><Pencil size={14}/>
                  </button>
                )}
                <span className="checklist-category-actions">
                  <span>{items.length}</span>
                  <button type="button" className="checklist-category-icon-button" onClick={() => {
                    setEditingCategory("");
                    setEditingCategoryName("");
                    setQuickAddCategory(current => current === category ? "" : category);
                    setQuickAddLabel("");
                  }} aria-label={`Ajouter un élément dans ${category}`} title={`Ajouter dans ${category}`}><Plus size={17}/></button>
                </span>
              </h2>
              {quickAddCategory === category && <form className="checklist-category-quick-add" onSubmit={event => addQuickItem(event, category)}>
                <input
                  autoFocus
                  value={quickAddLabel}
                  onChange={event => setQuickAddLabel(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Escape") {
                      setQuickAddCategory("");
                      setQuickAddLabel("");
                    }
                  }}
                  placeholder={`Ajouter dans ${category}`}
                  aria-label={`Nouvel élément dans ${category}`}
                />
                <button type="submit" disabled={!quickAddLabel.trim()}><Plus size={16}/> Ajouter</button>
                <button type="button" className="is-icon-only" onClick={() => {
                  setQuickAddCategory("");
                  setQuickAddLabel("");
                }} aria-label="Fermer"><X size={16}/></button>
              </form>}
              {items.map(item => <div className="checklist-editor-item" key={item.key}>
                <input
                  aria-label="Nom de l’élément"
                  value={item.label}
                  onChange={event => setDraft(current => ({ ...current, items: current.items.map(candidate => candidate.key === item.key ? { ...candidate, label: event.target.value } : candidate) }))}
                />
                <button aria-label={`Supprimer ${item.label}`} onClick={() => setDraft(current => ({ ...current, items: current.items.filter(candidate => candidate.key !== item.key) }))}><Trash2 size={17}/></button>
              </div>)}
            </section>)}
            {!draft.items.length && <div className="empty-inline">Ajoutez les éléments de cette checklist et classez-les par catégorie.</div>}
          </div>
        </> : <div className="empty-inline">Sélectionnez ou créez une checklist.</div>}
      </section>
    </div>

    {confirmDelete && <ConfirmModal
      title="Supprimer cette checklist ?"
      message="Elle ne sera plus proposée aux capsules. Les copies déjà ajoutées aux capsules restent conservées."
      confirmLabel="Supprimer"
      loading={saving}
      onConfirm={deleteTemplate}
      onClose={() => setConfirmDelete(false)}
    />}
  </section>;
}
