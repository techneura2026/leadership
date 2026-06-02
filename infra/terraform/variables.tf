variable "app_name" {
  description = "The name of the application"
  type        = string
  default     = "leaderprism"
}

variable "location" {
  description = "Azure region for the resources"
  type        = string
  default     = "East US 2"
}

variable "environment" {
  description = "The environment name (e.g. dev, prod)"
  type        = string
  default     = "dev"
}

variable "postgres_admin_password" {
  description = "Admin password for PostgreSQL Server"
  type        = string
  sensitive   = true
  default     = "SecureAdminPassword123!"
}

variable "jwt_access_secret" {
  description = "JWT Access Secret"
  type        = string
  sensitive   = true
  default     = "dev-access-secret-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}

variable "jwt_refresh_secret" {
  description = "JWT Refresh Secret"
  type        = string
  sensitive   = true
  default     = "dev-refresh-secret-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
