🤖 AI News Agent – Automated Innovation Radar
A Google Apps Script agent that monitors 15 RSS sources from the world of AI, cybersecurity, and tech policy — then uses Gemini 2.5 Flash to translate, analyze, and deliver a formatted HTML report to your mailing list every morning.

📸 What the Report Looks Like
Each news card contains:

Title – translated to Polish, highlighted in blue
Source – small gray label
Summary – 2–3 sentence description of what's happening
Strategic Insight – why it matters for business, in a highlighted box
Read Full Article – direct link button to the original source


⚙️ How It Works
RSS Sources (15x) → Deduplicate via Google Sheets → Gemini 2.5 Flash → HTML Email → BCC Mailing List

Fetches up to 5 latest articles from each RSS source
Checks a Google Sheets database to skip already-seen links (buffered — read once per run)
Sends new articles to Gemini 2.5 Flash for translation and analysis
Wraps the AI output in an HTML email template
Delivers the report via BCC to all recipients on the mailing list
Logs statistics and sends an alert email if anything goes wrong


🗂️ RSS Sources Included
CategorySourcesAI – Models & ToolsAnthropic, OpenAI, Microsoft AI Blog, Towards Data Science, MIT Technology ReviewBusiness & InnovationTechCrunch AI, VentureBeat AI, The Verge AI, OPI.org.plCybersecurityCyberDefence24, Krebs on SecurityRegulation & PolicyPolitico EU AI, UK DSIT, SCMP

🚀 Setup Guide
1. Create a Google Spreadsheet
Create a new Google Sheets file with three tabs:
Tab namePurposeBaza_NewsowStores seen article links (auto-filled)Lista_MailowaYour mailing list – one email per row, starting from row 2StatystykiRun statistics (auto-filled)
2. Open Google Apps Script
Go to script.google.com → New project → paste the code.
3. Set Your Spreadsheet URL
In the code, replace the placeholder:
javascriptconst SPREADSHEET_URL = "PASTE_YOUR_SPREADSHEET_URL_HERE";
4. Add Your Gemini API Key
Get a free API key from Google AI Studio:

In Apps Script, click ⚙️ Project Settings
Scroll to Script Properties
Click Edit script properties → Add property:

Property: GEMINI_KEY
Value: your_api_key_here



5. Set a Time Trigger

Click the ⏰ Triggers icon in the left panel
Add trigger → Function: runAgent
Time-based → Day timer → e.g. 7:00–8:00 AM


🔒 Security

The Gemini API key is never stored in the code — it's read securely from Script Properties at runtime
Recipients receive the report via BCC — no one sees other subscribers
The spreadsheet URL is the only value you need to configure directly in the code


🛡️ Reliability Features

Buffered deduplication — the link database is loaded once per run (not once per article)
Exponential backoff — if Gemini returns 429/503, the agent retries up to 3 times with increasing wait times (2s → 4s → 8s)
Critical error alerts — if the agent fails completely, you receive an email notification with the error details
Broken RSS handling — malformed feeds are silently skipped without crashing the agent


🧰 Tech Stack

Google Apps Script – runtime and scheduling
Gemini 2.5 Flash API – AI translation and analysis
Google Sheets – link database and mailing list
Gmail (MailApp) – report delivery
