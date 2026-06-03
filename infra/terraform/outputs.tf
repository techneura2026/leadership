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

