output "api_url" {
  value = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "web_url" {
  value = "https://${azurerm_linux_web_app.web.default_hostname}"
}

output "postgres_server_name" {
  value = azurerm_postgresql_flexible_server.postgres.name
}

output "redis_hostname" {
  value = azurerm_managed_redis.redis.hostname
}
