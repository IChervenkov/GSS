const METRIC_NAMES = Object.freeze({
  AUTH_LOGIN_ATTEMPTS_TOTAL: 'gss_auth_login_attempts_total',
  AUTH_TWO_FACTOR_ATTEMPTS_TOTAL: 'gss_auth_2fa_attempts_total',
  AUTH_USER_REQUESTS_TOTAL: 'gss_auth_qr_requests_total',
  AUTH_REFRESH_TOTAL: 'gss_auth_refresh_total',
  AUTH_FAILURES_TOTAL: 'gss_auth_failures_total',
  AUDIT_EVENTS_TOTAL: 'gss_security_audit_events_total',
  HTTP_ERROR_TOTAL: 'gss_http_error_total',
  SOCKET_CONNECTIONS_TOTAL: 'gss_socket_connections_total',
  SOCKET_ACTIVE_CONNECTIONS: 'gss_socket_active_connections',
  SOCKET_DISCONNECTS_TOTAL: 'gss_socket_disconnects_total',
  SOCKET_FORCED_DISCONNECTS_TOTAL: 'gss_socket_forced_disconnects_total',
  SOCKET_ROOM_JOINS_TOTAL: 'gss_socket_room_joins_total',
  SOCKET_ROOM_LEAVES_TOTAL: 'gss_socket_room_leaves_total',
  SOCKET_SUBSCRIPTION_ATTEMPTS_TOTAL: 'gss_socket_subscription_attempts_total',
  SOCKET_SUBSCRIPTION_REJECTIONS_TOTAL: 'gss_socket_subscription_rejections_total',
  SOCKET_ROOM_SUBSCRIPTIONS_TOTAL: 'gss_socket_room_subscriptions_total',
  SOCKET_PRINCIPAL_REEVALUATIONS_TOTAL: 'gss_socket_principal_reevaluations_total',
  SOCKET_EMIT_VALIDATION_FAILURES_TOTAL: 'gss_socket_emit_validation_failures_total',
});

module.exports = { METRIC_NAMES };
