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
      akord: gr(Number(p.akord) || 0),
      topUp: gr(Number(p.topUp) || 0),
      overtime: gr(Number(p.overtimePay) || 0),
      premia: gr(Number(p.premia) || 0),
      vacation: gr(Number(p.vacationVariable) || 0),
      sickPay: gr(Number(p.sickPay) || 0), // wynagrodzenie chorobowe (pracodawca)
      benefit: gr(Number(p.benefit) || 0), // zasiłek chorobowy
    };
    // Składki społeczne tylko od wynagrodzenia za pracę (bez chorobowego i zasiłku)
    const work = gr(parts.salary + parts.akord + parts.topUp + parts.overtime + parts.premia + parts.vacation);
    const gross = gr(work + parts.sickPay + parts.benefit);
    const pension = gr(work * R.pension);
    const disability = gr(work * R.disability);
    const sickness = gr(work * R.sickness);
    const social = gr(pension + disability + sickness);
    // Zdrowotna: od pracy po składkach + od wynagrodzenia chorobowego; zasiłek bez zdrowotnej
    const health = gr((work - social + parts.sickPay) * R.health);

    const ppkOn = p.ppk && p.ppk.on;
    const ppkEmp = ppkOn ? gr((work * (Number(p.ppk.emp) || 0)) / 100) : 0;
    const ppkEr = ppkOn ? gr((work * (Number(p.ppk.er) || 0)) / 100) : 0;

    const employment = gr(work - social + parts.sickPay); // przychód ze stosunku pracy po składkach
    const kup = employment > 0 ? Math.min(Number(p.kup) || 250, employment) : 0;
    let taxBase, pit;
    if (p.age === "under26") {
      // ulga dla młodych obejmuje pracę i chorobowe od pracodawcy, ale nie zasiłek
      taxBase = Math.max(0, zl(parts.benefit));
    } else {
      taxBase = Math.max(0, zl(employment - kup + parts.benefit + ppkEr));
    }
    pit = taxBase ? Math.max(0, zl(taxBase * R.pit - (p.pit2 ? R.pit2 : 0))) : 0;

    const net = gr(gross - social - health - pit - ppkEmp);
    return { ...parts, work, gross, pension, disability, sickness, social, health, kup, ppkEmp, ppkEr, taxBase, pit, net };
  }

  /**
   * L4 — dzienna stawka i kwota.
   * base: średnie brutto z 12 miesięcy; minimum: płaca minimalna × etat; rate: 80 lub 100 (%)
   */
  const MIN_WAGE = 4806;
  function sickDaily(base, etat, rate) {
    const b = Math.max(Number(base) || 0, MIN_WAGE * (Number(etat) || 1));
    const afterSocial = gr(b - gr(b * (R.pension + R.disability + R.sickness)));
    const per100 = gr(afterSocial / 30);
    return { afterSocial, per100, daily: gr((per100 * (Number(rate) || 80)) / 100) };
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

  // ---------- umowa zlecenie (2026) ----------
  /**
   * status: "student26" (brak ZUS i PIT) | "under26" (ZUS, PIT 0) | "etat" (inna praca ≥ min. krajowa: tylko zdrowotna + PIT) | "only" (pełny ZUS + PIT)
   * sickness: dobrowolna chorobowa 2,45%; pit2: −300 zł; KUP 20%
   */
  function zlecenie(p) {
    const gross = gr(Number(p.gross) || 0);
    const st = p.status;
    let pension = 0, disability = 0, sickness = 0;
    if (st === "under26" || st === "only") {
      pension = gr(gross * R.pension);
      disability = gr(gross * R.disability);
      if (p.sickness) sickness = gr(gross * R.sickness);
    }
    const social = gr(pension + disability + sickness);
    const health = st === "student26" ? 0 : gr((gross - social) * R.health);
    const kup = st === "student26" || st === "under26" ? 0 : gr((gross - social) * 0.2);
    const taxBase = st === "etat" || st === "only" ? Math.max(0, zl(gross - social - kup)) : 0;
    const pit = taxBase ? Math.max(0, zl(taxBase * R.pit - (p.pit2 ? R.pit2 : 0))) : 0;
    const net = gr(gross - social - health - pit);
    return { gross, pension, disability, sickness, social, health, kup, taxBase, pit, net };
  }

  // ---------- B2B / JDG (2026) ----------
  const ZUS_JDG = {
    big: { base: 5652, pension: 1103.27, disability: 452.16, sickness: 138.47, accident: 94.39, fp: 138.47 },
    pref: { base: 1441.8, pension: 281.44, disability: 115.34, sickness: 35.32, accident: 24.08, fp: 0 },
    start: { base: 0, pension: 0, disability: 0, sickness: 0, accident: 0, fp: 0 },
  };
  const HEALTH_MIN = 432.54; // 9% × 4806 zł
  const HEALTH_RYCZALT = [ { upTo: 60000, amount: 498.35 }, { upTo: 300000, amount: 830.58 }, { upTo: Infinity, amount: 1495.04 } ];
  const LINIOWY_HEALTH_DEDUCT_MONTH = 1175; // 14 100 zł / 12

  /**
   * revenue — przychód netto (bez VAT) w miesiącu; costs — koszty miesięczne
   * zus: "start" | "pref" | "big"; sickness: bool; form: "skala" | "liniowy" | "ryczalt"; ryczaltRate (%)
   */
  function b2b(p) {
    const revenue = gr(Number(p.revenue) || 0);
    const z = ZUS_JDG[p.zus] || ZUS_JDG.big;
    const pension = z.pension, disability = z.disability, accident = z.accident;
    const sickness = p.sickness ? z.sickness : 0;
    const social = gr(pension + disability + accident + sickness);
    const fp = z.fp; // Fundusz Pracy — koszt firmy
    const form = p.form || "skala";
    const costs = form === "ryczalt" ? 0 : gr((Number(p.costs) || 0) + fp);

    let health, taxBase, pit;
    if (form === "ryczalt") {
      const yearly = revenue * 12;
      health = HEALTH_RYCZALT.find((t) => yearly <= t.upTo).amount;
      taxBase = Math.max(0, zl(revenue - social - gr(health * 0.5)));
      pit = Math.max(0, zl((taxBase * (Number(p.ryczaltRate) || 12)) / 100));
    } else {
      const income = gr(revenue - costs);
      const healthBase = Math.max(0, income - social);
      health = gr(Math.max(HEALTH_MIN, healthBase * (form === "liniowy" ? 0.049 : 0.09)));
      if (form === "liniowy") {
        taxBase = Math.max(0, zl(income - social - Math.min(health, LINIOWY_HEALTH_DEDUCT_MONTH)));
        pit = Math.max(0, zl(taxBase * 0.19));
      } else {
        taxBase = Math.max(0, zl(income - social));
        pit = Math.max(0, zl(taxBase * R.pit - R.pit2));
      }
    }
    const allCosts = form === "ryczalt" ? gr((Number(p.costs) || 0) + fp) : costs;
    const net = gr(revenue - allCosts - social - health - pit);
    return { revenue, costs: allCosts, fp, pension, disability, accident, sickness, social, health, taxBase, pit, net, form };
  }

  const api = { R, gr, payslip, sickDaily, MIN_WAGE, vacationVariable, childRelief, zlecenie, b2b, ZUS_JDG, HEALTH_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Payroll = api;
})(typeof window !== "undefined" ? window : globalThis);
