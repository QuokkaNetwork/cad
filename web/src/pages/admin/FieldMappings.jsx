import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

const ENTITY_TYPES = [
  { key: 'person', label: 'Person Fields' },
  { key: 'vehicle', label: 'Vehicle Fields' },
];

const NEW_MAPPING_TEMPLATE = {
  label: '',
  table_name: '',
  column_name: '',
  character_join_column: '',
  is_json: false,
  json_key: '',
  is_search_column: false,
  sort_order: '0',
};

function formatErr(err) {
  if (!err) return 'Unknown error';
  if (err.message) return err.message;
  return String(err);
}

function parseFlag(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

function createDraft(mapping) {
  return {
    id: mapping.id,
    category_id: String(mapping.category_id || ''),
    label: String(mapping.label || ''),
    table_name: String(mapping.table_name || ''),
    column_name: String(mapping.column_name || ''),
    character_join_column: String(mapping.character_join_column || ''),
    is_json: parseFlag(mapping.is_json),
    json_key: String(mapping.json_key || ''),
    is_search_column: parseFlag(mapping.is_search_column),
    sort_order: String(Number(mapping.sort_order || 0)),
  };
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

      const hasSelected = nextCategories.some(c => c.id === selectedCategoryId);
      if (!hasSelected) {
        setSelectedCategoryId(nextCategories[0]?.id || null);
      }
    } catch (err) {
      alert('Failed to load field mappings:\n' + formatErr(err));
      setCategories([]);
      setMappings([]);
      setSelectedCategoryId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    setTableInspectColumns([]);
    setTableInspectName('');
  }, [entityType]);

  useEffect(() => {
    setDraftsById((prev) => {
      const next = {};
      for (const mapping of mappings) {
        if (prev[mapping.id]) {
          next[mapping.id] = {
            ...prev[mapping.id],
            category_id: String(mapping.category_id || prev[mapping.id].category_id || ''),
          };
        } else {
          next[mapping.id] = createDraft(mapping);
        }
      }
      return next;
    });
  }, [mappings]);

  const categoryMappings = useMemo(() => (
    mappings.filter(mapping => Number(mapping.category_id) === Number(selectedCategoryId))
  ), [mappings, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

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
      alert('Failed to create category:\n' + formatErr(err));
    } finally {
      setCreatingCategory(false);
    }
  }

  async function deleteCategory(categoryId) {
    if (!window.confirm('Delete this category and all of its mappings?')) return;
    try {
      await api.delete(`/api/admin/field-mapping-categories/${categoryId}`);
      await fetchData();
    } catch (err) {
      alert('Failed to delete category:\n' + formatErr(err));
    }
  }

  async function createMapping() {
    if (!canCreateMapping) return;
    setCreatingMapping(true);
    try {
      await api.post('/api/admin/field-mappings', {
        category_id: selectedCategory.id,
        label: String(newMapping.label || '').trim(),
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
      alert('Failed to create mapping:\n' + formatErr(err));
    } finally {
      setCreatingMapping(false);
    }
  }

  function updateDraft(mappingId, key, value) {
    setDraftsById(prev => ({
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

    setSavingById(prev => ({ ...prev, [mappingId]: true }));
    try {
      await api.patch(`/api/admin/field-mappings/${mappingId}`, {
        category_id: Number(draft.category_id || 0),
        label: String(draft.label || '').trim(),
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
      alert('Failed to save mapping:\n' + formatErr(err));
    } finally {
      setSavingById(prev => ({ ...prev, [mappingId]: false }));
    }
  }

  async function deleteMapping(mappingId) {
    if (!window.confirm('Delete this mapping?')) return;
    setDeletingById(prev => ({ ...prev, [mappingId]: true }));
    try {
      await api.delete(`/api/admin/field-mappings/${mappingId}`);
      await fetchData();
    } catch (err) {
      alert('Failed to delete mapping:\n' + formatErr(err));
    } finally {
      setDeletingById(prev => ({ ...prev, [mappingId]: false }));
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
      alert('Failed to inspect table:\n' + formatErr(err));
    } finally {
      setInspectingTable(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Field Mappings"
        subtitle="Create CAD field groups and map each field to exact database table/column/json paths."
      />

      <div className="bg-cad-card border border-cad-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {ENTITY_TYPES.map(type => (
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
            {loading ? 'Loading...' : `${categories.length} categories / ${mappings.length} mappings`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Categories</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {categories.map(category => {
                const count = mappings.filter(mapping => Number(mapping.category_id) === Number(category.id)).length;
                const selected = Number(selectedCategoryId) === Number(category.id);
                return (
                  <div
                    key={category.id}
                    className={`rounded border px-3 py-2 ${selected ? 'border-cad-accent/40 bg-cad-accent/10' : 'border-cad-border bg-cad-surface'}`}
                  >
                    <button
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-cad-muted">{count} mapping{count !== 1 ? 's' : ''}</p>
                    </button>
                    <div className="mt-2">
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Delete Category
                      </button>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-cad-muted">No categories for this entity type yet.</p>
              )}
            </div>
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">New Category</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="e.g. Licenses"
              />
              <input
                type="number"
                min="0"
                value={newCategorySortOrder}
                onChange={e => setNewCategorySortOrder(e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Sort order"
              />
              <button
                onClick={createCategory}
                disabled={creatingCategory || !String(newCategoryName || '').trim()}
                className="w-full px-3 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {creatingCategory ? 'Creating...' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Database Column Inspector</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={tableInspectName}
                onChange={e => setTableInspectName(e.target.value)}
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
              <div className="mt-3 max-h-48 overflow-y-auto border border-cad-border rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cad-border text-cad-muted">
                      <th className="px-2 py-1 text-left">Column</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableInspectColumns.map(column => (
                      <tr key={column.name} className="border-b border-cad-border/40">
                        <td className="px-2 py-1 font-mono">{column.name}</td>
                        <td className="px-2 py-1 text-cad-muted">{column.dataType}</td>
                        <td className="px-2 py-1 text-cad-muted">{String(!!column.isJson)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">
              New Mapping {selectedCategory ? `(${selectedCategory.name})` : ''}
            </h3>
            {selectedCategory ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMapping.label}
                  onChange={e => setNewMapping(prev => ({ ...prev, label: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Label (e.g. Driver License)"
                />
                <input
                  type="text"
                  value={newMapping.table_name}
                  onChange={e => setNewMapping(prev => ({ ...prev, table_name: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Table Name"
                />
                <input
                  type="text"
                  value={newMapping.column_name}
                  onChange={e => setNewMapping(prev => ({ ...prev, column_name: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Column Name"
                />
                <input
                  type="text"
                  value={newMapping.character_join_column}
                  onChange={e => setNewMapping(prev => ({ ...prev, character_join_column: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Character Mapping Column (join)"
                />
                <input
                  type="text"
                  value={newMapping.json_key}
                  onChange={e => setNewMapping(prev => ({ ...prev, json_key: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="JSON Key (optional)"
                />
                <input
                  type="number"
                  min="0"
                  value={newMapping.sort_order}
                  onChange={e => setNewMapping(prev => ({ ...prev, sort_order: e.target.value }))}
                  className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Sort order"
                />
                <label className="text-xs text-cad-muted flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!newMapping.is_json}
                    onChange={e => setNewMapping(prev => ({ ...prev, is_json: e.target.checked }))}
                  />
                  JSON Column
                </label>
                <label className="text-xs text-cad-muted flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!newMapping.is_search_column}
                    onChange={e => setNewMapping(prev => ({ ...prev, is_search_column: e.target.checked }))}
                  />
                  Show In Search
                </label>
                <div className="md:col-span-2">
                  <button
                    onClick={createMapping}
                    disabled={creatingMapping || !canCreateMapping}
                    className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {creatingMapping ? 'Creating...' : 'Add Mapping'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-cad-muted">Create and select a category to add mappings.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-cad-border">
              <h3 className="text-sm font-semibold">
                Mappings {selectedCategory ? `for ${selectedCategory.name}` : ''}
              </h3>
            </div>
            {selectedCategory ? (
              categoryMappings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[1050px]">
                    <thead>
                      <tr className="border-b border-cad-border text-cad-muted uppercase tracking-wider">
                        <th className="px-3 py-2 text-left">Label</th>
                        <th className="px-3 py-2 text-left">Table</th>
                        <th className="px-3 py-2 text-left">Column</th>
                        <th className="px-3 py-2 text-left">Join Column</th>
                        <th className="px-3 py-2 text-left">JSON Key</th>
                        <th className="px-3 py-2 text-left">JSON</th>
                        <th className="px-3 py-2 text-left">Search</th>
                        <th className="px-3 py-2 text-left">Sort</th>
                        <th className="px-3 py-2 text-left"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryMappings.map(mapping => {
                        const draft = draftsById[mapping.id] || createDraft(mapping);
                        return (
                          <tr key={mapping.id} className="border-b border-cad-border/40 align-top">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={draft.label}
                                onChange={e => updateDraft(mapping.id, 'label', e.target.value)}
                                className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={draft.table_name}
                                onChange={e => updateDraft(mapping.id, 'table_name', e.target.value)}
                                className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={draft.column_name}
                                onChange={e => updateDraft(mapping.id, 'column_name', e.target.value)}
                                className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={draft.character_join_column}
                                onChange={e => updateDraft(mapping.id, 'character_join_column', e.target.value)}
                                className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={draft.json_key}
                                onChange={e => updateDraft(mapping.id, 'json_key', e.target.value)}
                                className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!draft.is_json}
                                onChange={e => updateDraft(mapping.id, 'is_json', e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={!!draft.is_search_column}
                                onChange={e => updateDraft(mapping.id, 'is_search_column', e.target.checked)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={draft.sort_order}
                                onChange={e => updateDraft(mapping.id, 'sort_order', e.target.value)}
                                className="w-20 bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => saveMapping(mapping.id)}
                                  disabled={!!savingById[mapping.id]}
                                  className="px-2 py-1 text-[11px] bg-cad-surface border border-cad-border rounded text-cad-muted hover:text-cad-ink disabled:opacity-50"
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-cad-muted">No mappings in this category yet.</p>
              )
            ) : (
              <p className="px-4 py-6 text-sm text-cad-muted">Select a category to manage mappings.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
