/*
 * Twoja wypłata — lista płac dla umowy o pracę (zasady 2026).
 *  Składki pracownika: emerytalna 9,76%, rentowa 1,5%, chorobowa 2,45% (razem 13,71%)
 *  Zdrowotna: 9% od (brutto − składki społeczne), nie odlicza się od podatku
 *  Koszty uzyskania: 250 zł (lub 300 zł przy dojazdach z innej miejscowości)
 *  Zaliczka PIT: 12% od podstawy (zaokrąglonej do zł), minus 300 zł przy PIT-2
 *  Do 26 lat: PIT 0 (ulga dla młodych, do 85 528 zł przychodu rocznie); ZUS i zdrowotna bez zmian
 *  PPK: pracownik 2% (0,5–4%), pracodawca 1,5% — wpłata pracodawcy zwiększa podstawę PIT
 *  Wynagrodzenie urlopowe: pensja stała bez zmian + składniki zmienne (nadgodziny) ze średniej 3 miesięcy;
 *  premia uznaniowa nie wchodzi do podstawy urlopowej.
 */
(function (global) {
  const R = { pension: 0.0976, disability: 0.015, sickness: 0.0245, health: 0.09, pit: 0.12, pit2: 300 };

  function gr(n) {
    const cents = Number((Math.abs(n) * 100).toFixed(6));
    return (Math.sign(n) * Math.round(cents)) / 100;
  }
  function zl(n) {
    return Math.sign(n) * Math.round(Number(Math.abs(n).toFixed(6)));
  }

  /**
   * @param {object} p
   *  salary, overtimePay, premia, vacationVariable — składniki brutto (zł)
   *  age: "under26" | "26plus"; kup: 250 | 300; pit2: bool
   *  ppk: { on, emp (%), er (%) }
   */
  function payslip(p) {
    const parts = {
      salary: gr(Number(p.salary) || 0),
      overtime: gr(Number(p.overtimePay) || 0),
      premia: gr(Number(p.premia) || 0),
      vacation: gr(Number(p.vacationVariable) || 0),
    };
    const gross = gr(parts.salary + parts.overtime + parts.premia + parts.vacation);
    const pension = gr(gross * R.pension);
    const disability = gr(gross * R.disability);
    const sickness = gr(gross * R.sickness);
    const social = gr(pension + disability + sickness);
    const health = gr((gross - social) * R.health);

    const ppkOn = p.ppk && p.ppk.on;
    const ppkEmp = ppkOn ? gr((gross * (Number(p.ppk.emp) || 0)) / 100) : 0;
    const ppkEr = ppkOn ? gr((gross * (Number(p.ppk.er) || 0)) / 100) : 0;

    const kup = Math.min(Number(p.kup) || 250, Math.max(0, gross - social));
    const taxBase = Math.max(0, zl(gross - social - kup + ppkEr));
    let pit = 0;
    if (p.age !== "under26") pit = Math.max(0, zl(taxBase * R.pit - (p.pit2 ? R.pit2 : 0)));

    const net = gr(gross - social - health - pit - ppkEmp);
    return { ...parts, gross, pension, disability, sickness, social, health, kup, ppkEmp, ppkEr, taxBase, pit, net };
  }

  /**
   * Składniki zmienne do wynagrodzenia urlopowego.
   * history: [{ variable, hoursWorked }] z 3 miesięcy przed miesiącem urlopu.
   */
  function vacationVariable(history, vacationHours) {
    const sum = history.reduce((a, m) => a + (Number(m.variable) || 0), 0);
    const hours = history.reduce((a, m) => a + (Number(m.hoursWorked) || 0), 0);
    if (!(sum > 0) || !(hours > 0) || !(vacationHours > 0)) return { rate: 0, amount: 0 };
    const rate = gr(sum / hours);
    return { rate, amount: gr(rate * vacationHours) };
  }

  /** Ulga na dzieci w rocznym PIT (2026): 1. i 2. dziecko po 1112,04 zł, 3. — 2000,04 zł, 4. i kolejne — 2700 zł. */
  function childRelief(children) {
    let sum = 0;
    for (let i = 1; i <= children; i++) sum += i <= 2 ? 1112.04 : i === 3 ? 2000.04 : 2700;
    return gr(sum);
  }

  const api = { R, gr, payslip, vacationVariable, childRelief };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Payroll = api;
})(typeof window !== "undefined" ? window : globalThis);
