#!/bin/sh
set -eu
WEBHOOK_CONFIG=""
if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  WEBHOOK_CONFIG="    webhook_configs:
      - url: '${ALERT_WEBHOOK_URL}'
        send_resolved: true"
fi
sed -e "s#__WEBHOOK_CONFIG__#${WEBHOOK_CONFIG}#g" /etc/alertmanager/alertmanager.template.yml > /etc/alertmanager/alertmanager.yml
exec /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml --storage.path=/alertmanager
