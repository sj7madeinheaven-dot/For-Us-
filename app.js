const storageKey = "tether-mvp-state";

const initialState = {
  userName: "Avery",
  partnerName: "Jordan",
  pairCode: "TETH-2048",
  sharingEnabled: false,
  lastLocation: null,
  messages: [
    {
      id: createId(),
      author: "Jordan",
      text: "Share turned on when you head out?",
      timestamp: new Date().toISOString(),
    },
  ],
  places: [
    {
      id: createId(),
      name: "Home",
      note: "Safe arrival check-in",
      latitude: "28.6139",
      longitude: "77.2090",
      timestamp: new Date().toISOString(),
    },
  ],
};

const state = loadState();
let watchId = null;

const els = {
  userName: document.querySelector("#userName"),
  partnerName: document.querySelector("#partnerName"),
  pairCode: document.querySelector("#pairCode"),
  regenerateCode: document.querySelector("#regenerateCode"),
  shareStatus: document.querySelector("#shareStatus"),
  toggleSharing: document.querySelector("#toggleSharing"),
  accuracyValue: document.querySelector("#accuracyValue"),
  lastUpdated: document.querySelector("#lastUpdated"),
  watchBadge: document.querySelector("#watchBadge"),
  latitudeValue: document.querySelector("#latitudeValue"),
  longitudeValue: document.querySelector("#longitudeValue"),
  partnerZone: document.querySelector("#partnerZone"),
  locationSummary: document.querySelector("#locationSummary"),
  messageList: document.querySelector("#messageList"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  placeForm: document.querySelector("#placeForm"),
  placeName: document.querySelector("#placeName"),
  placeNote: document.querySelector("#placeNote"),
  placesList: document.querySelector("#placesList"),
};

hydrateInputs();
render();
bindEvents();

if (state.sharingEnabled) {
  startLocationWatch();
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return cloneInitialState();
  }

  try {
    return { ...cloneInitialState(), ...JSON.parse(saved) };
  } catch {
    return cloneInitialState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function hydrateInputs() {
  els.userName.value = state.userName;
  els.partnerName.value = state.partnerName;
  els.pairCode.textContent = state.pairCode;
}

function bindEvents() {
  els.userName.addEventListener("input", (event) => {
    state.userName = event.target.value.trim() || "Avery";
    saveState();
    renderMessages();
  });

  els.partnerName.addEventListener("input", (event) => {
    state.partnerName = event.target.value.trim() || "Jordan";
    saveState();
    render();
  });

  els.regenerateCode.addEventListener("click", () => {
    state.pairCode = generatePairCode();
    saveState();
    renderHeader();
  });

  els.toggleSharing.addEventListener("click", async () => {
    if (state.sharingEnabled) {
      stopLocationWatch();
      return;
    }

    await startLocationWatch();
  });

  els.messageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = els.messageInput.value.trim();
    if (!text) {
      return;
    }

    state.messages.unshift({
      id: createId(),
      author: state.userName,
      text,
      timestamp: new Date().toISOString(),
    });

    els.messageInput.value = "";
    saveState();
    renderMessages();
  });

  els.placeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!state.lastLocation) {
      window.alert("Start location sharing first so we can save your current spot.");
      return;
    }

    const name = els.placeName.value.trim() || "Pinned place";
    const note = els.placeNote.value.trim() || "Saved from live location";

    state.places.unshift({
      id: createId(),
      name,
      note,
      latitude: state.lastLocation.latitude.toFixed(4),
      longitude: state.lastLocation.longitude.toFixed(4),
      timestamp: new Date().toISOString(),
    });

    els.placeName.value = "";
    els.placeNote.value = "";
    saveState();
    renderPlaces();
  });
}

async function startLocationWatch() {
  if (!("geolocation" in navigator)) {
    window.alert("This browser does not support location sharing.");
    return;
  }

  state.sharingEnabled = true;
  saveState();
  renderHeader();

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.lastLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };
      saveState();
      renderLocation();
    },
    (error) => {
      state.sharingEnabled = false;
      saveState();
      renderHeader();
      window.alert(`Location access failed: ${error.message}`);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    }
  );
}

function stopLocationWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  state.sharingEnabled = false;
  saveState();
  renderHeader();
}

function render() {
  renderHeader();
  renderLocation();
  renderMessages();
  renderPlaces();
}

function renderHeader() {
  els.pairCode.textContent = state.pairCode;
  els.shareStatus.textContent = state.sharingEnabled ? "Sharing live" : "Paused";
  els.toggleSharing.textContent = state.sharingEnabled
    ? "Stop sharing"
    : "Start sharing";
  els.partnerZone.textContent = state.partnerName
    ? `${state.partnerName}'s zone`
    : "Partner zone";
  els.watchBadge.textContent = state.sharingEnabled ? "Live" : "Offline";
  els.watchBadge.className = `badge ${
    state.sharingEnabled ? "badge-online" : "badge-offline"
  }`;
}

function renderLocation() {
  if (!state.lastLocation) {
    els.latitudeValue.textContent = "--";
    els.longitudeValue.textContent = "--";
    els.accuracyValue.textContent = "Waiting...";
    els.lastUpdated.textContent = "Not yet shared";
    els.locationSummary.textContent =
      "Start sharing to pull your current coordinates from the browser.";
    return;
  }

  const { latitude, longitude, accuracy, timestamp } = state.lastLocation;
  els.latitudeValue.textContent = latitude.toFixed(4);
  els.longitudeValue.textContent = longitude.toFixed(4);
  els.accuracyValue.textContent = `${Math.round(accuracy)} m`;
  els.lastUpdated.textContent = formatDate(timestamp);
  els.locationSummary.textContent = `${state.userName} last checked in near ${latitude.toFixed(
    4
  )}, ${longitude.toFixed(4)}. Keep this page open for continuous browser-based updates.`;
}

function renderMessages() {
  if (!state.messages.length) {
    els.messageList.innerHTML =
      '<div class="empty-state">No messages yet. Send a quick status update to get started.</div>';
    return;
  }

  els.messageList.innerHTML = state.messages
    .map(
      (message) => `
        <article class="message">
          <strong>${escapeHtml(message.author)}</strong>
          <span>${escapeHtml(message.text)}</span>
          <small>${formatDate(message.timestamp)}</small>
        </article>
      `
    )
    .join("");
}

function renderPlaces() {
  if (!state.places.length) {
    els.placesList.innerHTML =
      '<div class="empty-state">Saved places will appear here with their coordinates and notes.</div>';
    return;
  }

  els.placesList.innerHTML = state.places
    .map(
      (place) => `
        <article class="place-item">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(place.note)}</span>
          <small>${place.latitude}, ${place.longitude}</small>
          <small>Saved ${formatDate(place.timestamp)}</small>
        </article>
      `
    )
    .join("");
}

function generatePairCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `TETH-${digits}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cloneInitialState() {
  return JSON.parse(JSON.stringify(initialState));
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
