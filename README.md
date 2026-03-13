# AI News & Jobs Aggregator Agent

## 🚀 Overview
An automated, serverless agent built with **Google Apps Script** that aggregates news and job offers related to AI from various sources.

## 🛠️ Key Technical Features
- **Anti-Bot Logic:** Implemented User-Agent spoofing to bypass simple server-side blocks.
- **Data Deduplication:** Uses `PropertiesService` as a Key-Value store to ensure no redundant content is delivered.
- **Proxy Workaround:** Uses Google News Aggregator as a proxy to fetch data from protected portals (avoiding Cloudflare blocks).
- **Automated Triggers:** Fully serverless execution on a 48h freshness filter.

## 💻 Tech Stack
- **Language:** JavaScript / Google Apps Script
- **Infrastructure:** Google Workspace (Serverless)
- **Data Format:** JSON / RSS
