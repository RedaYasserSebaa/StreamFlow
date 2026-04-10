#!/bin/bash

# Disable the service
systemctl disable streamflow.service

# Remove the service file from the system directory
rm -f /lib/systemd/system/streamflow.service

# Reload systemd to recognize the new service
systemctl daemon-reload


# Start the service immediately
systemctl start streamflow.service

echo "StreamFlow background service has been started and enabled."
