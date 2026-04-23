#!/bin/bash

# Stop the service
systemctl stop streamflow.service

# Disable the service
systemctl disable streamflow.service

# Remove the service file from the system directory
rm -f /lib/systemd/system/streamflow.service

# Reload systemd
systemctl daemon-reload

echo "StreamFlow background service has been stopped and removed."
