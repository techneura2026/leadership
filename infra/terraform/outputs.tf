output "vm_public_ip" {
  value = azurerm_public_ip.pip.ip_address
}

output "vm_fqdn" {
  value = azurerm_public_ip.pip.fqdn
}

output "ssh_private_key" {
  value     = tls_private_key.ssh.private_key_pem
  sensitive = true
}

output "landing_static_web_app_hostname" {
  value = azurerm_static_web_app.landing.default_host_name
}

output "landing_static_web_app_deployment_token" {
  value     = azurerm_static_web_app.landing.api_key
  sensitive = true
}

# ── Blob Storage (Tier 2B — report PDFs, no longer local-disk-only) ──

output "storage_account_name" {
  value = azurerm_storage_account.storage.name
}

output "storage_connection_string" {
  value     = azurerm_storage_account.storage.primary_connection_string
  sensitive = true
}

output "storage_container_reports" {
  value = azurerm_storage_container.reports.name
}

output "storage_container_uploads" {
  value = azurerm_storage_container.uploads.name
}

# ── Azure Communication Services (Tier 0f/0g — real email, no longer log-only) ──

output "communication_connection_string" {
  value     = azurerm_communication_service.comms.primary_connection_string
  sensitive = true
}

# Sender address once the Azure-managed domain provisions, e.g. donotreply@<id>.azurecomm.net —
# set this as EMAIL_FROM. Swap for a custom verified domain later without any app code changes.
output "email_from_sender_domain" {
  value = azurerm_email_communication_service_domain.email_domain.mail_from_sender_domain
}

