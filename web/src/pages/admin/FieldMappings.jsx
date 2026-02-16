import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

const ENTITY_TYPES = [
  { key: 'person', label: 'Character Lookup' },
  { key: 'vehicle', label: 'Vehicle Lookup' },
];

const FIELD_TYPES = [
  { key: 'text', label: 'Text' },
  { key: 'number', label: 'Number' },
  { key: 'date', label: 'Date' },
  { key: 'image', label: 'Image' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'boolean', label: 'Boolean' },
  { key: 'select', label: 'Select' },
  { key: 'badge', label: 'Badge' },
];

const NEW_MAPPING_TEMPLATE = {
  label: '',
  field_key: '',
  field_type: 'text',
  preview_width: '1',
  table_name: '',
  column_name: '',
  character_join_column: '',
  is_json: false,
  json_key: '',
  is_search_column: true,
  sort_order: '0',
};

function formatErr(err) {
  if (!err) return 'Unknown error';
  const base = err.message || 'Request failed';
  if (Array.isArray(err.details?.errors) && err.details.errors.length > 0) {
    return `${base}\n- ${err.details.errors.join('\n- ')}`;
  }
  return base;
}

function parseFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeFieldKey(value, fallbackLabel = '') {
  let key = String(value || '').trim().toLowerCase();
  if (!key && fallbackLabel) {
    key = String(fallbackLabel || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  return key;
}

function parsePreviewWidth(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(4, Math.trunc(parsed)));
}

function createDraft(mapping) {
  return {
    id: mapping.id,
    category_id: String(mapping.category_id || ''),
    label: String(mapping.label || ''),
    field_key: String(mapping.field_key || ''),
    field_type: String(mapping.field_type || 'text').trim().toLowerCase() || 'text',
    preview_width: String(parsePreviewWidth(mapping.preview_width)),
    table_name: String(mapping.table_name || ''),
    column_name: String(mapping.column_name || ''),
    character_join_column: String(mapping.character_join_column || ''),
    is_json: parseFlag(mapping.is_json),
    json_key: String(mapping.json_key || ''),
    is_search_column: parseFlag(mapping.is_search_column),
    sort_order: String(Number(mapping.sort_order || 0)),
  };
}

function sortMappings(mappings) {
  return [...mappings].sort((a, b) => {
    const aSort = Number(a.sort_order || 0);
    const bSort = Number(b.sort_order || 0);
    if (aSort !== bSort) return aSort - bSort;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function getSampleValue(field) {
  const type = String(field.field_type || 'text').toLowerCase();
  if (type === 'image') return 'Image Preview';
  if (type === 'date') return '2001-01-01';
  if (type === 'phone') return '(555) 010-2400';
  if (type === 'email') return 'sample@cad.local';
  if (type === 'boolean') return 'Yes';
  if (type === 'number') return '42';
  if (type === 'badge') return 'Active';
  if (type === 'select') return 'Standard';
  return field.label || 'Value';
}

function PreviewGrid({ fields, emptyText = 'No fields configured.' }) {
  const sorted = sortMappings(fields);

  if (sorted.length === 0) {
    return <p className="text-sm text-cad-muted">{emptyText}</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {sorted.map((field) => {
        const width = parsePreviewWidth(field.preview_width);
        const type = String(field.field_type || 'text').toLowerCase();
        const key = `${field.id}-${field.field_key || field.label}`;
        return (
          <div
            key={key}
            style={{ gridColumn: `span ${width} / span ${width}` }}
            className="rounded border border-cad-border bg-cad-surface px-3 py-2 min-h-[70px]"
          >
            <p className="text-[10px] uppercase tracking-wider text-cad-muted">
              {field.label || 'Field'}
            </p>
            {type === 'image' ? (
              <div className="mt-1 h-20 rounded border border-cad-border/70 bg-cad-card flex items-center justify-center text-xs text-cad-muted">
                Image Preview
              </div>
            ) : type === 'badge' ? (
              <span className="inline-flex mt-1 px-2 py-0.5 rounded border border-cad-accent/40 bg-cad-accent/15 text-cad-accent-light text-xs">
                {getSampleValue(field)}
              </span>
            ) : (
              <p className="text-sm mt-1 text-cad-ink break-all">{getSampleValue(field)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminFieldMappings() {
  const [entityType, setEntityType] = useState('person');
  const [categories, setCategories] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySortOrder, setNewCategorySortOrder] = useState('0');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryDraftsById, setCategoryDraftsById] = useState({});
  const [savingCategoryById, setSavingCategoryById] = useState({});
  const [deletingCategoryById, setDeletingCategoryById] = useState({});

  const [newMapping, setNewMapping] = useState(NEW_MAPPING_TEMPLATE);
  const [creatingMapping, setCreatingMapping] = useState(false);

  const [draftsById, setDraftsById] = useState({});
  const [savingById, setSavingById] = useState({});
  const [deletingById, setDeletingById] = useState({});

  const [tableInspectName, setTableInspectName] = useState('');
  const [tableInspectColumns, setTableInspectColumns] = useState([]);
  const [inspectingTable, setInspectingTable] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [categoryData, mappingData] = await Promise.all([
        api.get(`/api/admin/field-mapping-categories?entity_type=${entityType}`),
        api.get(`/api/admin/field-mappings?entity_type=${entityType}`),
      ]);

      const nextCategories = Array.isArray(categoryData) ? categoryData : [];
      const nextMappings = Array.isArray(mappingData) ? mappingData : [];
      setCategories(nextCategories);
      setMappings(nextMappings);

      const hasSelected = nextCategories.some((c) => Number(c.id) === Number(selectedCategoryId));
      if (!hasSelected) {
        setSelectedCategoryId(nextCategories[0]?.id || null);
      }
    } catch (err) {
      alert(`Failed to load field mappings:\n${formatErr(err)}`);
      setCategories([]);
      setMappings([]);
      setSelectedCategoryId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    setNewMapping(NEW_MAPPING_TEMPLATE);
    setTableInspectColumns([]);
    setTableInspectName('');
  }, [entityType]);

  useEffect(() => {
    setCategoryDraftsById((prev) => {
      const next = {};
      for (const category of categories) {
        const prevDraft = prev[category.id] || {};
        next[category.id] = {
          name: prevDraft.name !== undefined ? prevDraft.name : String(category.name || ''),
          sort_order: prevDraft.sort_order !== undefined
            ? prevDraft.sort_order
            : String(Number(category.sort_order || 0)),
        };
      }
      return next;
    });
  }, [categories]);

  useEffect(() => {
    setDraftsById((prev) => {
      const next = {};
      for (const mapping of mappings) {
        if (prev[mapping.id]) {
          next[mapping.id] = {
            ...createDraft(mapping),
            ...prev[mapping.id],
            category_id: String(prev[mapping.id].category_id || mapping.category_id || ''),
          };
        } else {
          next[mapping.id] = createDraft(mapping);
        }
      }
      return next;
    });
  }, [mappings]);

  const selectedCategory = useMemo(
    () => categories.find((category) => Number(category.id) === Number(selectedCategoryId)) || null,
    [categories, selectedCategoryId]
  );

  const mappingsByCategory = useMemo(() => {
    const map = new Map();
    for (const category of categories) {
      map.set(category.id, []);
    }
    for (const mapping of mappings) {
      const list = map.get(mapping.category_id) || [];
      list.push(mapping);
      map.set(mapping.category_id, list);
    }
    for (const [categoryId, list] of map.entries()) {
      map.set(categoryId, sortMappings(list));
    }
    return map;
  }, [categories, mappings]);

  const selectedMappings = useMemo(() => {
    if (!selectedCategory) return [];
    return mappingsByCategory.get(selectedCategory.id) || [];
  }, [mappingsByCategory, selectedCategory]);

  const allMappingsSorted = useMemo(() => {
    const sectionSortMap = new Map(
      categories.map((category) => [category.id, Number(category.sort_order || 0)])
    );
    return [...mappings].sort((a, b) => {
      const catA = sectionSortMap.get(a.category_id) ?? 0;
      const catB = sectionSortMap.get(b.category_id) ?? 0;
      if (catA !== catB) return catA - catB;
      const aSort = Number(a.sort_order || 0);
      const bSort = Number(b.sort_order || 0);
      if (aSort !== bSort) return aSort - bSort;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [categories, mappings]);

  const lookupPreviewFields = useMemo(() => {
    return allMappingsSorted.filter((mapping) => parseFlag(mapping.is_search_column));
  }, [allMappingsSorted]);

  const canCreateMapping = !!selectedCategory
    && String(newMapping.label || '').trim().length > 0
    && String(newMapping.table_name || '').trim().length > 0
    && String(newMapping.column_name || '').trim().length > 0
    && String(newMapping.character_join_column || '').trim().length > 0;

  async function createCategory() {
    const name = String(newCategoryName || '').trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      await api.post('/api/admin/field-mapping-categories', {
        name,
        entity_type: entityType,
        sort_order: Number(newCategorySortOrder || 0),
      });
      setNewCategoryName('');
      setNewCategorySortOrder('0');
      await fetchData();
    } catch (err) {
      alert(`Failed to create section:\n${formatErr(err)}`);
    } finally {
      setCreatingCategory(false);
    }
  }

  function updateCategoryDraft(categoryId, key, value) {
    setCategoryDraftsById((prev) => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || {}),
        [key]: value,
      },
    }));
  }

  async function saveCategory(categoryId) {
    const draft = categoryDraftsById[categoryId];
    if (!draft) return;
    const name = String(draft.name || '').trim();
    if (!name) {
      alert('Section name cannot be empty.');
      return;
    }

    setSavingCategoryById((prev) => ({ ...prev, [categoryId]: true }));
    try {
      await api.patch(`/api/admin/field-mapping-categories/${categoryId}`, {
        name,
        sort_order: Number(draft.sort_order || 0),
      });
      await fetchData();
    } catch (err) {
      alert(`Failed to save section:\n${formatErr(err)}`);
    } finally {
      setSavingCategoryById((prev) => ({ ...prev, [categoryId]: false }));
    }
  }

  async function deleteCategory(categoryId) {
    if (!window.confirm('Delete this section and all mapped fields?')) return;
    setDeletingCategoryById((prev) => ({ ...prev, [categoryId]: true }));
    try {
      await api.delete(`/api/admin/field-mapping-categories/${categoryId}`);
      await fetchData();
    } catch (err) {
      alert(`Failed to delete section:\n${formatErr(err)}`);
    } finally {
      setDeletingCategoryById((prev) => ({ ...prev, [categoryId]: false }));
    }
  }

  async function createMapping() {
    if (!canCreateMapping || !selectedCategory) return;
    setCreatingMapping(true);
    try {
      const label = String(newMapping.label || '').trim();
      const fieldKey = normalizeFieldKey(newMapping.field_key, label);
      if (!fieldKey) {
        alert('Field key could not be generated.');
        return;
      }
      await api.post('/api/admin/field-mappings', {
        category_id: selectedCategory.id,
        label,
        field_key: fieldKey,
        field_type: newMapping.field_type,
        preview_width: parsePreviewWidth(newMapping.preview_width),
        table_name: String(newMapping.table_name || '').trim(),
        column_name: String(newMapping.column_name || '').trim(),
        character_join_column: String(newMapping.character_join_column || '').trim(),
        is_json: !!newMapping.is_json,
        json_key: String(newMapping.json_key || '').trim(),
        is_search_column: !!newMapping.is_search_column,
        sort_order: Number(newMapping.sort_order || 0),
      });
      setNewMapping(NEW_MAPPING_TEMPLATE);
      await fetchData();
    } catch (err) {
      alert(`Failed to create mapping:\n${formatErr(err)}`);
    } finally {
      setCreatingMapping(false);
    }
  }

  function updateDraft(mappingId, key, value) {
    setDraftsById((prev) => ({
      ...prev,
      [mappingId]: {
        ...(prev[mappingId] || {}),
        [key]: value,
      },
    }));
  }

  async function saveMapping(mappingId) {
    const draft = draftsById[mappingId];
    if (!draft) return;

    const label = String(draft.label || '').trim();
    if (!label) {
      alert('Label cannot be empty.');
      return;
    }
    const fieldKey = normalizeFieldKey(draft.field_key, label);
    if (!fieldKey) {
      alert('Field key cannot be empty.');
      return;
    }

    setSavingById((prev) => ({ ...prev, [mappingId]: true }));
    try {
      await api.patch(`/api/admin/field-mappings/${mappingId}`, {
        category_id: Number(draft.category_id || 0),
        label,
        field_key: fieldKey,
        field_type: draft.field_type,
        preview_width: parsePreviewWidth(draft.preview_width),
        table_name: String(draft.table_name || '').trim(),
        column_name: String(draft.column_name || '').trim(),
        character_join_column: String(draft.character_join_column || '').trim(),
        is_json: !!draft.is_json,
        json_key: String(draft.json_key || '').trim(),
        is_search_column: !!draft.is_search_column,
        sort_order: Number(draft.sort_order || 0),
      });
      await fetchData();
    } catch (err) {
      alert(`Failed to save mapping:\n${formatErr(err)}`);
    } finally {
      setSavingById((prev) => ({ ...prev, [mappingId]: false }));
    }
  }

  async function deleteMapping(mappingId) {
    if (!window.confirm('Delete this mapping?')) return;
    setDeletingById((prev) => ({ ...prev, [mappingId]: true }));
    try {
      await api.delete(`/api/admin/field-mappings/${mappingId}`);
      await fetchData();
    } catch (err) {
      alert(`Failed to delete mapping:\n${formatErr(err)}`);
    } finally {
      setDeletingById((prev) => ({ ...prev, [mappingId]: false }));
    }
  }

  async function inspectColumns() {
    const tableName = String(tableInspectName || '').trim();
    if (!tableName) return;
    setInspectingTable(true);
    try {
      const columns = await api.get(`/api/admin/qbox/table-columns?table_name=${encodeURIComponent(tableName)}`);
      setTableInspectColumns(Array.isArray(columns) ? columns : []);
    } catch (err) {
      setTableInspectColumns([]);
      alert(`Failed to inspect table:\n${formatErr(err)}`);
    } finally {
      setInspectingTable(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Lookup & Record Builder"
        subtitle="Build character and vehicle lookup cards with section-based fields and direct database binding."
      />

      <div className="bg-cad-card border border-cad-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type.key}
              onClick={() => setEntityType(type.key)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                entityType === type.key
                  ? 'bg-cad-accent/20 text-cad-accent-light border-cad-accent/40'
                  : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
              }`}
            >
              {type.label}
            </button>
          ))}
          <span className="text-xs text-cad-muted ml-auto">
            {loading ? 'Loading...' : `${categories.length} section(s) / ${mappings.length} field(s)`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Record Sections</h3>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {categories.map((category) => {
                const selected = Number(selectedCategoryId) === Number(category.id);
                const count = (mappingsByCategory.get(category.id) || []).length;
                const draft = categoryDraftsById[category.id] || {
                  name: category.name,
                  sort_order: String(Number(category.sort_order || 0)),
                };
                return (
                  <div
                    key={category.id}
                    className={`rounded-lg border p-3 ${
                      selected ? 'border-cad-accent/40 bg-cad-accent/10' : 'border-cad-border bg-cad-surface'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="w-full text-left mb-2"
                    >
                      <p className="text-xs text-cad-muted uppercase tracking-wider">Section</p>
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-cad-muted mt-0.5">{count} field(s)</p>
                    </button>
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => updateCategoryDraft(category.id, 'name', e.target.value)}
                        className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                        placeholder="Section name"
                      />
                      <input
                        type="number"
                        min="0"
                        value={draft.sort_order}
                        onChange={(e) => updateCategoryDraft(category.id, 'sort_order', e.target.value)}
                        className="w-full bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                        placeholder="Sort order"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveCategory(category.id)}
                          disabled={!!savingCategoryById[category.id]}
                          className="flex-1 px-2 py-1 text-[11px] bg-cad-surface border border-cad-border rounded text-cad-muted hover:text-cad-ink disabled:opacity-50"
                        >
                          {savingCategoryById[category.id] ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => deleteCategory(category.id)}
                          disabled={!!deletingCategoryById[category.id]}
                          className="flex-1 px-2 py-1 text-[11px] bg-red-500/10 border border-red-500/30 rounded text-red-300 hover:text-red-200 disabled:opacity-50"
                        >
                          {deletingCategoryById[category.id] ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-cad-muted">No sections for this entity type yet.</p>
              )}
            </div>
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">New Section</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="e.g. Civilian Information"
              />
              <input
                type="number"
                min="0"
                value={newCategorySortOrder}
                onChange={(e) => setNewCategorySortOrder(e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Sort order"
              />
              <button
                onClick={createCategory}
                disabled={creatingCategory || !String(newCategoryName || '').trim()}
                className="w-full px-3 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creatingCategory ? 'Creating...' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Lookup Preview</h3>
            <p className="text-xs text-cad-muted mb-3">
              Fields flagged as lookup columns (`is_search_column`) are shown in search results.
            </p>
            <PreviewGrid
              fields={lookupPreviewFields}
              emptyText="No lookup fields marked yet. Enable 'Lookup' on at least one field."
            />
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Record Preview</h3>
            <p className="text-xs text-cad-muted mb-3">Full record view combining all mapped sections.</p>
            <PreviewGrid
              fields={allMappingsSorted}
              emptyText="No record fields configured."
            />
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Database Binding Inspector</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={tableInspectName}
                onChange={(e) => setTableInspectName(e.target.value)}
                className="flex-1 min-w-[220px] bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Table name (e.g. players)"
              />
              <button
                onClick={inspectColumns}
                disabled={inspectingTable || !String(tableInspectName || '').trim()}
                className="px-3 py-2 bg-cad-surface border border-cad-border rounded text-sm text-cad-muted hover:text-cad-ink transition-colors disabled:opacity-50"
              >
                {inspectingTable ? 'Inspecting...' : 'Inspect'}
              </button>
            </div>
            {tableInspectColumns.length > 0 && (
              <div className="mt-3 max-h-52 overflow-y-auto border border-cad-border rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cad-border text-cad-muted">
                      <th className="px-2 py-1 text-left">Column</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Nullable</th>
                      <th className="px-2 py-1 text-left">JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableInspectColumns.map((column) => (
                      <tr key={column.name} className="border-b border-cad-border/40">
                        <td className="px-2 py-1 font-mono">{column.name}</td>
                        <td className="px-2 py-1 text-cad-muted">{column.dataType}</td>
                        <td className="px-2 py-1 text-cad-muted">{column.nullable ? 'Yes' : 'No'}</td>
                        <td className="px-2 py-1 text-cad-muted">{column.isJson ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">
              Add Field {selectedCategory ? `to ${selectedCategory.name}` : ''}
            </h3>
            {selectedCategory ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMapping.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setNewMapping((prev) => ({
                      ...prev,
                      label,
                      field_key: prev.field_key ? prev.field_key : normalizeFieldKey(label),
                    }));
                  }}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Field label"
                />
                <input
                  type="text"
                  value={newMapping.field_key}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, field_key: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="Field key"
                />
                <select
                  value={newMapping.field_type}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, field_type: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
                <select
                  value={newMapping.preview_width}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, preview_width: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                >
                  <option value="1">Width 1</option>
                  <option value="2">Width 2</option>
                  <option value="3">Width 3</option>
                  <option value="4">Width 4</option>
                </select>
                <input
                  type="text"
                  value={newMapping.table_name}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, table_name: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="Table name"
                />
                <input
                  type="text"
                  value={newMapping.column_name}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, column_name: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="Column name"
                />
                <input
                  type="text"
                  value={newMapping.character_join_column}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, character_join_column: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="Join column"
                />
                <input
                  type="text"
                  value={newMapping.json_key}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, json_key: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="JSON key (optional)"
                />
                <input
                  type="number"
                  min="0"
                  value={newMapping.sort_order}
                  onChange={(e) => setNewMapping((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Sort order"
                />
                <div className="flex items-center gap-4 text-xs text-cad-muted">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!newMapping.is_json}
                      onChange={(e) => setNewMapping((prev) => ({ ...prev, is_json: e.target.checked }))}
                    />
                    JSON Column
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!newMapping.is_search_column}
                      onChange={(e) => setNewMapping((prev) => ({ ...prev, is_search_column: e.target.checked }))}
                    />
                    Lookup Column
                  </label>
                </div>
                <div className="md:col-span-2">
                  <button
                    onClick={createMapping}
                    disabled={creatingMapping || !canCreateMapping}
                    className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {creatingMapping ? 'Creating...' : 'Add Field'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-cad-muted">Create and select a section to add fields.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">
              Field Bindings {selectedCategory ? `for ${selectedCategory.name}` : ''}
            </h3>
            {selectedCategory ? (
              selectedMappings.length > 0 ? (
                <div className="space-y-2">
                  {selectedMappings.map((mapping) => {
                    const draft = draftsById[mapping.id] || createDraft(mapping);
                    return (
                      <div key={mapping.id} className="rounded border border-cad-border bg-cad-surface p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={draft.label}
                            onChange={(e) => updateDraft(mapping.id, 'label', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                            placeholder="Label"
                          />
                          <input
                            type="text"
                            value={draft.field_key}
                            onChange={(e) => updateDraft(mapping.id, 'field_key', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                            placeholder="Field key"
                          />
                          <input
                            type="text"
                            value={draft.table_name}
                            onChange={(e) => updateDraft(mapping.id, 'table_name', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                            placeholder="Table"
                          />
                          <input
                            type="text"
                            value={draft.column_name}
                            onChange={(e) => updateDraft(mapping.id, 'column_name', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                            placeholder="Column"
                          />
                          <input
                            type="text"
                            value={draft.character_join_column}
                            onChange={(e) => updateDraft(mapping.id, 'character_join_column', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                            placeholder="Join column"
                          />
                          <input
                            type="text"
                            value={draft.json_key}
                            onChange={(e) => updateDraft(mapping.id, 'json_key', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                            placeholder="JSON key"
                          />
                          <select
                            value={draft.field_type}
                            onChange={(e) => updateDraft(mapping.id, 'field_type', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type.key} value={type.key}>{type.label}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            value={draft.sort_order}
                            onChange={(e) => updateDraft(mapping.id, 'sort_order', e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                            placeholder="Sort"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-cad-muted">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!draft.is_search_column}
                              onChange={(e) => updateDraft(mapping.id, 'is_search_column', e.target.checked)}
                            />
                            Lookup
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!draft.is_json}
                              onChange={(e) => updateDraft(mapping.id, 'is_json', e.target.checked)}
                            />
                            JSON
                          </label>
                          <label className="inline-flex items-center gap-2">
                            Preview Width
                            <select
                              value={draft.preview_width}
                              onChange={(e) => updateDraft(mapping.id, 'preview_width', e.target.value)}
                              className="bg-cad-card border border-cad-border rounded px-2 py-1 text-xs focus:outline-none focus:border-cad-accent"
                            >
                              <option value="1">1</option>
                              <option value="2">2</option>
                              <option value="3">3</option>
                              <option value="4">4</option>
                            </select>
                          </label>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => saveMapping(mapping.id)}
                              disabled={!!savingById[mapping.id]}
                              className="px-2 py-1 text-[11px] bg-cad-card border border-cad-border rounded text-cad-muted hover:text-cad-ink disabled:opacity-50"
                            >
                              {savingById[mapping.id] ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => deleteMapping(mapping.id)}
                              disabled={!!deletingById[mapping.id]}
                              className="px-2 py-1 text-[11px] bg-red-500/10 border border-red-500/30 rounded text-red-300 hover:text-red-200 disabled:opacity-50"
                            >
                              {deletingById[mapping.id] ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No field mappings in this section yet.</p>
              )
            ) : (
              <p className="text-sm text-cad-muted">Select a section to manage field bindings.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
