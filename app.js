"use strict";

/*
  Aquarium-Kalender
  -----------------
  Alle Ereignisse werden im localStorage des Browsers gespeichert.

  Ereignistypen:
  - cleaning = Reinigung
  - analysis = Wasseranalyse
*/

const STORAGE_KEY = "aquarium-calendar-events-v2";

/* Aktueller Zustand der App */

let events = loadEvents();
let visibleMonth = startOfMonth(new Date());
let selectedDate = formatDateForInput(new Date());
let eventPendingDeletion = null;
let deferredInstallPrompt = null;
let toastTimer = null;

/* Elemente aus index.html */

const elements = {
  todayDate: document.getElementById("todayDate"),

  lastCleaningDate: document.getElementById("lastCleaningDate"),
  daysSinceCleaning: document.getElementById("daysSinceCleaning"),
  lastAnalysisDate: document.getElementById("lastAnalysisDate"),
  daysSinceAnalysis: document.getElementById("daysSinceAnalysis"),
  cleaningCount: document.getElementById("cleaningCount"),
  analysisCount: document.getElementById("analysisCount"),

  calendarTitle: document.getElementById("calendarTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  previousMonthButton: document.getElementById("previousMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),

  selectedDayTitle: document.getElementById("selectedDayTitle"),
  selectedDayEvents: document.getElementById("selectedDayEvents"),

  historyFilter: document.getElementById("historyFilter"),
  historyList: document.getElementById("historyList"),

  openCleaningButton: document.getElementById("openCleaningButton"),
  openAnalysisButton: document.getElementById("openAnalysisButton"),

  cleaningDialog: document.getElementById("cleaningDialog"),
  cleaningForm: document.getElementById("cleaningForm"),
  cleaningDialogTitle: document.getElementById("cleaningDialogTitle"),
  cleaningId: document.getElementById("cleaningId"),
  cleaningDate: document.getElementById("cleaningDate"),
  waterAmount: document.getElementById("waterAmount"),
  waterConditionerEnabled: document.getElementById(
    "waterConditionerEnabled"
  ),
  waterConditionerAmountGroup: document.getElementById(
    "waterConditionerAmountGroup"
  ),
  waterConditionerAmount: document.getElementById(
    "waterConditionerAmount"
  ),
  bacteriaEnabled: document.getElementById("bacteriaEnabled"),
  bacteriaAmountGroup: document.getElementById("bacteriaAmountGroup"),
  bacteriaAmount: document.getElementById("bacteriaAmount"),
  v30Amount: document.getElementById("v30Amount"),
  s7Amount: document.getElementById("s7Amount"),
  enzymeAmount: document.getElementById("enzymeAmount"),
  ironAmount: document.getElementById("ironAmount"),
  cleaningNotes: document.getElementById("cleaningNotes"),

  analysisDialog: document.getElementById("analysisDialog"),
  analysisForm: document.getElementById("analysisForm"),
  analysisDialogTitle: document.getElementById("analysisDialogTitle"),
  analysisId: document.getElementById("analysisId"),
  analysisDate: document.getElementById("analysisDate"),
  phValue: document.getElementById("phValue"),
  ghValue: document.getElementById("ghValue"),
  khValue: document.getElementById("khValue"),
  no2Value: document.getElementById("no2Value"),
  no3Value: document.getElementById("no3Value"),
  po4Value: document.getElementById("po4Value"),
  feValue: document.getElementById("feValue"),
  conductivityValue: document.getElementById("conductivityValue"),
  temperatureValue: document.getElementById("temperatureValue"),
  co2Value: document.getElementById("co2Value"),
  analysisNotes: document.getElementById("analysisNotes"),

  confirmDialog: document.getElementById("confirmDialog"),
  cancelDeleteButton: document.getElementById("cancelDeleteButton"),
  confirmDeleteButton: document.getElementById("confirmDeleteButton"),

  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),

  installButton: document.getElementById("installButton"),
  toast: document.getElementById("toast")
};

/* App starten */

initializeApp();

function initializeApp() {
  bindEventListeners();
  setTodayDisplay();
  renderApp();
  registerServiceWorker();
}

/* Ereignis-Listener */

function bindEventListeners() {
  elements.previousMonthButton.addEventListener("click", () => {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1
    );

    renderCalendar();
  });

  elements.nextMonthButton.addEventListener("click", () => {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1
    );

    renderCalendar();
  });

  elements.openCleaningButton.addEventListener("click", () => {
    openNewCleaningDialog(selectedDate);
  });

  elements.openAnalysisButton.addEventListener("click", () => {
    openNewAnalysisDialog(selectedDate);
  });

  elements.cleaningForm.addEventListener("submit", saveCleaning);
  elements.analysisForm.addEventListener("submit", saveAnalysis);

  elements.waterConditionerEnabled.addEventListener(
    "change",
    updateConditionalCleaningFields
  );

  elements.bacteriaEnabled.addEventListener(
    "change",
    updateConditionalCleaningFields
  );

  elements.historyFilter.addEventListener("change", renderHistory);

  elements.cancelDeleteButton.addEventListener("click", closeDeleteDialog);
  elements.confirmDeleteButton.addEventListener("click", confirmDeletion);

  elements.exportButton.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialogId = button.dataset.closeDialog;
      const dialog = document.getElementById(dialogId);

      if (dialog?.open) {
        dialog.close();
      }
    });
  });

  /*
    Ein Dialog wird auch geschlossen, wenn man direkt auf den dunklen
    Hintergrund außerhalb des Dialoginhalts tippt.
  */
  [elements.cleaningDialog, elements.analysisDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  });

  elements.confirmDialog.addEventListener("click", (event) => {
    if (event.target === elements.confirmDialog) {
      closeDeleteDialog();
    }
  });

  /*
    Der Browser löst dieses Ereignis aus, wenn die PWA installiert
    werden kann. Die eigentliche Installation erfolgt erst nach einem
    Klick auf den Installationsbutton.
  */
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    elements.installButton.classList.remove("hidden");
  });

  elements.installButton.addEventListener("click", installApp);

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    elements.installButton.classList.add("hidden");
    showToast("Die App wurde installiert.");
  });
}

/* Gesamte Oberfläche aktualisieren */

function renderApp() {
  events = sortEvents(events);
  saveEvents();

  renderDashboard();
  renderCalendar();
  renderSelectedDayEvents();
  renderHistory();
}

/* Dashboard */

function setTodayDisplay() {
  elements.todayDate.textContent = formatDateLong(
    formatDateForInput(new Date())
  );
}

function renderDashboard() {
  const cleanings = events.filter((event) => event.type === "cleaning");
  const analyses = events.filter((event) => event.type === "analysis");

  elements.cleaningCount.textContent = String(cleanings.length);
  elements.analysisCount.textContent = String(analyses.length);

  updateLatestEventCard({
    eventList: cleanings,
    dateElement: elements.lastCleaningDate,
    daysElement: elements.daysSinceCleaning
  });

  updateLatestEventCard({
    eventList: analyses,
    dateElement: elements.lastAnalysisDate,
    daysElement: elements.daysSinceAnalysis
  });
}

function updateLatestEventCard({
  eventList,
  dateElement,
  daysElement
}) {
  if (eventList.length === 0) {
    dateElement.textContent = "Noch keine";
    daysElement.textContent = "Kein Eintrag vorhanden";
    return;
  }

  /*
    Zukünftige Einträge werden für „letzter Eintrag“ nicht berücksichtigt.
    Falls ausschließlich zukünftige Einträge existieren, wird der zeitlich
    nächste Eintrag angezeigt.
  */
  const today = formatDateForInput(new Date());

  const pastOrToday = eventList
    .filter((event) => event.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latestEvent =
    pastOrToday[0] ??
    [...eventList].sort((a, b) => a.date.localeCompare(b.date))[0];

  dateElement.textContent = formatDateLong(latestEvent.date);

  const difference = getDayDifference(latestEvent.date, today);

  if (difference === 0) {
    daysElement.textContent = "heute";
  } else if (difference === 1) {
    daysElement.textContent = "vor einem Tag";
  } else if (difference > 1) {
    daysElement.textContent = `vor ${difference} Tagen`;
  } else if (difference === -1) {
    daysElement.textContent = "morgen";
  } else {
    daysElement.textContent = `in ${Math.abs(difference)} Tagen`;
  }
}

/* Kalender */

function renderCalendar() {
  elements.calendarTitle.textContent = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric"
  }).format(visibleMonth);

  elements.calendarGrid.replaceChildren();

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  /*
    JavaScript zählt Sonntag als 0. Für einen deutschen Kalender soll
    Montag die erste Spalte sein.
  */
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  /*
    Es werden immer sechs Kalenderwochen dargestellt. Dadurch bleibt
    die Kalenderhöhe beim Monatswechsel stabil.
  */
  const firstDisplayedDate = new Date(year, month, 1 - firstWeekday);

  for (let index = 0; index < 42; index += 1) {
    const dayDate = new Date(
      firstDisplayedDate.getFullYear(),
      firstDisplayedDate.getMonth(),
      firstDisplayedDate.getDate() + index
    );

    elements.calendarGrid.append(createCalendarDay(dayDate, month));
  }
}

function createCalendarDay(dayDate, visibleMonthNumber) {
  const dateString = formatDateForInput(dayDate);
  const today = formatDateForInput(new Date());

  const dayButton = document.createElement("button");
  dayButton.type = "button";
  dayButton.className = "calendar-day";
  dayButton.dataset.date = dateString;
  dayButton.setAttribute("role", "gridcell");
  dayButton.setAttribute(
    "aria-label",
    formatDateWithWeekday(dateString)
  );

  if (dayDate.getMonth() !== visibleMonthNumber) {
    dayButton.classList.add("other-month");
  }

  if (dateString === today) {
    dayButton.classList.add("today");
  }

  if (dateString === selectedDate) {
    dayButton.classList.add("selected");
  }

  const dayNumber = document.createElement("span");
  dayNumber.className = "calendar-day-number";
  dayNumber.textContent = String(dayDate.getDate());

  const markerContainer = document.createElement("span");
  markerContainer.className = "calendar-day-markers";

  const eventsOnDay = events.filter((event) => event.date === dateString);
  const hasCleaning = eventsOnDay.some(
    (event) => event.type === "cleaning"
  );
  const hasAnalysis = eventsOnDay.some(
    (event) => event.type === "analysis"
  );

  if (hasCleaning) {
    markerContainer.append(
      createCalendarMarker("cleaning", "Reinigung")
    );
  }

  if (hasAnalysis) {
    markerContainer.append(
      createCalendarMarker("analysis", "Wasseranalyse")
    );
  }

  dayButton.append(dayNumber, markerContainer);

  dayButton.addEventListener("click", () => {
    selectedDate = dateString;

    /*
      Wird ein ausgegrauter Tag aus dem vorherigen oder nächsten Monat
      ausgewählt, wechselt der Kalender direkt zu diesem Monat.
    */
    visibleMonth = startOfMonth(dayDate);

    renderCalendar();
    renderSelectedDayEvents();
  });

  return dayButton;
}

function createCalendarMarker(type, description) {
  const marker = document.createElement("span");
  marker.className = `calendar-marker ${type}`;
  marker.title = description;
  marker.setAttribute("aria-label", description);

  return marker;
}

/* Ereignisse des ausgewählten Tages */

function renderSelectedDayEvents() {
  elements.selectedDayTitle.textContent =
    formatDateWithWeekday(selectedDate);

  const selectedEvents = events
    .filter((event) => event.date === selectedDate)
    .sort(compareEventsForDisplay);

  renderEventList(
    elements.selectedDayEvents,
    selectedEvents,
    "Für diesen Tag wurden noch keine Ereignisse eingetragen."
  );
}

/* Gesamte Historie */

function renderHistory() {
  const selectedFilter = elements.historyFilter.value;

  const filteredEvents = events
    .filter((event) => {
      return selectedFilter === "all" || event.type === selectedFilter;
    })
    .sort(compareEventsForDisplay);

  renderEventList(
    elements.historyList,
    filteredEvents,
    "Noch keine passenden Ereignisse gespeichert."
  );
}

function renderEventList(container, eventList, emptyMessage) {
  container.replaceChildren();

  if (eventList.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = emptyMessage;
    container.append(emptyState);
    return;
  }

  eventList.forEach((event) => {
    container.append(createEventCard(event));
  });
}

/* Ereigniskarten erzeugen */

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  if (event.type === "analysis") {
    card.classList.add("analysis-event");
  }

  const header = document.createElement("div");
  header.className = "event-card-header";

  const titleWrapper = document.createElement("div");
  titleWrapper.className = "event-card-title";

  const icon = document.createElement("span");
  icon.className = "event-type-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = event.type === "cleaning" ? "💧" : "🧪";

  const titleText = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent =
    event.type === "cleaning" ? "Reinigung" : "Wasseranalyse";

  const date = document.createElement("span");
  date.className = "event-date";
  date.textContent = formatDateWithWeekday(event.date);

  titleText.append(title, date);
  titleWrapper.append(icon, titleText);

  const actions = document.createElement("div");
  actions.className = "event-card-actions";

  const editButton = createEventActionButton({
    symbol: "✎",
    label: "Eintrag bearbeiten",
    className: ""
  });

  editButton.addEventListener("click", () => editEvent(event.id));

  const deleteButton = createEventActionButton({
    symbol: "🗑",
    label: "Eintrag löschen",
    className: "delete"
  });

  deleteButton.addEventListener("click", () => {
    requestEventDeletion(event.id);
  });

  actions.append(editButton, deleteButton);
  header.append(titleWrapper, actions);

  const details = document.createElement("div");
  details.className = "event-details";

  if (event.type === "cleaning") {
    appendCleaningDetails(details, event);
  } else {
    appendAnalysisDetails(details, event);
  }

  card.append(header, details);

  if (event.notes) {
    const notes = document.createElement("p");
    notes.className = "event-notes";
    notes.textContent = event.notes;
    card.append(notes);
  }

  return card;
}

function createEventActionButton({
  symbol,
  label,
  className
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `event-action-button ${className}`.trim();
  button.textContent = symbol;
  button.title = label;
  button.setAttribute("aria-label", label);

  return button;
}

function appendCleaningDetails(container, event) {
  appendDetailRow(container, "Wasserwechsel", `${event.waterAmount} Liter`);

  if (event.waterConditionerEnabled) {
    appendDetailRow(
      container,
      "Wasseraufbereiter",
      `${formatNumber(event.waterConditionerAmount)} ml`
    );
  }

  if (event.bacteriaEnabled) {
    appendDetailRow(
      container,
      "Bakterien",
      `${formatNumber(event.bacteriaAmount)} ml`
    );
  }

  if (event.v30Amount > 0) {
    appendDetailRow(
      container,
      "V30",
      formatPumps(event.v30Amount)
    );
  }

  if (event.s7Amount > 0) {
    appendDetailRow(
      container,
      "S7",
      formatPumps(event.s7Amount)
    );
  }

  if (event.enzymeAmount > 0) {
    appendDetailRow(
      container,
      "Enzyme",
      `${formatNumber(event.enzymeAmount)} ml`
    );
  }

  if (event.ironAmount > 0) {
    appendDetailRow(
      container,
      "Eisendünger",
      formatIronTablets(event.ironAmount)
    );
  }
}

function appendAnalysisDetails(container, event) {
  const analysisValues = [
    ["pH", event.ph, ""],
    ["GH", event.gh, " °dH"],
    ["KH", event.kh, " °dH"],
    ["NO₂", event.no2, " mg/l"],
    ["NO₃", event.no3, " mg/l"],
    ["PO₄", event.po4, " mg/l"],
    ["Fe", event.fe, " mg/l"],
    ["Leitwert", event.conductivity, " µS/cm"],
    ["Temperatur", event.temperature, " °C"],
    ["CO₂", event.co2, " mg/l"]
  ];

  const enteredValues = analysisValues.filter(([, value]) => {
    return value !== null && value !== undefined && value !== "";
  });

  if (enteredValues.length === 0) {
    appendDetailRow(container, "Messwerte", "Keine Werte eingetragen");
    return;
  }

  enteredValues.forEach(([label, value, unit]) => {
    appendDetailRow(
      container,
      label,
      `${formatNumber(value)}${unit}`
    );
  });
}

function appendDetailRow(container, labelText, valueText) {
  const row = document.createElement("div");
  row.className = "event-detail-row";

  const label = document.createElement("span");
  label.className = "event-detail-label";
  label.textContent = labelText;

  const value = document.createElement("span");
  value.className = "event-detail-value";
  value.textContent = valueText;

  row.append(label, value);
  container.append(row);
}

/* Neue Reinigung */

function openNewCleaningDialog(date = selectedDate) {
  elements.cleaningForm.reset();
  elements.cleaningId.value = "";
  elements.cleaningDate.value = date;
  elements.cleaningDialogTitle.textContent = "Reinigung eintragen";

  updateConditionalCleaningFields();
  elements.cleaningDialog.showModal();
}

/* Reinigung bearbeiten */

function openCleaningForEditing(event) {
  elements.cleaningForm.reset();

  elements.cleaningId.value = event.id;
  elements.cleaningDate.value = event.date;
  elements.waterAmount.value = String(event.waterAmount);

  elements.waterConditionerEnabled.checked =
    Boolean(event.waterConditionerEnabled);

  elements.waterConditionerAmount.value =
    event.waterConditionerAmount ?? "";

  elements.bacteriaEnabled.checked =
    Boolean(event.bacteriaEnabled);

  elements.bacteriaAmount.value =
    event.bacteriaAmount ?? "";

  elements.v30Amount.value = String(event.v30Amount ?? 0);
  elements.s7Amount.value = String(event.s7Amount ?? 0);
  elements.enzymeAmount.value = String(event.enzymeAmount ?? 0);
  elements.ironAmount.value = String(event.ironAmount ?? 0);
  elements.cleaningNotes.value = event.notes ?? "";

  elements.cleaningDialogTitle.textContent = "Reinigung bearbeiten";

  updateConditionalCleaningFields();
  elements.cleaningDialog.showModal();
}

/* Bedingte Eingabefelder für Reinigung */

function updateConditionalCleaningFields() {
  const conditionerIsEnabled =
    elements.waterConditionerEnabled.checked;

  elements.waterConditionerAmountGroup.classList.toggle(
    "hidden",
    !conditionerIsEnabled
  );

  elements.waterConditionerAmount.required = conditionerIsEnabled;

  if (!conditionerIsEnabled) {
    elements.waterConditionerAmount.value = "";
  }

  const bacteriaIsEnabled = elements.bacteriaEnabled.checked;

  elements.bacteriaAmountGroup.classList.toggle(
    "hidden",
    !bacteriaIsEnabled
  );

  elements.bacteriaAmount.required = bacteriaIsEnabled;

  if (!bacteriaIsEnabled) {
    elements.bacteriaAmount.value = "";
  }
}

/* Reinigung speichern */

function saveCleaning(submitEvent) {
  submitEvent.preventDefault();

  if (!elements.cleaningForm.reportValidity()) {
    return;
  }

  const existingId = elements.cleaningId.value;
  const now = new Date().toISOString();

  const cleaningEvent = {
    id: existingId || createId(),
    type: "cleaning",
    date: elements.cleaningDate.value,
    waterAmount: numberOrZero(elements.waterAmount.value),

    waterConditionerEnabled:
      elements.waterConditionerEnabled.checked,

    waterConditionerAmount:
      elements.waterConditionerEnabled.checked
        ? nullableNumber(elements.waterConditionerAmount.value)
        : null,

    bacteriaEnabled: elements.bacteriaEnabled.checked,

    bacteriaAmount:
      elements.bacteriaEnabled.checked
        ? nullableNumber(elements.bacteriaAmount.value)
        : null,

    v30Amount: numberOrZero(elements.v30Amount.value),
    s7Amount: numberOrZero(elements.s7Amount.value),
    enzymeAmount: numberOrZero(elements.enzymeAmount.value),
    ironAmount: numberOrZero(elements.ironAmount.value),
    notes: elements.cleaningNotes.value.trim(),
    createdAt: now,
    updatedAt: now
  };

  const existingEvent = events.find((event) => event.id === existingId);

  if (existingEvent) {
    cleaningEvent.createdAt = existingEvent.createdAt ?? now;

    events = events.map((event) => {
      return event.id === existingId ? cleaningEvent : event;
    });
  } else {
    events.push(cleaningEvent);
  }

  selectedDate = cleaningEvent.date;
  visibleMonth = startOfMonth(parseLocalDate(cleaningEvent.date));

  elements.cleaningDialog.close();
  renderApp();

  showToast(
    existingEvent
      ? "Die Reinigung wurde aktualisiert."
      : "Die Reinigung wurde gespeichert."
  );
}

/* Neue Wasseranalyse */

function openNewAnalysisDialog(date = selectedDate) {
  elements.analysisForm.reset();
  elements.analysisId.value = "";
  elements.analysisDate.value = date;
  elements.analysisDialogTitle.textContent =
    "Wasseranalyse eintragen";

  elements.analysisDialog.showModal();
}

/* Wasseranalyse bearbeiten */

function openAnalysisForEditing(event) {
  elements.analysisForm.reset();

  elements.analysisId.value = event.id;
  elements.analysisDate.value = event.date;
  elements.phValue.value = event.ph ?? "";
  elements.ghValue.value = event.gh ?? "";
  elements.khValue.value = event.kh ?? "";
  elements.no2Value.value = event.no2 ?? "";
  elements.no3Value.value = event.no3 ?? "";
  elements.po4Value.value = event.po4 ?? "";
  elements.feValue.value = event.fe ?? "";
  elements.conductivityValue.value = event.conductivity ?? "";
  elements.temperatureValue.value = event.temperature ?? "";
  elements.co2Value.value = event.co2 ?? "";
  elements.analysisNotes.value = event.notes ?? "";

  elements.analysisDialogTitle.textContent =
    "Wasseranalyse bearbeiten";

  elements.analysisDialog.showModal();
}

/* Wasseranalyse speichern */

function saveAnalysis(submitEvent) {
  submitEvent.preventDefault();

  if (!elements.analysisForm.reportValidity()) {
    return;
  }

  const existingId = elements.analysisId.value;
  const now = new Date().toISOString();

  const analysisEvent = {
    id: existingId || createId(),
    type: "analysis",
    date: elements.analysisDate.value,
    ph: nullableNumber(elements.phValue.value),
    gh: nullableNumber(elements.ghValue.value),
    kh: nullableNumber(elements.khValue.value),
    no2: nullableNumber(elements.no2Value.value),
    no3: nullableNumber(elements.no3Value.value),
    po4: nullableNumber(elements.po4Value.value),
    fe: nullableNumber(elements.feValue.value),
    conductivity: nullableNumber(elements.conductivityValue.value),
    temperature: nullableNumber(elements.temperatureValue.value),
    co2: nullableNumber(elements.co2Value.value),
    notes: elements.analysisNotes.value.trim(),
    createdAt: now,
    updatedAt: now
  };

  const existingEvent = events.find((event) => event.id === existingId);

  if (existingEvent) {
    analysisEvent.createdAt = existingEvent.createdAt ?? now;

    events = events.map((event) => {
      return event.id === existingId ? analysisEvent : event;
    });
  } else {
    events.push(analysisEvent);
  }

  selectedDate = analysisEvent.date;
  visibleMonth = startOfMonth(parseLocalDate(analysisEvent.date));

  elements.analysisDialog.close();
  renderApp();

  showToast(
    existingEvent
      ? "Die Wasseranalyse wurde aktualisiert."
      : "Die Wasseranalyse wurde gespeichert."
  );
}

/* Bearbeiten */

function editEvent(eventId) {
  const event = events.find((entry) => entry.id === eventId);

  if (!event) {
    showToast("Der Eintrag wurde nicht gefunden.", true);
    return;
  }

  if (event.type === "cleaning") {
    openCleaningForEditing(event);
  } else if (event.type === "analysis") {
    openAnalysisForEditing(event);
  }
}

/* Löschen */

function requestEventDeletion(eventId) {
  const event = events.find((entry) => entry.id === eventId);

  if (!event) {
    showToast("Der Eintrag wurde nicht gefunden.", true);
    return;
  }

  eventPendingDeletion = eventId;
  elements.confirmDialog.showModal();
}

function closeDeleteDialog() {
  eventPendingDeletion = null;

  if (elements.confirmDialog.open) {
    elements.confirmDialog.close();
  }
}

function confirmDeletion() {
  if (!eventPendingDeletion) {
    closeDeleteDialog();
    return;
  }

  events = events.filter((event) => {
    return event.id !== eventPendingDeletion;
  });

  closeDeleteDialog();
  renderApp();
  showToast("Der Eintrag wurde gelöscht.");
}

/* Export */

function exportData() {
  const backup = {
    app: "Aquarium-Kalender",
    version: 2,
    exportedAt: new Date().toISOString(),
    events
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {
    type: "application/json"
  });

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `aquarium-backup-${formatDateForInput(new Date())}.json`;

  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(downloadUrl);
  showToast("Die Datensicherung wurde erstellt.");
}

/* Import */

async function importData(changeEvent) {
  const file = changeEvent.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const fileText = await file.text();
    const importedData = JSON.parse(fileText);

    const importedEvents = Array.isArray(importedData)
      ? importedData
      : importedData.events;

    if (!Array.isArray(importedEvents)) {
      throw new Error("Die Datei enthält keine Ereignisliste.");
    }

    const validatedEvents = importedEvents
      .map(normalizeImportedEvent)
      .filter(Boolean);

    if (
      importedEvents.length > 0 &&
      validatedEvents.length === 0
    ) {
      throw new Error("Keine gültigen Ereignisse gefunden.");
    }

    /*
      Importierte Einträge werden mit vorhandenen Einträgen zusammengeführt.
      Einträge mit derselben ID werden durch die importierte Version ersetzt.
    */
    const mergedEvents = new Map();

    events.forEach((event) => mergedEvents.set(event.id, event));
    validatedEvents.forEach((event) => mergedEvents.set(event.id, event));

    events = [...mergedEvents.values()];
    renderApp();

    showToast(
      `${validatedEvents.length} Ereignis${
        validatedEvents.length === 1 ? "" : "se"
      } importiert.`
    );
  } catch (error) {
    console.error("Import fehlgeschlagen:", error);
    showToast(
      "Die Datei konnte nicht importiert werden.",
      true
    );
  } finally {
    /*
      Dadurch kann dieselbe Datei anschließend erneut ausgewählt werden.
    */
    elements.importInput.value = "";
  }
}

function normalizeImportedEvent(event) {
  if (
    !event ||
    typeof event !== "object" ||
    !["cleaning", "analysis"].includes(event.type) ||
    !isValidDateString(event.date)
  ) {
    return null;
  }

  const baseEvent = {
    id:
      typeof event.id === "string" && event.id
        ? event.id
        : createId(),
    type: event.type,
    date: event.date,
    notes: typeof event.notes === "string" ? event.notes : "",
    createdAt:
      typeof event.createdAt === "string"
        ? event.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof event.updatedAt === "string"
        ? event.updatedAt
        : new Date().toISOString()
  };

  if (event.type === "cleaning") {
    return {
      ...baseEvent,
      waterAmount: numberOrZero(event.waterAmount),
      waterConditionerEnabled:
        Boolean(event.waterConditionerEnabled),
      waterConditionerAmount:
        nullableNumber(event.waterConditionerAmount),
      bacteriaEnabled: Boolean(event.bacteriaEnabled),
      bacteriaAmount: nullableNumber(event.bacteriaAmount),
      v30Amount: numberOrZero(event.v30Amount),
      s7Amount: numberOrZero(event.s7Amount),
      enzymeAmount: numberOrZero(event.enzymeAmount),
      ironAmount: numberOrZero(event.ironAmount)
    };
  }

  return {
    ...baseEvent,
    ph: nullableNumber(event.ph),
    gh: nullableNumber(event.gh),
    kh: nullableNumber(event.kh),
    no2: nullableNumber(event.no2),
    no3: nullableNumber(event.no3),
    po4: nullableNumber(event.po4),
    fe: nullableNumber(event.fe),
    conductivity: nullableNumber(event.conductivity),
    temperature: nullableNumber(event.temperature),
    co2: nullableNumber(event.co2)
  };
}

/* localStorage */

function loadEvents() {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (!storedData) {
      return [];
    }

    const parsedData = JSON.parse(storedData);

    if (!Array.isArray(parsedData)) {
      return [];
    }

    return parsedData
      .map(normalizeImportedEvent)
      .filter(Boolean);
  } catch (error) {
    console.error("Gespeicherte Daten konnten nicht gelesen werden:", error);
    return [];
  }
}

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.error("Daten konnten nicht gespeichert werden:", error);
    showToast(
      "Die Daten konnten nicht gespeichert werden.",
      true
    );
  }
}

/* Installation */

async function installApp() {
  if (!deferredInstallPrompt) {
    showToast(
      "Nutze im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“."
    );
    return;
  }

  deferredInstallPrompt.prompt();

  try {
    await deferredInstallPrompt.userChoice;
  } finally {
    deferredInstallPrompt = null;
    elements.installButton.classList.add("hidden");
  }
}

/* Service Worker für Offline-Funktion */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.info("Service Worker wurde registriert.");
    } catch (error) {
      console.error(
        "Service Worker konnte nicht registriert werden:",
        error
      );
    }
  });
}

/* Meldungen */

function showToast(message, isError = false) {
  clearTimeout(toastTimer);

  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 3200);
}

/* Hilfsfunktionen */

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortEvents(eventList) {
  return [...eventList].sort(compareEventsForDisplay);
}

function compareEventsForDisplay(firstEvent, secondEvent) {
  const dateComparison = secondEvent.date.localeCompare(firstEvent.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  /*
    Am selben Tag wird eine Reinigung vor einer Wasseranalyse angezeigt.
  */
  if (firstEvent.type !== secondEvent.type) {
    return firstEvent.type === "cleaning" ? -1 : 1;
  }

  return String(secondEvent.createdAt ?? "").localeCompare(
    String(firstEvent.createdAt ?? "")
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLong(dateString) {
  if (!isValidDateString(dateString)) {
    return "Ungültiges Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parseLocalDate(dateString));
}

function formatDateWithWeekday(dateString) {
  if (!isValidDateString(dateString)) {
    return "Ungültiges Datum";
  }

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parseLocalDate(dateString));
}

function isValidDateString(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = parseLocalDate(value);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    formatDateForInput(parsedDate) === value
  );
}

function getDayDifference(earlierDateString, laterDateString) {
  const earlierDate = parseLocalDate(earlierDateString);
  const laterDate = parseLocalDate(laterDateString);

  /*
    Mittagszeit verhindert Probleme an Tagen mit Zeitumstellung.
  */
  earlierDate.setHours(12, 0, 0, 0);
  laterDate.setHours(12, 0, 0, 0);

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.round(
    (laterDate.getTime() - earlierDate.getTime()) /
      millisecondsPerDay
  );
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const normalizedValue =
    typeof value === "string"
      ? value.replace(",", ".")
      : value;

  const number = Number(normalizedValue);

  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return nullableNumber(value) ?? 0;
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2
  }).format(number);
}

function formatPumps(amount) {
  const numericAmount = Number(amount);

  return numericAmount === 1
    ? "1 Hub"
    : `${formatNumber(numericAmount)} Hübe`;
}

function formatIronTablets(amount) {
  const numericAmount = Number(amount);

  if (numericAmount === 0.5) {
    return "½ Tablette";
  }

  if (numericAmount === 1) {
    return "1 Tablette";
  }

  return `${formatNumber(numericAmount)} Tabletten`;
}