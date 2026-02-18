var overlay = document.getElementById("overlay");
var form = document.getElementById("emergencyForm");
var closeBtn = document.getElementById("closeBtn");
var cancelBtn = document.getElementById("cancelBtn");
var submitBtn = document.getElementById("submitBtn");
var titleInput = document.getElementById("titleInput");
var detailsInput = document.getElementById("detailsInput");
var titleCounter = document.getElementById("titleCounter");
var detailsCounter = document.getElementById("detailsCounter");
var titleError = document.getElementById("titleError");
var departmentsEmpty = document.getElementById("departmentsEmpty");
var departmentsList = document.getElementById("departmentsList");

var licenseOverlay = document.getElementById("licenseOverlay");
var licenseForm = document.getElementById("licenseForm");
var licenseCloseBtn = document.getElementById("licenseCloseBtn");
var licenseCancelBtn = document.getElementById("licenseCancelBtn");
var licenseSubmitBtn = document.getElementById("licenseSubmitBtn");
var licenseNameInput = document.getElementById("licenseNameInput");
var licenseDobInput = document.getElementById("licenseDobInput");
var licenseGenderInput = document.getElementById("licenseGenderInput");
var licenseNumberInput = document.getElementById("licenseNumberInput");
var licenseDurationSelect = document.getElementById("licenseDurationSelect");
var licenseExpiryAtInput = document.getElementById("licenseExpiryAtInput");
var licenseConditionsInput = document.getElementById("licenseConditionsInput");
var licenseClassList = document.getElementById("licenseClassList");
var licenseClassEmpty = document.getElementById("licenseClassEmpty");
var licenseFormError = document.getElementById("licenseFormError");

var registrationOverlay = document.getElementById("registrationOverlay");
var registrationForm = document.getElementById("registrationForm");
var registrationCloseBtn = document.getElementById("registrationCloseBtn");
var registrationCancelBtn = document.getElementById("registrationCancelBtn");
var registrationSubmitBtn = document.getElementById("registrationSubmitBtn");
var regoOwnerInput = document.getElementById("regoOwnerInput");
var regoPlateInput = document.getElementById("regoPlateInput");
var regoModelInput = document.getElementById("regoModelInput");
var regoColourInput = document.getElementById("regoColourInput");
var regoDurationSelect = document.getElementById("regoDurationSelect");
var registrationFormError = document.getElementById("registrationFormError");

var idCardOverlay = document.getElementById("idCardOverlay");
var idCardCloseBtn = document.getElementById("idCardCloseBtn");
var idCardViewerNote = document.getElementById("idCardViewerNote");
var idCardPhoto = document.getElementById("idCardPhoto");
var idCardName = document.getElementById("idCardName");
var idCardDob = document.getElementById("idCardDob");
var idCardGender = document.getElementById("idCardGender");
var idCardNumber = document.getElementById("idCardNumber");
var idCardClasses = document.getElementById("idCardClasses");
var idCardStatus = document.getElementById("idCardStatus");
var idCardExpiry = document.getElementById("idCardExpiry");
var idCardConditions = document.getElementById("idCardConditions");

var emergencyOpen = false;
var licenseOpen = false;
var registrationOpen = false;
var idCardOpen = false;

var titleLimit = 80;
var detailsLimit = 600;
var departments = [];
var selectedDepartmentIds = [];
var classOptions = [];
var selectedClasses = [];
var licenseDurationOptions = [];
var durationOptions = [];

function safeGet(obj, key, fallback) {
  if (!obj || typeof obj !== "object") return fallback;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return fallback;
  return obj[key];
}

function getResourceName() {
  try {
    return GetParentResourceName();
  } catch (_err) {
    return "nui-resource";
  }
}

function postNui(endpoint, payload) {
  return fetch("https://" + getResourceName() + "/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload || {}),
  });
}

function sanitizeDepartments(raw) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  var seen = {};
  for (var i = 0; i < raw.length; i += 1) {
    var item = raw[i] || {};
    var id = Number(safeGet(item, "id", 0));
    if (!Number.isInteger(id) || id <= 0 || seen[id]) continue;
    seen[id] = true;
    out.push({
      id: id,
      name: String(safeGet(item, "name", "Department #" + String(id)) || "").trim() || ("Department #" + String(id)),
      shortName: String(safeGet(item, "short_name", "") || "").trim(),
      color: String(safeGet(item, "color", "") || "").trim(),
    });
  }
  return out;
}

function sanitizeStringArray(raw, toUpper) {
  if (!Array.isArray(raw)) return [];
  var out = [];
  var seen = {};
  for (var i = 0; i < raw.length; i += 1) {
    var value = String(raw[i] || "").trim();
    if (!value) continue;
    if (toUpper) value = value.toUpperCase();
    if (seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}

function showErrorNode(node, text) {
  if (!node) return;
  node.textContent = String(text || "");
  if (text) node.classList.remove("hidden");
  else node.classList.add("hidden");
}

function setVisible(node, visible) {
  if (!node) return;
  if (visible) {
    node.classList.remove("hidden");
    node.style.display = "grid";
    node.setAttribute("aria-hidden", "false");
    return;
  }
  node.classList.add("hidden");
  node.style.display = "none";
  node.setAttribute("aria-hidden", "true");
}

function anyModalOpen() {
  return emergencyOpen || licenseOpen || registrationOpen || idCardOpen;
}

function closeAll() {
  cancelEmergencyForm();
  cancelLicenseForm();
  cancelRegistrationForm();
  if (idCardOpen) requestCloseIdCard();
}

function isDepartmentSelected(id) {
  for (var i = 0; i < selectedDepartmentIds.length; i += 1) {
    if (Number(selectedDepartmentIds[i]) === Number(id)) return true;
  }
  return false;
}

function toggleDepartment(id) {
  var next = [];
  var removed = false;
  for (var i = 0; i < selectedDepartmentIds.length; i += 1) {
    var current = Number(selectedDepartmentIds[i]);
    if (current === Number(id)) {
      removed = true;
      continue;
    }
    next.push(current);
  }
  if (!removed) next.push(Number(id));
  selectedDepartmentIds = next;
}

function updateCounters() {
  if (!titleCounter || !detailsCounter || !titleInput || !detailsInput) return;
  titleCounter.textContent = String(titleInput.value.length) + " / " + String(titleLimit);
  detailsCounter.textContent = String(detailsInput.value.length) + " / " + String(detailsLimit);
}

function renderDepartments() {
  if (!departmentsList || !departmentsEmpty) return;
  departmentsList.innerHTML = "";
  if (departments.length === 0) {
    departmentsEmpty.classList.remove("hidden");
    departmentsList.classList.add("hidden");
    return;
  }

  departmentsEmpty.classList.add("hidden");
  departmentsList.classList.remove("hidden");

  for (var i = 0; i < departments.length; i += 1) {
    (function renderDepartmentButton(dept) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dept-btn" + (isDepartmentSelected(dept.id) ? " active" : "");
      btn.dataset.id = String(dept.id);

      var title = document.createElement("span");
      title.className = "dept-title";
      title.textContent = dept.name;
      if (dept.color) title.style.color = dept.color;

      var subtitle = document.createElement("span");
      subtitle.className = "dept-subtitle";
      subtitle.textContent = dept.shortName ? dept.shortName : "ID " + String(dept.id);

      btn.appendChild(title);
      btn.appendChild(subtitle);
      btn.addEventListener("click", function onDepartmentClick() {
        toggleDepartment(dept.id);
        renderDepartments();
      });

      departmentsList.appendChild(btn);
    })(departments[i]);
  }
}

function collectSelectedDepartmentIds() {
  var out = [];
  for (var i = 0; i < selectedDepartmentIds.length; i += 1) {
    var id = Number(selectedDepartmentIds[i]);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (out.indexOf(id) >= 0) continue;
    out.push(id);
  }
  return out;
}

function resetEmergencyForm(payload) {
  var data = payload || {};
  titleLimit = Math.max(20, Math.min(120, Number(safeGet(data, "max_title_length", 80)) || 80));
  detailsLimit = Math.max(100, Math.min(1200, Number(safeGet(data, "max_details_length", 600)) || 600));
  titleInput.maxLength = titleLimit;
  detailsInput.maxLength = detailsLimit;

  titleInput.value = "";
  detailsInput.value = "";
  showErrorNode(titleError, "");

  departments = sanitizeDepartments(safeGet(data, "departments", []));
  selectedDepartmentIds = [];
  renderDepartments();
  updateCounters();
  submitBtn.disabled = false;
}

function openEmergencyForm(payload) {
  if (licenseOpen) closeLicenseForm();
  if (registrationOpen) closeRegistrationForm();
  resetEmergencyForm(payload || {});
  emergencyOpen = true;
  setVisible(overlay, true);
  setTimeout(function focusEmergencyTitle() {
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }, 40);
}

function closeEmergencyForm() {
  emergencyOpen = false;
  setVisible(overlay, false);
}

async function submitEmergencyForm() {
  var title = String(titleInput.value || "").trim();
  if (!title) {
    showErrorNode(titleError, "Title is required.");
    if (titleInput) titleInput.focus();
    return;
  }
  showErrorNode(titleError, "");
  submitBtn.disabled = true;

  try {
    var response = await postNui("cadBridge000Submit", {
      title: title,
      details: String(detailsInput.value || "").trim(),
      requested_department_ids: collectSelectedDepartmentIds(),
    });
    var result = null;
    try {
      result = await response.json();
    } catch (_err) {
      result = null;
    }
    if (!response.ok || (result && result.ok === false)) {
      if (result && result.error === "title_required") {
        showErrorNode(titleError, "Title is required.");
      }
      submitBtn.disabled = false;
      return;
    }
    closeEmergencyForm();
  } catch (_err) {
    submitBtn.disabled = false;
  }
}

function cancelEmergencyForm() {
  if (!emergencyOpen) return;
  postNui("cadBridge000Cancel", {}).catch(function ignoreCancelError() {});
  closeEmergencyForm();
}

function normalizeClassOptions(raw) {
  var list = sanitizeStringArray(Array.isArray(raw) ? raw : [], true);
  return list;
}

function isClassSelected(name) {
  return selectedClasses.indexOf(String(name || "").toUpperCase()) >= 0;
}

function toggleClass(name) {
  var target = String(name || "").toUpperCase();
  if (!target) return;
  var next = [];
  var removed = false;
  for (var i = 0; i < selectedClasses.length; i += 1) {
    if (selectedClasses[i] === target) {
      removed = true;
      continue;
    }
    next.push(selectedClasses[i]);
  }
  if (!removed) next.push(target);
  selectedClasses = next;
}

function renderLicenseClasses() {
  if (!licenseClassList || !licenseClassEmpty) return;
  licenseClassList.innerHTML = "";
  if (classOptions.length === 0) {
    licenseClassList.classList.add("hidden");
    licenseClassEmpty.classList.remove("hidden");
    return;
  }
  licenseClassList.classList.remove("hidden");
  licenseClassEmpty.classList.add("hidden");

  for (var i = 0; i < classOptions.length; i += 1) {
    (function renderClassButton(classCode) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn" + (isClassSelected(classCode) ? " active" : "");
      btn.textContent = classCode;
      btn.addEventListener("click", function onClassClick() {
        toggleClass(classCode);
        renderLicenseClasses();
      });
      licenseClassList.appendChild(btn);
    })(classOptions[i]);
  }
}

function normalizeLicenseDurationOptions(raw, fallback) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i += 1) {
    var value = Number(list[i]);
    if (!Number.isFinite(value) || value < 1) continue;
    var rounded = Math.floor(value);
    if (seen[rounded]) continue;
    seen[rounded] = true;
    out.push(rounded);
  }
  if (out.length === 0) out = [Number(fallback) || 35];
  out.sort(function sortNumber(a, b) { return a - b; });
  return out;
}

function getLicenseDurationLabel(days) {
  var value = Number(days) || 0;
  if (value === 6) return "6 months (6 days)";
  if (value === 14) return "2 years (2 weeks)";
  if (value === 35) return "5 years (5 weeks)";
  if (value === 70) return "10 years (10 weeks)";
  return String(value) + " day" + (value === 1 ? "" : "s");
}

function renderLicenseDurationSelect(defaultDuration) {
  if (!licenseDurationSelect) return;
  licenseDurationSelect.innerHTML = "";
  var fallback = Number(defaultDuration) || 35;
  licenseDurationOptions = normalizeLicenseDurationOptions(licenseDurationOptions, fallback);
  if (licenseDurationOptions.indexOf(fallback) < 0) {
    fallback = licenseDurationOptions.indexOf(35) >= 0 ? 35 : licenseDurationOptions[0];
  }

  for (var i = 0; i < licenseDurationOptions.length; i += 1) {
    var optionValue = licenseDurationOptions[i];
    var option = document.createElement("option");
    option.value = String(optionValue);
    option.textContent = getLicenseDurationLabel(optionValue);
    if (optionValue === fallback) option.selected = true;
    licenseDurationSelect.appendChild(option);
  }
}

function resetLicenseForm(payload) {
  var data = payload || {};
  classOptions = normalizeClassOptions(safeGet(data, "class_options", []));
  selectedClasses = sanitizeStringArray(
    safeGet(data, "default_classes", []),
    true
  );
  if (selectedClasses.length === 0 && classOptions.length > 0) {
    selectedClasses = [classOptions[0]];
  }
  renderLicenseClasses();

  if (licenseNameInput) licenseNameInput.value = String(safeGet(data, "full_name", "") || "");
  if (licenseDobInput) licenseDobInput.value = String(safeGet(data, "date_of_birth", "") || "");
  if (licenseGenderInput) licenseGenderInput.value = String(safeGet(data, "gender", "") || "");
  if (licenseNumberInput) licenseNumberInput.value = String(safeGet(data, "license_number", "") || "");
  if (licenseConditionsInput) licenseConditionsInput.value = "";
  if (licenseExpiryAtInput) licenseExpiryAtInput.value = String(safeGet(data, "expiry_at", "") || "");
  licenseDurationOptions = Array.isArray(data.duration_options) ? data.duration_options : [6, 14, 35, 70];
  renderLicenseDurationSelect(Number(safeGet(data, "default_expiry_days", 35)) || 35);
  if (licenseSubmitBtn) licenseSubmitBtn.disabled = false;
  showErrorNode(licenseFormError, "");
}

function openLicenseForm(payload) {
  if (emergencyOpen) closeEmergencyForm();
  if (registrationOpen) closeRegistrationForm();
  resetLicenseForm(payload || {});
  licenseOpen = true;
  setVisible(licenseOverlay, true);
  setTimeout(function focusLicenseInput() {
    if (licenseNumberInput) {
      licenseNumberInput.focus();
      return;
    }
    if (licenseConditionsInput) licenseConditionsInput.focus();
  }, 40);
}

function closeLicenseForm() {
  licenseOpen = false;
  setVisible(licenseOverlay, false);
}

function parseConditionsFromInput() {
  var text = String(licenseConditionsInput && licenseConditionsInput.value || "").trim();
  if (!text) return [];
  var parts = text.split(",");
  var out = [];
  var seen = {};
  for (var i = 0; i < parts.length; i += 1) {
    var value = String(parts[i] || "").trim();
    if (!value) continue;
    if (seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }
  return out;
}

async function submitLicenseForm() {
  var fullName = String(licenseNameInput && licenseNameInput.value || "").trim();
  var dateOfBirth = String(licenseDobInput && licenseDobInput.value || "").trim();
  var gender = String(licenseGenderInput && licenseGenderInput.value || "").trim();
  if (!fullName || !dateOfBirth || !gender || selectedClasses.length === 0) {
    showErrorNode(licenseFormError, "Name, DOB, gender and at least one class are required.");
    return;
  }
  showErrorNode(licenseFormError, "");
  if (licenseSubmitBtn) licenseSubmitBtn.disabled = true;

  var expiryDays = Number(licenseDurationSelect && licenseDurationSelect.value || 0);
  if (!Number.isFinite(expiryDays) || expiryDays < 1) expiryDays = 1;
  var payload = {
    full_name: fullName,
    date_of_birth: dateOfBirth,
    gender: gender,
    license_number: String(licenseNumberInput && licenseNumberInput.value || "").trim(),
    license_classes: sanitizeStringArray(selectedClasses, true),
    conditions: parseConditionsFromInput(),
    expiry_days: Math.floor(expiryDays),
    expiry_at: String(licenseExpiryAtInput && licenseExpiryAtInput.value || "").trim(),
  };

  try {
    var response = await postNui("cadBridgeLicenseSubmit", payload);
    var result = null;
    try {
      result = await response.json();
    } catch (_err) {
      result = null;
    }
    if (!response.ok || (result && result.ok === false)) {
      showErrorNode(licenseFormError, "Unable to submit license form.");
      if (licenseSubmitBtn) licenseSubmitBtn.disabled = false;
      return;
    }
    closeLicenseForm();
  } catch (_err2) {
    showErrorNode(licenseFormError, "Unable to submit license form.");
    if (licenseSubmitBtn) licenseSubmitBtn.disabled = false;
  }
}

function cancelLicenseForm() {
  if (!licenseOpen) return;
  postNui("cadBridgeLicenseCancel", {}).catch(function ignoreCancelError() {});
  closeLicenseForm();
}

function normalizeDurationOptions(raw, fallback) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i += 1) {
    var value = Number(list[i]);
    if (!Number.isFinite(value) || value < 1) continue;
    var rounded = Math.floor(value);
    if (seen[rounded]) continue;
    seen[rounded] = true;
    out.push(rounded);
  }
  if (out.length === 0) out = [Number(fallback) || 365];
  out.sort(function sortNumber(a, b) { return a - b; });
  return out;
}

function renderDurationSelect(defaultDuration) {
  if (!regoDurationSelect) return;
  regoDurationSelect.innerHTML = "";
  var fallback = Number(defaultDuration) || 35;
  durationOptions = normalizeDurationOptions(durationOptions, fallback);
  var selectedValue = durationOptions.indexOf(fallback) >= 0 ? fallback : durationOptions[0];
  for (var i = 0; i < durationOptions.length; i += 1) {
    var optionValue = durationOptions[i];
    var option = document.createElement("option");
    option.value = String(optionValue);
    option.textContent = getLicenseDurationLabel(optionValue);
    if (optionValue === selectedValue) option.selected = true;
    regoDurationSelect.appendChild(option);
  }
}

function resetRegistrationForm(payload) {
  var data = payload || {};
  if (regoOwnerInput) regoOwnerInput.value = String(safeGet(data, "owner_name", "") || "");
  if (regoPlateInput) regoPlateInput.value = String(safeGet(data, "plate", "") || "");
  if (regoModelInput) regoModelInput.value = String(safeGet(data, "vehicle_model", "") || "");
  if (regoColourInput) regoColourInput.value = String(safeGet(data, "vehicle_colour", "") || "");
  durationOptions = Array.isArray(data.duration_options) ? data.duration_options : [];
  renderDurationSelect(Number(safeGet(data, "default_duration_days", 35)) || 35);
  if (registrationSubmitBtn) registrationSubmitBtn.disabled = false;
  showErrorNode(registrationFormError, "");
}

function openRegistrationForm(payload) {
  if (emergencyOpen) closeEmergencyForm();
  if (licenseOpen) closeLicenseForm();
  resetRegistrationForm(payload || {});
  registrationOpen = true;
  setVisible(registrationOverlay, true);
  setTimeout(function focusRegoDuration() {
    if (regoDurationSelect) regoDurationSelect.focus();
  }, 40);
}

function closeRegistrationForm() {
  registrationOpen = false;
  setVisible(registrationOverlay, false);
}

async function submitRegistrationForm() {
  var ownerName = String(regoOwnerInput && regoOwnerInput.value || "").trim();
  var plate = String(regoPlateInput && regoPlateInput.value || "").trim().toUpperCase();
  var model = String(regoModelInput && regoModelInput.value || "").trim();
  if (!ownerName || !plate || !model) {
    showErrorNode(registrationFormError, "Owner, plate and model are required.");
    return;
  }
  showErrorNode(registrationFormError, "");
  if (registrationSubmitBtn) registrationSubmitBtn.disabled = true;

  var durationDays = Number(regoDurationSelect && regoDurationSelect.value || 0);
  if (!Number.isFinite(durationDays) || durationDays < 1) durationDays = 35;
  var payload = {
    owner_name: ownerName,
    plate: plate,
    vehicle_model: model,
    vehicle_colour: String(regoColourInput && regoColourInput.value || "").trim(),
    duration_days: Math.floor(durationDays),
  };

  try {
    var response = await postNui("cadBridgeRegistrationSubmit", payload);
    var result = null;
    try {
      result = await response.json();
    } catch (_err) {
      result = null;
    }
    if (!response.ok || (result && result.ok === false)) {
      showErrorNode(registrationFormError, "Unable to submit registration form.");
      if (registrationSubmitBtn) registrationSubmitBtn.disabled = false;
      return;
    }
    closeRegistrationForm();
  } catch (_err2) {
    showErrorNode(registrationFormError, "Unable to submit registration form.");
    if (registrationSubmitBtn) registrationSubmitBtn.disabled = false;
  }
}

function cancelRegistrationForm() {
  if (!registrationOpen) return;
  postNui("cadBridgeRegistrationCancel", {}).catch(function ignoreCancelError() {});
  closeRegistrationForm();
}

function setTextNode(node, value, fallback) {
  if (!node) return;
  var text = String(value || "").trim();
  node.textContent = text || String(fallback || "");
}

function normalizeStatusLabel(value) {
  var normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (normalized === "valid") return "Valid";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "disqualified") return "Disqualified";
  if (normalized === "expired") return "Expired";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function listToText(value, fallback) {
  var list = sanitizeStringArray(Array.isArray(value) ? value : [], false);
  if (list.length === 0) return String(fallback || "None");
  return list.join(", ");
}

function closeIdCard() {
  idCardOpen = false;
  setVisible(idCardOverlay, false);
}

function requestCloseIdCard() {
  postNui("cadBridgeIdCardClose", {}).catch(function ignoreIdCardCloseError() {});
  closeIdCard();
}

function openIdCard(payload) {
  var data = payload || {};
  var mugshot = String(safeGet(data, "mugshot_url", "") || "").trim();
  if (idCardPhoto) {
    if (mugshot) {
      idCardPhoto.src = mugshot;
    } else {
      idCardPhoto.removeAttribute("src");
    }
  }

  setTextNode(idCardViewerNote, safeGet(data, "viewer_note", ""), "");
  setTextNode(idCardName, safeGet(data, "full_name", ""), "Unknown");
  setTextNode(idCardDob, safeGet(data, "date_of_birth", ""), "Unknown");
  setTextNode(idCardGender, safeGet(data, "gender", ""), "Unknown");
  setTextNode(idCardNumber, safeGet(data, "license_number", ""), "Auto");
  setTextNode(idCardClasses, listToText(safeGet(data, "license_classes", []), "None"), "None");
  setTextNode(idCardStatus, normalizeStatusLabel(safeGet(data, "status", "")), "Unknown");
  setTextNode(idCardExpiry, safeGet(data, "expiry_at", ""), "None");
  setTextNode(idCardConditions, listToText(safeGet(data, "conditions", []), "None"), "None");

  idCardOpen = true;
  setVisible(idCardOverlay, true);
}

window.addEventListener("message", function onMessage(event) {
  var message = event.data || {};
  if (message.action === "cadBridge000:open") {
    openEmergencyForm(message.payload || {});
    postNui("cadBridge000Opened", {}).catch(function ignoreOpenedError() {});
    return;
  }
  if (message.action === "cadBridge000:close") {
    closeEmergencyForm();
    return;
  }
  if (message.action === "cadBridgeLicense:open") {
    openLicenseForm(message.payload || {});
    return;
  }
  if (message.action === "cadBridgeLicense:close") {
    closeLicenseForm();
    return;
  }
  if (message.action === "cadBridgeRegistration:open") {
    openRegistrationForm(message.payload || {});
    return;
  }
  if (message.action === "cadBridgeRegistration:close") {
    closeRegistrationForm();
    return;
  }
  if (message.action === "cadBridgeIdCard:show") {
    openIdCard(message.payload || {});
    return;
  }
  if (message.action === "cadBridgeIdCard:hide") {
    closeIdCard();
  }
});

window.force000Open = function force000Open(departmentsPayload) {
  openEmergencyForm({
    departments: departmentsPayload || [],
    max_title_length: 80,
    max_details_length: 600,
  });
};

function initialize() {
  setVisible(overlay, false);
  setVisible(licenseOverlay, false);
  setVisible(registrationOverlay, false);
  setVisible(idCardOverlay, false);

  if (form) {
    form.addEventListener("submit", function onEmergencySubmit(event) {
      event.preventDefault();
      submitEmergencyForm();
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", cancelEmergencyForm);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelEmergencyForm);
  if (titleInput) {
    titleInput.addEventListener("input", function onTitleInput() {
      if (String(titleInput.value || "").trim()) {
        showErrorNode(titleError, "");
      }
      updateCounters();
    });
  }
  if (detailsInput) detailsInput.addEventListener("input", updateCounters);
  updateCounters();

  if (licenseForm) {
    licenseForm.addEventListener("submit", function onLicenseSubmit(event) {
      event.preventDefault();
      submitLicenseForm();
    });
  }
  if (licenseCloseBtn) licenseCloseBtn.addEventListener("click", cancelLicenseForm);
  if (licenseCancelBtn) licenseCancelBtn.addEventListener("click", cancelLicenseForm);

  if (registrationForm) {
    registrationForm.addEventListener("submit", function onRegistrationSubmit(event) {
      event.preventDefault();
      submitRegistrationForm();
    });
  }
  if (registrationCloseBtn) registrationCloseBtn.addEventListener("click", cancelRegistrationForm);
  if (registrationCancelBtn) registrationCancelBtn.addEventListener("click", cancelRegistrationForm);
  if (idCardCloseBtn) idCardCloseBtn.addEventListener("click", requestCloseIdCard);

  window.addEventListener("keydown", function onKeyDown(event) {
    if (!anyModalOpen()) return;
    if (event.key === "PageDown") {
      event.preventDefault();
      if (idCardOpen) requestCloseIdCard();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeAll();
    }
  });

  postNui("cadBridge000Ready", {})
    .then(function noop() {})
    .catch(function onReadyError(err) {
      console.error("[CAD UI] Ready signal failed:", err);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
