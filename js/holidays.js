/** Polskie święta ustawowe (dni wolne od pracy). */
(function (global) {
  function easterSunday(year) {
    // Algorytm Meeusa/Jonesa/Butchera
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function ymd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function polishHolidays(year) {
    const easter = easterSunday(year);
    const corpusChristi = addDays(easter, 60);
    const fixed = [
      `${year}-01-01`, // Nowy Rok
      `${year}-01-06`, // Trzech Króli
      `${year}-05-01`, // Święto Pracy
      `${year}-05-03`, // Konstytucja 3 Maja
      `${year}-08-15`, // Wniebowzięcie NMP
      `${year}-11-01`, // Wszystkich Świętych
      `${year}-11-11`, // Niepodległość
      `${year}-12-25`, // Boże Narodzenie
      `${year}-12-26`, // Drugi dzień BN
    ];
    return new Set([
      ...fixed,
      ymd(easter),
      ymd(addDays(easter, 1)), // Poniedziałek Wielkanocny
      ymd(corpusChristi), // Boże Ciało
    ]);
  }

  const cache = new Map();

  function isPolishHoliday(date) {
    const year = date.getFullYear();
    if (!cache.has(year)) cache.set(year, polishHolidays(year));
    return cache.get(year).has(ymd(date));
  }

  function holidayName(date) {
    if (!isPolishHoliday(date)) return null;
    const key = ymd(date);
    const year = date.getFullYear();
    const easter = easterSunday(year);
    const map = {
      [`${year}-01-01`]: "Nowy Rok",
      [`${year}-01-06`]: "Trzech Króli",
      [ymd(easter)]: "Wielkanoc",
      [ymd(addDays(easter, 1))]: "Poniedziałek Wielkanocny",
      [`${year}-05-01`]: "Święto Pracy",
      [`${year}-05-03`]: "Święto Konstytucji 3 Maja",
      [ymd(addDays(easter, 60))]: "Boże Ciało",
      [`${year}-08-15`]: "Wniebowzięcie NMP",
      [`${year}-11-01`]: "Wszystkich Świętych",
      [`${year}-11-11`]: "Święto Niepodległości",
      [`${year}-12-25`]: "Boże Narodzenie",
      [`${year}-12-26`]: "Drugi dzień Bożego Narodzenia",
    };
    return map[key] || "Święto";
  }

  /** Liczba godzin nominalnych: dni robocze (pn–pt, bez świąt) × 8. */
  function nominalHoursForMonth(year, monthIndex) {
    let hours = 0;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, monthIndex, day);
      const weekday = d.getDay();
      if (weekday === 0 || weekday === 6) continue;
      if (isPolishHoliday(d)) continue;
      hours += 8;
    }
    return hours;
  }

  global.PLHolidays = {
    isPolishHoliday,
    holidayName,
    nominalHoursForMonth,
    ymd,
  };
})(window);
