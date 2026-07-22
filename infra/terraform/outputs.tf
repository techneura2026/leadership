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

