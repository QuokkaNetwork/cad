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
var licenseQuizList = document.getElementById("licenseQuizList");
var licenseStatusPanel = document.getElementById("licenseStatusPanel");
var licenseStatusMessage = document.getElementById("licenseStatusMessage");
var licenseRetakePhotoBtn = document.getElementById("licenseRetakePhotoBtn");
var licenseQuizPanel = document.getElementById("licenseQuizPanel");
var licensePassPanel = document.getElementById("licensePassPanel");
var licensePassMessage = document.getElementById("licensePassMessage");
var licenseContinuePhotoBtn = document.getElementById("licenseContinuePhotoBtn");
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
var regoDurationList = document.getElementById("regoDurationList");
var registrationFormError = document.getElementById("registrationFormError");

var idCardMount = document.getElementById("idCardMount");
var idCardOverlay = null;
var idCardCloseBtn = null;
var idCardViewerNote = null;
var idCardPhoto = null;
var idCardName = null;
var idCardDob = null;
var idCardGender = null;
var idCardNumber = null;
var idCardClasses = null;
var idCardStatus = null;
var idCardExpiry = null;
var idCardConditions = null;
var idCardTemplateReady = false;
var idCardTemplatePromise = null;
var queuedIdCardPayload = null;

var emergencyOpen = false;
var licenseOpen = false;
var registrationOpen = false;
var idCardOpen = false;

var titleLimit = 80;
var detailsLimit = 600;
var departments = [];
var selectedDepartmentIds = [];
var quizAnswers = {};
var quizPassPercent = 80;
var licenseRenewalWindowDays = 3;
var activeQuizQuestions = [];
var existingLicenseSnapshot = null;
var pendingLicenseSubmissionPayload = null;
var licenseViewMode = "quiz";
var licenseShowStatusPanel = false;
var durationOptions = [];
var selectedRegistrationDurationDays = 35;
var registrationSubmitPending = false;

function bindIdCardNodes() {
  idCardOverlay = document.getElementById("idCardOverlay");
  idCardCloseBtn = document.getElementById("idCardCloseBtn");
  idCardViewerNote = document.getElementById("idCardViewerNote");
  idCardPhoto = document.getElementById("idCardPhoto");
  idCardName = document.getElementById("idCardName");
  idCardDob = document.getElementById("idCardDob");
  idCardGender = document.getElementById("idCardGender");
  idCardNumber = document.getElementById("idCardNumber");
  idCardClasses = document.getElementById("idCardClasses");
  idCardStatus = document.getElementById("idCardStatus");
  idCardExpiry = document.getElementById("idCardExpiry");
  idCardConditions = document.getElementById("idCardConditions");
  if (idCardCloseBtn && idCardCloseBtn.dataset.bound !== "1") {
    idCardCloseBtn.dataset.bound = "1";
    idCardCloseBtn.addEventListener("click", requestCloseIdCard);
  }
  idCardTemplateReady = Boolean(idCardOverlay);
}

function ensureIdCardTemplateLoaded() {
  if (idCardTemplateReady) return Promise.resolve(true);
  if (idCardTemplatePromise) return idCardTemplatePromise;
  idCardTemplatePromise = fetch("license-card.html", { cache: "no-store" })
    .then(function onTemplateResponse(response) {
      if (!response.ok) throw new Error("license-card template request failed");
      return response.text();
    })
    .then(function onTemplateHtml(html) {
      if (idCardMount) idCardMount.innerHTML = String(html || "");
      bindIdCardNodes();
      return idCardTemplateReady;
    })
    .catch(function onTemplateLoadError(err) {
      console.error("[CAD UI] Failed loading license-card.html:", err);
      bindIdCardNodes();
      return idCardTemplateReady;
    })
    .finally(function afterTemplateLoad() {
      idCardTemplatePromise = null;
      if (queuedIdCardPayload && idCardTemplateReady) {
        var payload = queuedIdCardPayload;
        queuedIdCardPayload = null;
        openIdCard(payload);
      }
    });
  return idCardTemplatePromise;
}

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

function pad2(value) {
  var num = Number(value);
  if (!Number.isFinite(num)) return "";
  var rounded = Math.floor(num);
  if (rounded < 0) return "";
  return rounded < 10 ? "0" + String(rounded) : String(rounded);
}

function normalizeDateForDateInput(rawValue) {
  var text = String(rawValue || "").trim();
  if (!text) return "";

  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
  }

  var parts = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!parts) return "";

  var first = Number(parts[1]);
  var second = Number(parts[2]);
  var year = Number(parts[3]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return "";
  if (year < 1900 || year > 2100) return "";

  // Prefer AU-style day-first, fallback to month-first when day-first is impossible.
  var day = first;
  var month = second;
  if (first <= 12 && second > 12) {
    month = first;
    day = second;
  }

  var candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    (candidate.getUTCMonth() + 1) !== month ||
    candidate.getUTCDate() !== day
  ) {
    candidate = new Date(Date.UTC(year, first - 1, second));
    if (
      candidate.getUTCFullYear() !== year ||
      (candidate.getUTCMonth() + 1) !== first ||
      candidate.getUTCDate() !== second
    ) {
      return "";
    }
    month = first;
    day = second;
  }

  return String(year) + "-" + pad2(month) + "-" + pad2(day);
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

var LICENSE_QUIZ_QUESTION_POOL = [
  {
    id: "q1",
    question: "At a STOP sign in Australia, what must you do?",
    options: [
      "Slow down and continue if clear",
      "Come to a complete stop and give way",
      "Honk and proceed first"
    ],
    answer: 1
  },
  {
    id: "q2",
    question: "What is the default urban speed limit unless signed otherwise?",
    options: [
      "40 km/h",
      "50 km/h",
      "60 km/h"
    ],
    answer: 1
  },
  {
    id: "q3",
    question: "When turning left at lights with pedestrians crossing, you must:",
    options: [
      "Give way to pedestrians",
      "Drive through if you are first",
      "Flash headlights to warn them"
    ],
    answer: 0
  },
  {
    id: "q4",
    question: "On multi-lane roads, you should normally keep:",
    options: [
      "In the right lane at all times",
      "In the left lane unless overtaking or turning right",
      "Any lane regardless of traffic"
    ],
    answer: 1
  },
  {
    id: "q5",
    question: "Using a hand-held phone while driving is:",
    options: [
      "Allowed below 40 km/h",
      "Allowed at traffic lights",
      "Illegal"
    ],
    answer: 2
  },
  {
    id: "q6",
    question: "When approaching a roundabout, you must:",
    options: [
      "Give way to vehicles already in the roundabout",
      "Enter first if you are on the right",
      "Always stop even if clear"
    ],
    answer: 0
  },
  {
    id: "q7",
    question: "A flashing yellow traffic light means:",
    options: [
      "Stop and wait",
      "Proceed with caution and obey give-way rules",
      "Traffic lights are off so you can ignore signs"
    ],
    answer: 1
  },
  {
    id: "q8",
    question: "In wet weather, your safe following distance should:",
    options: [
      "Stay the same as dry conditions",
      "Be reduced because speeds are lower",
      "Increase to allow extra stopping distance"
    ],
    answer: 2
  },
  {
    id: "q9",
    question: "You may overtake on the left only when:",
    options: [
      "The vehicle ahead is turning right or it is safe in marked lanes",
      "You are in a hurry",
      "There is a school zone"
    ],
    answer: 0
  },
  {
    id: "q10",
    question: "Seatbelts must be worn by:",
    options: [
      "Driver only",
      "Front passengers only",
      "All occupants where fitted"
    ],
    answer: 2
  },
  {
    id: "q11",
    question: "At a pedestrian crossing without lights, you must:",
    options: [
      "Give way to pedestrians on or entering the crossing",
      "Sound horn and continue",
      "Only stop for children"
    ],
    answer: 0
  },
  {
    id: "q12",
    question: "What should you do before changing lanes?",
    options: [
      "Brake hard first",
      "Check mirrors, blind spot, then indicate",
      "Only indicate if another car is close"
    ],
    answer: 1
  }
];

function pickRandomQuizQuestions(count) {
  var normalizedCount = Number(count);
  if (!Number.isFinite(normalizedCount) || normalizedCount < 1) normalizedCount = 5;
  var desiredCount = Math.min(Math.floor(normalizedCount), LICENSE_QUIZ_QUESTION_POOL.length);
  var pool = LICENSE_QUIZ_QUESTION_POOL.slice(0);
  for (var i = pool.length - 1; i > 0; i -= 1) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, desiredCount);
}

function renderLicenseQuiz() {
  if (!licenseQuizList) return;
  licenseQuizList.innerHTML = "";

  for (var i = 0; i < activeQuizQuestions.length; i += 1) {
    (function renderQuestion(questionObj, questionIndex) {
      var wrapper = document.createElement("div");
      wrapper.className = "field";

      var title = document.createElement("label");
      title.textContent = String(questionIndex + 1) + ". " + questionObj.question;
      wrapper.appendChild(title);

      var optionsGrid = document.createElement("div");
      optionsGrid.className = "chip-grid";

      for (var optionIndex = 0; optionIndex < questionObj.options.length; optionIndex += 1) {
        (function renderOption(index) {
          var btn = document.createElement("button");
          btn.type = "button";
          var isActive = Number(quizAnswers[questionObj.id]) === index;
          btn.className = "chip-btn" + (isActive ? " active" : "");
          btn.textContent = questionObj.options[index];
          btn.addEventListener("click", function onQuizAnswerClick() {
            quizAnswers[questionObj.id] = index;
            renderLicenseQuiz();
          });
          optionsGrid.appendChild(btn);
        })(optionIndex);
      }

      wrapper.appendChild(optionsGrid);
      licenseQuizList.appendChild(wrapper);
    })(activeQuizQuestions[i], i);
  }
}

function setLicenseMode(mode) {
  licenseViewMode = String(mode || "quiz");
  setVisible(licenseStatusPanel, licenseViewMode === "blocked" || (licenseViewMode === "quiz" && licenseShowStatusPanel));
  setVisible(licenseQuizPanel, licenseViewMode === "quiz");
  setVisible(licensePassPanel, licenseViewMode === "pass");
  if (licenseSubmitBtn) {
    var showSubmit = licenseViewMode === "quiz";
    licenseSubmitBtn.textContent = licenseViewMode === "pass" ? "Processing..." : "Submit Quiz";
    licenseSubmitBtn.disabled = !showSubmit;
    licenseSubmitBtn.classList.toggle("hidden", !showSubmit);
  }
  if (licenseCancelBtn) {
    licenseCancelBtn.textContent = licenseViewMode === "blocked" ? "Exit" : "Cancel";
  }
}

function normalizeExistingLicense(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    full_name: String(raw.full_name || "").trim(),
    date_of_birth: String(raw.date_of_birth || "").trim(),
    gender: String(raw.gender || "").trim(),
    license_number: String(raw.license_number || "").trim(),
    license_classes: sanitizeStringArray(Array.isArray(raw.license_classes) ? raw.license_classes : [], true),
    conditions: sanitizeStringArray(Array.isArray(raw.conditions) ? raw.conditions : [], false),
    expiry_at: String(raw.expiry_at || "").trim(),
    status: String(raw.status || "").trim(),
    days_until_expiry: Number(raw.days_until_expiry),
  };
}

function resetLicenseForm(payload) {
  var data = payload || {};
  quizAnswers = {};
  activeQuizQuestions = pickRandomQuizQuestions(Number(safeGet(data, "quiz_question_count", 5)) || 5);
  quizPassPercent = Number(safeGet(data, "quiz_pass_percent", 80));
  if (!Number.isFinite(quizPassPercent) || quizPassPercent < 1) quizPassPercent = 80;
  licenseRenewalWindowDays = Number(safeGet(data, "renewal_window_days", 3));
  if (!Number.isFinite(licenseRenewalWindowDays) || licenseRenewalWindowDays < 0) licenseRenewalWindowDays = 3;
  existingLicenseSnapshot = normalizeExistingLicense(safeGet(data, "existing_license", null));
  licenseShowStatusPanel = false;
  pendingLicenseSubmissionPayload = null;
  if (licenseContinuePhotoBtn) licenseContinuePhotoBtn.disabled = false;
  if (licenseCancelBtn) licenseCancelBtn.disabled = false;
  if (licenseCloseBtn) licenseCloseBtn.disabled = false;

  if (licenseNameInput) licenseNameInput.value = String(safeGet(data, "full_name", "") || "");
  if (licenseDobInput) {
    licenseDobInput.value = normalizeDateForDateInput(safeGet(data, "date_of_birth", ""));
  }
  if (licenseGenderInput) licenseGenderInput.value = String(safeGet(data, "gender", "") || "");
  renderLicenseQuiz();
  showErrorNode(licenseFormError, "");

  var canTakeQuiz = safeGet(data, "can_take_quiz", true) === true;
  var canRetakePhoto = safeGet(data, "can_retake_photo", false) === true;
  var blockedMessage = String(safeGet(data, "blocked_message", "") || "").trim();
  var expiryText = existingLicenseSnapshot && existingLicenseSnapshot.expiry_at ? existingLicenseSnapshot.expiry_at : "unknown";
  var statusText = existingLicenseSnapshot && existingLicenseSnapshot.status ? existingLicenseSnapshot.status : "unknown";

  if (!canTakeQuiz) {
    licenseShowStatusPanel = true;
    if (licenseStatusMessage) {
      if (blockedMessage) {
        licenseStatusMessage.textContent = blockedMessage;
      } else {
        licenseStatusMessage.textContent =
          "You already have a valid licence (status: " + statusText + ", expiry: " + expiryText + "). " +
          "You can take a new test within " + String(licenseRenewalWindowDays) + " days of expiry.";
      }
    }
    if (licenseRetakePhotoBtn) licenseRetakePhotoBtn.disabled = !canRetakePhoto;
    setLicenseMode("blocked");
    return;
  }

  if (licenseStatusMessage && existingLicenseSnapshot) {
    var days = Number(existingLicenseSnapshot.days_until_expiry);
    if (Number.isFinite(days)) {
      licenseStatusMessage.textContent = "Current licence found. Days until expiry: " + String(days) + ". You can retake your photo now.";
    } else {
      licenseStatusMessage.textContent = "Current licence found. You can retake your photo now.";
    }
  }
  licenseShowStatusPanel = canRetakePhoto && existingLicenseSnapshot !== null;
  if (licenseRetakePhotoBtn) licenseRetakePhotoBtn.disabled = !canRetakePhoto;
  setLicenseMode("quiz");
}

function openLicenseForm(payload) {
  if (emergencyOpen) closeEmergencyForm();
  if (registrationOpen) closeRegistrationForm();
  resetLicenseForm(payload || {});
  licenseOpen = true;
  setVisible(licenseOverlay, true);
  setTimeout(function focusLicenseInput() {
    if (licenseSubmitBtn) licenseSubmitBtn.focus();
  }, 40);
}

function closeLicenseForm() {
  licenseOpen = false;
  setVisible(licenseOverlay, false);
}

async function submitLicenseForm() {
  if (licenseViewMode !== "quiz") return;
  var fullName = String(licenseNameInput && licenseNameInput.value || "").trim();
  var dateOfBirth = String(licenseDobInput && licenseDobInput.value || "").trim();
  var gender = String(licenseGenderInput && licenseGenderInput.value || "").trim();
  if (!fullName || !dateOfBirth || !gender) {
    showErrorNode(licenseFormError, "Character details are missing. Reopen the quiz.");
    return;
  }

  var answered = 0;
  var correct = 0;
  for (var i = 0; i < activeQuizQuestions.length; i += 1) {
    var questionObj = activeQuizQuestions[i];
    var selected = Number(quizAnswers[questionObj.id]);
    if (!Number.isInteger(selected)) continue;
    answered += 1;
    if (selected === Number(questionObj.answer)) correct += 1;
  }

  if (answered < activeQuizQuestions.length) {
    showErrorNode(licenseFormError, "Please answer every question.");
    return;
  }

  var scorePercent = Math.floor((correct / activeQuizQuestions.length) * 100);
  if (scorePercent < quizPassPercent) {
    showErrorNode(
      licenseFormError,
      "Quiz failed (" + String(scorePercent) + "%). You need " + String(quizPassPercent) + "% or more."
    );
    return;
  }

  pendingLicenseSubmissionPayload = {
    full_name: fullName,
    date_of_birth: dateOfBirth,
    gender: gender,
    license_classes: ["CAR"],
    conditions: ["Quiz pass " + String(scorePercent) + "%"],
    expiry_days: 30,
    quiz_mode: true,
    quiz_score_percent: scorePercent,
    quiz_total_questions: activeQuizQuestions.length,
    quiz_correct_answers: correct
  };
  if (licensePassMessage) {
    licensePassMessage.textContent =
      "Congratulations, you passed with " + String(scorePercent) + "%. " +
      "Your photo will now be taken for your licence record.";
  }
  showErrorNode(licenseFormError, "");
  setLicenseMode("pass");
}

async function submitPendingLicenseAfterPass() {
  if (!pendingLicenseSubmissionPayload) return;
  if (licenseContinuePhotoBtn) licenseContinuePhotoBtn.disabled = true;
  if (licenseCancelBtn) licenseCancelBtn.disabled = true;
  if (licenseCloseBtn) licenseCloseBtn.disabled = true;
  try {
    var response = await postNui("cadBridgeLicenseSubmit", pendingLicenseSubmissionPayload);
    var result = null;
    try {
      result = await response.json();
    } catch (_err) {
      result = null;
    }
    if (!response.ok || (result && result.ok === false)) {
      showErrorNode(licenseFormError, "Unable to submit quiz result.");
      setLicenseMode("pass");
      if (licenseContinuePhotoBtn) licenseContinuePhotoBtn.disabled = false;
      if (licenseCancelBtn) licenseCancelBtn.disabled = false;
      if (licenseCloseBtn) licenseCloseBtn.disabled = false;
      return;
    }
    closeLicenseForm();
  } catch (_err2) {
    showErrorNode(licenseFormError, "Unable to submit quiz result.");
    setLicenseMode("pass");
    if (licenseContinuePhotoBtn) licenseContinuePhotoBtn.disabled = false;
    if (licenseCancelBtn) licenseCancelBtn.disabled = false;
    if (licenseCloseBtn) licenseCloseBtn.disabled = false;
  }
}

async function requestLicensePhotoRetake() {
  if (!existingLicenseSnapshot) {
    showErrorNode(licenseFormError, "No existing licence found for photo retake.");
    return;
  }
  if (licenseRetakePhotoBtn) licenseRetakePhotoBtn.disabled = true;
  if (licenseCancelBtn) licenseCancelBtn.disabled = true;
  if (licenseCloseBtn) licenseCloseBtn.disabled = true;

  try {
    var response = await postNui("cadBridgeLicenseRetakePhoto", {
      existing_license: existingLicenseSnapshot
    });
    var result = null;
    try {
      result = await response.json();
    } catch (_err) {
      result = null;
    }
    if (!response.ok || (result && result.ok === false)) {
      showErrorNode(licenseFormError, "Unable to start photo retake.");
      if (licenseRetakePhotoBtn) licenseRetakePhotoBtn.disabled = false;
      if (licenseCancelBtn) licenseCancelBtn.disabled = false;
      if (licenseCloseBtn) licenseCloseBtn.disabled = false;
      return;
    }
    closeLicenseForm();
  } catch (_err2) {
    showErrorNode(licenseFormError, "Unable to start photo retake.");
    if (licenseRetakePhotoBtn) licenseRetakePhotoBtn.disabled = false;
    if (licenseCancelBtn) licenseCancelBtn.disabled = false;
    if (licenseCloseBtn) licenseCloseBtn.disabled = false;
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
  if (out.length === 0) out = [Number(fallback) || 35];
  out.sort(function sortNumber(a, b) { return a - b; });
  return out;
}

function getLicenseDurationLabel(days) {
  var value = Number(days) || 0;
  if (value === 1) return "Temporary (1 day)";
  if (value === 6) return "6 months (6 days)";
  if (value === 14) return "2 years (2 weeks)";
  if (value === 35) return "5 years (5 weeks)";
  if (value === 70) return "10 years (10 weeks)";
  return String(value) + " day" + (value === 1 ? "" : "s");
}

function renderRegistrationDurations(defaultDuration) {
  if (!regoDurationList) return;
  regoDurationList.innerHTML = "";
  var fallback = Number(defaultDuration) || 35;
  durationOptions = normalizeDurationOptions(durationOptions, fallback);
  selectedRegistrationDurationDays = durationOptions.indexOf(fallback) >= 0 ? fallback : durationOptions[0];

  for (var i = 0; i < durationOptions.length; i += 1) {
    (function renderDurationButton(optionValue) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn" + (selectedRegistrationDurationDays === optionValue ? " active" : "");
      btn.textContent = getLicenseDurationLabel(optionValue);
      btn.addEventListener("click", function onDurationClick() {
        selectedRegistrationDurationDays = optionValue;
        renderRegistrationDurations(optionValue);
      });
      regoDurationList.appendChild(btn);
    })(durationOptions[i]);
  }
}

function resetRegistrationForm(payload) {
  var data = payload || {};
  if (regoOwnerInput) regoOwnerInput.value = String(safeGet(data, "owner_name", "") || "");
  if (regoPlateInput) regoPlateInput.value = String(safeGet(data, "plate", "") || "");
  if (regoModelInput) regoModelInput.value = String(safeGet(data, "vehicle_model", "") || "");
  if (regoColourInput) regoColourInput.value = String(safeGet(data, "vehicle_colour", "") || "");
  durationOptions = Array.isArray(data.duration_options) ? data.duration_options : [];
  renderRegistrationDurations(Number(safeGet(data, "default_duration_days", 35)) || 35);
  registrationSubmitPending = false;
  if (registrationSubmitBtn) registrationSubmitBtn.disabled = false;
  if (registrationSubmitBtn) registrationSubmitBtn.textContent = "Save Registration";
  showErrorNode(registrationFormError, "");
}

function openRegistrationForm(payload) {
  if (emergencyOpen) closeEmergencyForm();
  if (licenseOpen) closeLicenseForm();
  resetRegistrationForm(payload || {});
  registrationOpen = true;
  setVisible(registrationOverlay, true);
  setTimeout(function focusRegoDuration() {
    var selectedButton = regoDurationList && regoDurationList.querySelector("button.active") || regoDurationList && regoDurationList.querySelector("button");
    if (selectedButton) selectedButton.focus();
  }, 40);
}

function closeRegistrationForm() {
  registrationOpen = false;
  registrationSubmitPending = false;
  setVisible(registrationOverlay, false);
  if (registrationSubmitBtn) {
    registrationSubmitBtn.disabled = false;
    registrationSubmitBtn.textContent = "Save Registration";
  }
}

async function submitRegistrationForm() {
  if (registrationSubmitPending) return;

  var ownerName = String(regoOwnerInput && regoOwnerInput.value || "").trim();
  var plate = String(regoPlateInput && regoPlateInput.value || "").trim().toUpperCase();
  var model = String(regoModelInput && regoModelInput.value || "").trim();
  if (!ownerName || !plate || !model) {
    showErrorNode(registrationFormError, "Owner, plate and model are required.");
    return;
  }
  showErrorNode(registrationFormError, "");
  if (registrationSubmitBtn) registrationSubmitBtn.disabled = true;

  var durationDays = Number(selectedRegistrationDurationDays || 0);
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
      var errorCode = String(result && result.error || "").trim();
      if (errorCode === "submit_in_progress") {
        showErrorNode(registrationFormError, "Registration is already being submitted. Please wait.");
      } else if (errorCode === "invalid_form") {
        showErrorNode(registrationFormError, "Owner, plate and model are required.");
      } else {
        showErrorNode(registrationFormError, "Unable to submit registration form.");
      }
      if (registrationSubmitBtn) registrationSubmitBtn.disabled = false;
      return;
    }
    if (result && (result.pending === true || result.accepted === true)) {
      registrationSubmitPending = true;
      if (registrationSubmitBtn) {
        registrationSubmitBtn.disabled = true;
        registrationSubmitBtn.textContent = "Saving...";
      }
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

function setIdCardField(fieldName, value, fallback, legacyNode) {
  var text = String(value || "").trim();
  var resolved = text || String(fallback || "");
  var wrotePlaceholder = false;
  if (idCardOverlay) {
    var selector = '[data-license-field="' + String(fieldName || "") + '"]';
    var nodes = idCardOverlay.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = resolved;
      wrotePlaceholder = true;
    }
  }
  if (legacyNode) {
    legacyNode.textContent = resolved;
    return;
  }
  if (!wrotePlaceholder) return;
}

function setIdCardImage(fieldName, src, legacyNode) {
  var imageSrc = String(src || "").trim();
  var wrotePlaceholder = false;
  if (idCardOverlay) {
    var selector = '[data-license-image="' + String(fieldName || "") + '"]';
    var nodes = idCardOverlay.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) {
      if (imageSrc) nodes[i].setAttribute("src", imageSrc);
      else nodes[i].removeAttribute("src");
      wrotePlaceholder = true;
    }
  }
  if (legacyNode) {
    if (imageSrc) legacyNode.setAttribute("src", imageSrc);
    else legacyNode.removeAttribute("src");
    return;
  }
  if (!wrotePlaceholder) return;
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
  if (!idCardTemplateReady || !idCardOverlay) {
    queuedIdCardPayload = payload || {};
    ensureIdCardTemplateLoaded();
    return;
  }
  var data = payload || {};
  var mugshot = String(safeGet(data, "mugshot_url", "") || "").trim();
  setIdCardImage("mugshot_url", mugshot, idCardPhoto);
  setIdCardField("viewer_note", safeGet(data, "viewer_note", ""), "", idCardViewerNote);
  setIdCardField("full_name", safeGet(data, "full_name", ""), "Unknown", idCardName);
  setIdCardField("date_of_birth", safeGet(data, "date_of_birth", ""), "Unknown", idCardDob);
  setIdCardField("gender", safeGet(data, "gender", ""), "Unknown", idCardGender);
  setIdCardField("license_number", safeGet(data, "license_number", ""), "Auto", idCardNumber);
  setIdCardField("license_classes", listToText(safeGet(data, "license_classes", []), "None"), "None", idCardClasses);
  setIdCardField("status", normalizeStatusLabel(safeGet(data, "status", "")), "Unknown", idCardStatus);
  setIdCardField("expiry_at", safeGet(data, "expiry_at", ""), "None", idCardExpiry);
  setIdCardField("conditions", listToText(safeGet(data, "conditions", []), "None"), "None", idCardConditions);

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
  if (message.action === "cadBridgeRegistration:submitting") {
    registrationSubmitPending = true;
    if (registrationSubmitBtn) {
      registrationSubmitBtn.disabled = true;
      registrationSubmitBtn.textContent = "Saving...";
    }
    return;
  }
  if (message.action === "cadBridgeRegistration:submitResult") {
    var submitPayload = message.payload || {};
    var submitOk = submitPayload.ok === true || submitPayload.success === true;
    if (submitOk) {
      closeRegistrationForm();
      return;
    }
    registrationSubmitPending = false;
    if (registrationSubmitBtn) {
      registrationSubmitBtn.disabled = false;
      registrationSubmitBtn.textContent = "Save Registration";
    }
    var submitMessage = String(safeGet(submitPayload, "message", "") || "").trim();
    if (!submitMessage) {
      var submitErrorCode = String(safeGet(submitPayload, "error_code", "") || "").trim();
      if (submitErrorCode === "not_owner") {
        submitMessage = "You are not the owner of this vehicle, so it cannot be registered.";
      } else {
        submitMessage = "Unable to save registration.";
      }
    }
    showErrorNode(registrationFormError, submitMessage);
    return;
  }
  if (message.action === "cadBridgeIdCard:show") {
    openIdCard(message.payload || {});
    return;
  }
  if (message.action === "cadBridgeIdCard:hide") {
    closeIdCard();
    return;
  }
  if (message.action === "cadBridgeMiniCad:update") {
    updateMiniCad(message.payload || null);
    return;
  }
  if (message.action === "cadBridgeMiniCad:show") {
    if (miniCadData && miniCadData.call_id) showMiniCad();
    return;
  }
  if (message.action === "cadBridgeMiniCad:hide") {
    hideMiniCad();
    return;
  }
  if (message.action === "cadBridgeMugshot:showBackdrop") {
    var bd = document.getElementById("mugshotBackdrop");
    if (bd) bd.style.display = "none";
    return;
  }
  if (message.action === "cadBridgeMugshot:hideBackdrop") {
    var bd2 = document.getElementById("mugshotBackdrop");
    if (bd2) bd2.style.display = "none";
    return;
  }
  if (message.action === "cadBridgeHeadshot:capture") {
    var txdName = String(message.txdName || "").trim();
    if (!txdName) {
      postNui("cadBridgeHeadshotCapture", { data: "" }).catch(function ignoreCaptureError() {});
      return;
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function onHeadshotLoad() {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 256;
      canvas.height = img.naturalHeight || 256;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      var dataUrl = canvas.toDataURL("image/webp", 0.92);
      postNui("cadBridgeHeadshotCapture", { data: dataUrl }).catch(function ignoreCaptureError() {});
    };
    img.onerror = function onHeadshotError() {
      postNui("cadBridgeHeadshotCapture", { data: "" }).catch(function ignoreCaptureError() {});
    };
    img.src = "https://nui-img/" + txdName + "/" + txdName;
    return;
  }
});

// ─── Mini-CAD Popup ───
var miniCadPopup = document.getElementById("miniCadPopup");
var miniCadCallIndex = document.getElementById("miniCadCallIndex");
var miniCadJobCode = document.getElementById("miniCadJobCode");
var miniCadTitle = document.getElementById("miniCadTitle");
var miniCadLocation = document.getElementById("miniCadLocation");
var miniCadPostal = document.getElementById("miniCadPostal");
var miniCadUnits = document.getElementById("miniCadUnits");
var miniCadDescription = document.getElementById("miniCadDescription");
var miniCadPrevBtn = document.getElementById("miniCadPrev");
var miniCadNextBtn = document.getElementById("miniCadNext");
var miniCadDetachBtn = document.getElementById("miniCadDetach");
var miniCadHideBtn = document.getElementById("miniCadHideBtn");
var miniCadOpen = false;
var miniCadData = null;
var miniCadCurrentIndex = 0;

function showMiniCad() {
  if (!miniCadPopup) return;
  miniCadOpen = true;
  miniCadPopup.classList.remove("hidden");
}

function hideMiniCad() {
  if (!miniCadPopup) return;
  miniCadOpen = false;
  miniCadPopup.classList.add("hidden");
  postNui("cadBridgeMiniCadHidden", {}).catch(function ignore() {});
}

function updateMiniCad(payload) {
  miniCadData = payload || null;
  if (!miniCadData || !miniCadData.call_id) {
    if (miniCadOpen) hideMiniCad();
    return;
  }

  var allCalls = Array.isArray(miniCadData.all_assigned_calls) ? miniCadData.all_assigned_calls : [];
  var totalCalls = Math.max(1, allCalls.length);

  // Find current call index in the list.
  var foundIndex = -1;
  for (var i = 0; i < allCalls.length; i++) {
    if (Number(allCalls[i].id) === Number(miniCadData.call_id)) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex >= 0) {
    miniCadCurrentIndex = foundIndex;
  } else {
    miniCadCurrentIndex = 0;
  }

  renderMiniCadCall();
}

function renderMiniCadCall() {
  if (!miniCadData) return;

  var allCalls = Array.isArray(miniCadData.all_assigned_calls) ? miniCadData.all_assigned_calls : [];
  var totalCalls = Math.max(1, allCalls.length);
  var displayIndex = miniCadCurrentIndex + 1;
  var currentCall = allCalls[miniCadCurrentIndex] || miniCadData;

  if (miniCadCallIndex) miniCadCallIndex.textContent = String(displayIndex) + "/" + String(totalCalls);

  var jobCode = String(currentCall.job_code || "").trim();
  var title = String(currentCall.title || "").trim();
  var priority = String(currentCall.priority || "").trim();
  if (miniCadJobCode) {
    var headerParts = [];
    if (jobCode) headerParts.push(jobCode);
    if (priority) headerParts.push("P" + priority);
    miniCadJobCode.textContent = headerParts.length > 0 ? headerParts.join(" | ") : "";
    miniCadJobCode.style.display = headerParts.length > 0 ? "" : "none";
  }
  if (miniCadTitle) {
    miniCadTitle.textContent = title.toUpperCase();
  }

  if (miniCadLocation) {
    miniCadLocation.textContent = String(currentCall.location || "").trim() || "No location set";
  }

  if (miniCadPostal) {
    var postalVal = String(currentCall.postal || "").trim();
    miniCadPostal.textContent = postalVal;
  }

  // Render assigned unit badges.
  if (miniCadUnits) {
    miniCadUnits.innerHTML = "";
    var units = Array.isArray(miniCadData.assigned_units) ? miniCadData.assigned_units : [];
    for (var u = 0; u < units.length; u++) {
      var badge = document.createElement("span");
      badge.className = "minicad-unit-badge";
      badge.textContent = String(units[u].callsign || "?");
      var color = String(units[u].department_color || "").trim();
      if (color) badge.style.backgroundColor = color;
      miniCadUnits.appendChild(badge);
    }
  }

  // Description: for the current call being viewed use the main description if it's the primary call.
  if (miniCadDescription) {
    var desc = "";
    if (Number(currentCall.id || currentCall.call_id) === Number(miniCadData.call_id)) {
      desc = String(miniCadData.description || "").trim();
    } else {
      desc = String(currentCall.description || "").trim();
    }
    miniCadDescription.textContent = desc;
  }

  // Prev/next buttons.
  if (miniCadPrevBtn) miniCadPrevBtn.disabled = miniCadCurrentIndex <= 0;
  if (miniCadNextBtn) miniCadNextBtn.disabled = miniCadCurrentIndex >= totalCalls - 1;
}

function miniCadPrev() {
  if (miniCadCurrentIndex > 0) {
    miniCadCurrentIndex -= 1;
    renderMiniCadCall();
  }
}

function miniCadNext() {
  var allCalls = miniCadData && Array.isArray(miniCadData.all_assigned_calls) ? miniCadData.all_assigned_calls : [];
  if (miniCadCurrentIndex < allCalls.length - 1) {
    miniCadCurrentIndex += 1;
    renderMiniCadCall();
  }
}

function miniCadDetach() {
  if (!miniCadData) return;
  var allCalls = Array.isArray(miniCadData.all_assigned_calls) ? miniCadData.all_assigned_calls : [];
  var currentCall = allCalls[miniCadCurrentIndex] || miniCadData;
  var callId = Number(currentCall.id || currentCall.call_id || 0);
  if (callId > 0) {
    postNui("cadBridgeMiniCadDetach", { call_id: callId }).catch(function ignore() {});
  }
}

window.force000Open = function force000Open(departmentsPayload) {
  openEmergencyForm({
    departments: departmentsPayload || [],
    max_title_length: 80,
    max_details_length: 600,
  });
};

function initialize() {
  bindIdCardNodes();
  ensureIdCardTemplateLoaded();

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
  if (licenseRetakePhotoBtn) {
    licenseRetakePhotoBtn.addEventListener("click", function onRetakePhotoClick() {
      requestLicensePhotoRetake();
    });
  }
  if (licenseContinuePhotoBtn) {
    licenseContinuePhotoBtn.addEventListener("click", function onContinuePhotoClick() {
      submitPendingLicenseAfterPass();
    });
  }

  if (registrationForm) {
    registrationForm.addEventListener("submit", function onRegistrationSubmit(event) {
      event.preventDefault();
      submitRegistrationForm();
    });
  }
  if (registrationCloseBtn) registrationCloseBtn.addEventListener("click", cancelRegistrationForm);
  if (registrationCancelBtn) registrationCancelBtn.addEventListener("click", cancelRegistrationForm);

  // Mini-CAD bindings.
  if (miniCadHideBtn) miniCadHideBtn.addEventListener("click", hideMiniCad);
  if (miniCadPrevBtn) miniCadPrevBtn.addEventListener("click", miniCadPrev);
  if (miniCadNextBtn) miniCadNextBtn.addEventListener("click", miniCadNext);
  if (miniCadDetachBtn) miniCadDetachBtn.addEventListener("click", miniCadDetach);

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
