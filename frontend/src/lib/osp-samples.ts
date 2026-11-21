// Przykładowe opisy stanowisk pracy (skrót z docs/HackNation/…/OSP_word.zip).
// Służą do szybkiego wyboru OSP w kreatorze; zawsze można wkleić własny opis.

export interface OspSample {
  id: string;
  title: string;
  manages_people: boolean;
  suggested_competency_ids: string[];
  text: string;
}

export const OSP_SAMPLES: OspSample[] = [
  {
    id: "DC-WZKSOiC-6",
    title: "Starszy specjalista – Departament Cyberbezpieczeństwa (DC WZKSOiC 6)",
    manages_people: false,
    suggested_competency_ids: ["K11", "K07"],
    text: `Cel istnienia stanowiska: prowadzenie spraw dotyczących zarządzania kryzysowego w cyberprzestrzeni pozostających w zakresie ministra właściwego ds. informatyzacji.
Liczba podległych pracowników: brak.
Zadania dominujące:
1. Udział w opracowaniu i aktualizacji dokumentacji w zakresie zarządzania kryzysowego (np. Krajowego planu reagowania na incydenty i sytuacje kryzysowe w cyberbezpieczeństwie).
2. Udział w realizacji zadań zarządzania kryzysowego wynikających z członkostwa Polski w NATO, UE i ONZ.
3. Współpraca z zespołami CSIRT i organami właściwymi do spraw cyberbezpieczeństwa.
Złożoność: zadania o umiarkowanym stopniu złożoności, samodzielny wybór rozwiązania spośród dostępnych procedur, interpretacja przepisów, sytuacje nietypowe wymagające szybkiego działania.`,
  },
  {
    id: "DSI-WWI-5",
    title: "Radca – Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji (DSI WWI 5)",
    manages_people: false,
    suggested_competency_ids: ["K07", "K05"],
    text: `Cel istnienia stanowiska: wsparcie merytoryczne rozwoju innowacyjnych rozwiązań opartych na sztucznej inteligencji, rozwijanie mechanizmów zgodności z przepisami i identyfikowanie barier dla innowacyjności.
Liczba podległych pracowników: brak.
Zadania dominujące:
1. Analiza prawa krajowego i UE, orzecznictwa i wytycznych w obszarze AI oraz propozycje zmian systemowych.
2. Prowadzenie spraw dotyczących opinii indywidualnych i wyjaśnień stosowania przepisów z zakresu AI.
3. Przygotowywanie projektów informacji zawierających pogląd Komisji w sprawach AI.
Złożoność: wysoka; opracowywanie nowych zasad, analiza korzyści i ryzyka, przekonujące przedstawianie argumentów, sytuacje bezprecedensowe.`,
  },
  {
    id: "DWM-WKAM-1",
    title: "Naczelnik wydziału – Departament Współpracy Międzynarodowej (DWM WKAM 1)",
    manages_people: true,
    suggested_competency_ids: ["K08", "K09"],
    text: `Cel istnienia stanowiska: organizacja aktywności międzynarodowej kierownictwa MC, koordynacja spraw budżetowo-finansowych departamentu, zarządzanie procesem delegacji zagranicznych.
Liczba podległych pracowników: bezpośrednio kieruje pracą od 5 do 9 pracowników.
Zadania dominujące:
1. Koordynacja pracy zespołu: planowanie, organizowanie, nadzorowanie, delegowanie, motywowanie i rozwój pracowników.
2. Nadzór nad przygotowaniem zagranicznych wizyt kierownictwa MC i wizyt gości zagranicznych.
3. Koordynacja spraw finansowo-budżetowych departamentu, w tym dotacji i decyzji administracyjnych.
Złożoność: opracowywanie nowych rozwiązań systemowych, inicjowanie dyskusji w kwestiach spornych, przekonywanie do zmiany stanowiska, rozwiązywanie sporów.`,
  },
];
