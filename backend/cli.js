const fs = require("fs");
const path = require("path");

// CLI Argument Parsing for Systemd Setup
function handleCli() {
  const args = process.argv.slice(2);
  if (!args.includes('--setup-service')) return;

  const isRoot = process.getuid && process.getuid() === 0;
  const nodePath = process.execPath;
  const scriptPath = path.resolve(__filename, '..', 'server.js');
  const workingDir = path.dirname(path.dirname(scriptPath));
  const user = isRoot ? 'root' : process.env.USER || 'root';

  const serviceContent = `[Unit]
Description=StreamFlow Media Server
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${workingDir}
ExecStart=${nodePath} ${scriptPath}
Restart=on-failure
StandardOutput=append:/var/log/streamflow.log
StandardError=append:/var/log/streamflow.log

[Install]
WantedBy=multi-user.target
`;

  console.log("\n--- StreamFlow Systemd Service Generator ---");
  console.log(serviceContent);
  console.log("-------------------------------------------\n");

  if (isRoot) {
    const servicePath = '/etc/systemd/system/streamflow.service';
    try {
      fs.writeFileSync(servicePath, serviceContent);
      console.log(`✅ Service file written to ${servicePath}`);
      console.log("\nTo start the service, run:");
      console.log("  systemctl daemon-reload");
      console.log("  systemctl enable streamflow");
      console.log("  systemctl start streamflow\n");
    } catch (err) {
      console.error(`❌ Failed to write service file: ${err.message}`);
    }
  } else {
    console.log("💡 Tip: Run this command with 'sudo' to automatically install the service.");
    console.log("Or manually copy the content above to /etc/systemd/system/streamflow.service\n");
  }
  process.exit(0);
}

module.exports = handleCli;
