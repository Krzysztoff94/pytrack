# PyTrack PWA

Prywatny tracker nauki Pythona, działający jako PWA na iPhonie. Dane sesji są przechowywane lokalnie w `localStorage` przeglądarki.

## Funkcje
- timer sesji: start, wstrzymanie, wznowienie i zapis
- temat sesji
- statystyki: dzisiaj, ostatnie 7 dni, liczba sesji
- kalendarz aktywności z ostatnich 12 tygodni
- ostatnie sesje i usuwanie pojedynczych wpisów
- eksport i import kopii JSON
- manifest PWA i cache offline

## Publikacja przez GitHub Pages
1. Utwórz nowe repozytorium GitHub, np. `pytrack`.
2. Wgraj wszystkie pliki z tego folderu do głównego katalogu repozytorium.
3. W repozytorium wybierz **Settings → Pages**.
4. W sekcji **Build and deployment** ustaw **Deploy from a branch**, wybierz `main` i folder `/(root)`, a następnie zapisz.
5. Poczekaj na publikację i otwórz adres podany w sekcji Pages, np. `https://TWOJ_LOGIN.github.io/pytrack/`.

Pliki używają ścieżek względnych, dlatego powinny działać w repozytorium publikowanym pod ścieżką `/pytrack/`.

## Dodanie do iPhone'a
1. Otwórz adres strony w Safari.
2. Naciśnij **Udostępnij**.
3. Wybierz **Dodaj do ekranu początkowego**.
4. Jeśli pojawi się opcja otwierania jako aplikacja webowa, pozostaw ją włączoną.

## Kopia zapasowa
W aplikacji wybierz **Eksportuj dane**. Zapisany plik JSON możesz później zaimportować na tym samym lub innym urządzeniu.

## Ważne ograniczenia
- Dane są lokalne dla konkretnej przeglądarki/instalacji. Nie synchronizują się automatycznie między urządzeniami.
- Wyczyszczenie danych Safari, usunięcie danych witryny lub pewne działania systemowe mogą spowodować utratę historii. Eksportuj kopię regularnie.
- Timer działa, gdy aplikacja jest otwarta. System iOS może wstrzymać stronę działającą w tle, więc aplikacja odtwarza czas na podstawie znaczników czasu po powrocie, ale aktualizacja wyświetlacza może być opóźniona.
- To nowa implementacja webowa. Nie importuje automatycznie danych z aplikacji SwiftUI.
