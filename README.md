# Chess Vision — wtyczka do lichess

Rysuje na szachownicy relacje, których początkujący jeszcze nie widzi: kto co
bije, widelce, związania, przeciążone figury, słaby ostatni rząd i skutek
ostatniego ruchu.

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
| `n` | nazwy motywów |
| `d` | skutek ostatniego ruchu |
| `Shift+V` | słabe pola (domyślnie wyłączone, bo hałasują) |

## Język wizualny

Zasada: zagrożenie to **relacja między polami**, więc rysujemy je linią, nigdy
kolorowym polem. Linia ma kierunek i długość — to zapamiętuje oko („goniec tnie
całą długą przekątną"). Podświetlony kwadrat nie zostawia w głowie nic.

Drugi filar: każdy motyw ma **zawsze ten sam kształt**, niezależnie od pozycji.
Po kilkudziesięciu powtórzeniach kształt sam wskakuje do głowy jako całość —
tak właśnie widzi mocny gracz.

| Kształt | Motyw | Znaczenie |
|---|---|---|
| linia ciągła | wisi | kto bije i co; nikt nie broni |
| linia kreskowana | strata | obrońcy są, ale wymiana i tak przegrywa |
| wachlarz linii z jednego pola | widelec | jedna figura, dwa cele |
| linia biegnąca przez figurę | związanie | przez figurę do cenniejszej za nią |
| kilka linii kreskowanych z jednej figury | przeciążony | broni dwóch rzeczy naraz |
| przerywana ramka wokół króla | ostatni rząd | król bez okienka |
| strzałka | ostatni ruch | i co ten ruch zaczął atakować |

Przy każdym motywie pojawia się jego **nazwa**. Obraz plus słowo zapamiętuje się
dużo mocniej niż sam obraz — dlatego trenerzy każą nazywać motywy na głos.
Klawisz `n` wyłącza nazwy, gdy już ich nie potrzebujesz.

Linie **rysują się animacją** w kierunku zagrożenia, żeby oko podążyło wzdłuż
wektora. Animacja odpala się tylko przy faktycznej zmianie pozycji, a przy
włączonym systemowym ograniczeniu ruchu nie odpala się wcale.

W lewym dolnym rogu siedzi legenda z tym samym opisem. Klikasz `–` i zwija się
do małego `?`; wybór zapamiętuje się w `localStorage`.

## Jak to działa

- `src/attacks.js` — czysta logika, zero DOM. Mapa ataków, wiszące figury,
  motywy (widelec, związanie, przeciążenie, ostatni rząd), słabe pola,
  porównanie dwóch pozycji. Jedyny plik, który da się sensownie testować.
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

26 testów logiki szachowej. Część DOM-owa nie ma testów automatycznych — do niej
służy `test/harness.html`, strona odtwarzająca markup chessground:

```bash
python3 -m http.server 8123
```

i otwórz <http://localhost:8123/test/harness.html>. W konsoli masz
`setFen('...')` do podmiany pozycji i `chessVision.render()`. Pliki źródłowe są
doładowywane z pieczątką czasu, więc przeglądarka nie podsunie starej wersji.

## Stan

Zweryfikowane: selektory chessground odczytane z żywego lichess, odczyt pozycji
w obu orientacjach, odświeżanie po ruchu, wszystkie motywy wraz z nazwami,
animacja rysowania linii, przełączniki klawiszowe, brak reakcji na klawisze
podczas pisania w czacie.

Nie zrobione:
- panel ustawień i zapamiętywanie preferencji poza legendą
- związanie wykrywamy, ale liczenie obrońców jeszcze go nie uwzględnia —
  figura związana wciąż liczy się jako pełnoprawny obrońca
- roszada i promocja są w diffie pomijane zamiast pokazywane
- album motywów z partii do przeglądania po grze
