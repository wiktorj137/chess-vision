# Chess Vision — wtyczka do lichess

Rysuje na szachownicy to, czego początkujący jeszcze nie widzi: figury wiszące,
figury niedobronione, słabe pola i skutek ostatniego ruchu.

Bez silnika. Wtyczka **nigdy nie podpowiada najlepszego ruchu** — pokazuje tylko
to, co i tak jest na szachownicy, ale trzeba to umieć zobaczyć.

## Zanim włączysz na partii

Wtyczka działa na wszystkich stronach lichess, łącznie z trwającymi partiami.
Regulamin lichess traktuje nakładki analityczne jako pomoc zewnętrzną, więc:

- **partie rankingowe — nie włączaj.** Ryzykujesz bana konta.
- **partie towarzyskie (casual) — w porządku.** Tu robisz turniej.
- **analiza, studia, zadania — bez ograniczeń.**

Klawisz `v` wyłącza całą nakładkę jednym naciśnięciem.

## Turniej dla dzieci

Pomysł: turniej na partiach **casual**, wszyscy uczestnicy z włączoną wtyczką.
Dzieci widzą konsekwencje ruchów, których same jeszcze nie zauważają, i uczą się
patrzeć na to samo, na co patrzy mocniejszy gracz.

Co warto ustawić przed startem:

- słabe pola (`Shift+V`) **zostaw wyłączone** — dla początkujących to szum
- zostaw włączony `→` (skutek ostatniego ruchu), bo to najlepiej uczy
- legendę zostaw rozwiniętą przy pierwszej partii, potem można zwinąć

## Instalacja (Chrome / Chromium)

1. `chrome://extensions` → włącz **Tryb dewelopera**
2. **Załaduj rozpakowane** → wskaż ten katalog
3. Wejdź na lichess

Firefox: `about:debugging` → **Ten Firefox** → **Załaduj tymczasowy dodatek** →
wskaż `manifest.json`.

## Sterowanie

| Klawisz | Działanie |
|---|---|
| `v` | włącz/wyłącz całą nakładkę |
| `d` | skutek ostatniego ruchu |
| `Shift+V` | słabe pola (domyślnie wyłączone, bo hałasują) |

## Co oznaczają znaczniki

Każdy znacznik ma kolor **i** symbol — sam kolor nie wystarcza, bo czerwony
i pomarańczowy część ludzi widzi tak samo.

| Znacznik | Symbol | Znaczenie |
|---|---|---|
| czerwone koło | `!` | figura wisi: atakowana i nikt jej nie broni |
| pomarańczowa obwódka | `2:1` | atakujący : obrońcy — przegrywasz wymianę |
| pomarańczowa obwódka | `≤` | obrońcy są, ale bije tańsza figura, więc i tak strata |
| zielona strzałka | `→` | ostatni ruch i to, co zaczął atakować |
| fioletowa ramka | przekreślony pion | słabe pole: żaden pion już go nie pokryje |

W lewym dolnym rogu siedzi legenda z tym samym opisem. Klikasz `–` i zwija się
do małego `?`; wybór zapamiętuje się w `localStorage`.

## Jak to działa

- `src/attacks.js` — czysta logika, zero DOM. Mapa ataków, wiszące figury,
  słabe pola, porównanie dwóch pozycji. Jedyny plik, który da się sensownie
  testować.
- `src/board.js` — odczyt pozycji z DOM-u chessground. Najkruchszy element
  całości: gdy lichess zmieni markup, psuje się tutaj i tylko tutaj.
- `src/content.js` — nakładka SVG nad szachownicą plus `MutationObserver`,
  bo lichess nie przeładowuje strony przy ruchu.

Nakładka nigdy nie modyfikuje DOM-u lichess — dokłada własny `<svg>`
z `pointer-events: none`, żeby klikanie figur dalej działało.

## Testy

```bash
node --test test/logic.test.js
```

16 testów logiki szachowej. Część DOM-owa nie ma testów automatycznych — do niej
służy `test/harness.html`, strona odtwarzająca markup chessground:

```bash
python3 -m http.server 8123
```

i otwórz <http://localhost:8123/test/harness.html>. W konsoli masz
`setFen('...')` do podmiany pozycji i `chessVision.render()`. Pliki źródłowe są
doładowywane z pieczątką czasu, więc przeglądarka nie podsunie starej wersji.

## Stan

Zweryfikowane: selektory chessground odczytane z żywego lichess, odczyt pozycji
w obu orientacjach szachownicy, automatyczne odświeżanie po ruchu, wszystkie
typy znaczników, wykrywanie ruchu wraz z nowymi atakami, przełączniki
klawiszowe, brak reakcji na klawisze podczas pisania w polu tekstowym.

Nie zrobione:
- panel ustawień (na razie tylko klawisze) i zapamiętywanie preferencji
- wykrywanie związania — figura związana liczy się jako pełnoprawny obrońca,
  więc bywa fałszywy spokój
- roszada i promocja są w diffie pomijane zamiast pokazywane
- tryb „najpierw zgadnij" — znaczniki po odpowiedzi ucznia, nie przed
