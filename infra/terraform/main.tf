data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "rg" {
  name     = "${var.app_name}-rg-${var.environment}"
  location = var.location
}

# Key Vault
resource "azurerm_key_vault" "kv" {
  name                = "${var.app_name}-kv-${var.environment}-2"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge"
    ]
  }
}

resource "azurerm_key_vault_secret" "jwt_access_secret" {
  name         = "jwt-access-secret"
  value        = var.jwt_access_secret
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "jwt_refresh_secret" {
  name         = "jwt-refresh-secret"
  value        = var.jwt_refresh_secret
  key_vault_id = azurerm_key_vault.kv.id
}

# Postgres Flexible Server
resource "azurerm_postgresql_flexible_server" "postgres" {
  name                   = "${var.app_name}-postgres-${var.environment}"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "16"
  administrator_login    = "leaderprism"
  administrator_password = var.postgres_admin_password
  storage_mb             = 32768
  sku_name               = "B_Standard_B1ms"
  backup_retention_days  = 7
  geo_redundant_backup_enabled = false
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "leaderprism"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Redis
resource "azurerm_redis_cache" "redis" {
  name                = "${var.app_name}-redis-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"
  non_ssl_port_enabled = false
}

# Storage Account
resource "azurerm_storage_account" "storage" {
  name                     = replace("${var.app_name}st${var.environment}", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# App Service Plan
resource "azurerm_service_plan" "plan" {
  name                = "${var.app_name}-plan-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1"
}

# App Service - API
resource "azurerm_linux_web_app" "api" {
  name                = "${var.app_name}-api-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = {
    "NODE_ENV"                        = "production"
    "PORT"                            = "3001"
    "DATABASE_URL"                    = "postgresql://leaderprism:${var.postgres_admin_password}@${azurerm_postgresql_flexible_server.postgres.name}.postgres.database.azure.com/leaderprism?sslmode=require"
    "REDIS_URL"                       = "redis://${azurerm_redis_cache.redis.hostname}:${azurerm_redis_cache.redis.ssl_port},password=${azurerm_redis_cache.redis.primary_access_key},ssl=True,abortConnect=False"
    "AZURE_STORAGE_CONNECTION_STRING" = azurerm_storage_account.storage.primary_connection_string
    "AZURE_KEY_VAULT_URI"             = azurerm_key_vault.kv.vault_uri
  }
}

# App Service - Web
resource "azurerm_linux_web_app" "web" {
  name                = "${var.app_name}-web-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = {
    "NODE_ENV"            = "production"
    "INTERNAL_API_URL"    = "https://${azurerm_linux_web_app.api.default_hostname}"
    "NEXT_PUBLIC_API_URL" = "https://${azurerm_linux_web_app.api.default_hostname}/api/v1"
  }
}
