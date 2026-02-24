import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const APPLICATION_FORM_FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Single Choice' },
  { value: 'number', label: 'Number' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'checkbox', label: 'Checkbox (consent)' },
];

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const text = String(value);
  const parsed = new Date(text.replace(' ', 'T') + (text.includes('T') ? '' : 'Z'));
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function getStatusMeta(status) {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'approved') return { label: 'Approved', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' };
  if (key === 'rejected') return { label: 'Rejected', className: 'border-red-500/30 bg-red-500/10 text-red-300' };
  if (key === 'withdrawn') return { label: 'Withdrawn', className: 'border-gray-500/30 bg-gray-500/10 text-gray-300' };
  return { label: 'Pending', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' };
}

function fieldTypeNeedsOptions(type) {
  const key = String(type || '').trim().toLowerCase();
  return key === 'select' || key === 'radio';
}

function createEmptyApplicationFormField(index = 0) {
  return {
    id: `field_${Date.now()}_${index}`.slice(0, 40),
    label: '',
    type: 'text',
    required: false,
    description: '',
    placeholder: '',
    options_text: '',
    max_length: 250,
  };
}

function normalizeManagerFormSchemaDraft(schema) {
  if (!Array.isArray(schema)) return [];
  return schema.map((field, index) => ({
    id: String(field?.id || `field_${index + 1}`),
    label: String(field?.label || ''),
    type: String(field?.type || 'text').toLowerCase(),
    required: !!field?.required,
    description: String(field?.description || ''),
    placeholder: String(field?.placeholder || ''),
    options_text: Array.isArray(field?.options) ? field.options.map((opt) => String(opt)).join('\n') : '',
    max_length: Number.isInteger(Number(field?.max_length)) ? Number(field.max_length) : (String(field?.type || '').toLowerCase() === 'textarea' ? 4000 : 250),
  }));
}

function buildSchemaPayloadFromDraft(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field, index) => {
      const label = String(field?.label || '').trim();
      if (!label) return null;
      const type = String(field?.type || 'text').toLowerCase();
      const options = String(field?.options_text || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        id: String(field?.id || `field_${index + 1}`),
        label,
        type,
        required: !!field?.required,
        description: String(field?.description || '').trim(),
        placeholder: String(field?.placeholder || ''),
        max_length: Math.max(1, Math.min(8000, Number.parseInt(String(field?.max_length || (type === 'textarea' ? 4000 : 250)), 10) || (type === 'textarea' ? 4000 : 250))),
      };
      if (fieldTypeNeedsOptions(type)) {
        payload.options = options;
      }
      return payload;
    })
    .filter(Boolean);
}

function formatStructuredAnswerValue(answer) {
  if (!answer || typeof answer !== 'object') return '';
  if (String(answer.type || '').toLowerCase() === 'checkbox' || String(answer.type || '').toLowerCase() === 'yes_no') {
    return answer.value ? 'Yes' : 'No';
  }
  return String(answer.value_label || answer.value || '');
}

export default function DepartmentApplicationsManager() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ departments: [], applications: [], permission: null });
  const [templateDrafts, setTemplateDrafts] = useState({});
  const [formSchemaDrafts, setFormSchemaDrafts] = useState({});
  const [savingTemplateDepartmentId, setSavingTemplateDepartmentId] = useState(null);
  const [reviewingApplicationId, setReviewingApplicationId] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const result = await api.get('/api/department-applications/manage?limit=250');
      const departments = Array.isArray(result?.departments) ? result.departments : [];
      setData({
        departments,
        applications: Array.isArray(result?.applications) ? result.applications : [],
        permission: result?.permission || null,
      });
      setTemplateDrafts(Object.fromEntries(
        departments.map((dept) => [String(dept.id), String(dept.application_template || '')])
      ));
      setFormSchemaDrafts(Object.fromEntries(
        departments.map((dept) => [String(dept.id), normalizeManagerFormSchemaDraft(dept.application_form_schema)])
      ));
    } catch (err) {
      setError(err.message || 'Failed to load department applications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const departmentById = useMemo(() => {
    const map = new Map();
    for (const dept of data.departments) map.set(Number(dept.id), dept);
    return map;
  }, [data.departments]);

  const filteredApplications = useMemo(() => {
    if (departmentFilter === 'all') return data.applications;
    const targetId = Number(departmentFilter);
    if (!Number.isInteger(targetId) || targetId <= 0) return data.applications;
    return data.applications.filter((app) => Number(app.department_id) === targetId);
  }, [data.applications, departmentFilter]);

  const pendingApplications = useMemo(
    () => filteredApplications.filter((app) => String(app.status || '').toLowerCase() === 'pending'),
    [filteredApplications]
  );
  const reviewedApplications = useMemo(
    () => filteredApplications.filter((app) => String(app.status || '').toLowerCase() !== 'pending').slice(0, 25),
    [filteredApplications]
  );

  async function saveTemplate(department) {
    const departmentId = Number(department?.id || 0);
    if (!departmentId) return;
    const draft = String(templateDrafts[String(departmentId)] || '');
    const formSchemaDraft = Array.isArray(formSchemaDrafts[String(departmentId)]) ? formSchemaDrafts[String(departmentId)] : [];
    setSavingTemplateDepartmentId(departmentId);
    try {
      const result = await api.patch(`/api/department-applications/manage/departments/${departmentId}/template`, {
        application_template: draft,
        application_form_schema: buildSchemaPayloadFromDraft(formSchemaDraft),
      });
      const updated = result?.department;
      setData((prev) => ({
        ...prev,
        departments: prev.departments.map((dept) => (Number(dept.id) === departmentId ? { ...dept, ...updated } : dept)),
      }));
      if (updated) {
        setFormSchemaDrafts((prev) => ({
          ...prev,
          [String(departmentId)]: normalizeManagerFormSchemaDraft(updated.application_form_schema),
        }));
      }
    } catch (err) {
      alert('Failed to save application template: ' + err.message);
    } finally {
      setSavingTemplateDepartmentId(null);
    }
  }

  function updateDepartmentFormField(departmentId, fieldIndex, patch) {
    const key = String(departmentId);
    setFormSchemaDrafts((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      return {
        ...prev,
        [key]: current.map((field, idx) => (idx === fieldIndex ? { ...field, ...patch } : field)),
      };
    });
  }

  function addDepartmentFormField(departmentId) {
    const key = String(departmentId);
    setFormSchemaDrafts((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      return {
        ...prev,
        [key]: [...current, createEmptyApplicationFormField(current.length + 1)],
      };
    });
  }

  function removeDepartmentFormField(departmentId, fieldIndex) {
    const key = String(departmentId);
    setFormSchemaDrafts((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      return {
        ...prev,
        [key]: current.filter((_, idx) => idx !== fieldIndex),
      };
    });
  }

  function moveDepartmentFormField(departmentId, fieldIndex, direction) {
    const key = String(departmentId);
    setFormSchemaDrafts((prev) => {
      const current = Array.isArray(prev[key]) ? [...prev[key]] : [];
      const target = fieldIndex + direction;
      if (fieldIndex < 0 || target < 0 || target >= current.length) return prev;
      const temp = current[fieldIndex];
      current[fieldIndex] = current[target];
      current[target] = temp;
      return { ...prev, [key]: current };
    });
  }

  async function reviewApplication(application, status) {
    if (!application || reviewingApplicationId) return;
    const reviewNotes = window.prompt(`Optional notes for ${status} application:`, '') ?? '';
    setReviewingApplicationId(application.id);
    try {
      await api.patch(`/api/department-applications/manage/${application.id}`, {
        status,
        review_notes: reviewNotes,
      });
      await loadData();
    } catch (err) {
      alert(`Failed to ${status} application: ` + err.message);
    } finally {
      setReviewingApplicationId(null);
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="rounded-2xl border border-cad-border bg-cad-card/85 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 text-sm bg-cad-surface border border-cad-border text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded transition-colors"
                >
                  Back to Admin Menu
                </Link>
              ) : (
                <Link
                  to="/home"
                  className="px-3 py-1.5 text-sm bg-cad-surface border border-cad-border text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded transition-colors"
                >
                  Return Home
                </Link>
              )}
              <span className="text-[11px] uppercase tracking-[0.16em] text-cad-muted rounded-full border border-cad-border bg-cad-surface/60 px-2.5 py-1">
                Department Applications
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-cad-ink">Applications & Templates</h1>
            <p className="text-sm text-cad-muted mt-1 max-w-3xl leading-6">
              Review department applications and build department-specific application forms/templates for the departments you lead.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="all">All Managed Departments</option>
              {data.departments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="px-3 py-2 text-sm rounded border border-cad-border bg-cad-surface text-cad-muted hover:text-cad-ink transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-cad-border bg-cad-card/75 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-cad-ink">Application Templates</h2>
          <span className="text-xs text-cad-muted">{data.departments.length} department(s)</span>
        </div>
        {data.departments.length === 0 ? (
          <p className="text-sm text-cad-muted">No managed departments found for your account.</p>
        ) : (
          <div className="space-y-3">
            {data.departments
              .filter((dept) => departmentFilter === 'all' || String(dept.id) === String(departmentFilter))
              .map((dept) => (
                <div key={dept.id} className="rounded-xl border border-cad-border bg-cad-surface/45 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-cad-ink">{dept.name}</p>
                      <p className="text-xs text-cad-muted mt-1">
                        {dept.short_name || 'Department'} | {dept.applications_open ? 'Applications Open' : 'Applications Closed'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveTemplate(dept)}
                      disabled={savingTemplateDepartmentId === dept.id}
                      className="px-3 py-1.5 rounded-lg bg-cad-accent hover:bg-cad-accent-light text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {savingTemplateDepartmentId === dept.id ? 'Saving...' : 'Save Form & Template'}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    maxLength={12000}
                    value={templateDrafts[String(dept.id)] ?? ''}
                    onChange={(e) => setTemplateDrafts((prev) => ({ ...prev, [String(dept.id)]: e.target.value }))}
                    className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-y"
                    placeholder="Template shown to applicants (questions, required details, availability format, prior experience prompts, etc.)"
                  />
                  <p className="text-xs text-cad-muted mt-1">
                    Shown in the applicant popup to guide submissions.
                  </p>

                  <div className="mt-4 rounded-lg border border-cad-border bg-cad-card/50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-xs font-semibold text-cad-ink uppercase tracking-wider">Application Form Fields</p>
                        <p className="text-[11px] text-cad-muted mt-1">
                          Build required questions applicants must complete for this department.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addDepartmentFormField(dept.id)}
                        className="px-2.5 py-1.5 rounded border border-cad-border bg-cad-surface text-xs text-cad-muted hover:text-cad-ink transition-colors"
                      >
                        + Add Field
                      </button>
                    </div>

                    {(Array.isArray(formSchemaDrafts[String(dept.id)]) ? formSchemaDrafts[String(dept.id)] : []).length === 0 ? (
                      <div className="rounded-lg border border-cad-border bg-cad-surface/40 px-3 py-2.5 text-xs text-cad-muted">
                        No structured form fields yet. Applicants will use the free-text application message unless you add questions.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(formSchemaDrafts[String(dept.id)] || []).map((field, idx, arr) => (
                          <div key={`${dept.id}-field-${field.id}-${idx}`} className="rounded-lg border border-cad-border bg-cad-surface/40 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold text-cad-ink">Field {idx + 1}</p>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveDepartmentFormField(dept.id, idx, -1)}
                                  disabled={idx === 0}
                                  className="px-2 py-1 rounded border border-cad-border bg-cad-card text-xs text-cad-muted hover:text-cad-ink disabled:opacity-40"
                                >
                                  Up
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDepartmentFormField(dept.id, idx, 1)}
                                  disabled={idx === arr.length - 1}
                                  className="px-2 py-1 rounded border border-cad-border bg-cad-card text-xs text-cad-muted hover:text-cad-ink disabled:opacity-40"
                                >
                                  Down
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDepartmentFormField(dept.id, idx)}
                                  className="px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/15"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-xs text-cad-muted mb-1">Question Label *</label>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => updateDepartmentFormField(dept.id, idx, { label: e.target.value })}
                                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                                  placeholder="e.g. Previous RP experience"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-cad-muted mb-1">Field Type</label>
                                <select
                                  value={field.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value;
                                    updateDepartmentFormField(dept.id, idx, {
                                      type: nextType,
                                      options_text: fieldTypeNeedsOptions(nextType) ? field.options_text : '',
                                      max_length: nextType === 'textarea' ? 4000 : 250,
                                    });
                                  }}
                                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                                >
                                  {APPLICATION_FORM_FIELD_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-cad-muted mb-1">Max Length</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={field.type === 'textarea' ? '8000' : '500'}
                                  value={field.max_length ?? (field.type === 'textarea' ? 4000 : 250)}
                                  onChange={(e) => updateDepartmentFormField(dept.id, idx, { max_length: e.target.value })}
                                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs text-cad-muted mb-1">Help Text (optional)</label>
                                <textarea
                                  rows={2}
                                  value={field.description}
                                  onChange={(e) => updateDepartmentFormField(dept.id, idx, { description: e.target.value })}
                                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-y"
                                  placeholder="Explain what the applicant should provide."
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs text-cad-muted mb-1">
                                  {field.type === 'checkbox' ? 'Checkbox Label / Hint' : 'Placeholder (optional)'}
                                </label>
                                <input
                                  type="text"
                                  value={field.placeholder}
                                  onChange={(e) => updateDepartmentFormField(dept.id, idx, { placeholder: e.target.value })}
                                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                                  placeholder={field.type === 'checkbox' ? 'Example: I confirm I have read the SOPs' : 'Optional placeholder text'}
                                />
                              </div>
                              {fieldTypeNeedsOptions(field.type) ? (
                                <div className="md:col-span-2">
                                  <label className="block text-xs text-cad-muted mb-1">Options (one per line)</label>
                                  <textarea
                                    rows={4}
                                    value={field.options_text}
                                    onChange={(e) => updateDepartmentFormField(dept.id, idx, { options_text: e.target.value })}
                                    className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-y"
                                    placeholder={'Option 1\nOption 2\nOption 3'}
                                  />
                                </div>
                              ) : null}
                            </div>

                            <label className="mt-3 inline-flex items-center gap-2 text-xs text-cad-muted">
                              <input
                                type="checkbox"
                                checked={!!field.required}
                                onChange={(e) => updateDepartmentFormField(dept.id, idx, { required: e.target.checked })}
                                className="rounded"
                              />
                              Required field
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <section className="rounded-2xl border border-cad-border bg-cad-card/75 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-cad-ink">Pending Applications</h2>
            <span className="text-xs text-cad-muted">{pendingApplications.length}</span>
          </div>
          {pendingApplications.length === 0 ? (
            <p className="text-sm text-cad-muted">No pending applications in the selected scope.</p>
          ) : (
            <div className="space-y-3">
              {pendingApplications.map((application) => {
                const dept = departmentById.get(Number(application.department_id));
                return (
                  <div key={application.id} className="rounded-xl border border-cad-border bg-cad-surface/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-cad-ink">
                          {application.applicant_name || 'Unknown User'} {'->'} {application.department_name || dept?.name || 'Department'}
                        </p>
                        <p className="text-xs text-cad-muted mt-1">
                          Submitted {formatDateTime(application.created_at)}
                          {application.applicant_discord_name ? ` | Discord: ${application.applicant_discord_name}` : ''}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Pending
                      </span>
                    </div>
                    {String(application.message || '').trim() ? (
                      <p className="text-xs text-cad-muted mt-3 whitespace-pre-wrap leading-5">
                        {application.message}
                      </p>
                    ) : (
                      <p className="text-xs text-cad-muted mt-3 italic">No application message provided.</p>
                    )}
                    {Array.isArray(application.form_answers) && application.form_answers.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-cad-border bg-cad-card/45 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-cad-muted">Form Responses</p>
                        <div className="mt-2 space-y-1.5">
                          {application.form_answers.map((answer, idx) => (
                            <div key={`${application.id}-pending-answer-${answer.field_id || idx}`} className="text-xs">
                              <span className="text-cad-ink font-medium">{answer.label || answer.field_id || 'Field'}:</span>{' '}
                              <span className="text-cad-muted whitespace-pre-wrap">{formatStructuredAnswerValue(answer) || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => reviewApplication(application, 'approved')}
                        disabled={reviewingApplicationId === application.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {reviewingApplicationId === application.id ? 'Saving...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewApplication(application, 'rejected')}
                        disabled={reviewingApplicationId === application.id}
                        className="px-3 py-1.5 rounded-lg bg-red-500/12 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/18 transition-colors disabled:opacity-50"
                      >
                        {reviewingApplicationId === application.id ? 'Saving...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-cad-border bg-cad-card/75 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-cad-ink">Recent Reviewed</h2>
            <span className="text-xs text-cad-muted">{reviewedApplications.length}</span>
          </div>
          {reviewedApplications.length === 0 ? (
            <p className="text-sm text-cad-muted">No reviewed applications yet.</p>
          ) : (
            <div className="space-y-2.5">
              {reviewedApplications.map((application) => {
                const statusMeta = getStatusMeta(application.status);
                return (
                  <div key={application.id} className="rounded-lg border border-cad-border bg-cad-surface/45 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-cad-ink truncate">
                          {application.applicant_name || 'Unknown User'} {'->'} {application.department_name || 'Department'}
                        </p>
                        <p className="text-xs text-cad-muted mt-0.5">
                          {formatDateTime(application.reviewed_at || application.updated_at)}
                          {application.reviewer_name ? ` | by ${application.reviewer_name}` : ''}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    {String(application.review_notes || '').trim() ? (
                      <p className="text-xs text-cad-muted mt-1.5 whitespace-pre-wrap leading-5">{application.review_notes}</p>
                    ) : null}
                    {Array.isArray(application.form_answers) && application.form_answers.length > 0 ? (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-cad-muted hover:text-cad-ink">View form responses</summary>
                        <div className="mt-2 rounded-lg border border-cad-border bg-cad-card/45 p-2.5 space-y-1.5">
                          {application.form_answers.map((answer, idx) => (
                            <div key={`${application.id}-reviewed-answer-${answer.field_id || idx}`}>
                              <span className="text-cad-ink font-medium">{answer.label || answer.field_id || 'Field'}:</span>{' '}
                              <span className="text-cad-muted whitespace-pre-wrap">{formatStructuredAnswerValue(answer) || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
