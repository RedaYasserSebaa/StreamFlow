<p align="center">
  <img src="assets/favicon.png" alt="Stream Flow Icon" width="100" />
</p>

# Stream Flow

Welcome to **Stream Flow**, a standalone application that integrates movie and TV show discovery with automated torrent searching and **direct browser-based media streaming**. This app bypasses the need for manual downloads and provides an UI for your own torrent streams!

> [!WARNING]
> **Under Development:** Stream Flow is currently in active development. You may encounter bugs, performance issues, or incomplete features. Your feedback and contributions are highly appreciated!

---

## 🚀 How to Install and Use

You can install Stream Flow using one of three methods:

### Method 1: Using the Installer (Windows `.exe` or Linux `.deb`)
1. **Download:** Go to the **Releases** tab on this GitHub repository and download the latest Windows `.exe` or Linux `.deb` installer.
2. **Install:** Double click the file or run `sudo dpkg -i streamflow.deb` to install the application.
3. **Run:** Once installed, Stream Flow runs as a lightweight background server and will automatically open the streaming UI in your default web browser.

### Method 2: Using NPM (NodeJS)
If you already have NodeJS installed, you can download and run the application entirely from the terminal:
1. **Install globally:**
   ```bash
   # Use sudo to ensure systemd setup is available
   sudo npm install -g streamflow-app
   ```
2. **Setup as Service (Optional but Recommended):**
   ```bash
   sudo streamflow-app --setup-service
   sudo systemctl start streamflow
   ```
3. **Run Manually:**
   ```bash
   streamflow-app
   ```
   *The server will start on port 7676. Open `http://localhost:7676` in your browser.*

### Method 3: Using Docker (Headless Server)
For server administrators or NAS setups, you can run the headless Stream Flow container:
1. **Pull and Run the image:**
   ```bash
   docker run -d -p 7676:7676 redayasser/streamflow:latest
   ```
2. **Access:** Open `http://localhost:7676` in your browser.

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

If you are a developer and wish to run the app from source, modify the code, or build the installer yourself:

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
4. **Build the Standalone Windows Installer yourself**
   ```bash
   npm run build
   ```
   *The built `.exe` will be saved to the `dist-installer/` directory.*

---

## License

This project is licensed under the MIT License.
