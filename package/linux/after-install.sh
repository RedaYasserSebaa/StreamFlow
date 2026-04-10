#!/bin/bash

# Reload systemd to recognize the new service
systemctl daemon-reload

# Enable the service to start on boot
systemctl enable streamflow.service

# Start the service immediately
systemctl start streamflow.service

echo "StreamFlow background service has been started and enabled."
