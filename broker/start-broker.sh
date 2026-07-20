#!/bin/sh
set -eu

required_vars='MQTT_BAG_PASSWORD MQTT_JETSON_PASSWORD MQTT_SERVER_PASSWORD'
for name in $required_vars; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "[Mosquitto] Missing required environment variable: $name" >&2
    exit 1
  fi
done

password_file=/mosquitto/config/password_file
umask 077
mosquitto_passwd -b -c "$password_file" bag01 "$MQTT_BAG_PASSWORD"
mosquitto_passwd -b "$password_file" jetson "$MQTT_JETSON_PASSWORD"
mosquitto_passwd -b "$password_file" server "$MQTT_SERVER_PASSWORD"

exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
