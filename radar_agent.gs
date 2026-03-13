// === 1. KONFIGURACJA ===
// Klucz pobierany z: Ustawienia Projektu (koło zębate) -> Właściwości skryptu -> GEMINI_KEY
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
const EMAIL_ADMINA = Session.getActiveUser().getEmail(); 
const SPREADSHEET_URL = "WKLEJ_TUTAJ_URL_SWOJEGO_ARKUSZA";

const RSS_SOURCES = [
  // --- AI - MODELE I NARZĘDZIA ---
  "https://www.anthropic.com/news/rss.xml",
  "https://blogs.microsoft.com/ai/feed/",
  "https://openai.com/news/rss.xml",
  "https://towardsdatascience.com/feed",
  "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  // --- BIZNES I INNOWACJE ---
  "https://techcrunch.com/category/artificial-intelligence/feed/",
  "https://venturebeat.com/category/ai/feed/",
  "https://techspark.co/feed/",
  "https://opi.org.pl/feed/",
  "https://www.theverge.com/rss/artificial-intelligence/index.xml",
  // --- CYBERBEZPIECZEŃSTWO ---
  "https://cyberdefence24.pl/rss",
  "https://krebsonsecurity.com/feed/",
  // --- REGULACJE I POLITYKA ---
  "https://www.politico.eu/section/artificial-intelligence/feed/",
  "https://www.gov.uk/government/organisations/department-for-science-innovation-and-technology.atom",
  // --- POZOSTAŁE ---
  "https://www.scmp.com/rss/318421/feed"
];

// === 2. GŁÓWNA FUNKCJA (Z PEŁNĄ OBSŁUGĄ BŁĘDÓW) ===
function runAgent() {
  try {
    Logger.log("🤖 Inicjalizacja Agenta v7.6...");
    
    if (!GEMINI_API_KEY) {
      throw new Error("Brak klucza GEMINI_KEY w PropertiesService! Sprawdź ustawienia projektu.");
    }

    // BUFOROWANIE BAZY: Pobieramy linki tylko RAZ na sesję
    const buforLinkow = pobierzWszystkieLinkiZBazy();
    Logger.log(`📦 Wczytano bufor: ${buforLinkow.size} pozycji.`);

    // POBIERANIE NEWSÓW
    const rawNews = fetchAllRSS(RSS_SOURCES, buforLinkow);
    
    if (!rawNews || rawNews.length < 50) {
      Logger.log("🤖 Brak nowych newsów do przetworzenia.");
      return;
    }

    // ANALIZA AI Z MECHANIZMEM RETRY
    Logger.log("🤖 Wysyłam do Gemini 2.5 Flash (z obsługą Retry)...");
    const aiAnalysis = callGeminiAPI(rawNews);
    
    if (!aiAnalysis) {
      throw new Error("Gemini nie odpowiedziało po wszystkich próbach ponowienia.");
    }

    // WYSYŁKA
    const listaOdbiorcow = pobierzListeMailingowa();
    if (!listaOdbiorcow) {
      throw new Error("Nie można pobrać listy mailingowej z Arkusza.");
    }

    const liczbaOdbiorcow = listaOdbiorcow.split(",").length;
    wyslijRaport(aiAnalysis, listaOdbiorcow, liczbaOdbiorcow);
    
    // STATYSTYKI
    aktualizujStatystyki(liczbaOdbiorcow);
    Logger.log("✅ Raport wysłany pomyślnie.");

  } catch (error) {
    Logger.log("❌ BŁĄD KRYTYCZNY: " + error.message);
    MailApp.sendEmail({
      to: EMAIL_ADMINA,
      subject: "⚠️ AWARYJNY ALERT AGENTA: " + error.message.substring(0, 50),
      body: `Cześć Patryk,\n\nAgent napotkał błąd, którego nie mógł sam naprawić:\n\nTreść: ${error.message}\n\nSprawdź logi w Google Apps Script.`
    });
  }
}

// === 3. MODUŁ GEMINI (Z MECHANIZMEM EXPONENTIAL BACKOFF) ===
function callGeminiAPI(newsData) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const systemPrompt = `Jesteś Ekspertem AI. Przetłumacz i sformatuj newsy na polski. 
  Wymagane: Tytuł (niebieski), Źródło (szare), Opis (O co chodzi), Wniosek w ramce. 
  Zwróć TYLKO czysty HTML.`;

  const payload = { "contents": [{ "parts": [{ "text": systemPrompt + "\n\nDATA:\n" + newsData }] }] };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };

  const MAX_RETRIES = 3;
  let waitTime = 2000; // 2 sekundy na start

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      const code = response.getResponseCode();
      const text = response.getContentText();

      if (code === 200) {
        const json = JSON.parse(text);
        return json.candidates[0].content.parts[0].text.replace(/```html|```/g, "").trim();
      }

      // Jeśli błąd to 429 (limit) lub 5xx (serwer) - czekamy
      if ([429, 500, 502, 503, 504].includes(code)) {
        Logger.log(`⚠️ Próba ${i+1} nieudana (Kod: ${code}). Kolejne podejście za ${waitTime/1000}s...`);
        Utilities.sleep(waitTime);
        waitTime *= 2; // Wydłużamy czekanie dwukrotnie
        continue;
      }

      throw new Error(`Błąd API Gemini (${code}): ${text}`);

    } catch (e) {
      if (i === MAX_RETRIES - 1) throw e;
      Logger.log(`⚠️ Błąd połączenia (Próba ${i+1}): ${e.message}`);
      Utilities.sleep(waitTime);
      waitTime *= 2;
    }
  }
  return null;
}

// === 4. MODUŁ POBIERANIA RSS (Z BUFOREM) ===
function fetchAllRSS(urls, buforLinkow) {
  let combinedText = "";
  urls.forEach(url => {
    try {
      let response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, timeout: 10000});
      if (response.getResponseCode() !== 200) return;
      
      let xml = response.getContentText().replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/g, '&amp;');
      const document = XmlService.parse(xml);
      const root = document.getRootElement();
      const ns = root.getNamespace();
      let items = root.getName() === 'feed' ? root.getChildren('entry', ns) : (root.getChild('channel') ? root.getChild('channel').getChildren('item') : []);

      items.slice(0, 5).forEach(item => {
        const title = item.getChildText("title") || item.getChildText("title", ns);
        let linkElem = item.getChild("link") || item.getChild("link", ns);
        let link = linkElem ? (linkElem.getText() || linkElem.getAttribute("href")?.getValue() || "") : "";
        
        // SZYBKIE SPRAWDZENIE W BUFORZE RAM
        if (title && link && !buforLinkow.has(link)) {
          combinedText += `TYTUŁ: ${title}\nŹRÓDŁO: ${url}\nLINK: ${link}\n---\n`;
          zapiszLinkDoBazy(link, url); 
          buforLinkow.add(link);
        }
      });
    } catch (e) { Logger.log("⚠️ RSS pominięty: " + url); }
  });
  return combinedText;
}

// === 5. MODUŁ WYSYŁKI RAPORTU ===
function wyslijRaport(aiAnalysis, bccList, count) {
  const dataDzisiaj = Utilities.formatDate(new Date(), "GMT+1", "dd.MM.yyyy");
  const htmlTemplate = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #1a73e8, #0d47a1); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px;">🤖 Radar Innowacji AI</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">Monitoring Strategiczny | ${dataDzisiaj}</p>
      </div>
      <div style="padding: 25px;">${aiAnalysis}</div>
      <div style="padding: 20px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #eee; font-size: 11px; color: #666;">
        <p>System: Gemini 2.5 Flash | Agent v7.6 "Ironclad"</p>
        <p style="color: #1a73e8; font-weight: bold;">✅ Status: Wysłano do ${count} odbiorców.</p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: EMAIL_ADMINA,
    bcc: bccList,
    subject: "🤖 Radar Innowacji AI | " + dataDzisiaj,
    htmlBody: htmlTemplate
  });
}

// === 6. POMOCNICZE (BUFOROWANIE I BAZA) ===
function pobierzWszystkieLinkiZBazy() {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Baza_Newsow");
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return new Set();
    const data = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    return new Set(data.flat());
  } catch (e) { return new Set(); }
}

function pobierzListeMailingowa() {
  try {
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    const sheet = ss.getSheetByName("Lista_Mailowa");
    const emails = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    return emails.flat().filter(String).join(","); 
  } catch (e) { return null; }
}

function zapiszLinkDoBazy(link, zrodlo) {
  try {
    const sheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL).getSheetByName("Baza_Newsow");
    sheet.appendRow([new Date(), link, zrodlo]);
  } catch (e) { }
}

function aktualizujStatystyki(liczbaOdbiorcow) {
  try {
    const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    let statsSheet = ss.getSheetByName("Statystyki") || ss.insertSheet("Statystyki");
    const totalNews = ss.getSheetByName("Baza_Newsow").getLastRow() - 1;
    statsSheet.appendRow([new Date(), totalNews, liczbaOdbiorcow]);
  } catch (e) { }
}
