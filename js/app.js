(() => {
  const STORAGE_KEY = "nadgodziny-pl-v1";
  const DEFAULT_SALARY = 5265;

  const els = {
    salary: document.getElementById("salary"),
    month: document.getElementById("month"),
    nominalHours: document.getElementById("nominalHours"),
    nominalHint: document.getElementById("nominalHint"),
    settingsForm: document.getElementById("settingsForm"),
    entryForm: document.getElementById("entryForm"),
    entryDate: document.getElementById("entryDate"),
    entryHours: document.getElementById("entryHours"),
    entryType: document.getElementById("entryType"),
    entryNote: document.getElementById("entryNote"),
    typePreview: document.getElementById("typePreview"),
    entryList: document.getElementById("entryList"),
    listCount: document.getElementById("listCount"),
    clearMonthBtn: document.getElementById("clearMonthBtn"),
    totalPay: document.getElementById("totalPay"),
    totalHours: document.getElementById("totalHours"),
    hourlyRate: document.getElementById("hourlyRate"),
    monthLabel: document.getElementById("monthLabel"),
    installBtn: document.getElementById("installBtn"),
    toast: document.getElementById("toast"),
  };

  let state = loadState();
  let deferredPrompt = null;
  let nominalManual = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        salary: Number(parsed.salary) || DEFAULT_SALARY,
        month: parsed.month || currentMonthValue(),
        nominalHours: Number(parsed.nominalHours) || null,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch {
      return defaultState();
    }
  }

  function defaultState() {
    const month = currentMonthValue();
    const [y, m] = month.split("-").map(Number);
    return {
      salary: DEFAULT_SALARY,
      month,
      nominalHours: PLHolidays.nominalHoursForMonth(y, m - 1),
      entries: [],
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function parseMonth(value) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, monthIndex: m - 1 };
  }

  function formatMoney(n) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function formatHours(n) {
    return new Intl.NumberFormat("pl-PL", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function formatDateLabel(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }

  function monthTitle(value) {
    const { year, monthIndex } = parseMonth(value);
    const d = new Date(year, monthIndex, 1);
    return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(d);
  }

  function resolveRateType(isoDate, override) {
    if (override === "50" || override === "100") {
      return {
        rate: Number(override),
        reason: override === "100" ? "Ustawiono ręcznie: 100%" : "Ustawiono ręcznie: 50%",
      };
    }
    const d = new Date(`${isoDate}T12:00:00`);
    const weekday = d.getDay();
    const holiday = PLHolidays.holidayName(d);
    if (holiday) {
      return { rate: 100, reason: `Święto: ${holiday} → 100%` };
    }
    if (weekday === 0 || weekday === 6) {
      return { rate: 100, reason: "Weekend → 100%" };
    }
    return { rate: 50, reason: "Dzień powszedni → 50%" };
  }

  function hourlyRate() {
    const hours = Number(state.nominalHours) || 1;
    return state.salary / hours;
  }

  /** Wypłata za nadgodzinę = stawka × (1 + premia/100), zaokrąglenie do 1 grosza. */
  function payForEntry(entry, rate) {
    const multiplier = 1 + entry.rate / 100;
    return Math.round(entry.hours * rate * multiplier * 100) / 100;
  }

  function entriesForMonth() {
    return state.entries
      .filter((e) => e.date.startsWith(state.month))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  function showToast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.classList.remove("show");
      setTimeout(() => {
        els.toast.hidden = true;
      }, 250);
    }, 2200);
  }

  function syncNominalFromMonth(force) {
    if (nominalManual && !force) return;
    const { year, monthIndex } = parseMonth(els.month.value || state.month);
    const auto = PLHolidays.nominalHoursForMonth(year, monthIndex);
    els.nominalHours.value = String(auto);
    els.nominalHint.textContent = `Wyliczone automatycznie: ${auto} h (dni robocze × 8 h)`;
    if (force) nominalManual = false;
  }

  function updateTypePreview() {
    const date = els.entryDate.value;
    if (!date) {
      els.typePreview.textContent = "Wybierz datę, aby zobaczyć typ dopłaty.";
      return;
    }
    const override = els.entryType.value === "auto" ? "auto" : els.entryType.value;
    const resolved = resolveRateType(date, override);
    els.typePreview.textContent = resolved.reason;
  }

  function render() {
    const rate = hourlyRate();
    const monthEntries = entriesForMonth();
    const totalHours = monthEntries.reduce((s, e) => s + e.hours, 0);
    const totalPay = monthEntries.reduce((s, e) => s + payForEntry(e, rate), 0);

    els.monthLabel.textContent = monthTitle(state.month);
    els.hourlyRate.textContent = formatMoney(rate);
    els.totalHours.textContent = formatHours(totalHours);
    els.totalPay.textContent = formatMoney(totalPay);

    if (!monthEntries.length) {
      els.listCount.textContent = "Brak wpisów w tym miesiącu.";
      els.clearMonthBtn.hidden = true;
      els.entryList.innerHTML = `<li class="empty">Dodaj pierwsze nadgodziny powyżej.</li>`;
      return;
    }

    els.listCount.textContent = `${monthEntries.length} ${pluralEntries(monthEntries.length)} · ${formatHours(totalHours)} h`;
    els.clearMonthBtn.hidden = false;
    els.entryList.innerHTML = monthEntries
      .map((entry) => {
        const pay = payForEntry(entry, rate);
        const badgeClass = entry.rate === 100 ? "weekend" : "";
        const note = entry.note ? ` · ${escapeHtml(entry.note)}` : "";
        return `
          <li class="entry-item" data-id="${entry.id}">
            <div class="entry-main">
              <div class="entry-date">
                ${escapeHtml(formatDateLabel(entry.date))}
                <span class="badge ${badgeClass}">+${entry.rate}%</span>
              </div>
              <div class="entry-meta">${formatHours(entry.hours)} h${note}</div>
            </div>
            <div class="entry-pay">${formatMoney(pay)}</div>
            <div class="entry-actions">
              <button type="button" class="btn ghost danger" data-delete="${entry.id}">Usuń</button>
            </div>
          </li>
        `;
      })
      .join("");
  }

  function pluralEntries(n) {
    if (n === 1) return "wpis";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "wpisy";
    return "wpisów";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // Init form values
  els.salary.value = String(state.salary);
  els.month.value = state.month;
  if (state.nominalHours) {
    els.nominalHours.value = String(state.nominalHours);
    els.nominalHint.textContent = "Możesz zmienić ręcznie lub wrócić do auto przy zmianie miesiąca.";
  } else {
    syncNominalFromMonth(true);
    state.nominalHours = Number(els.nominalHours.value);
  }
  els.entryDate.value = PLHolidays.ymd(new Date());
  updateTypePreview();
  render();

  els.month.addEventListener("change", () => {
    nominalManual = false;
    syncNominalFromMonth(true);
    state.month = els.month.value;
    state.nominalHours = Number(els.nominalHours.value);
    saveState();
    render();
  });

  els.nominalHours.addEventListener("input", () => {
    nominalManual = true;
    els.nominalHint.textContent = "Ustawione ręcznie.";
  });

  els.entryDate.addEventListener("change", updateTypePreview);
  els.entryType.addEventListener("change", updateTypePreview);

  els.settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const { year, monthIndex } = parseMonth(els.month.value);
    state.salary = Number(els.salary.value) || DEFAULT_SALARY;
    state.month = els.month.value;
    state.nominalHours =
      Number(els.nominalHours.value) || PLHolidays.nominalHoursForMonth(year, monthIndex);
    saveState();
    render();
    showToast("Ustawienia zapisane");
  });

  els.entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = els.entryDate.value;
    const hours = Number(els.entryHours.value);
    if (!date || !(hours > 0)) {
      showToast("Podaj datę i liczbę godzin");
      return;
    }
    const override = els.entryType.value === "auto" ? "auto" : els.entryType.value;
    const resolved = resolveRateType(date, override);
    const entry = {
      id: uid(),
      date,
      hours,
      rate: resolved.rate,
      note: (els.entryNote.value || "").trim(),
      createdAt: Date.now(),
    };
    state.entries.push(entry);
    // Przełącz widok na miesiąc wpisu
    state.month = date.slice(0, 7);
    els.month.value = state.month;
    if (!nominalManual) syncNominalFromMonth(true);
    state.nominalHours = Number(els.nominalHours.value);
    saveState();
    els.entryHours.value = "1";
    els.entryNote.value = "";
    els.entryType.value = "auto";
    updateTypePreview();
    render();
    showToast("Dodano nadgodziny");
  });

  els.entryList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    const id = btn.getAttribute("data-delete");
    state.entries = state.entries.filter((x) => x.id !== id);
    saveState();
    render();
    showToast("Usunięto wpis");
  });

  els.clearMonthBtn.addEventListener("click", () => {
    if (!confirm("Usunąć wszystkie wpisy z tego miesiąca?")) return;
    state.entries = state.entries.filter((e) => !e.date.startsWith(state.month));
    saveState();
    render();
    showToast("Wyczyszczono miesiąc");
  });

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.hidden = false;
    els.installBtn.textContent = "Zainstaluj";
  });

  els.installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      els.installBtn.hidden = true;
      return;
    }
    if (isIos) {
      showToast("Safari → Udostępnij → Dodaj do ekranu początkowego");
      return;
    }
    showToast("Użyj menu przeglądarki: Dodaj do ekranu głównego");
  });

  window.addEventListener("appinstalled", () => {
    els.installBtn.hidden = true;
    showToast("Aplikacja zainstalowana");
  });

  if (isIos && !isStandalone) {
    els.installBtn.hidden = false;
    els.installBtn.textContent = "Jak zainstalować";
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
