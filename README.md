# Nadgodziny PL

Kalkulator nadgodzin według **Kodeksu pracy** (umowa o pracę) — po polsku, do instalacji na telefonie (PWA).

## Zasady

- Pensja domyślna: **5 265 zł brutto** / miesiąc
- Stawka godzinowa = pensja ÷ godziny nominalne miesiąca (dni robocze × 8 h)
- **50%** dopłaty w dni powszednie → wypłata = stawka × 1,5
- **100%** w weekendy i święta → wypłata = stawka × 2,0

## Instalacja na telefonie

1. Otwórz stronę w Chrome (Android) lub Safari (iPhone).
2. Android: menu → **Zainstaluj aplikację** / **Dodaj do ekranu głównego**.
3. iPhone: **Udostępnij** → **Dodaj do ekranu początkowego**.

## Uruchomienie lokalne

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Otwórz http://127.0.0.1:8080
