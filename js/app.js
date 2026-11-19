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
    monthSel: document.getElementById("monthSel"),
    yearSel: document.getElementById("yearSel"),
    breakdown: document.getElementById("breakdown"),
    payslip: document.getElementById("payslip"),
    netPay: document.getElementById("netPay"),
    grossPay: document.getElementById("grossPay"),
    leaveLeft: document.getElementById("leaveLeft"),
    premia: document.getElementById("premia"),
    leaveDays: document.getElementById("leaveDays"),
    leaveInfo: document.getElementById("leaveInfo"),
    taxForm: document.getElementById("taxForm"),
    kup: document.getElementById("kup"),
    pit2: document.getElementById("pit2"),
    ppkOn: document.getElementById("ppkOn"),
    ppkEmp: document.getElementById("ppkEmp"),
    ppkEr: document.getElementById("ppkEr"),
    leaveLimit: document.getElementById("leaveLimit"),
    familyList: document.getElementById("familyList"),
    familyForm: document.getElementById("familyForm"),
    familyName: document.getElementById("familyName"),
    familyType: document.getElementById("familyType"),
    familyInfo: document.getElementById("familyInfo"),
    toast: document.getElementById("toast"),
  };

  let etatNow = 1;
  let state = loadState();
  etatNow = Number(state.etat) || 1;
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
        tax: Object.assign(defaultTax(), parsed.tax || {}),
        family: Array.isArray(parsed.family) ? parsed.family : [],
        monthData: parsed.monthData && typeof parsed.monthData === "object" ? parsed.monthData : {},
        contract: ["uop", "uz", "b2b"].includes(parsed.contract) ? parsed.contract : "uop",
        etat: Number(parsed.etat) || 1,
        uz: Object.assign(defaultUz(), parsed.uz || {}),
        b2b: Object.assign(defaultB2b(), parsed.b2b || {}),
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
      nominalHours: nominalAuto(y, m - 1),
      entries: [],
      employeeName: "",
      employerName: "",
      tax: defaultTax(),
      family: [],
      monthData: {},
      contract: "uop",
      etat: 1,
      uz: defaultUz(),
      b2b: defaultB2b(),
    };
  }

  function defaultUz() {
    return { mode: "hour", rate: 31.4, hours: 160, amount: 5000, status: "only", sickness: false, pit2: true };
  }

  function defaultB2b() {
    return { revenue: 10000, costs: 0, zus: "big", form: "skala", rate: 12, sickness: false };
  }

  /** Godziny nominalne miesiąca z uwzględnieniem wymiaru etatu. */
  function nominalAuto(y, monthIndex) {
    const full = PLHolidays.nominalHoursForMonth(y, monthIndex);
    const etat = etatNow;
    return Math.round(full * etat * 100) / 100;
  }

  function defaultTax() {
    return { status: "26plus", kup: 250, pit2: true, ppkOn: false, ppkEmp: 2, ppkEr: 1.5, leaveLimit: 26 };
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

  const MONTHS_PL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];

  function monthTitle(value) {
    const { year, monthIndex } = parseMonth(value);
    return `${MONTHS_PL[monthIndex]} ${year}`;
  }

  /** Wypełnia listy miesięcy i lat po polsku (niezależnie od języka telefonu). */
  function setupMonthPicker() {
    els.monthSel.innerHTML = MONTHS_PL.map(
      (name, i) => `<option value="${String(i + 1).padStart(2, "0")}">${name}</option>`
    ).join("");
    const now = new Date().getFullYear();
    const years = [];
    for (let y = now - 3; y <= now + 1; y++) years.push(y);
    els.yearSel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  }

  function setMonthValue(value) {
    const [y, m] = value.split("-");
    if (![...els.yearSel.options].some((o) => o.value === y)) {
      els.yearSel.insertAdjacentHTML("beforeend", `<option value="${y}">${y}</option>`);
      [...els.yearSel.options]
        .sort((a, b) => a.value - b.value)
        .forEach((o) => els.yearSel.appendChild(o));
    }
    els.yearSel.value = y;
    els.monthSel.value = m;
    els.month.value = value;
  }

  function onMonthPicked() {
    els.month.value = `${els.yearSel.value}-${els.monthSel.value}`;
    els.month.dispatchEvent(new Event("change"));
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

  /** Stawka godzinowa zaokrąglona do 1 grosza — od niej liczymy wszystko dalej. */
  function hourlyRate() {
    const hours = Number(state.nominalHours) || 1;
    return roundGr(state.salary / hours);
  }

  /** Zaokrąglenie do 1 grosza „jak w księgowości” (0,005 zawsze w górę). */
  function roundGr(n) {
    const cents = Number((Math.abs(n) * 100).toFixed(6));
    return (Math.sign(n) * Math.round(cents)) / 100;
  }

  /** Stawka samego dodatku za 1 h (50% lub 100% stawki), do 1 grosza. */
  function bonusRate(entry, rate) {
    return roundGr(rate * (entry.rate / 100));
  }

  /** Stawka z dodatkiem = stawka + stawka dodatku. */
  function rateWithBonus(entry, rate) {
    return roundGr(rate + bonusRate(entry, rate));
  }

  /** Rozbicie wpisu: podstawa (godziny × stawka) + dodatek (godziny × stawka dodatku). */
  function splitEntry(entry, rate) {
    const base = roundGr(entry.hours * rate);
    const bonus = roundGr(entry.hours * bonusRate(entry, rate));
    return { base, bonus, total: roundGr(base + bonus) };
  }

  function payForEntry(entry, rate) {
    return splitEntry(entry, rate).total;
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
    const auto = nominalAuto(year, monthIndex);
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
    els.typePreview.textContent = `${formatDateLabel(date)} · ${resolved.reason}`;
  }

  // ---------- lista płac ----------

  const LEAVE_DAY_HOURS = 8;
  const pct = (v) => String(Number(v) || 0).replace(".", ",");

  function monthInfo(key) {
    return Object.assign({ premia: 0, premiaMode: "gross", leaveDays: 0 }, state.monthData[key] || {});
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  /** Nadgodziny miesiąca: kwota brutto i godziny (stawka liczona od pensji i godzin nominalnych tego miesiąca). */
  function overtimeFor(key) {
    const [y, m] = key.split("-").map(Number);
    const nominal = key === state.month ? Number(state.nominalHours) || nominalAuto(y, m - 1) : nominalAuto(y, m - 1);
    const rate = roundGr(state.salary / (nominal || 1));
    const list = state.entries.filter((e) => e.date.startsWith(key));
    return {
      nominal,
      pay: roundGr(list.reduce((s, e) => s + payForEntry(e, rate), 0)),
      hours: list.reduce((s, e) => s + e.hours, 0),
    };
  }

  /** Składniki zmienne do urlopu: nadgodziny z 3 poprzednich miesięcy / godziny przepracowane. */
  function vacationFor(key) {
    const info = monthInfo(key);
    const hours = (Number(info.leaveDays) || 0) * LEAVE_DAY_HOURS;
    if (!hours) return { rate: 0, amount: 0, hours: 0 };
    const history = [1, 2, 3].map((i) => {
      const k = shiftMonth(key, -i);
      const ot = overtimeFor(k);
      const leaveH = (Number(monthInfo(k).leaveDays) || 0) * LEAVE_DAY_HOURS;
      return { variable: ot.pay, hoursWorked: Math.max(0, ot.nominal - leaveH) + ot.hours };
    });
    return { ...Payroll.vacationVariable(history, hours), hours };
  }

  function slipWithPremia(key, premiaGross) {
    const tx = state.tax;
    const ot = overtimeFor(key);
    const vac = vacationFor(key);
    return Payroll.payslip({
      salary: state.salary,
      overtimePay: ot.pay,
      premia: premiaGross,
      vacationVariable: vac.amount,
      age: tx.status === "26plus" ? "26plus" : "under26",
      kup: Number(tx.kup) || 250,
      pit2: tx.pit2,
      ppk: { on: tx.ppkOn, emp: tx.ppkEmp, er: tx.ppkEr },
    });
  }

  /** Premia brutto: wpisana, albo wyliczona z kwoty netto (ile więcej na rękę dzięki premii). */
  function premiaGrossFor(key) {
    const info = monthInfo(key);
    const amount = Number(info.premia) || 0;
    if (info.premiaMode !== "net" || !amount) return amount;
    const base = slipWithPremia(key, 0).net;
    const gain = (g) => roundGr(slipWithPremia(key, g).net - base);
    let lo = 0, hi = amount * 3;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (gain(mid) < amount) lo = mid;
      else hi = mid;
    }
    // najbliższa kwota w groszach, która daje co najmniej żądane netto
    let g = Math.floor(lo * 100) / 100;
    for (let i = 0; i < 400 && gain(g) < amount; i++) g = roundGr(g + 0.01);
    return g;
  }

  function payslipFor(key) {
    const tx = state.tax;
    const ot = overtimeFor(key);
    const vac = vacationFor(key);
    const slip = Payroll.payslip({
      salary: state.salary,
      overtimePay: ot.pay,
      premia: premiaGrossFor(key),
      vacationVariable: vac.amount,
      age: tx.status === "26plus" ? "26plus" : "under26",
      kup: Number(tx.kup) || 250,
      pit2: tx.pit2,
      ppk: { on: tx.ppkOn, emp: tx.ppkEmp, er: tx.ppkEr },
    });
    return { slip, vac };
  }

  function leaveUsedInYear(year) {
    return Object.entries(state.monthData)
      .filter(([k]) => k.startsWith(`${year}-`))
      .reduce((s, [, v]) => s + (Number(v.leaveDays) || 0), 0);
  }

  const CONTRACT_NAMES = { uop: "Umowa o pracę", uz: "Umowa zlecenie", b2b: "B2B (działalność gospodarcza)" };

  function uzGross() {
    const u = state.uz;
    return u.mode === "hour" ? roundGr((Number(u.rate) || 0) * (Number(u.hours) || 0)) : roundGr(Number(u.amount) || 0);
  }

  function uzResult() {
    const u = state.uz;
    return Payroll.zlecenie({ gross: uzGross(), status: u.status, sickness: u.sickness, pit2: u.pit2 });
  }

  function b2bResult() {
    const b = state.b2b;
    return Payroll.b2b({ revenue: b.revenue, costs: b.costs, zus: b.zus, sickness: b.sickness, form: b.form, ryczaltRate: b.rate });
  }

  /** Wiersze rozliczenia dla zlecenia i B2B: [etykieta, kwota, znak] */
  function contractLines() {
    if (state.contract === "uz") {
      const r = uzResult();
      const u = state.uz;
      const L = [[u.mode === "hour" ? `Wynagrodzenie (${formatHours(Number(u.hours) || 0)} h × ${formatMoney(Number(u.rate) || 0)})` : "Wynagrodzenie z umowy", r.gross, "="]];
      if (r.pension) L.push(["Składka emerytalna 9,76%", r.pension, "−"]);
      if (r.disability) L.push(["Składka rentowa 1,5%", r.disability, "−"]);
      if (r.sickness) L.push(["Składka chorobowa 2,45%", r.sickness, "−"]);
      if (r.health) L.push(["Składka zdrowotna 9%", r.health, "−"]);
      L.push([u.status === "etat" || u.status === "only" ? `Zaliczka PIT 12%${u.pit2 ? " (PIT-2)" : ""}` : "Zaliczka PIT — ulga dla młodych", r.pit, "−"]);
      L.push(["Do wypłaty netto", r.net, "="]);
      if (r.kup) L.push(["Koszty uzyskania przychodu 20%", r.kup, "i"]);
      if (r.taxBase) L.push(["Podstawa podatku", r.taxBase, "i"]);
      return { L, net: r.net, gross: r.gross };
    }
    const r = b2bResult();
    const b = state.b2b;
    const formName = { skala: "skala 12%", liniowy: "liniowy 19%", ryczalt: `ryczałt ${String(b.rate).replace(".", ",")}%` }[r.form];
    const L = [["Przychód netto (bez VAT)", r.revenue, "="]];
    if (r.costs) L.push([r.fp ? "Koszty firmy (z Funduszem Pracy)" : "Koszty firmy", r.costs, "−"]);
    if (r.pension) L.push(["ZUS emerytalna 19,52%", r.pension, "−"]);
    if (r.disability) L.push(["ZUS rentowa 8%", r.disability, "−"]);
    if (r.accident) L.push(["ZUS wypadkowa 1,67%", r.accident, "−"]);
    if (r.sickness) L.push(["ZUS chorobowa 2,45%", r.sickness, "−"]);
    L.push([`Składka zdrowotna (${r.form === "ryczalt" ? "ryczałt — kwota stała" : r.form === "liniowy" ? "4,9% dochodu" : "9% dochodu"})`, r.health, "−"]);
    L.push([`Zaliczka PIT — ${formName}`, r.pit, "−"]);
    L.push(["Zostaje na rękę", r.net, "="]);
    L.push(["Podstawa podatku", r.taxBase, "i"]);
    return { L, net: r.net, gross: r.revenue };
  }

  function applyContractVisibility() {
    const c = state.contract;
    document.querySelectorAll("[data-only]").forEach((el) => {
      el.hidden = !el.dataset.only.split(" ").includes(c);
    });
    document.querySelectorAll("#contractPick [data-contract]").forEach((b) => b.classList.toggle("active", b.dataset.contract === c));
    const u = state.uz;
    if (c === "uz") {
      document.getElementById("uzRateRow").hidden = u.mode !== "hour";
      document.getElementById("uzHoursRow").hidden = u.mode !== "hour";
      document.getElementById("uzAmountRow").hidden = u.mode !== "amount";
      document.getElementById("uzSickRow").hidden = !(u.status === "under26" || u.status === "only");
      document.getElementById("uzPit2Row").hidden = !(u.status === "etat" || u.status === "only");
    }
    if (c === "b2b") document.getElementById("b2bRateRow").hidden = state.b2b.form !== "ryczalt";
    els.printReport.classList.toggle("no-ot", c !== "uop");
    document.getElementById("brandSub").textContent =
      c === "uz" ? "Umowa zlecenie · netto po ZUS i podatku" : c === "b2b" ? "B2B · ile zostaje z faktury" : "Umowa o pracę · netto, nadgodziny, urlop";
    document.getElementById("lede").textContent =
      c === "uz"
        ? "Stawka × godziny albo kwota z umowy — brutto i na rękę, po ZUS i podatku."
        : c === "b2b"
          ? "Przychód z faktur minus koszty, ZUS, zdrowotna i podatek — tyle zostaje na rękę."
          : "Pensja, nadgodziny, premia i urlop — brutto i na rękę, po ZUS, podatku i PPK.";
    document.getElementById("grossLabel").textContent = c === "b2b" ? "Przychód" : "Brutto";
    document.getElementById("contractNote").textContent =
      c === "uz"
        ? "Na umowie zlecenie nie ma nadgodzin z Kodeksu pracy ani płatnego urlopu — płacą za każdą godzinę według stawki. Wpisz stawkę i godziny w ustawieniach."
        : c === "b2b"
          ? "Na B2B wystawiasz faktury: nie ma nadgodzin, urlopu ani PIT-2. Wynik to szacunek — pomija VAT, próg 32% na skali i roczne rozliczenie zdrowotnej."
          : "";
  }

  function renderPayslip() {
    applyContractVisibility();
    if (state.contract !== "uop") {
      const { L, net, gross } = contractLines();
      els.netPay.textContent = formatMoney(net);
      els.grossPay.textContent = formatMoney(gross);
      document.getElementById("payslipTitle").textContent = state.contract === "uz" ? "Zlecenie — od brutto do netto" : "Firma (B2B) — od przychodu do kwoty na rękę";
      const row = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
      els.payslip.innerHTML = L.map(([l, v, sign]) =>
        sign === "−" ? row(l, `−${formatMoney(v)}`, "minus") : sign === "=" ? row(l, formatMoney(v), "sum") : row(l, formatMoney(v), "info")
      ).join("");
      return;
    }
    document.getElementById("payslipTitle").textContent = "Lista płac — od brutto do netto";
    const { slip, vac } = payslipFor(state.month);
    const tx = state.tax;
    els.netPay.textContent = formatMoney(slip.net);
    els.grossPay.textContent = formatMoney(slip.gross);

    const row = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
    const minus = (label, v) => row(label, `−${formatMoney(v)}`, "minus");
    const lines = [row("Pensja zasadnicza", formatMoney(slip.salary))];
    if (slip.overtime) lines.push(row("+ Nadgodziny (z dodatkami)", formatMoney(slip.overtime), "plus"));
    if (slip.premia) lines.push(row("+ Premia uznaniowa", formatMoney(slip.premia), "plus"));
    if (slip.vacation) lines.push(row(`+ Urlop — składniki zmienne (${formatHours(vac.hours)} h × ${formatMoney(vac.rate)})`, formatMoney(slip.vacation), "plus"));
    lines.push(row("= Brutto", formatMoney(slip.gross), "sum"));
    lines.push(minus("Składka emerytalna 9,76%", slip.pension));
    lines.push(minus("Składka rentowa 1,5%", slip.disability));
    lines.push(minus("Składka chorobowa 2,45%", slip.sickness));
    lines.push(minus("Składka zdrowotna 9%", slip.health));
    if (tx.status === "26plus") {
      lines.push(minus(`Zaliczka PIT 12%${tx.pit2 ? " (z PIT-2: −300 zł)" : " (bez PIT-2)"}`, slip.pit));
    } else {
      lines.push(row("Zaliczka PIT — ulga dla młodych", formatMoney(0)));
    }
    if (tx.ppkOn) lines.push(minus(`PPK — Twoja wpłata ${pct(tx.ppkEmp)}%`, slip.ppkEmp));
    lines.push(row("= Na rękę (netto)", formatMoney(slip.net), "sum"));
    lines.push(row(`Koszty uzyskania przychodu`, formatMoney(slip.kup), "info"));
    lines.push(row(`Podstawa podatku`, formatMoney(slip.taxBase), "info"));
    if (tx.ppkOn) lines.push(row(`PPK — wpłata pracodawcy ${pct(tx.ppkEr)}% (na Twoje konto PPK)`, formatMoney(slip.ppkEr), "info"));
    els.payslip.innerHTML = lines.join("");

    const year = state.month.slice(0, 4);
    const used = leaveUsedInYear(year);
    const limit = Number(tx.leaveLimit) || 26;
    els.leaveLeft.textContent = `${formatHours(limit - used)} / ${limit} dni`;

    const info = monthInfo(state.month);
    els.premia.value = info.premia || "";
    const pm = document.getElementById("premiaMode");
    pm.value = info.premiaMode;
    document.getElementById("premiaLabel").textContent = info.premiaMode === "net" ? "Premia uznaniowa (zł netto — na rękę)" : "Premia uznaniowa (zł brutto)";
    const pInfo = document.getElementById("premiaInfo");
    if (slip.premia) {
      const gain = roundGr(slip.net - slipWithPremia(state.month, 0).net);
      pInfo.hidden = false;
      pInfo.textContent = `Premia: ${formatMoney(slip.premia)} brutto → ${formatMoney(gain)} na rękę (po ZUS, zdrowotnej${tx.status === "26plus" ? ", podatku" : ""}${tx.ppkOn ? " i PPK" : ""}).`;
    } else pInfo.hidden = true;
    els.leaveDays.value = info.leaveDays || "";
    els.leaveInfo.textContent = info.leaveDays
      ? `Urlop: ${formatHours(Number(info.leaveDays))} dni (${formatHours(vac.hours)} h). Pensja zasadnicza bez zmian` +
        (vac.amount ? ` + ${formatMoney(vac.amount)} za nadgodziny ze średniej 3 miesięcy.` : ". Brak nadgodzin w 3 poprzednich miesiącach — nic nie dochodzi.") +
        ` W ${year} r. wykorzystane: ${formatHours(used)} z ${limit} dni.`
      : `W ${year} r. wykorzystane: ${formatHours(used)} z ${limit} dni urlopu. Premia uznaniowa nie wchodzi do wynagrodzenia urlopowego.`;
  }

  function renderContractInputs() {
    const u = state.uz, b = state.b2b;
    const val = (id, v) => (document.getElementById(id).value = v ?? "");
    val("etat", String(state.etat));
    val("uzMode", u.mode); val("uzRate", u.rate); val("uzHours", u.hours); val("uzAmount", u.amount);
    document.querySelectorAll("input[name=uzStatus]").forEach((r) => (r.checked = r.value === u.status));
    document.getElementById("uzSick").checked = u.sickness;
    document.getElementById("uzPit2").checked = u.pit2;
    val("b2bRevenue", b.revenue); val("b2bCosts", b.costs || ""); val("b2bZus", b.zus); val("b2bForm", b.form); val("b2bRate", String(b.rate));
    document.getElementById("b2bSick").checked = b.sickness;
    const [y, m] = state.month.split("-").map(Number);
    document.getElementById("etatHint").textContent =
      Number(state.etat) < 1
        ? `Godziny nominalne: ${formatHours(nominalAuto(y, m - 1))} h. Wpisz pensję za swój etat (z umowy). Na części etatu nadgodziny zaczynają się po przekroczeniu limitu z umowy (art. 151 § 5 KP).`
        : "";
  }

  function renderTax() {
    renderContractInputs();
    const tx = state.tax;
    els.taxForm.querySelectorAll("input[name=status]").forEach((r) => (r.checked = r.value === tx.status));
    els.kup.value = String(tx.kup);
    els.pit2.checked = tx.pit2;
    els.pit2.closest("label").hidden = tx.status !== "26plus";
    els.ppkOn.checked = tx.ppkOn;
    els.ppkEmp.value = tx.ppkEmp;
    els.ppkEr.value = tx.ppkEr;
    document.getElementById("ppkEmpRow").hidden = !tx.ppkOn;
    document.getElementById("ppkErRow").hidden = !tx.ppkOn;
    els.leaveLimit.value = String(tx.leaveLimit);
  }

  function renderFamily() {
    const kids = state.family.filter((f) => f.type === "child").length;
    els.familyList.innerHTML = state.family.length
      ? state.family
          .map(
            (f) => `<li><div><div class="who">${escapeHtml(f.name || (f.type === "child" ? "Dziecko" : "Dorosły"))}</div>
              <div class="kind">${f.type === "child" ? "Dziecko" : "Dorosły członek rodziny"}</div></div>
              <button type="button" class="btn ghost danger" data-family-del="${f.id}">Usuń</button></li>`
          )
          .join("")
      : `<li class="empty">Nikt nie jest dopisany.</li>`;
    let txt =
      "Zgłoszenie rodziny do ZUS nie zmienia Twojej pensji ani składki zdrowotnej — płacisz tyle samo, a rodzina ma prawo do leczenia w NFZ.";
    if (kids) {
      const relief = Payroll.childRelief(kids);
      txt += ` Ulga na ${kids === 1 ? "1 dziecko" : `${kids} dzieci`} w rocznym PIT za ${state.month.slice(0, 4)} r.: do ${formatMoney(relief)} zwrotu (przy 1 dziecku limit dochodu 112 000 zł dla małżonków, 56 000 zł dla samotnych; ulgę można podzielić między rodziców).`;
    }
    txt += " Dziecko uczące się może być dopisane do 26 lat.";
    els.familyInfo.textContent = txt;
  }

  function render() {
    renderPayslip();
    renderTax();
    renderFamily();
    const rate = hourlyRate();
    const monthEntries = entriesForMonth();
    const totalHours = monthEntries.reduce((s, e) => s + e.hours, 0);
    const totalPay = monthEntries.reduce((s, e) => s + payForEntry(e, rate), 0);

    els.monthLabel.textContent = monthTitle(state.month);
    els.hourlyRate.textContent = formatMoney(rate);
    els.totalHours.textContent = formatHours(totalHours);
    els.totalPay.textContent = formatMoney(totalPay);
    renderBreakdown(monthEntries, rate);

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
        const parts = splitEntry(entry, rate);
        const pay = parts.total;
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
              <div class="entry-split">podstawa ${formatMoney(parts.base)} + dodatek ${entry.rate}% ${formatMoney(parts.bonus)}</div>
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

  /** Sumy miesiąca rozbite na podstawę i dodatki 50% / 100%. */
  function monthSplit(monthEntries, rate) {
    const acc = { base: 0, bonus50: 0, bonus100: 0, hours50: 0, hours100: 0 };
    monthEntries.forEach((e) => {
      const p = splitEntry(e, rate);
      acc.base += p.base;
      if (e.rate === 100) {
        acc.bonus100 += p.bonus;
        acc.hours100 += e.hours;
      } else {
        acc.bonus50 += p.bonus;
        acc.hours50 += e.hours;
      }
    });
    Object.keys(acc).forEach((k) => (acc[k] = roundGr(acc[k])));
    acc.total = roundGr(acc.base + acc.bonus50 + acc.bonus100);
    return acc;
  }

  function renderBreakdown(monthEntries, rate) {
    const t = monthSplit(monthEntries, rate);
    const row = (label, value, cls = "") =>
      `<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
    els.breakdown.innerHTML = [
      row(`Podstawa za nadgodziny (${formatHours(t.hours50 + t.hours100)} h × ${formatMoney(rate)})`, formatMoney(t.base)),
      row(`Dodatek 50% · ${formatHours(t.hours50)} h`, formatMoney(t.bonus50), "b50"),
      row(`Dodatek 100% · ${formatHours(t.hours100)} h`, formatMoney(t.bonus100), "b100"),
      row("Razem do wypłaty", formatMoney(t.total), "sum"),
    ].join("");
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
      .map((e) => {
        const p = splitEntry(e, rate);
        return {
          ...e,
          bonusRate: bonusRate(e, rate),
          rateWithBonus: rateWithBonus(e, rate),
          base: p.base,
          bonus: p.bonus,
          pay: p.total,
        };
      });
    const sum = (list, key) => roundGr(list.reduce((s, r) => s + r[key], 0));
    const r50 = rows.filter((r) => r.rate === 50);
    const r100 = rows.filter((r) => r.rate === 100);
    return {
      rate,
      rows,
      hours50: sum(r50, "hours"),
      bonus50: sum(r50, "bonus"),
      hours100: sum(r100, "hours"),
      bonus100: sum(r100, "bonus"),
      totalHours: sum(rows, "hours"),
      totalBase: sum(rows, "base"),
      totalBonus: sum(rows, "bonus"),
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
            <td class="num">${formatMoney(r.base)}</td>
            <td class="num">${formatMoney(r.bonus)}</td>
            <td class="num">${formatMoney(r.pay)}</td>
            <td>${escapeHtml(r.note || "")}</td>
          </tr>`
      )
      .join("");

    els.printReport.innerHTML = `
      <header class="pr-head">
        <h1>Twoja wypłata — zestawienie</h1>
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
            <th class="num">Podstawa</th>
            <th class="num">Kwota dodatku</th>
            <th class="num">Razem brutto</th>
            <th>Uwagi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Razem</td>
            <td class="num">${formatHours(data.totalHours)}</td>
            <td></td>
            <td class="num">${formatMoney(data.totalBase)}</td>
            <td class="num">${formatMoney(data.totalBonus)}</td>
            <td class="num">${formatMoney(data.totalPay)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <table class="pr-summary">
        <tbody>
          <tr>
            <th>Podstawa — wynagrodzenie za godziny nadliczbowe (${formatMoney(data.rate)} / h)</th>
            <td class="num">${formatHours(data.totalHours)} h</td>
            <td class="num">${formatMoney(data.totalBase)}</td>
          </tr>
          <tr>
            <th>Dodatek 50% — dni powszednie (${formatMoney(roundGr(data.rate * 0.5))} / h)</th>
            <td class="num">${formatHours(data.hours50)} h</td>
            <td class="num">${formatMoney(data.bonus50)}</td>
          </tr>
          <tr>
            <th>Dodatek 100% — weekendy, święta, dni wolne (${formatMoney(data.rate)} / h)</th>
            <td class="num">${formatHours(data.hours100)} h</td>
            <td class="num">${formatMoney(data.bonus100)}</td>
          </tr>
          <tr class="pr-grand">
            <th>Łącznie do wypłaty za nadgodziny (brutto)</th>
            <td class="num">${formatHours(data.totalHours)} h</td>
            <td class="num">${formatMoney(data.totalPay)}</td>
          </tr>
        </tbody>
      </table>

      <h2 class="pr-h2">${escapeHtml(CONTRACT_NAMES[state.contract])} — rozliczenie (szacunkowo)</h2>
      <table class="pr-summary pr-pay">
        <tbody>${payslipLines()
          .map(([l, v, sign]) => `<tr class="${sign === "=" ? "pr-grand" : ""}"><th>${sign === "+" || sign === "−" ? sign + " " : ""}${escapeHtml(l)}</th><td class="num">${formatMoney(v)}</td></tr>`)
          .join("")}</tbody>
      </table>

      <div class="pr-sign">
        <div><span></span>Podpis pracownika</div>
        <div><span></span>Podpis przełożonego</div>
      </div>

      <footer class="pr-foot">
        <p>Stawka godzinowa = pensja brutto ÷ godziny nominalne miesiąca (do 1 grosza). Podstawa = godziny × stawka. Dodatek = godziny × 50% lub 100% stawki (do 1 grosza). Razem = podstawa + dodatek (art. 151¹ Kodeksu pracy).</p>
        <p>Zestawienie pomocnicze — ostateczne rozliczenie zależy od grafiku i regulaminu pracodawcy. Wygenerowano: ${escapeHtml(generated)} · Twoja wypłata</p>
      </footer>
    `;
    return data;
  }

  /** Wiersze listy płac do wydruku i CSV: [etykieta, kwota, znak] */
  function payslipLines() {
    if (state.contract !== "uop") return contractLines().L;
    const { slip, vac } = payslipFor(state.month);
    const tx = state.tax;
    const L = [["Pensja zasadnicza", slip.salary, ""]];
    if (slip.overtime) L.push(["Nadgodziny (z dodatkami)", slip.overtime, "+"]);
    if (slip.premia) L.push(["Premia uznaniowa", slip.premia, "+"]);
    if (slip.vacation) L.push([`Urlop — składniki zmienne (${formatHours(vac.hours)} h)`, slip.vacation, "+"]);
    L.push(["Wynagrodzenie brutto", slip.gross, "="]);
    L.push(["Składka emerytalna 9,76%", slip.pension, "−"]);
    L.push(["Składka rentowa 1,5%", slip.disability, "−"]);
    L.push(["Składka chorobowa 2,45%", slip.sickness, "−"]);
    L.push(["Składka zdrowotna 9%", slip.health, "−"]);
    L.push([tx.status === "26plus" ? `Zaliczka PIT 12%${tx.pit2 ? " (PIT-2)" : ""}` : "Zaliczka PIT (ulga dla młodych)", slip.pit, "−"]);
    if (tx.ppkOn) L.push([`PPK — wpłata pracownika ${pct(tx.ppkEmp)}%`, slip.ppkEmp, "−"]);
    L.push(["Do wypłaty netto", slip.net, "="]);
    if (tx.ppkOn) L.push([`PPK — wpłata pracodawcy ${pct(tx.ppkEr)}% (doliczona do podstawy PIT)`, slip.ppkEr, "i"]);
    return L;
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
    add("Lp.", "Data", "Dzień", "Godziny", "Dodatek (%)", "Podstawa (zł)", "Kwota dodatku (zł)", "Razem brutto (zł)", "Uwagi");
    data.rows.forEach((r, i) =>
      add(
        i + 1,
        formatDateShort(r.date),
        weekdayName(r.date),
        formatNumberPl(r.hours),
        r.rate,
        formatNumberPl(r.base),
        formatNumberPl(r.bonus),
        formatNumberPl(r.pay),
        r.note || ""
      )
    );
    add("Razem", "", "", formatNumberPl(data.totalHours), "", formatNumberPl(data.totalBase), formatNumberPl(data.totalBonus), formatNumberPl(data.totalPay), "");
    add();
    add("Podsumowanie", "Godziny", "Kwota (zł)");
    add("Podstawa za nadgodziny", formatNumberPl(data.totalHours), formatNumberPl(data.totalBase));
    add("Dodatek 50%", formatNumberPl(data.hours50), formatNumberPl(data.bonus50));
    add("Dodatek 100%", formatNumberPl(data.hours100), formatNumberPl(data.bonus100));
    add("Łącznie do wypłaty", formatNumberPl(data.totalHours), formatNumberPl(data.totalPay));
    add();
    add("Lista płac (szacunkowo)", "Kwota (zł)");
    payslipLines().forEach(([l, v, sign]) => add(`${sign === "+" || sign === "−" ? sign + " " : ""}${l}`, formatNumberPl(v)));

    // BOM, żeby Excel poprawnie pokazał polskie znaki
    return { text: "﻿" + lines.join("\r\n"), count: data.rows.length };
  }

  async function downloadCsv() {
    saveExportFields();
    const { text } = buildCsv();
    const filename = `wyplata-${state.month}.csv`;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });

    // W aplikacji zainstalowanej na iPhonie pobieranie bywa zablokowane — użyj udostępniania
    if (isIos && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: "text/csv" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Twoja wypłata" });
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
    buildPrintReport();
    window.print();
  }

  // Init form values
  els.employeeName.value = state.employeeName || "";
  els.employerName.value = state.employerName || "";
  els.salary.value = String(state.salary);
  setupMonthPicker();
  setMonthValue(state.month);
  els.monthSel.addEventListener("change", onMonthPicked);
  els.yearSel.addEventListener("change", onMonthPicked);
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
      Number(els.nominalHours.value) || nominalAuto(year, monthIndex);
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
    setMonthValue(state.month);
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

  // ---------- rodzaj umowy ----------

  document.getElementById("contractPick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-contract]");
    if (!b) return;
    state.contract = b.dataset.contract;
    saveState();
    render();
  });
  function onContractInput(e) {
    const id = e.target.id, v = e.target.value, u = state.uz, b = state.b2b;
    const num = () => Math.max(0, Number(v) || 0);
    if (id === "etat") {
      state.etat = Number(v) || 1;
      etatNow = state.etat;
      nominalManual = false;
      syncNominalFromMonth(true);
      state.nominalHours = Number(els.nominalHours.value);
    } else if (id === "uzMode") u.mode = v;
    else if (id === "uzRate") u.rate = num();
    else if (id === "uzHours") u.hours = num();
    else if (id === "uzAmount") u.amount = num();
    else if (e.target.name === "uzStatus") u.status = v;
    else if (id === "uzSick") u.sickness = e.target.checked;
    else if (id === "uzPit2") u.pit2 = e.target.checked;
    else if (id === "b2bRevenue") b.revenue = num();
    else if (id === "b2bCosts") b.costs = num();
    else if (id === "b2bZus") b.zus = v;
    else if (id === "b2bForm") b.form = v;
    else if (id === "b2bRate") b.rate = Number(v) || 12;
    else if (id === "b2bSick") b.sickness = e.target.checked;
    else return false;
    saveState();
    render();
    return true;
  }
  els.settingsForm.addEventListener("change", onContractInput);
  els.taxForm.addEventListener("change", (e) => {
    if (onContractInput(e)) showToast("Zapisano");
  });

  // ---------- ten miesiąc, podatki, rodzina ----------

  function setMonthInfo(field, value) {
    const cur = monthInfo(state.month);
    cur[field] = Math.max(0, Number(value) || 0);
    state.monthData[state.month] = cur;
    saveState();
    render();
  }
  els.premia.addEventListener("change", () => setMonthInfo("premia", els.premia.value));
  document.getElementById("premiaMode").addEventListener("change", (e) => {
    const cur = monthInfo(state.month);
    cur.premiaMode = e.target.value === "net" ? "net" : "gross";
    state.monthData[state.month] = cur;
    saveState();
    render();
  });
  els.leaveDays.addEventListener("change", () => {
    const max = Number(state.tax.leaveLimit) || 26;
    setMonthInfo("leaveDays", Math.min(31, Number(els.leaveDays.value) || 0));
    if (leaveUsedInYear(state.month.slice(0, 4)) > max) showToast("Uwaga: więcej dni urlopu niż przysługuje w roku");
  });

  els.taxForm.addEventListener("change", (e) => {
    const tx = state.tax;
    if (e.target.name === "status") tx.status = e.target.value;
    else if (e.target === els.kup) tx.kup = Number(els.kup.value);
    else if (e.target === els.pit2) tx.pit2 = els.pit2.checked;
    else if (e.target === els.ppkOn) tx.ppkOn = els.ppkOn.checked;
    else if (e.target === els.ppkEmp) tx.ppkEmp = Math.min(4, Math.max(0.5, Number(els.ppkEmp.value) || 2));
    else if (e.target === els.ppkEr) tx.ppkEr = Math.min(4, Math.max(1.5, Number(els.ppkEr.value) || 1.5));
    else if (e.target === els.leaveLimit) tx.leaveLimit = Number(els.leaveLimit.value);
    else return;
    saveState();
    render();
    showToast("Zapisano");
  });

  els.familyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.family.push({ id: uid(), name: els.familyName.value.trim(), type: els.familyType.value });
    els.familyName.value = "";
    saveState();
    render();
    showToast("Dodano osobę");
  });
  els.familyList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-family-del]");
    if (!b) return;
    state.family = state.family.filter((f) => f.id !== b.dataset.familyDel);
    saveState();
    render();
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
