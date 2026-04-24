<p align="center">
  <img src="assets/favicon.png" alt="Stream Flow Icon" width="100" />
</p>

# Stream Flow

Welcome to **Stream Flow**, a standalone application that integrates movie and TV show discovery with automated torrent searching and **direct browser-based media streaming**. This app bypasses the need for manual downloads and provides a beautiful UI for your own torrent streams!

> [!WARNING]
> **Under Development:** Stream Flow is currently in active development. You may encounter bugs, performance issues, or incomplete features. Your feedback and contributions are highly appreciated!

---

## 🚀 How to Install and Use

### Method 1: Using Docker (Recommended)
For server administrators, NAS setups, or Linux users, Docker is the fastest and most reliable way to run Stream Flow:
1. **Pull and Run the image:**
   ```bash
   docker run -d -p 7676:7676 redayasser/streamflow:latest
   ```
2. **Access:** Open `http://localhost:7676` in your browser.
3. **Data Persistence (Optional):** To keep your configuration across updates:
   ```bash
   docker run -d -p 7676:7676 -v streamflow_data:/app/data --name streamflow redayasser/streamflow:latest
   ```

### Method 2: Using the Windows Installer
1. **Download:** Go to the **Releases** tab on this GitHub repository and download the latest `StreamFlow Setup.exe`.
2. **Install:** Double-click the file to install the application.
3. **Run:** Once installed, Stream Flow runs as a lightweight background server and will automatically open the streaming UI in your default web browser.

### Initial Setup Requirements
When you first launch the app, you will be directed to a setup page that requires two external services:

1. **TMDB API Key (For Posters & Metadata)**: 
   - Create a free account at [themoviedb.org](https://www.themoviedb.org/).
   - Go to Account Settings > API, and copy your Developer API Key.
2. **Jackett (For Torrent Scraping)**: 
   - Jackett works as a proxy to search across multiple torrent sites simultaneously.
   - Download and install Jackett from their [GitHub Releases](https://github.com/Jackett/Jackett/releases).
   - Add your preferred torrent indexers in the Jackett dashboard.
   - Copy your Jackett API key and port (default is `9117`) and enter them into the Stream Flow setup page.

---

## 🛠️ Local Development 

If you are a developer and wish to run the app from source:

1. **Clone the project**
   ```bash
   git clone https://github.com/RedaYasserSebaa/StreamFlow
   cd StreamFlow
   ```
2. **Install NodeJS dependencies**
   ```bash
   npm install
   ```
3. **Start the application**
   ```bash
   npm start
   ```

---

## License

This project is licensed under the MIT License.
