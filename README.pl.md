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
- **partie towarzyskie (casual) — w porządku.** Do tego wtyczka jest zbudowana.
- **analiza, studia, zadania — bez ograniczeń.**

Klawisz `v` wyłącza całą nakładkę jednym naciśnięciem.

## Ustawienia na start

- słabe pola (`Shift+V`) **zostaw wyłączone** — na początku to głównie szum
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
| kreskowany wachlarz + kółko na pustym polu | grozi widelec | ktoś wskoczy tam w następnym ruchu |
| podwójna linia (dwie szyny) | bateria | figura za figurą na jednej linii |
| strzałka | ostatni ruch | i co ten ruch zaczął atakować |

### Zagrożenia, których jeszcze nie ma

Najważniejszy motyw dla początkującego: **grozi widelec**. Wtyczka rozgrywa za
przeciwnika każdy jego możliwy ruch i sprawdza, czy z nowego pola trafiłby dwie
cenne figury naraz. Jeśli tak — rysuje kółko na tym polu i kreskowane linie do
przyszłych ofiar.

Kółko czyta się jednoznacznie: **to jest pole do zabezpieczenia**. Ostrzeżenie
nie pojawia się, gdy pole jest już przez Ciebie kryte, bo wtedy skoczek po
prostu zginie i nie ma problemu.

### Związanie odbiera prawo bicia

Figura przybita do własnego króla **nie bije naprawdę** — nie może zejść z linii
związania. Wtyczka to uwzględnia po obu stronach:

- pion, który jest związany, nie liczy się jako napastnik, więc figura, którą
  „atakuje", nie dostaje alarmu „wisi"
- figura związana nie liczy się też jako obrońca, więc to, czego „broni", potrafi
  jednak być stratą

Związana figura może wciąż bić **wzdłuż linii związania**, łącznie ze zbiciem
tego, kto ją związał. A figura związana w poprzek własnego ruchu — na przykład
goniec przybity wzdłuż rzędu — jest zamrożona całkowicie.

Ostrzeżenie „grozi widelec" też o tym wie: przybity skoczek nigdzie nie skoczy.

### Bateria i król jako obrońca

Hetman za gońcem na tej samej przekątnej **nie jest zasłonięty, tylko
załadowany** — gdy goniec bije, hetman przejmuje linię. Wtyczka liczy taką
figurę jako drugiego napastnika, tak samo dla ataku i dla obrony.

Z tego wynika druga zasada: **król broni tylko do drugiego napastnika**. Nie
odbije na polu, które wciąż kryje kolejna figura przeciwnika, bo wszedłby pod
szacha. Pionek h7 broniony wyłącznie przez króla, atakowany przez baterię
goniec + hetman, jest po prostu stracony — i wtyczka pokazuje go jako wiszącego.

### Wymuszone przed ładnym

Widelec z szachem nie jest szansą do rozważenia, tylko faktem: król **musi**
uciec, więc druga figura spada na pewno. Dlatego motywy z szachem dostają dużą
premię do wagi i wchodzą na szachownicę przed spokojniejszymi, nawet gdy tamte
dotyczą cenniejszej figury.

Wymuszone motywy pomijają też kolejkę stron — pokazujemy je niezależnie od tego,
czyje są.

### Czyj to motyw

Najważniejsza informacja na szachownicy. **Mocny kolor to zagrożenie
przeciwnika, przygaszony to Twoja szansa.** Stronę wtyczka bierze z ustawienia
szachownicy — grasz tym kolorem, który masz na dole.

### Ile naraz

Domyślnie **trzy motywy**: najpierw wymuszone, potem zagrożenia przeciwnika,
a **jedno miejsce jest zawsze zarezerwowane na Twoją szansę** — inaczej gęsta
pozycja pełna pomysłów przeciwnika zasłoniłaby wszystko, co masz do zagrania. W gęstej pozycji logika znajduje ich
siedem czy osiem — narysowanie wszystkich naraz nie pokazuje niczego. Klawisz
`m` podnosi limit, gdy chcesz zobaczyć całość w analizie.

Przy każdym motywie pojawia się jego **nazwa**. Obraz plus słowo zapamiętuje się
dużo mocniej niż sam obraz — dlatego trenerzy każą nazywać motywy na głos.
Klawisz `n` wyłącza nazwy, gdy już ich nie potrzebujesz.

Linie **rysują się animacją** w kierunku zagrożenia, żeby oko podążyło wzdłuż
wektora. Animacja odpala się tylko przy faktycznej zmianie pozycji, a przy
włączonym systemowym ograniczeniu ruchu nie odpala się wcale.

### Legenda

W lewym dolnym rogu siedzi panel, celowo skromny. Pierwszy raz widzisz
**trzy wiersze** i zwinięty rozwijacz „taktyki" — pełna lista jedenastu motywów
czeka złożona, aż jej poszukasz. Panel dopasowuje się do jasnego motywu lichess,
zwija się do małego `?`, a wszystkie wybory zapamiętuje `localStorage`.

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

55 testów logiki szachowej. Część DOM-owa nie ma testów automatycznych — do niej
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
i kształtami, wpływ związania oraz baterii na liczenie ataków i obrony,
rozróżnienie zagrożeń
od własnych szans, limit motywów, animacja
rysowania linii, przełączniki klawiszowe, brak reakcji na klawisze podczas
pisania w czacie.

Nie zrobione:
- album motywów z partii do przeglądania po grze
- ostrzeżenie „grozi widelec" nie sprawdza, czy skoczek po drodze nie zostanie
  związany albo czy ruch nie jest nielegalny z powodu szacha
- liczniki są wspólne dla wszystkich profili w przeglądarce
- panel ustawień i zapamiętywanie preferencji poza legendą
- roszada i promocja są w diffie pomijane zamiast pokazywane
