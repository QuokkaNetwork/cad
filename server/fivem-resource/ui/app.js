const overlay = document.getElementById("overlay");
const form = document.getElementById("emergencyForm");
const closeBtn = document.getElementById("closeBtn");
const cancelBtn = document.getElementById("cancelBtn");
const submitBtn = document.getElementById("submitBtn");
const titleInput = document.getElementById("titleInput");
const detailsInput = document.getElementById("detailsInput");
const titleCounter = document.getElementById("titleCounter");
const detailsCounter = document.getElementById("detailsCounter");
const titleError = document.getElementById("titleError");
const departmentsEmpty = document.getElementById("departmentsEmpty");
const departmentsList = document.getElementById("departmentsList");

let open = false;
let titleLimit = 80;
let detailsLimit = 600;
let departments = [];
let selectedDepartmentIds = new Set();

function sanitizeDepartments(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = Number(item?.id || 0);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(item?.name || `Department #${id}`).trim() || `Department #${id}`,
      shortName: String(item?.short_name || "").trim(),
      color: String(item?.color || "").trim(),
    });
  }
  return out;
}

function updateCounters() {
  titleCounter.textContent = `${titleInput.value.length} / ${titleLimit}`;
  detailsCounter.textContent = `${detailsInput.value.length} / ${detailsLimit}`;
}

function hideTitleError() {
  titleError.classList.add("hidden");
}

function showTitleError() {
  titleError.classList.remove("hidden");
}

function renderDepartments() {
  departmentsList.innerHTML = "";
  if (departments.length === 0) {
    departmentsEmpty.classList.remove("hidden");
    departmentsList.classList.add("hidden");
    return;
  }

  departmentsEmpty.classList.add("hidden");
  departmentsList.classList.remove("hidden");

  for (const dept of departments) {
    const isSelected = selectedDepartmentIds.has(dept.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `dept-btn${isSelected ? " active" : ""}`;
    btn.dataset.id = String(dept.id);

    const title = document.createElement("span");
    title.className = "dept-title";
    title.textContent = dept.name;
    if (dept.color) title.style.color = dept.color;

    const subtitle = document.createElement("span");
    subtitle.className = "dept-subtitle";
    subtitle.textContent = dept.shortName ? dept.shortName : `ID ${dept.id}`;

    btn.appendChild(title);
    btn.appendChild(subtitle);

    btn.addEventListener("click", () => {
      if (selectedDepartmentIds.has(dept.id)) {
        selectedDepartmentIds.delete(dept.id);
      } else {
        selectedDepartmentIds.add(dept.id);
      }
      renderDepartments();
    });

    departmentsList.appendChild(btn);
  }
}

function setVisible(visible) {
  open = visible === true;
  overlay.classList.toggle("hidden", !open);
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    titleInput.focus();
    titleInput.select();
  }
}

function resetForm(payload) {
  const data = payload || {};
  titleLimit = Math.max(20, Math.min(120, Number(data.max_title_length) || 80));
  detailsLimit = Math.max(100, Math.min(1200, Number(data.max_details_length) || 600));
  titleInput.maxLength = titleLimit;
  detailsInput.maxLength = detailsLimit;

  titleInput.value = "";
  detailsInput.value = "";
  hideTitleError();

  departments = sanitizeDepartments(data.departments);
  selectedDepartmentIds = new Set();
  renderDepartments();
  updateCounters();
  submitBtn.disabled = false;
}

function getResourceName() {
  try {
    return GetParentResourceName();
  } catch {
    return "nui-resource";
  }
}

function postNui(endpoint, payload) {
  return fetch(`https://${getResourceName()}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload || {}),
  });
}

async function submitEmergencyForm() {
  const title = titleInput.value.trim();
  if (!title) {
    showTitleError();
    titleInput.focus();
    return;
  }
  hideTitleError();

  submitBtn.disabled = true;
  const payload = {
    title,
    details: detailsInput.value.trim(),
    requested_department_ids: Array.from(selectedDepartmentIds.values())
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  };

  try {
    const response = await postNui("cadBridge000Submit", payload);
    let result = null;
    try {
      result = await response.json();
    } catch {
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
  } catch {
    submitBtn.disabled = false;
  }
}

function cancelEmergencyForm() {
  if (!open) return;
  postNui("cadBridge000Cancel", {});
  setVisible(false);
}

window.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.action === "cadBridge000:open") {
    resetForm(message.payload || {});
    setVisible(true);
    return;
  }
  if (message.action === "cadBridge000:close") {
    setVisible(false);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitEmergencyForm();
});

closeBtn.addEventListener("click", cancelEmergencyForm);
cancelBtn.addEventListener("click", cancelEmergencyForm);

titleInput.addEventListener("input", () => {
  if (titleInput.value.trim()) {
    hideTitleError();
  }
  updateCounters();
});
detailsInput.addEventListener("input", updateCounters);

window.addEventListener("keydown", (event) => {
  if (!open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    cancelEmergencyForm();
  }
});
