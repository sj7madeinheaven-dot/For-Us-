import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  get,
  getDatabase,
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
import { appOptions, firebaseConfig } from "./firebase-config.js";

const themeStorageKey = "for-us-theme";

const els = {
  themeStatus: document.querySelector("#themeStatus"),
  lightThemeButton: document.querySelector("#lightThemeButton"),
  darkThemeButton: document.querySelector("#darkThemeButton"),
  authForm: document.querySelector("#authForm"),
  authModeToggle: document.querySelector("#authModeToggle"),
  authSubmit: document.querySelector("#authSubmit"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  displayName: document.querySelector("#displayName"),
  authStatus: document.querySelector("#authStatus"),
  accountName: document.querySelector("#accountName"),
  accountEmail: document.querySelector("#accountEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  configNotice: document.querySelector("#configNotice"),
  createRoomButton: document.querySelector("#createRoomButton"),
  joinRoomForm: document.querySelector("#joinRoomForm"),
  joinRoomCode: document.querySelector("#joinRoomCode"),
  activeRoomCode: document.querySelector("#activeRoomCode"),
  roomStatus: document.querySelector("#roomStatus"),
  leaveRoomButton: document.querySelector("#leaveRoomButton"),
  shareStatus: document.querySelector("#shareStatus"),
  toggleSharing: document.querySelector("#toggleSharing"),
  watchBadge: document.querySelector("#watchBadge"),
  lastUpdated: document.querySelector("#lastUpdated"),
  latitudeValue: document.querySelector("#latitudeValue"),
  longitudeValue: document.querySelector("#longitudeValue"),
  accuracyValue: document.querySelector("#accuracyValue"),
  partnerStatus: document.querySelector("#partnerStatus"),
  locationSummary: document.querySelector("#locationSummary"),
  partnerCoordinates: document.querySelector("#partnerCoordinates"),
  partnerTimestamp: document.querySelector("#partnerTimestamp"),
  messageList: document.querySelector("#messageList"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  placeForm: document.querySelector("#placeForm"),
  placeName: document.querySelector("#placeName"),
  placeNote: document.querySelector("#placeNote"),
  placesList: document.querySelector("#placesList"),
};

const state = {
  theme: loadTheme(),
  authMode: "sign-in",
  firebaseReady: isFirebaseConfigured(firebaseConfig),
  auth: null,
  db: null,
  user: null,
  profile: null,
  roomId: null,
  roomMembers: {},
  roomPresence: {},
  roomLocations: {},
  messages: [],
  places: [],
  myLocation: null,
  partnerMember: null,
  partnerLocation: null,
  sharingEnabled: false,
};

let locationWatchId = null;
let profileUnsubscribe = null;
let roomUnsubscribers = [];

bindEvents();
applyTheme();
render();

if (state.firebaseReady) {
  const app = initializeApp(firebaseConfig);
  state.auth = getAuth(app);
  state.db = getDatabase(app);
  initFirebaseSession();
} else {
  setStatus(
    "Add your Firebase project values to firebase-config.js before signing in.",
    "info"
  );
}

function bindEvents() {
  els.lightThemeButton.addEventListener("click", () => {
    state.theme = "light";
    saveTheme();
    applyTheme();
  });

  els.darkThemeButton.addEventListener("click", () => {
    state.theme = "dark";
    saveTheme();
    applyTheme();
  });

  els.authModeToggle.addEventListener("click", () => {
    state.authMode = state.authMode === "sign-in" ? "sign-up" : "sign-in";
    renderAuthMode();
  });

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.firebaseReady) {
      return;
    }

    const email = els.authEmail.value.trim();
    const password = els.authPassword.value.trim();
    const displayName = els.displayName.value.trim();

    if (!email || !password) {
      setStatus("Email and password are required.", "error");
      return;
    }

    try {
      if (state.authMode === "sign-up") {
        if (!displayName) {
          setStatus("Pick a display name before creating an account.", "error");
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          state.auth,
          email,
          password
        );
        await updateProfile(credential.user, { displayName });
        await writeUserProfile(credential.user, null, displayName);
        setStatus("Account created. You can pair with your partner now.", "success");
      } else {
        await signInWithEmailAndPassword(state.auth, email, password);
        setStatus("Signed in successfully.", "success");
      }

      els.authPassword.value = "";
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.logoutButton.addEventListener("click", async () => {
    if (!state.auth) {
      return;
    }

    try {
      stopLocationSharing();
      await signOut(state.auth);
      setStatus("Signed out.", "info");
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.createRoomButton.addEventListener("click", async () => {
    if (!requireUser()) {
      return;
    }

    const roomId = generateRoomCode();

    try {
      await set(ref(state.db, `rooms/${roomId}/meta`), {
        createdAt: serverTimestamp(),
        createdBy: state.user.uid,
      });
      await set(ref(state.db, `roomCodes/${roomId}`), {
        createdAt: serverTimestamp(),
        createdBy: state.user.uid,
      });
      await joinRoom(roomId);
      setStatus(`Room ${roomId} created. Share the code with your partner.`, "success");
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.joinRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireUser()) {
      return;
    }

    const roomId = els.joinRoomCode.value.trim().toUpperCase();
    if (!roomId) {
      setStatus("Enter a room code to join.", "error");
      return;
    }

    try {
      const roomSnapshot = await get(ref(state.db, `roomCodes/${roomId}`));
      if (!roomSnapshot.exists()) {
        setStatus("That room code was not found.", "error");
        return;
      }

      await joinRoom(roomId);
      els.joinRoomCode.value = "";
      setStatus(`Joined room ${roomId}.`, "success");
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.leaveRoomButton.addEventListener("click", async () => {
    if (!state.user || !state.roomId) {
      return;
    }

    try {
      stopLocationSharing();
      await remove(ref(state.db, `rooms/${state.roomId}/members/${state.user.uid}`));
      await remove(ref(state.db, `rooms/${state.roomId}/presence/${state.user.uid}`));
      await remove(ref(state.db, `rooms/${state.roomId}/locations/${state.user.uid}`));
      await writeUserProfile(state.user, null);
      setStatus("You left the room.", "info");
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.toggleSharing.addEventListener("click", async () => {
    if (!requireRoom()) {
      return;
    }

    if (state.sharingEnabled) {
      stopLocationSharing();
      setStatus("Live location paused.", "info");
      return;
    }

    await startLocationSharing();
  });

  els.messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireRoom()) {
      return;
    }

    const text = els.messageInput.value.trim();
    if (!text) {
      return;
    }

    try {
      const messageRef = push(ref(state.db, `rooms/${state.roomId}/messages`));
      await set(messageRef, {
        authorId: state.user.uid,
        authorName: getDisplayName(),
        text,
        createdAt: serverTimestamp(),
      });
      els.messageInput.value = "";
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });

  els.placeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireRoom()) {
      return;
    }

    if (!state.myLocation) {
      setStatus("Turn on location sharing before saving a place.", "error");
      return;
    }

    const name = els.placeName.value.trim() || "Pinned place";
    const note = els.placeNote.value.trim() || "Saved from live location";

    try {
      const placeRef = push(ref(state.db, `rooms/${state.roomId}/places`));
      await set(placeRef, {
        authorId: state.user.uid,
        authorName: getDisplayName(),
        name,
        note,
        latitude: roundCoord(state.myLocation.latitude),
        longitude: roundCoord(state.myLocation.longitude),
        accuracy: Math.round(state.myLocation.accuracy),
        createdAt: serverTimestamp(),
      });
      els.placeName.value = "";
      els.placeNote.value = "";
      setStatus("Place saved to the shared room.", "success");
    } catch (error) {
      setStatus(normalizeFirebaseError(error), "error");
    }
  });
}

function initFirebaseSession() {
  onAuthStateChanged(state.auth, async (user) => {
    clearRoomSubscriptions();
    if (profileUnsubscribe) {
      profileUnsubscribe();
      profileUnsubscribe = null;
    }

    stopLocationSharing(false);

    state.user = user;
    state.profile = null;
    state.roomId = null;
    state.roomMembers = {};
    state.roomPresence = {};
    state.roomLocations = {};
    state.messages = [];
    state.places = [];
    state.myLocation = null;
    state.partnerMember = null;
    state.partnerLocation = null;
    state.sharingEnabled = false;

    if (!user) {
      render();
      return;
    }

    await writeUserProfile(user);
    subscribeToUserProfile(user.uid);
    render();
  });
}

function subscribeToUserProfile(uid) {
  profileUnsubscribe = onValue(ref(state.db, `users/${uid}`), (snapshot) => {
    state.profile = snapshot.val() || null;
    const nextRoomId = state.profile?.roomId || null;
    if (nextRoomId !== state.roomId) {
      state.roomId = nextRoomId;
      subscribeToRoom(nextRoomId);
    }
    render();
  });
}

function subscribeToRoom(roomId) {
  clearRoomSubscriptions();

  if (!roomId || !state.user) {
    state.roomMembers = {};
    state.roomPresence = {};
    state.roomLocations = {};
    state.messages = [];
    state.places = [];
    state.partnerMember = null;
    state.partnerLocation = null;
    render();
    return;
  }

  const messagesRef = query(
    ref(state.db, `rooms/${roomId}/messages`),
    orderByChild("createdAt"),
    limitToLast(appOptions.maxMessages)
  );
  const placesRef = query(
    ref(state.db, `rooms/${roomId}/places`),
    orderByChild("createdAt"),
    limitToLast(appOptions.maxPlaces)
  );

  roomUnsubscribers.push(
    onValue(ref(state.db, `rooms/${roomId}/members`), (snapshot) => {
      state.roomMembers = snapshot.val() || {};
      syncPartnerState();
      renderHeader();
    })
  );

  roomUnsubscribers.push(
    onValue(ref(state.db, `rooms/${roomId}/presence`), (snapshot) => {
      state.roomPresence = snapshot.val() || {};
      syncPartnerState();
      renderHeader();
    })
  );

  roomUnsubscribers.push(
    onValue(ref(state.db, `rooms/${roomId}/locations`), (snapshot) => {
      state.roomLocations = snapshot.val() || {};
      state.myLocation = state.roomLocations[state.user.uid] || state.myLocation;
      syncPartnerState();
      renderLocation();
    })
  );

  roomUnsubscribers.push(
    onValue(messagesRef, (snapshot) => {
      state.messages = snapshotToArray(snapshot).sort(sortByCreatedAtDesc);
      renderMessages();
    })
  );

  roomUnsubscribers.push(
    onValue(placesRef, (snapshot) => {
      state.places = snapshotToArray(snapshot).sort(sortByCreatedAtDesc);
      renderPlaces();
    })
  );

  setupPresence(roomId).catch((error) => {
    setStatus(normalizeFirebaseError(error), "error");
  });
}

async function joinRoom(roomId) {
  await update(ref(state.db, `rooms/${roomId}/members/${state.user.uid}`), {
    uid: state.user.uid,
    displayName: getDisplayName(),
    email: state.user.email || "",
    joinedAt: serverTimestamp(),
  });

  await writeUserProfile(state.user, roomId);
}

async function writeUserProfile(user, roomId, preferredName) {
  const payload = {
    email: user.email || "",
    displayName:
      preferredName ||
      user.displayName ||
      els.displayName.value.trim() ||
      user.email?.split("@")[0] ||
      "Partner",
    updatedAt: serverTimestamp(),
  };

  if (roomId !== undefined) {
    payload.roomId = roomId;
  }

  await update(ref(state.db, `users/${user.uid}`), payload);
}

async function setupPresence(roomId) {
  const connectedRef = ref(state.db, ".info/connected");
  const userPresenceRef = ref(state.db, `rooms/${roomId}/presence/${state.user.uid}`);

  roomUnsubscribers.push(
    onValue(connectedRef, async (snapshot) => {
      if (snapshot.val() !== true || !state.user || !state.roomId) {
        return;
      }

      await onDisconnect(userPresenceRef).set({
        state: "offline",
        displayName: getDisplayName(),
        lastChanged: serverTimestamp(),
      });

      await set(userPresenceRef, {
        state: "online",
        displayName: getDisplayName(),
        lastChanged: serverTimestamp(),
      });
    })
  );
}

async function startLocationSharing() {
  if (!("geolocation" in navigator)) {
    setStatus("This browser does not support geolocation.", "error");
    return;
  }

  state.sharingEnabled = true;
  renderHeader();

  locationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const payload = {
        uid: state.user.uid,
        displayName: getDisplayName(),
        latitude: roundCoord(position.coords.latitude),
        longitude: roundCoord(position.coords.longitude),
        accuracy: Math.round(position.coords.accuracy),
        sharing: true,
        updatedAt: Date.now(),
      };

      state.myLocation = payload;
      renderLocation();

      try {
        await set(ref(state.db, `rooms/${state.roomId}/locations/${state.user.uid}`), payload);
      } catch (error) {
        setStatus(normalizeFirebaseError(error), "error");
      }
    },
    (error) => {
      state.sharingEnabled = false;
      renderHeader();
      setStatus(`Location access failed: ${error.message}`, "error");
    },
    {
      enableHighAccuracy: true,
      maximumAge: appOptions.locationThrottleMs,
      timeout: 15000,
    }
  );

  setStatus("Live location is on.", "success");
}

function stopLocationSharing(removeRemote = true) {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }

  state.sharingEnabled = false;

  if (removeRemote && state.db && state.user && state.roomId) {
    update(ref(state.db, `rooms/${state.roomId}/locations/${state.user.uid}`), {
      sharing: false,
      updatedAt: Date.now(),
    }).catch(() => {});
  }

  renderHeader();
}

function clearRoomSubscriptions() {
  for (const unsubscribe of roomUnsubscribers) {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  }

  roomUnsubscribers = [];
}

function syncPartnerState() {
  if (!state.user) {
    state.partnerMember = null;
    state.partnerLocation = null;
    return;
  }

  const partnerEntry = Object.entries(state.roomMembers).find(
    ([uid]) => uid !== state.user.uid
  );

  state.partnerMember = partnerEntry ? partnerEntry[1] : null;
  state.partnerLocation = partnerEntry
    ? state.roomLocations[partnerEntry[0]] || null
    : null;
}

function render() {
  renderTheme();
  renderAuthMode();
  renderHeader();
  renderLocation();
  renderMessages();
  renderPlaces();
}

function renderTheme() {
  const darkMode = state.theme === "dark";
  els.themeStatus.textContent = darkMode ? "Dark" : "Light";
  els.lightThemeButton.classList.toggle("active-theme", !darkMode);
  els.darkThemeButton.classList.toggle("active-theme", darkMode);
}

function renderAuthMode() {
  const signUp = state.authMode === "sign-up";
  els.authSubmit.textContent = signUp ? "Create account" : "Sign in";
  els.authModeToggle.textContent = signUp ? "Switch to Sign in" : "Switch to Sign up";
}

function renderHeader() {
  const signedIn = Boolean(state.user);
  const hasRoom = Boolean(state.roomId);
  const partnerPresence = state.partnerMember
    ? state.roomPresence[getPartnerUid()]?.state || "paired"
    : "waiting";

  els.configNotice.style.display = state.firebaseReady ? "none" : "block";
  els.authStatus.textContent = signedIn ? "Signed in" : "Signed out";
  els.accountName.textContent = signedIn ? getDisplayName() : "Not connected";
  els.accountEmail.textContent = signedIn
    ? state.user.email || "Authenticated user"
    : "Sign in to create or join a shared room.";
  els.logoutButton.disabled = !signedIn;
  els.createRoomButton.disabled = !signedIn;
  els.leaveRoomButton.disabled = !hasRoom;
  els.toggleSharing.disabled = !(signedIn && hasRoom);
  els.roomStatus.textContent = hasRoom ? "Active room" : "No room";
  els.activeRoomCode.textContent = hasRoom ? state.roomId : "Not joined";
  els.shareStatus.textContent = state.sharingEnabled ? "Sharing live" : "Paused";
  els.watchBadge.textContent = state.sharingEnabled ? "Live" : "Offline";
  els.watchBadge.className = `badge ${
    state.sharingEnabled ? "badge-online" : "badge-offline"
  }`;
  els.toggleSharing.textContent = state.sharingEnabled
    ? "Stop sharing"
    : "Start sharing";
  els.partnerStatus.textContent = formatPartnerStatus(partnerPresence);
}

function renderLocation() {
  if (state.myLocation) {
    els.latitudeValue.textContent = Number(state.myLocation.latitude).toFixed(4);
    els.longitudeValue.textContent = Number(state.myLocation.longitude).toFixed(4);
    els.accuracyValue.textContent = `${state.myLocation.accuracy} m`;
  } else {
    els.latitudeValue.textContent = "--";
    els.longitudeValue.textContent = "--";
    els.accuracyValue.textContent = "--";
  }

  if (!state.myLocation && !state.partnerLocation) {
    els.lastUpdated.textContent = "No live data";
    els.locationSummary.textContent =
      "Sign in, join a room, and start sharing to publish your live coordinates to your partner.";
  } else if (state.partnerLocation) {
    els.lastUpdated.textContent = formatDate(state.partnerLocation.updatedAt);
    els.locationSummary.textContent = `${getDisplayName()} and ${
      state.partnerMember?.displayName || "your partner"
    } are connected through room ${state.roomId}.`;
  } else {
    els.lastUpdated.textContent = formatDate(state.myLocation?.updatedAt);
    els.locationSummary.textContent =
      "Your location is publishing. Your partner will appear here once they join and share.";
  }

  if (!state.partnerLocation) {
    els.partnerCoordinates.textContent = "No partner location yet";
    els.partnerTimestamp.textContent = "Their latest update will appear here.";
    return;
  }

  els.partnerCoordinates.textContent = `${state.partnerMember?.displayName || "Partner"}: ${Number(
    state.partnerLocation.latitude
  ).toFixed(4)}, ${Number(state.partnerLocation.longitude).toFixed(4)}`;
  els.partnerTimestamp.textContent = `Updated ${formatDate(
    state.partnerLocation.updatedAt
  )} with ${state.partnerLocation.accuracy}m accuracy.`;
}

function renderMessages() {
  if (!state.messages.length) {
    els.messageList.innerHTML =
      '<div class="empty-state">Room messages will appear here as soon as one of you sends the first note.</div>';
    return;
  }

  els.messageList.innerHTML = state.messages
    .map((message) => {
      const className = message.authorId === state.user?.uid ? "message self" : "message";
      return `
        <article class="${className}">
          <strong>${escapeHtml(message.authorName || "Partner")}</strong>
          <span>${escapeHtml(message.text || "")}</span>
          <small>${formatDate(message.createdAt)}</small>
        </article>
      `;
    })
    .join("");
}

function renderPlaces() {
  if (!state.places.length) {
    els.placesList.innerHTML =
      '<div class="empty-state">Saved places will show up here with coordinates, notes, and who pinned them.</div>';
    return;
  }

  els.placesList.innerHTML = state.places
    .map(
      (place) => `
        <article class="place-item">
          <strong>${escapeHtml(place.name || "Pinned place")}</strong>
          <span>${escapeHtml(place.note || "")}</span>
          <small>${escapeHtml(place.authorName || "Partner")} saved ${formatDate(
            place.createdAt
          )}</small>
          <small>${Number(place.latitude).toFixed(4)}, ${Number(place.longitude).toFixed(4)}</small>
        </article>
      `
    )
    .join("");
}

function requireUser() {
  if (state.user) {
    return true;
  }

  setStatus("Sign in first.", "error");
  return false;
}

function requireRoom() {
  if (state.user && state.roomId) {
    return true;
  }

  setStatus("Create or join a room first.", "error");
  return false;
}

function snapshotToArray(snapshot) {
  if (!snapshot.exists()) {
    return [];
  }

  return Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value }));
}

function sortByCreatedAtDesc(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function setStatus(message, tone) {
  els.authStatus.textContent = tone === "error" ? "Needs attention" : "Updated";
  els.accountEmail.textContent = message;
}

function getDisplayName() {
  return (
    state.user?.displayName ||
    state.profile?.displayName ||
    els.displayName.value.trim() ||
    state.user?.email?.split("@")[0] ||
    "Partner"
  );
}

function getPartnerUid() {
  return Object.keys(state.roomMembers).find((uid) => uid !== state.user?.uid) || null;
}

function generateRoomCode() {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TETH-${token}`;
}

function roundCoord(value) {
  return Number(value.toFixed(6));
}

function formatDate(value) {
  if (!value) {
    return "just now";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPartnerStatus(status) {
  if (status === "online") {
    return "Partner online";
  }

  if (status === "offline") {
    return "Partner offline";
  }

  if (state.partnerMember) {
    return "Partner paired";
  }

  return "Waiting for room";
}

function loadTheme() {
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  return savedTheme === "dark" ? "dark" : "light";
}

function saveTheme() {
  window.localStorage.setItem(themeStorageKey, state.theme);
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  renderTheme();
}

function normalizeFirebaseError(error) {
  return (
    error?.message
      ?.replace("Firebase: ", "")
      .replace(/\(auth\/|\)\.?/g, "")
      .trim() || "Something went wrong."
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isFirebaseConfigured(config) {
  return Boolean(
    config &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.databaseURL &&
      !String(config.apiKey).includes("YOUR_")
  );
}
