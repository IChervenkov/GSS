#!/bin/sh
set -eu
awk \
  -v metrics_path="${GSS_METRICS_PATH:-/metrics}" \
  -v metrics_scheme="${GSS_METRICS_SCHEME:-http}" \
  -v target_host="${GSS_TARGET_HOST:-host.docker.internal}" \
  -v target_port="${GSS_TARGET_PORT:-3000}" \
  -v metrics_token="${GSS_METRICS_TOKEN:-}" '
function yaml_quote(value) {
  gsub(/\047/, "\047\047", value)
  return "\047" value "\047"
}
{
  gsub(/__GSS_METRICS_PATH__/, metrics_path)
  gsub(/__GSS_METRICS_SCHEME__/, metrics_scheme)
  gsub(/__GSS_TARGET_HOST__/, target_host)
  gsub(/__GSS_TARGET_PORT__/, target_port)
  if ($0 == "__GSS_AUTH_BLOCK__") {
    if (metrics_token != "") {
      print "    authorization:"
      print "      credentials: " yaml_quote(metrics_token)
    }
    next
  }
  print
}
' /etc/prometheus/prometheus.template.yml > /etc/prometheus/prometheus.yml
exec /bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/prometheus --web.enable-lifecycle
