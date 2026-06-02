terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = "a9c17b61-74a0-4f5c-bc7b-86e5f55d2d40"
}
