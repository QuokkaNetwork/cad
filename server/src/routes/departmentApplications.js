const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Departments, DepartmentApplications } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const {
  requireDepartmentApplicationManager,
  departmentLeaderScopeCanManageDepartment,
} = require('../utils/departmentLeaderPermissions');

const router = express.Router();
router.use(requireAuth);

const APPLICATION_FORM_FIELD_TYPES = new Set(['text', 'textarea', 'select', 'radio', 'number', 'yes_no', 'checkbox']);

function slugifyFormFieldId(value, fallback = 'field') {
  const out = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return out || fallback;
}

function parseLooseBoolean(value) {
  if (typeof value === 'boolean') return { ok: true, value };
  const text = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return { ok: true, value: true };
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return { ok: true, value: false };
  return { ok: false, value: false };
}

function normalizeApplicationMessage(value) {
  const message = String(value || '').trim();
  return message.slice(0, 4000);
}

function normalizeApplicationTemplate(value) {
  return String(value || '').slice(0, 12000);
}

function parseDepartmentApplicationStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) return '';
  return status;
}

function parseManageListLimit(value, fallback = 200) {
  const parsed = Number.parseInt(String(value ?? fallback).trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 500);
}

function normalizeFieldOptions(raw, maxItems = 30) {
  let source = raw;
  if (typeof source === 'string') {
    source = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  if (!Array.isArray(source)) return [];
  const seen = new Set();
  const out = [];
  for (const item of source) {
    const value = String(item || '').trim().slice(0, 120);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeDepartmentApplicationFormSchemaInput(input, { throwOnError = true } = {}) {
  const fail = (msg) => {
    if (throwOnError) {
      const err = new Error(msg);
      err.status = 400;
      throw err;
    }
    return [];
  };

  if (input === undefined || input === null || input === '') return [];
  let raw = input;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    try {
      raw = JSON.parse(text);
    } catch {
      return fail('application_form_schema must be valid JSON');
    }
  }
  if (!Array.isArray(raw)) return fail('application_form_schema must be an array');

  const out = [];
  const seenIds = new Set();
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;

    const label = String(row.label || '').trim().slice(0, 140);
    if (!label) return fail(`Form field ${i + 1} requires a label`);

    const requestedType = String(row.type || 'text').trim().toLowerCase();
    const type = APPLICATION_FORM_FIELD_TYPES.has(requestedType) ? requestedType : 'text';

    let id = slugifyFormFieldId(row.id || label, `field_${i + 1}`);
    if (seenIds.has(id)) {
      let suffix = 2;
      while (seenIds.has(`${id}_${suffix}`) && suffix < 200) suffix += 1;
      id = `${id}_${suffix}`;
    }
    seenIds.add(id);

    const required = !!(row.required === true || row.required === 1 || String(row.required || '').trim().toLowerCase() === 'true');
    const description = String(row.description || row.help_text || '').trim().slice(0, 500);
    const placeholder = String(row.placeholder || '').slice(0, 200);
    const options = (type === 'select' || type === 'radio') ? normalizeFieldOptions(row.options) : [];
    if ((type === 'select' || type === 'radio') && options.length === 0) {
      return fail(`Form field "${label}" requires at least one option`);
    }

    let maxLength = Number.parseInt(String(row.max_length ?? '').trim(), 10);
    if (!Number.isInteger(maxLength) || maxLength <= 0) {
      maxLength = type === 'textarea' ? 4000 : 250;
    }
    maxLength = Math.min(maxLength, type === 'textarea' ? 8000 : 500);

    const normalizedField = {
      id,
      label,
      type,
      required,
      description,
      placeholder,
      max_length: maxLength,
    };
    if (options.length > 0) normalizedField.options = options;

    out.push(normalizedField);
    if (out.length >= 40) break;
  }

  return out;
}

function parseStoredApplicationFormSchema(raw) {
  try {
    return normalizeDepartmentApplicationFormSchemaInput(raw, { throwOnError: false });
  } catch {
    return [];
  }
}

function parseStoredApplicationFormAnswers(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        field_id: String(row.field_id || row.id || '').trim().slice(0, 64),
        label: String(row.label || '').trim().slice(0, 140),
        type: String(row.type || 'text').trim().toLowerCase(),
        value: row.value,
        value_label: String(row.value_label || '').trim().slice(0, 200),
        required: !!row.required,
      }));
  } catch {
    return [];
  }
}

function serializeDepartmentForPortal(dept, assignedDepartmentIds = new Set()) {
  return {
    id: dept.id,
    name: dept.name,
    short_name: dept.short_name || '',
    color: dept.color || '#0052C2',
    icon: dept.icon || '',
    slogan: dept.slogan || '',
    is_dispatch: !!dept.is_dispatch,
    layout_type: String(dept.layout_type || '').trim(),
    applications_open: !!dept.applications_open,
    application_template: String(dept.application_template || ''),
    application_form_schema: parseStoredApplicationFormSchema(dept.application_form_schema),
    is_assigned: assignedDepartmentIds.has(Number(dept.id)),
  };
}

function serializeDepartmentForManage(dept) {
  return {
    id: dept.id,
    name: dept.name,
    short_name: dept.short_name || '',
    color: dept.color || '#0052C2',
    applications_open: !!dept.applications_open,
    application_template: String(dept.application_template || ''),
    application_form_schema: parseStoredApplicationFormSchema(dept.application_form_schema),
    is_active: !!dept.is_active,
    is_dispatch: !!dept.is_dispatch,
  };
}

function serializeApplicationRecord(record) {
  return {
    ...record,
    form_answers: parseStoredApplicationFormAnswers(record?.form_answers_json),
  };
}

function getSubmittedAnswersMap(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input;
  }
  if (Array.isArray(input)) {
    const out = {};
    for (const row of input) {
      if (!row || typeof row !== 'object') continue;
      const key = String(row.field_id || row.id || row.key || '').trim();
      if (!key) continue;
      out[key] = row.value;
    }
    return out;
  }
  return {};
}

function normalizeSingleFormAnswer(field, rawValue) {
  const type = String(field?.type || 'text').trim().toLowerCase();
  const label = String(field?.label || '').trim();
  const required = !!field?.required;

  if (type === 'checkbox' || type === 'yes_no') {
    const parsed = parseLooseBoolean(rawValue);
    const hasValue = parsed.ok;
    if (required && (!parsed.ok || parsed.value !== true && type === 'checkbox')) {
      return { error: `${label} is required` };
    }
    if (!parsed.ok && !required) return { empty: true };
    return {
      answer: {
        field_id: field.id,
        label,
        type,
        required,
        value: !!parsed.value,
        value_label: parsed.value ? 'Yes' : 'No',
      },
      summaryValue: parsed.value ? 'Yes' : 'No',
    };
  }

  if (type === 'number') {
    const text = String(rawValue ?? '').trim();
    if (!text) {
      if (required) return { error: `${label} is required` };
      return { empty: true };
    }
    const n = Number(text);
    if (!Number.isFinite(n)) return { error: `${label} must be a valid number` };
    const normalized = String(text).slice(0, 64);
    return {
      answer: {
        field_id: field.id,
        label,
        type,
        required,
        value: normalized,
        value_label: normalized,
      },
      summaryValue: normalized,
    };
  }

  const text = String(rawValue ?? '').trim();
  if (!text) {
    if (required) return { error: `${label} is required` };
    return { empty: true };
  }
  const maxLength = Number.isInteger(field?.max_length) ? field.max_length : (type === 'textarea' ? 4000 : 250);
  const normalized = text.slice(0, Math.max(1, maxLength));

  if ((type === 'select' || type === 'radio') && Array.isArray(field.options) && field.options.length > 0) {
    const allowed = new Set(field.options.map((opt) => String(opt)));
    if (!allowed.has(normalized)) {
      return { error: `${label} has an invalid selection` };
    }
  }

  return {
    answer: {
      field_id: field.id,
      label,
      type,
      required,
      value: normalized,
      value_label: normalized,
    },
    summaryValue: normalized.replace(/\s+/g, ' ').slice(0, 120),
  };
}

function validateAndSnapshotFormAnswers(schema, submittedAnswersInput) {
  const fields = Array.isArray(schema) ? schema : [];
  if (fields.length === 0) return { answers: [], summaryLines: [] };

  const submitted = getSubmittedAnswersMap(submittedAnswersInput);
  const answers = [];
  const summaryLines = [];

  for (const field of fields) {
    const result = normalizeSingleFormAnswer(field, submitted[field.id]);
    if (result?.error) {
      const err = new Error(result.error);
      err.status = 400;
      throw err;
    }
    if (result?.empty) continue;
    if (result?.answer) answers.push(result.answer);
    if (result?.summaryValue) summaryLines.push(`${field.label}: ${String(result.summaryValue)}`);
  }

  return { answers, summaryLines };
}

function buildLegacyMessageFromSubmission({ message, schemaFields, summaryLines }) {
  const legacy = normalizeApplicationMessage(message);
  if (legacy) return legacy;
  if (Array.isArray(schemaFields) && schemaFields.length > 0) {
    const combined = (Array.isArray(summaryLines) ? summaryLines : [])
      .slice(0, 12)
      .join('\n');
    const normalized = normalizeApplicationMessage(combined);
    return normalized || 'Structured application form submitted';
  }
  return '';
}

router.get('/', (req, res) => {
  const assignedDepartmentIds = new Set(
    (Array.isArray(req.user?.departments) ? req.user.departments : []).map((dept) => Number(dept?.id))
  );

  const departments = Departments.listActive().map((dept) => serializeDepartmentForPortal(dept, assignedDepartmentIds));
  const applications = DepartmentApplications.listByUser(req.user.id).map(serializeApplicationRecord);
  res.json({ departments, applications });
});

router.post('/', (req, res, next) => {
  try {
    if (req.user?.is_admin) {
      return res.status(400).json({ error: 'Admins do not need department applications' });
    }

    if (!String(req.user?.discord_id || '').trim()) {
      return res.status(400).json({ error: 'Link Discord before applying to a department' });
    }

    const departmentId = Number.parseInt(String(req.body?.department_id || '').trim(), 10);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ error: 'department_id is required' });
    }

    const department = Departments.findById(departmentId);
    if (!department || !department.is_active) {
      return res.status(404).json({ error: 'Department not found' });
    }

    if (!department.applications_open) {
      return res.status(400).json({ error: 'Applications are currently closed for this department' });
    }

    const alreadyAssigned = (Array.isArray(req.user?.departments) ? req.user.departments : [])
      .some((dept) => Number(dept?.id) === departmentId);
    if (alreadyAssigned) {
      return res.status(400).json({ error: 'You already have access to this department' });
    }

    const existingPending = DepartmentApplications.findPendingByUserAndDepartment(req.user.id, departmentId);
    if (existingPending) {
      return res.status(409).json({ error: 'You already have a pending application for this department' });
    }

    const schemaFields = parseStoredApplicationFormSchema(department.application_form_schema);
    const { answers, summaryLines } = validateAndSnapshotFormAnswers(schemaFields, req.body?.form_answers);

    const message = buildLegacyMessageFromSubmission({
      message: req.body?.message,
      schemaFields,
      summaryLines,
    });
    if (!message) {
      return res.status(400).json({ error: schemaFields.length > 0 ? 'Complete the required application form fields' : 'Application message is required' });
    }

    const application = DepartmentApplications.create({
      user_id: req.user.id,
      department_id: departmentId,
      message,
      form_answers_json: answers.length > 0 ? JSON.stringify(answers) : '',
    });

    audit(req.user.id, 'department_application_created', {
      department_id: departmentId,
      department_name: department.name,
      application_id: application.id,
      uses_structured_form: schemaFields.length > 0,
    });

    res.status(201).json({
      success: true,
      application: serializeApplicationRecord(application),
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message || 'Invalid application payload' });
    }
    next(err);
  }
});

router.get('/manage', requireDepartmentApplicationManager, (req, res) => {
  const scope = req.departmentLeaderScope || {};
  const status = parseDepartmentApplicationStatus(req.query?.status);
  const limit = parseManageListLimit(req.query?.limit, 200);

  const allDepartments = Departments.list();
  const departments = allDepartments
    .filter((dept) => departmentLeaderScopeCanManageDepartment(scope, dept.id))
    .map(serializeDepartmentForManage);

  const applications = DepartmentApplications.listForAdmin({
    status,
    limit,
    departmentIds: scope.can_manage_all_departments
      ? []
      : departments.map((dept) => Number(dept.id)).filter((id) => Number.isInteger(id) && id > 0),
  }).map(serializeApplicationRecord);

  res.json({
    permission: {
      allowed: !!scope.allowed,
      source: scope.source || '',
      is_admin: !!scope.is_admin,
      is_department_leader: !!scope.is_department_leader,
      can_manage_all_departments: !!scope.can_manage_all_departments,
      managed_department_ids: Array.isArray(scope.managed_department_ids) ? scope.managed_department_ids : [],
      matched_role_ids_by_department: scope.matched_role_ids_by_department || {},
    },
    departments,
    applications,
  });
});

router.patch('/manage/:id', requireDepartmentApplicationManager, (req, res) => {
  const applicationId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ error: 'Invalid application id' });
  }

  const application = DepartmentApplications.findById(applicationId);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const scope = req.departmentLeaderScope || {};
  if (!departmentLeaderScopeCanManageDepartment(scope, application.department_id)) {
    return res.status(403).json({ error: 'You cannot manage applications for this department' });
  }

  const status = parseDepartmentApplicationStatus(req.body?.status);
  if (!status || status === 'pending') {
    return res.status(400).json({ error: 'status must be approved, rejected, or withdrawn' });
  }

  const reviewNotes = String(req.body?.review_notes || '').trim().slice(0, 4000);
  const updated = DepartmentApplications.updateStatus(applicationId, {
    status,
    review_notes: reviewNotes,
    reviewed_by: req.user.id,
  });

  audit(req.user.id, 'department_application_reviewed', {
    application_id: applicationId,
    target_user_id: application.user_id,
    department_id: application.department_id,
    status,
    source: scope.is_admin ? 'admin' : 'department_leader',
  });

  res.json(updated);
});

router.patch('/manage/departments/:id/template', requireDepartmentApplicationManager, (req, res, next) => {
  try {
    const departmentId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(400).json({ error: 'Invalid department id' });
    }

    const department = Departments.findById(departmentId);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const scope = req.departmentLeaderScope || {};
    if (!departmentLeaderScopeCanManageDepartment(scope, departmentId)) {
      return res.status(403).json({ error: 'You cannot manage templates for this department' });
    }

    const applicationTemplate = normalizeApplicationTemplate(req.body?.application_template);
    const formSchema = normalizeDepartmentApplicationFormSchemaInput(req.body?.application_form_schema, { throwOnError: true });

    Departments.update(departmentId, {
      application_template: applicationTemplate,
      application_form_schema: formSchema.length > 0 ? JSON.stringify(formSchema) : '',
    });

    audit(req.user.id, 'department_application_template_updated', {
      department_id: departmentId,
      source: scope.is_admin ? 'admin' : 'department_leader',
      form_field_count: formSchema.length,
    });

    const updatedDepartment = Departments.findById(departmentId);
    res.json({
      success: true,
      department: serializeDepartmentForManage(updatedDepartment),
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message || 'Invalid department application form configuration' });
    }
    next(err);
  }
});

module.exports = router;

