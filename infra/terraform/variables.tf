variable "app_name" {
  description = "The name of the application"
  type        = string
  default     = "leaderprism"
}

variable "location" {
  description = "Azure region for the resources"
  type        = string
  default     = "Central US"
}

variable "environment" {
  description = "The environment name (e.g. dev, prod)"
  type        = string
  default     = "dev"
}
