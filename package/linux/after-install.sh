#!/bin/bash

# Copy the service file to the system directory
# The file is copied to /opt/StreamFlow by extraFiles in package.json
cp /opt/StreamFlow/streamflow.service /lib/systemd/system/streamflow.service

# Set correct permissions
chmod 644 /lib/systemd/system/streamflow.service

# Reload systemd to recognize the new service
systemctl daemon-reload

# Enable and Start the service
systemctl enable streamflow.service
systemctl start streamflow.service

echo "StreamFlow background service has been started and enabled."
