# Chess Vision — wtyczka do lichess

Rysuje na szachownicy relacje, których początkujący jeszcze nie widzi: kto co
bije, widelce, związania, szpikulce, odsłony, przeciążone figury, uwięzione
figury, wolne piony, słaby ostatni rząd i skutek ostatniego ruchu.

Bez silnika. Wtyczka **nigdy nie podpowiada najlepszego ruchu** — pokazuje tylko
to, co i tak jest na szachownicy, ale trzeba to umieć zobaczyć.

**Cel: stać się niepotrzebną.** Wtyczka ma przyspieszyć naukę patrzenia, a nie
myśleć za gracza. Miarą sukcesu jest to, ile widzisz po jej wyłączeniu.

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
| `m` | ile motywów naraz: 3 → 6 → wszystkie |
| `p` | pokaż motywy już opanowane |
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
| linia na wylot, cenniejsza z przodu | szpikulec | ta z przodu musi uciec, ta z tyłu padnie |
| linia kreskowana przez własną figurę | odsłona | ruszysz ją, otworzysz atak |
| kilka linii kreskowanych z jednej figury | przeciążony | broni dwóch rzeczy naraz |
| pełna ramka wokół figury | uwięziona | nie ma bezpiecznego pola |
| przerywana ramka wokół króla | ostatni rząd | król bez okienka |
| kreskowana linia w górę linii | wolny pion | droga do promocji wolna |
| strzałka | ostatni ruch | i co ten ruch zaczął atakować |

### Czyj to motyw

Najważniejsza informacja na szachownicy. **Mocny kolor to zagrożenie
przeciwnika, przygaszony to Twoja szansa.** Stronę wtyczka bierze z ustawienia
szachownicy — grasz tym kolorem, który masz na dole.

### Ile naraz

Domyślnie **trzy motywy**, wybierane po tym, ile materiału jest w grze,
z pierwszeństwem dla zagrożeń przeciwnika. W gęstej pozycji logika znajduje ich
siedem czy osiem — narysowanie wszystkich naraz nie pokazuje niczego. Klawisz
`m` podnosi limit, gdy chcesz zobaczyć całość w analizie.

Przy każdym motywie pojawia się jego **nazwa**. Obraz plus słowo zapamiętuje się
dużo mocniej niż sam obraz — dlatego trenerzy każą nazywać motywy na głos.
Klawisz `n` wyłącza nazwy, gdy już ich nie potrzebujesz.

Linie **rysują się animacją** w kierunku zagrożenia, żeby oko podążyło wzdłuż
wektora. Animacja odpala się tylko przy faktycznej zmianie pozycji, a przy
włączonym systemowym ograniczeniu ruchu nie odpala się wcale.

W lewym dolnym rogu siedzi legenda z tym samym opisem. Klikasz `–` i zwija się
do małego `?`; wybór zapamiętuje się w `localStorage`.

## Tryb ucznia

Wtyczka liczy, ile razy pokazała Ci każdy typ motywu, i **stopniowo się
wycofuje**:

| Ile razy widziałeś | Co rysuje |
|---|---|
| do 40 | pełna linia i nazwa motywu |
| 40–150 | cieńsza, przygaszona linia, **bez nazwy** |
| powyżej 150 | nic — chyba że naciśniesz `p` |

Nic nie jest opóźniane ani ukrywane przed nauką: sygnał zawsze pojawia się
natychmiast. Blaknie tylko tam, gdzie już umiesz. Najpierw znika słowo, potem
kształt — bo słowo jest rusztowaniem dla kształtu, a kształt dla nawyku.

Liczniki widać w legendzie przy każdym motywie; przekreślona nazwa znaczy
„opanowane". To jest pasek postępu: patrzysz, jak rusztowanie się cofa.

**Przycisk „Tryb ucznia" w legendzie wyłącza to jednym kliknięciem** — wtedy
wszystko rysuje się pełną siłą, bez wycofywania. Ustawienie i liczniki
zapamiętują się między sesjami. Przycisk „wyzeruj" kasuje postęp, przydatny gdy
wtyczki używa ktoś inny.

## Jak to działa

- `src/attacks.js` — czysta logika, zero DOM. Mapa ataków, wiszące figury,
  motywy z wagą i stroną, która na nich korzysta, słabe pola, porównanie dwóch
  pozycji. Jedyny plik, który da się sensownie testować.
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

35 testów logiki szachowej. Część DOM-owa nie ma testów automatycznych — do niej
służy `test/harness.html`, strona odtwarzająca markup chessground:

```bash
python3 -m http.server 8123
```

i otwórz <http://localhost:8123/test/harness.html>. W konsoli masz
`setFen('...')` do podmiany pozycji i `chessVision.render()`. Pliki źródłowe są
doładowywane z pieczątką czasu, więc przeglądarka nie podsunie starej wersji.

## Stan

Zweryfikowane: selektory chessground odczytane z żywego lichess, odczyt pozycji
w obu orientacjach, odświeżanie po ruchu, wszystkie motywy wraz z nazwami
i kształtami, rozróżnienie zagrożeń od własnych szans, limit motywów, animacja
rysowania linii, przełączniki klawiszowe, brak reakcji na klawisze podczas
pisania w czacie.

Nie zrobione:
- album motywów z partii do przeglądania po grze
- liczniki są wspólne dla wszystkich profili w przeglądarce
- panel ustawień i zapamiętywanie preferencji poza legendą
- związanie wykrywamy, ale liczenie obrońców jeszcze go nie uwzględnia —
  figura związana wciąż liczy się jako pełnoprawny obrońca
- roszada i promocja są w diffie pomijane zamiast pokazywane
