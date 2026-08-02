resource "azurerm_resource_group" "rg" {
  name     = "${var.app_name}-rg-${var.environment}"
  location = var.location
}

# SSH Key Generation
resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Virtual Network
resource "azurerm_virtual_network" "vnet" {
  name                = "${var.app_name}-vnet-${var.environment}"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

# Subnet
resource "azurerm_subnet" "subnet" {
  name                 = "${var.app_name}-subnet-${var.environment}"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Public IP
resource "azurerm_public_ip" "pip" {
  name                = "${var.app_name}-pip-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  domain_name_label   = "${var.app_name}-${var.environment}-app"
}

# Network Security Group
resource "azurerm_network_security_group" "nsg" {
  name                = "${var.app_name}-nsg-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  security_rule {
    name                       = "SSH"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTP"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "API"
    priority                   = 1004
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3001"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "Web"
    priority                   = 1005
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3000"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Network Interface
resource "azurerm_network_interface" "nic" {
  name                = "${var.app_name}-nic-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.pip.id
  }
}

# Connect NSG to NIC
resource "azurerm_network_interface_security_group_association" "association" {
  network_interface_id      = azurerm_network_interface.nic.id
  network_security_group_id = azurerm_network_security_group.nsg.id
}

# Virtual Machine
resource "azurerm_linux_virtual_machine" "vm" {
  name                = "${var.app_name}-vm-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  size                = "Standard_D2s_v3" # 2 vCPU, 8GB RAM - Standard Dsv3-series with quota availability
  admin_username      = "ubuntu"
  network_interface_ids = [
    azurerm_network_interface.nic.id,
  ]

  admin_ssh_key {
    username   = "ubuntu"
    public_key = tls_private_key.ssh.public_key_openssh
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }

  custom_data = base64encode(<<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y apt-transport-https ca-certificates curl software-properties-common git
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
              add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
              apt-get update
              apt-get install -y docker-ce docker-compose-plugin
              systemctl enable docker
              systemctl start docker
              mkdir -p /app
              chown -R ubuntu:ubuntu /app
              usermod -aG docker ubuntu
              
              # Install Node.js 20 & PM2
              curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
              apt-get install -y nodejs
              npm install -g pm2
              EOF
  )
}

# Static Web App — hosts the landing site (static export, deployed via GitHub Actions)
resource "azurerm_static_web_app" "landing" {
  name                = "${var.app_name}-landing-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku_tier            = "Free"
  sku_size            = "Free"
}

# ── Blob Storage — report PDFs (was local-disk-only; see docs/frontend-backend-gap-remediation-plan.md Tier 2B) ──

resource "azurerm_storage_account" "storage" {
  name                     = replace("${var.app_name}st${var.environment}", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

resource "azurerm_storage_container" "reports" {
  name                  = "reports"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

# ── Azure Communication Services — email (was log-only; see docs/frontend-backend-gap-remediation-plan.md Tier 0f/0g) ──

resource "azurerm_email_communication_service" "email" {
  name                = "${var.app_name}-email-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "United States"
}

# Azure-managed sender domain — no external DNS verification needed, suitable for dev/test.
# A custom verified domain (e.g. mail.leaderprism.com) can replace this later for production
# sender reputation without changing any application code — just the EMAIL_FROM env var.
resource "azurerm_email_communication_service_domain" "email_domain" {
  name              = "AzureManagedDomain"
  email_service_id  = azurerm_email_communication_service.email.id
  domain_management = "AzureManaged"
}

resource "azurerm_communication_service" "comms" {
  name                = "${var.app_name}-comms-${var.environment}"
  resource_group_name = azurerm_resource_group.rg.name
  data_location       = "United States"
}

resource "azurerm_communication_service_email_domain_association" "comms_email_link" {
  communication_service_id = azurerm_communication_service.comms.id
  email_service_domain_id  = azurerm_email_communication_service_domain.email_domain.id
}
