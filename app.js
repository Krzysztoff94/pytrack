
(() => {
  "use strict";

  // Jeden wspólny obiekt danych dla całej aplikacji.
  const STORAGE_KEY = "pytrack.data.v1";
  const $ = (id) => document.getElementById(id);

  const TASKS = [
    { id: "steps", icon: "🚶", title: "10 000 kroków", subtitle: "Dzienny cel kroków" },
    { id: "training", icon: "💪", title: "1 godzina treningu", subtitle: "Ruch, siłownia lub trening" },
    { id: "reading", icon: "📖", title: "20 stron książki", subtitle: "Codzienna porcja czytania" },
    { id: "learning", icon: "🐍", title: "1 godzina nauki", subtitle: "Python i rozwój zawodowy" }
  ];

  const emptyData = {
    sessions: [],
    dailyTasks: {},
    activeSession: null
  };

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        return structuredClone(emptyData);
      }

      return {
        sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
        dailyTasks: saved.dailyTasks && typeof saved.dailyTasks === "object"
          ? saved.dailyTasks : {},
        activeSession: saved.activeSession || null
      };
    } catch {
      return structuredClone(emptyData);
    }
  }

  let data = loadData();
  let tickHandle = null;
  let installPrompt = null;
  let heatmapMonth = new Date();
  heatmapMonth.setDate(1);

  const els = {
    topic: $("topicInput"),
    display: $("timerDisplay"),
    hint: $("timerHint"),
    status: $("statusPill"),
    start: $("startButton"),
    pause: $("pauseButton"),
    finish: $("finishButton"),
    message: $("timerMessage"),
    today: $("todayStat"),
    week: $("weekStat"),
    sessions: $("sessionsStat"),
    history: $("historyList"),
    empty: $("emptyHistory"),
    export: $("exportButton"),
    import: $("importInput"),
    clear: $("clearButton"),
    install: $("installButton")
  };

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }

  function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);

    if (minutes < 1) return "< 1 min";

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours} godz. ${remainingMinutes ? `${remainingMinutes} min` : ""}`.trim();
    }

    return `${minutes} min`;
  }

  function friendlyDate(iso) {
    return new Date(iso).toLocaleString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // ZAKŁADKI
  document.querySelectorAll(".nav-tab").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;

      document.querySelectorAll(".nav-tab").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      $("studyTab").classList.toggle("active", target === "study");
      $("dailyTab").classList.toggle("active", target === "daily");

      if (target === "daily") renderDaily();
    });
  });

  // TIMER
  function activeSeconds() {
    const active = data.activeSession;
    if (!active) return 0;

    if (active.pausedAt) {
      return Math.max(0, active.elapsedBeforePause || 0);
    }

    return Math.max(0, Math.floor((Date.now() - active.startedAt) / 1000));
  }

  function renderTimer() {
    const active = data.activeSession;
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

    els.hint.textContent = running
      ? "Skupienie trwa — dobra robota."
      : paused
        ? "Sesja jest wstrzymana."
        : "Każde 15 minut ma znaczenie.";
  }

  function startSession() {
    data.activeSession = {
      startedAt: Date.now(),
      topic: els.topic.value.trim(),
      pausedAt: null,
      elapsedBeforePause: 0
    };

    saveData();
    els.message.textContent = "";
    renderTimer();

    tickHandle = window.setInterval(renderTimer, 250);
  }

  function togglePause() {
    const active = data.activeSession;
    if (!active) return;

    if (!active.pausedAt) {
      active.elapsedBeforePause = activeSeconds();
      active.pausedAt = Date.now();

      if (tickHandle) clearInterval(tickHandle);
      tickHandle = null;
    } else {
      active.startedAt += Date.now() - active.pausedAt;
      active.pausedAt = null;

      tickHandle = window.setInterval(renderTimer, 250);
    }

    saveData();
    renderTimer();
  }

  function finishSession() {
    const active = data.activeSession;
    if (!active) return;

    const duration = activeSeconds();

    if (duration < 1) {
      els.message.textContent = "Sesja trwała krócej niż sekundę — nie została zapisana.";
      return;
    }

    data.sessions.unshift({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
      topic: active.topic || "Nauka Pythona",
      startedAt: new Date(active.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      duration
    });

    data.activeSession = null;

    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;

    saveData();
    els.topic.value = "";
    els.message.textContent = `Zapisano sesję: ${formatDuration(duration)}. Świetna robota!`;

    renderAll();
  }

  // STATYSTYKI
  function daySeconds(key) {
    return data.sessions.reduce((sum, session) => {
      return sum + (dateKey(session.endedAt) === key ? session.duration : 0);
    }, 0);
  }

  function renderStats() {
    const today = daySeconds(dateKey(new Date()));

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    const week = data.sessions.reduce((sum, session) => {
      return sum + (new Date(session.endedAt) >= weekStart ? session.duration : 0);
    }, 0);

    els.today.textContent = formatDuration(today);
    els.week.textContent = formatDuration(week);
    els.sessions.textContent = String(data.sessions.length);
  }

  // KALENDARZ NAUKI
  function renderHeatmap() {
    const heatmap = $("heatmap");
    heatmap.replaceChildren();

    const year = heatmapMonth.getFullYear();
    const month = heatmapMonth.getMonth();

    $("heatmapMonthLabel").textContent = heatmapMonth.toLocaleDateString("pl-PL", {
      month: "long",
      year: "numeric"
    });

    const byDay = new Map();

    for (const session of data.sessions) {
      const key = dateKey(session.endedAt);
      byDay.set(key, (byDay.get(key) || 0) + session.duration);
    }

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "heat-empty";
      heatmap.appendChild(empty);
    }

    let totalDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const seconds = byDay.get(dateKey(date)) || 0;

      if (seconds > 0) totalDays++;

      let level = 0;

      if (seconds > 0 && seconds < 1800) level = 1;
      else if (seconds < 3600 && seconds >= 1800) level = 2;
      else if (seconds <= 10800 && seconds >= 3600) level = 3;
      else if (seconds > 10800) level = 4;

      const cell = document.createElement("div");
      cell.className = `heat-cell level-${level}`;
      cell.textContent = day;
      cell.title = `${date.toLocaleDateString("pl-PL")}: ${formatDuration(seconds)}`;

      heatmap.appendChild(cell);
    }

    $("heatmapTotal").textContent = `${totalDays} dni z nauką`;
  }

  // HISTORIA SESJI
  function renderHistory() {
    els.history.replaceChildren();
    els.empty.classList.toggle("hidden", data.sessions.length > 0);

    data.sessions.slice(0, 12).forEach(session => {
      const item = document.createElement("article");
      item.className = "history-item";

      const mark = document.createElement("div");
      mark.className = "history-mark";
      mark.textContent = "⌘";

      const info = document.createElement("div");
      info.className = "history-info";

      const title = document.createElement("div");
      title.className = "history-title";
      title.textContent = session.topic || "Nauka Pythona";

      const date = document.createElement("div");
      date.className = "history-date";
      date.textContent = friendlyDate(session.endedAt);

      info.append(title, date);

      const duration = document.createElement("div");
      duration.className = "history-duration";
      duration.textContent = formatDuration(session.duration);

      const del = document.createElement("button");
      del.className = "delete-session";
      del.type = "button";
      del.textContent = "×";
      del.title = "Usuń sesję";

      del.addEventListener("click", () => {
        if (!confirm("Usunąć tę sesję z historii?")) return;

        data.sessions = data.sessions.filter(s => s.id !== session.id);
        saveData();
        renderAll();
      });

      item.append(mark, info, duration, del);
      els.history.appendChild(item);
    });
  }

  // CODZIENNE CELE
  function getDayTasks(key) {
    if (!data.dailyTasks[key]) {
      data.dailyTasks[key] = {};
    }

    return data.dailyTasks[key];
  }

  function renderDaily() {
    const todayKey = dateKey(new Date());
    const todayTasks = getDayTasks(todayKey);

    $("dailyDateLabel").textContent = new Date().toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    const completed = TASKS.filter(task => todayTasks[task.id] === true).length;
    const percent = completed / TASKS.length * 100;

    $("dailyProgress").textContent = `${completed}/${TASKS.length}`;
    $("dailyProgressBar").style.width = `${percent}%`;

    const list = $("dailyTasks");
    list.replaceChildren();

    TASKS.forEach(task => {
      const isDone = todayTasks[task.id] === true;

      const label = document.createElement("label");
      label.className = `daily-task${isDone ? " completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isDone;
      checkbox.setAttribute("aria-label", task.title);

      checkbox.addEventListener("change", () => {
        const day = getDayTasks(todayKey);

        if (checkbox.checked) {
          day[task.id] = true;
        } else {
          delete day[task.id];
        }

        saveData();
        renderDaily();
      });

      const icon = document.createElement("span");
      icon.className = "daily-task-icon";
      icon.textContent = task.icon;

      const textWrap = document.createElement("span");
      textWrap.className = "daily-task-text";

      const title = document.createElement("strong");
      title.textContent = task.title;

      const subtitle = document.createElement("small");
      subtitle.textContent = task.subtitle;

      textWrap.append(title, subtitle);

      const state = document.createElement("span");
      state.className = "daily-task-state";
      state.textContent = isDone ? "Zrobione" : "Do zrobienia";

      label.append(checkbox, icon, textWrap, state);
      list.appendChild(label);
    });

    renderDailyWeek();
  }

  function renderDailyWeek() {
    const container = $("dailyWeek");
    container.replaceChildren();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let total = 0;

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const key = dateKey(date);
      const record = data.dailyTasks[key] || {};

      const count = TASKS.filter(task => record[task.id] === true).length;
      total += count;

      const item = document.createElement("div");
      item.className = "daily-day";

      if (i === 0) item.classList.add("today");

      const day = document.createElement("span");
      day.className = "daily-day-name";
      day.textContent = date.toLocaleDateString("pl-PL", {
        weekday: "short"
      }).replace(".", "");

      const score = document.createElement("strong");
      score.textContent = `${count}/4`;

      const track = document.createElement("div");
      track.className = "mini-track";

      const fill = document.createElement("div");
      fill.className = "mini-fill";
      fill.style.width = `${count / 4 * 100}%`;

      track.appendChild(fill);

      const number = document.createElement("small");
      number.textContent = date.getDate();

      item.append(day, score, track, number);
      container.appendChild(item);
    }

    $("dailyWeekSummary").textContent = `${total}/28 celów`;
  }

  // EKSPORT I IMPORT
  function exportData() {
    const blob = new Blob([JSON.stringify({
      app: "PyTrack",
      version: 1,
      exportedAt: new Date().toISOString(),
      ...data
    }, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `pytrack-backup-${dateKey(new Date())}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function importData() {
    const file = els.import.files[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());

      if (!Array.isArray(parsed.sessions) || typeof parsed.dailyTasks !== "object") {
        throw new Error("Nieprawidłowy format");
      }

      if (!confirm("Import zastąpi obecne dane PyTrack. Kontynuować?")) return;

      data = {
        sessions: parsed.sessions,
        dailyTasks: parsed.dailyTasks || {},
        activeSession: parsed.activeSession || null
      };

      saveData();
      renderAll();
      els.message.textContent = "Dane zostały zaimportowane.";
    } catch {
      alert("Nie udało się odczytać pliku kopii zapasowej PyTrack.");
    } finally {
      els.import.value = "";
    }
  }

  // CZYSZCZENIE DANYCH
  function clearData() {
    if (!confirm("Usunąć wszystkie sesje nauki i codzienne cele? Tej operacji nie można cofnąć.")) {
      return;
    }

    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;

    data = {
      sessions: [],
      dailyTasks: {},
      activeSession: null
    };

    saveData();
    els.topic.value = "";
    els.message.textContent = "";
    renderAll();
  }

  function renderAll() {
    renderTimer();
    renderStats();
    renderHeatmap();
    renderHistory();
    renderDaily();
  }

  // OBSŁUGA PRZYCISKÓW
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
    if (confirm("Zakończyć i zapisać tę sesję?")) {
      finishSession();
    }
  });

  els.export.addEventListener("click", exportData);
  els.import.addEventListener("change", importData);
  els.clear.addEventListener("click", clearData);

  // INSTALACJA PWA
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    els.install.classList.remove("hidden");
  });

  els.install.addEventListener("click", async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    await installPrompt.userChoice;

    installPrompt = null;
    els.install.classList.add("hidden");
  });

  // SERVICE WORKER
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  // Przywrócenie aktywnej sesji po odświeżeniu strony.
  if (data.activeSession && !data.activeSession.pausedAt) {
    tickHandle = window.setInterval(renderTimer, 250);
  }

  renderAll();
})();
