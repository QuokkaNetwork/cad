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

var open = false;
var titleLimit = 80;
var detailsLimit = 600;
var departments = [];
var selectedDepartmentIds = [];

function hasUiElements() {
  return !!(
    overlay &&
    form &&
    closeBtn &&
    cancelBtn &&
    submitBtn &&
    titleInput &&
    detailsInput &&
    titleCounter &&
    detailsCounter &&
    titleError &&
    departmentsEmpty &&
    departmentsList
  );
}

function safeGet(obj, key, fallback) {
  if (!obj || typeof obj !== "object") return fallback;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return fallback;
  return obj[key];
}

function sanitizeDepartments(raw) {
  if (!Array.isArray(raw)) return [];
  var seen = {};
  var out = [];
  for (var i = 0; i < raw.length; i += 1) {
    var item = raw[i] || {};
    var id = Number(safeGet(item, "id", 0));
    if (!Number.isInteger(id) || id <= 0 || seen[id]) continue;
    seen[id] = true;
    var defaultName = "Department #" + String(id);
    var name = String(safeGet(item, "name", defaultName) || "").trim() || defaultName;
    var shortName = String(safeGet(item, "short_name", "") || "").trim();
    var color = String(safeGet(item, "color", "") || "").trim();
    out.push({
      id: id,
      name: name,
      shortName: shortName,
      color: color,
    });
  }
  return out;
}

function updateCounters() {
  if (!hasUiElements()) return;
  titleCounter.textContent = String(titleInput.value.length) + " / " + String(titleLimit);
  detailsCounter.textContent = String(detailsInput.value.length) + " / " + String(detailsLimit);
}

function hideTitleError() {
  if (!hasUiElements()) return;
  titleError.classList.add("hidden");
}

function showTitleError() {
  if (!hasUiElements()) return;
  titleError.classList.remove("hidden");
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
  if (!removed) {
    next.push(Number(id));
  }
  selectedDepartmentIds = next;
}

function renderDepartments() {
  if (!hasUiElements()) return;
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
      var isSelected = isDepartmentSelected(dept.id);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dept-btn" + (isSelected ? " active" : "");
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

function setVisible(visible) {
  if (!hasUiElements()) {
    console.error("[CAD 000] UI elements not found!");
    return;
  }
  open = visible === true;

  if (open) {
    // Force remove hidden class
    overlay.classList.remove("hidden");
    overlay.style.display = "grid";
    overlay.setAttribute("aria-hidden", "false");

    // Force focus after a short delay to ensure rendering
    setTimeout(function() {
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 50);

  } else {
    overlay.classList.add("hidden");
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
  }
}

function resetForm(payload) {
  if (!hasUiElements()) return;
  var data = payload || {};
  titleLimit = Math.max(20, Math.min(120, Number(safeGet(data, "max_title_length", 80)) || 80));
  detailsLimit = Math.max(100, Math.min(1200, Number(safeGet(data, "max_details_length", 600)) || 600));
  titleInput.maxLength = titleLimit;
  detailsInput.maxLength = detailsLimit;

  titleInput.value = "";
  detailsInput.value = "";
  hideTitleError();

  departments = sanitizeDepartments(safeGet(data, "departments", []));
  selectedDepartmentIds = [];
  renderDepartments();
  updateCounters();
  submitBtn.disabled = false;
}

function getResourceName() {
  try {
    return GetParentResourceName();
  } catch (err) {
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

async function submitEmergencyForm() {
  if (!hasUiElements()) return;
  var title = String(titleInput.value || "").trim();
  if (!title) {
    showTitleError();
    titleInput.focus();
    return;
  }
  hideTitleError();

  submitBtn.disabled = true;
  var payload = {
    title: title,
    details: String(detailsInput.value || "").trim(),
    requested_department_ids: collectSelectedDepartmentIds(),
  };

  try {
    var response = await postNui("cadBridge000Submit", payload);
    var result = null;
    try {
      result = await response.json();
    } catch (err) {
      result = null;
    }

    if (!response.ok || (result && result.ok === false)) {
      if (result && result.error === "title_required") {
        showTitleError();
      }
      submitBtn.disabled = false;
      return;
    }

    setVisible(false);
  } catch (err) {
    submitBtn.disabled = false;
  }
}

function cancelEmergencyForm() {
  if (!open) return;
  postNui("cadBridge000Cancel", {}).catch(function ignoreCancelError() {});
  setVisible(false);
}

var lastOpenPayload = null;

window.addEventListener("message", function onMessage(event) {
  var message = event.data || {};
  if (message.action === "cadBridge000:open") {
    lastOpenPayload = message.payload || {};
    resetForm(lastOpenPayload);
    setVisible(true);
    postNui("cadBridge000Opened", {}).catch(function ignoreOpenedError() {});
    return;
  }
  if (message.action === "cadBridge000:close") {
    setVisible(false);
  }
});

// Emergency fallback: expose a global function to force open the UI
window.force000Open = function(departments) {
  var payload = {
    departments: departments || [],
    max_title_length: 80,
    max_details_length: 600
  };
  resetForm(payload);
  setVisible(true);
};

if (hasUiElements()) {
  form.addEventListener("submit", function onSubmit(event) {
    event.preventDefault();
    submitEmergencyForm();
  });

  closeBtn.addEventListener("click", cancelEmergencyForm);
  cancelBtn.addEventListener("click", cancelEmergencyForm);

  titleInput.addEventListener("input", function onTitleInput() {
    if (String(titleInput.value || "").trim()) {
      hideTitleError();
    }
    updateCounters();
  });
  detailsInput.addEventListener("input", updateCounters);

  window.addEventListener("keydown", function onKeyDown(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEmergencyForm();
    }
  });
}

// Wait for DOM to be fully ready before signaling
function initialize() {
  if (!hasUiElements()) {
    console.error("[CAD 000] CRITICAL: UI elements not found in DOM!");
    console.error("[CAD 000] overlay:", !!overlay);
    console.error("[CAD 000] form:", !!form);
    console.error("[CAD 000] titleInput:", !!titleInput);
    return;
  }

  // Ensure overlay starts hidden
  overlay.classList.add("hidden");
  overlay.style.display = "none";

  postNui("cadBridge000Ready", {})
    .then(function() {})
    .catch(function(err) {
      console.error("[CAD 000] Ready signal failed:", err);
    });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
