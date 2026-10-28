(() => {
  "use strict";
  const STORAGE_KEY = "pytrack.sessions.v1";
  const ACTIVE_KEY = "pytrack.active.v1";
  const $ = (id) => document.getElementById(id);
  const els = {
    topic: $("topicInput"), display: $("timerDisplay"), hint: $("timerHint"),
    status: $("statusPill"), start: $("startButton"), pause: $("pauseButton"),
    finish: $("finishButton"), message: $("timerMessage"), today: $("todayStat"),
    week: $("weekStat"), sessions: $("sessionsStat"), heatmap: $("heatmap"),
    heatmapTotal: $("heatmapTotal"), history: $("historyList"),
    empty: $("emptyHistory"), export: $("exportButton"), import: $("importInput"),
    clear: $("clearButton"), install: $("installButton")
  };
  let sessions = loadSessions();
  let active = loadActive();
  let tickHandle = null;
  let installPrompt = null;

  function loadSessions() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(s => s && typeof s.id === "string" && Number.isFinite(s.duration) && s.duration >= 0) : [];
    } catch { return []; }
  }
  function loadActive() {
    try {
      const value = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "null");
      if (!value || !Number.isFinite(value.startedAt)) return null;
      if (value.pausedAt && !Number.isFinite(value.elapsedBeforePause)) return null;
      return value;
    } catch { return null; }
  }
  function saveSessions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
  function saveActive() {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function formatClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds % 3600 / 60))}:${pad(seconds % 60)}`;
  }
  function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 1) return "< 1 min";
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h} godz. ${m ? `${m} min` : ""}`.trim() : `${m} min`;
  }
  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function friendlyDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }
  function activeSeconds() {
    if (!active) return 0;
    if (active.pausedAt) return Math.max(0, active.elapsedBeforePause || 0);
    return Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
  }
  function renderTimer() {
    const running = active && !active.pausedAt;
    const paused = active && !!active.pausedAt;
    els.display.textContent = formatClock(activeSeconds());
    els.status.textContent = running ? "W trakcie" : paused ? "Wstrzymano" : "Gotowy";
    els.status.className = "status-pill" + (running ? " running" : paused ? " paused" : "");
    els.start.classList.toggle("hidden", !!active);
    els.pause.classList.toggle("hidden", !active);
    els.finish.classList.toggle("hidden", !active);
    els.pause.textContent = paused ? "▶ Wznów" : "Ⅱ Wstrzymaj";
    els.topic.disabled = !!active;
    els.hint.textContent = running ? "Skupienie trwa — dobra robota." : paused ? "Sesja jest wstrzymana." : "Każde 15 minut ma znaczenie.";
  }
  function startSession() {
    active = { startedAt: Date.now(), topic: els.topic.value.trim(), pausedAt: null, elapsedBeforePause: 0 };
    saveActive();
    els.message.textContent = "";
    renderTimer();
    tickHandle = window.setInterval(renderTimer, 250);
  }
  function togglePause() {
    if (!active) return;
    if (!active.pausedAt) {
      active.elapsedBeforePause = activeSeconds();
      active.pausedAt = Date.now();
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = null;
    } else {
      const pausedDuration = Date.now() - active.pausedAt;
      active.startedAt += pausedDuration;
      active.pausedAt = null;
      tickHandle = window.setInterval(renderTimer, 250);
    }
    saveActive(); renderTimer();
  }
  function finishSession() {
    if (!active) return;
    const duration = activeSeconds();
    if (duration < 1) {
      els.message.textContent = "Sesja trwała krócej niż sekundę — nie została zapisana.";
      return;
    }
    sessions.unshift({
      id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      topic: active.topic || "Nauka Pythona",
      startedAt: new Date(active.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      duration
    });
    saveSessions();
    active = null; saveActive();
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
    els.topic.value = "";
    els.message.textContent = `Zapisano sesję: ${formatDuration(duration)}. Świetna robota!`;
    renderAll();
  }
  function daySeconds(key) {
    return sessions.reduce((sum, s) => sum + (dateKey(s.endedAt) === key ? s.duration : 0), 0);
  }
  function renderStats() {
    const today = dateKey(new Date());
    const todaySeconds = daySeconds(today);
    const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate()-6);
    const weekSeconds = sessions.reduce((sum,s) => sum + (new Date(s.endedAt) >= weekStart ? s.duration : 0), 0);
    els.today.textContent = formatDuration(todaySeconds);
    els.week.textContent = formatDuration(weekSeconds);
    els.sessions.textContent = String(sessions.length);
  }
  
let heatmapMonth = new Date();
heatmapMonth.setDate(1);

function renderHeatmap() {
  const heatmap = $("heatmap");
  const monthLabel = $("heatmapMonthLabel");
  const totalLabel = $("heatmapTotal");

  if (!heatmap || !monthLabel || !totalLabel) return;

  heatmap.replaceChildren();

  const year = heatmapMonth.getFullYear();
  const month = heatmapMonth.getMonth();

  monthLabel.textContent = heatmapMonth.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric"
  });

  // Sumujemy czas wszystkich sesji według dnia zakończenia.
  const byDay = new Map();

  for (const s of sessions) {
    const key = dateKey(s.endedAt);
    byDay.set(key, (byDay.get(key) || 0) + s.duration);
  }

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Poniedziałek = 0, wtorek = 1, ..., niedziela = 6.
  const offset = (firstDay.getDay() + 6) % 7;

  // Puste miejsca przed pierwszym dniem miesiąca.
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "heat-empty";
    heatmap.appendChild(empty);
  }

  let totalDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const seconds = byDay.get(key) || 0;

    if (seconds > 0) totalDays++;

    // Poziomy intensywności. Poziom 4: ponad 3 godziny.
    let level = 0;

    if (seconds > 0 && seconds < 1800) {
      level = 1;
    } else if (seconds < 3600 && seconds >= 1800) {
      level = 2;
    } else if (seconds <= 10800 && seconds >= 3600) {
      level = 3;
    } else if (seconds > 10800) {
      level = 4;
    }

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `heat-cell level-${level}`;
    cell.textContent = day;
    cell.title = `${date.toLocaleDateString("pl-PL")}: ${formatDuration(seconds)}`;
    cell.setAttribute("aria-label", cell.title);

    heatmap.appendChild(cell);
  }

  totalLabel.textContent = `${totalDays} ${totalDays === 1 ? "dzień" : "dni"} z nauką`;
}

  function renderHistory() {
    els.history.replaceChildren();
    els.empty.classList.toggle("hidden", sessions.length > 0);
    const shown = sessions.slice(0, 12);
    for (const s of shown) {
      const item = document.createElement("article"); item.className = "history-item";
      const mark = document.createElement("div"); mark.className = "history-mark"; mark.textContent = "⌘";
      const info = document.createElement("div"); info.className = "history-info";
      const title = document.createElement("div"); title.className = "history-title"; title.textContent = s.topic || "Nauka Pythona";
      const date = document.createElement("div"); date.className = "history-date"; date.textContent = friendlyDate(s.endedAt);
      info.append(title,date);
      const duration = document.createElement("div"); duration.className = "history-duration"; duration.textContent = formatDuration(s.duration);
      const del = document.createElement("button"); del.className = "delete-session"; del.type = "button"; del.textContent = "×"; del.title = "Usuń sesję"; del.setAttribute("aria-label", `Usuń sesję: ${s.topic || "Nauka Pythona"}`);
      del.addEventListener("click", () => {
        if (!confirm("Usunąć tę sesję z historii?")) return;
        sessions = sessions.filter(x => x.id !== s.id); saveSessions(); renderAll();
      });
      item.append(mark,info,duration,del); els.history.appendChild(item);
    }
  }
  function renderAll() { renderTimer(); renderStats(); renderHeatmap(); renderHistory(); }
  
  $("prevMonthBtn").addEventListener("click", () => {
    heatmapMonth.setMonth(heatmapMonth.getMonth() - 1);
    renderHeatmap();
  });

  $("nextMonthBtn").addEventListener("click", () => {
    heatmapMonth.setMonth(heatmapMonth.getMonth() + 1);
    renderHeatmap();
  });

  els.start.addEventListener("click", startSession);
  els.pause.addEventListener("click", togglePause);
  els.finish.addEventListener("click", () => {
    if (confirm("Zakończyć i zapisać tę sesję?")) finishSession();
  });
  els.export.addEventListener("click", () => {
    const payload = { app: "PyTrack", version: 1, exportedAt: new Date().toISOString(), sessions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `pytrack-backup-${dateKey(new Date())}.json`; a.click();
    URL.revokeObjectURL(url);
  });
  els.import.addEventListener("change", async () => {
    const file = els.import.files && els.import.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.sessions;
      if (!Array.isArray(incoming) || incoming.some(s => !s || typeof s.id !== "string" || !Number.isFinite(s.duration) || typeof s.endedAt !== "string")) throw new Error("invalid");
      if (!confirm(`Zaimportować ${incoming.length} sesji? Dane zostaną połączone z obecną historią.`)) return;
      const merged = new Map(sessions.map(s => [s.id, s]));
      incoming.forEach(s => merged.set(s.id, {...s, topic: String(s.topic || "Nauka Pythona")}));
      sessions = [...merged.values()].sort((a,b) => new Date(b.endedAt)-new Date(a.endedAt));
      saveSessions(); renderAll(); els.message.textContent = "Kopia zapasowa została zaimportowana.";
    } catch { alert("Nie udało się odczytać pliku. Wybierz kopię zapasową PyTrack w formacie JSON."); }
    finally { els.import.value = ""; }
  });
  els.clear.addEventListener("click", () => {
    if (!confirm("Na pewno wyczyścić całą historię? Najpierw wyeksportuj kopię, jeśli chcesz zachować dane.")) return;
    sessions = []; saveSessions(); renderAll();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); installPrompt = event; els.install.classList.remove("hidden");
  });
  els.install.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; els.install.classList.add("hidden");
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
  if (active && !active.pausedAt) tickHandle = window.setInterval(renderTimer, 250);
  renderAll();
})();
