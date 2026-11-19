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
    employeeName: document.getElementById("employeeName"),
    employerName: document.getElementById("employerName"),
    printBtn: document.getElementById("printBtn"),
    csvBtn: document.getElementById("csvBtn"),
    printReport: document.getElementById("printReport"),
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
        employeeName: typeof parsed.employeeName === "string" ? parsed.employeeName : "",
        employerName: typeof parsed.employerName === "string" ? parsed.employerName : "",
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
      employeeName: "",
      employerName: "",
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

  function roundGr(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** Stawka z dodatkiem zaokrąglona do 1 grosza (ta sama, którą widać na wydruku). */
  function rateWithBonus(entry, rate) {
    return roundGr(rate * (1 + entry.rate / 100));
  }

  /** Wypłata za nadgodzinę = godziny × stawka z dodatkiem (już zaokrąglona), do 1 grosza. */
  function payForEntry(entry, rate) {
    return roundGr(entry.hours * rateWithBonus(entry, rate));
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

  // ---------- Eksport i wydruk ----------

  function weekdayName(iso) {
    const d = new Date(`${iso}T12:00:00`);
    const name = new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(d);
    const holiday = PLHolidays.holidayName(d);
    return holiday ? `${name} (${holiday})` : name;
  }

  function formatDateShort(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function formatNumberPl(n, digits = 2) {
    return new Intl.NumberFormat("pl-PL", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: false,
    }).format(n);
  }

  /** Wpisy miesiąca w kolejności chronologicznej, z wyliczonymi kwotami. */
  function reportData() {
    const rate = hourlyRate();
    const rows = entriesForMonth()
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .map((e) => ({
        ...e,
        rateWithBonus: rateWithBonus(e, rate),
        pay: payForEntry(e, rate),
      }));
    const sum = (list, key) => roundGr(list.reduce((s, r) => s + r[key], 0));
    const r50 = rows.filter((r) => r.rate === 50);
    const r100 = rows.filter((r) => r.rate === 100);
    return {
      rate,
      rows,
      hours50: sum(r50, "hours"),
      pay50: sum(r50, "pay"),
      hours100: sum(r100, "hours"),
      pay100: sum(r100, "pay"),
      totalHours: sum(rows, "hours"),
      totalPay: sum(rows, "pay"),
    };
  }

  function saveExportFields() {
    state.employeeName = (els.employeeName.value || "").trim();
    state.employerName = (els.employerName.value || "").trim();
    saveState();
  }

  function buildPrintReport() {
    const data = reportData();
    const title = monthTitle(state.month);
    const generated = new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    const meta = [
      state.employeeName && `<div><dt>Pracownik</dt><dd>${escapeHtml(state.employeeName)}</dd></div>`,
      state.employerName && `<div><dt>Pracodawca / stanowisko</dt><dd>${escapeHtml(state.employerName)}</dd></div>`,
      `<div><dt>Okres rozliczeniowy</dt><dd>${escapeHtml(title)}</dd></div>`,
      `<div><dt>Pensja miesięczna brutto</dt><dd>${formatMoney(state.salary)}</dd></div>`,
      `<div><dt>Godziny nominalne w miesiącu</dt><dd>${formatHours(Number(state.nominalHours) || 0)} h</dd></div>`,
      `<div><dt>Stawka godzinowa</dt><dd>${formatMoney(data.rate)}</dd></div>`,
    ]
      .filter(Boolean)
      .join("");

    const rows = data.rows
      .map(
        (r, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td>${formatDateShort(r.date)}</td>
            <td>${escapeHtml(weekdayName(r.date))}</td>
            <td class="num">${formatHours(r.hours)}</td>
            <td class="num">${r.rate}%</td>
            <td class="num">${formatMoney(r.rateWithBonus)}</td>
            <td class="num">${formatMoney(r.pay)}</td>
            <td>${escapeHtml(r.note || "")}</td>
          </tr>`
      )
      .join("");

    els.printReport.innerHTML = `
      <header class="pr-head">
        <h1>Zestawienie nadgodzin</h1>
        <p class="pr-sub">${escapeHtml(title)}</p>
      </header>

      <dl class="pr-meta">${meta}</dl>

      <table class="pr-table">
        <thead>
          <tr>
            <th class="num">Lp.</th>
            <th>Data</th>
            <th>Dzień</th>
            <th class="num">Godziny</th>
            <th class="num">Dodatek</th>
            <th class="num">Stawka z dodatkiem</th>
            <th class="num">Kwota brutto</th>
            <th>Uwagi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Razem</td>
            <td class="num">${formatHours(data.totalHours)}</td>
            <td></td>
            <td></td>
            <td class="num">${formatMoney(data.totalPay)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <table class="pr-summary">
        <tbody>
          <tr>
            <th>Nadgodziny z dodatkiem 50% (dni powszednie)</th>
            <td class="num">${formatHours(data.hours50)} h</td>
            <td class="num">${formatMoney(data.pay50)}</td>
          </tr>
          <tr>
            <th>Nadgodziny z dodatkiem 100% (weekendy, święta, dni wolne)</th>
            <td class="num">${formatHours(data.hours100)} h</td>
            <td class="num">${formatMoney(data.pay100)}</td>
          </tr>
          <tr class="pr-grand">
            <th>Łącznie do wypłaty za nadgodziny (brutto)</th>
            <td class="num">${formatHours(data.totalHours)} h</td>
            <td class="num">${formatMoney(data.totalPay)}</td>
          </tr>
        </tbody>
      </table>

      <div class="pr-sign">
        <div><span></span>Podpis pracownika</div>
        <div><span></span>Podpis przełożonego</div>
      </div>

      <footer class="pr-foot">
        <p>Stawka godzinowa = pensja brutto ÷ godziny nominalne miesiąca. Stawka z dodatkiem = stawka godzinowa × 1,5 (50%) lub × 2,0 (100%), zaokrąglona do 1 grosza. Kwota = godziny × stawka z dodatkiem (art. 151¹ Kodeksu pracy).</p>
        <p>Zestawienie pomocnicze — ostateczne rozliczenie zależy od grafiku i regulaminu pracodawcy. Wygenerowano: ${escapeHtml(generated)} · Nadgodziny PL</p>
      </footer>
    `;
    return data;
  }

  function csvCell(value) {
    const s = String(value ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function buildCsv() {
    const data = reportData();
    const lines = [];
    const add = (...cells) => lines.push(cells.map(csvCell).join(";"));

    add("Zestawienie nadgodzin", monthTitle(state.month));
    if (state.employeeName) add("Pracownik", state.employeeName);
    if (state.employerName) add("Pracodawca / stanowisko", state.employerName);
    add("Pensja miesięczna brutto (zł)", formatNumberPl(state.salary));
    add("Godziny nominalne", formatNumberPl(Number(state.nominalHours) || 0, 0));
    add("Stawka godzinowa (zł)", formatNumberPl(data.rate));
    add();
    add("Lp.", "Data", "Dzień", "Godziny", "Dodatek (%)", "Stawka z dodatkiem (zł)", "Kwota brutto (zł)", "Uwagi");
    data.rows.forEach((r, i) =>
      add(
        i + 1,
        formatDateShort(r.date),
        weekdayName(r.date),
        formatNumberPl(r.hours),
        r.rate,
        formatNumberPl(r.rateWithBonus),
        formatNumberPl(r.pay),
        r.note || ""
      )
    );
    add("Razem", "", "", formatNumberPl(data.totalHours), "", "", formatNumberPl(data.totalPay), "");
    add();
    add("Nadgodziny 50% (h)", formatNumberPl(data.hours50), "Kwota 50% (zł)", formatNumberPl(data.pay50));
    add("Nadgodziny 100% (h)", formatNumberPl(data.hours100), "Kwota 100% (zł)", formatNumberPl(data.pay100));
    add("Łącznie (h)", formatNumberPl(data.totalHours), "Łącznie (zł)", formatNumberPl(data.totalPay));

    // BOM, żeby Excel poprawnie pokazał polskie znaki
    return { text: "﻿" + lines.join("\r\n"), count: data.rows.length };
  }

  async function downloadCsv() {
    saveExportFields();
    const { text, count } = buildCsv();
    if (!count) {
      showToast("Brak wpisów w tym miesiącu do eksportu");
      return;
    }
    const filename = `nadgodziny-${state.month}.csv`;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });

    // W aplikacji zainstalowanej na iPhonie pobieranie bywa zablokowane — użyj udostępniania
    if (isIos && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: "text/csv" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Zestawienie nadgodzin" });
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Pobrano plik " + filename);
  }

  function printReport() {
    saveExportFields();
    const data = buildPrintReport();
    if (!data.rows.length) {
      showToast("Brak wpisów w tym miesiącu do wydruku");
      return;
    }
    window.print();
  }

  // Init form values
  els.employeeName.value = state.employeeName || "";
  els.employerName.value = state.employerName || "";
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

  els.printBtn.addEventListener("click", printReport);
  els.csvBtn.addEventListener("click", downloadCsv);
  els.employeeName.addEventListener("change", saveExportFields);
  els.employerName.addEventListener("change", saveExportFields);
  // Gdy ktoś drukuje z menu przeglądarki — też pokaż aktualne zestawienie
  window.addEventListener("beforeprint", buildPrintReport);

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
