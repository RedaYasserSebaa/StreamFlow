#!/bin/bash

# Stop the service
systemctl stop streamflow.service

# Disable the service
systemctl disable streamflow.service

# Reload systemd
systemctl daemon-reload

echo "StreamFlow background service has been stopped and disabled."
