# Auto-shutdown / auto-start schedule for the dev VM.
# leaderprism-vm-dev is a single VM (not a scale set / App Service), so there is
# no true "scale to zero" — deallocating it outside business hours is the
# equivalent cost-saving lever. An Automation Account runs two PowerShell
# runbooks on a weekly Mon-Fri schedule: start at business open, stop at
# business close. Because both schedules only fire on weekdays, the VM stays
# deallocated across the full Fri-evening -> Mon-morning weekend window too.
#
# KNOWN GAP: azurerm_automation_schedule has no `enabled`/`is_enabled` argument
# in this provider version, so Terraform cannot see or correct someone flipping
# a schedule off in the Portal (this has happened before — both schedules sat
# disabled for 5 days with zero trace in the Activity Log, which doesn't record
# Automation schedule enable/disable at all). If the app ever stops "auto
# activating" again, check this FIRST, not just VM power state:
#   az automation schedule show -g leaderprism-rg-dev \
#     --automation-account-name leaderprism-automation-dev \
#     --name start-weekday-morning --query isEnabled
# Re-enable with `az automation schedule update ... --is-enabled true`.

locals {
  business_hours_timezone = "Asia/Colombo"
  business_days           = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  # Must be a future timestamp at first `terraform apply`; only the time-of-day
  # and weekday recurrence matter after that (Automation ignores the date part
  # once the schedule is active).
  start_schedule_anchor = "2026-07-13T08:00:00+05:30" # Monday 08:00 Asia/Colombo
  stop_schedule_anchor  = "2026-07-13T20:00:00+05:30" # Monday 20:00 Asia/Colombo
}

resource "azurerm_automation_account" "aa" {
  name                = "${var.app_name}-automation-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku_name            = "Basic"

  identity {
    type = "SystemAssigned"
  }
}

# Grants the Automation Account's managed identity permission to start/stop
# only this VM (scoped to the VM, not the resource group).
resource "azurerm_role_assignment" "automation_vm_contributor" {
  scope                = azurerm_linux_virtual_machine.vm.id
  role_definition_name = "Virtual Machine Contributor"
  principal_id         = azurerm_automation_account.aa.identity[0].principal_id
}

resource "azurerm_automation_runbook" "start_vm" {
  name                    = "Start-LeaderPrismDevVM"
  location                = azurerm_resource_group.rg.location
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  log_verbose             = false
  log_progress            = true
  runbook_type            = "PowerShell72" # ships with Az modules preinstalled — no module import needed

  content = <<-PS
    param(
      [Parameter(Mandatory=$true)][string]$ResourceGroupName,
      [Parameter(Mandatory=$true)][string]$VMName
    )
    Connect-AzAccount -Identity | Out-Null
    Start-AzVM -ResourceGroupName $ResourceGroupName -Name $VMName
  PS

  # The Azure API confirms runbook_type is actually "PowerShell72" (az automation
  # runbook show), but this provider version reads it back as "PowerShell" on
  # refresh, which makes every plan want to destroy+recreate a working runbook
  # for no real change. Ignore it rather than risk breaking the job_schedule link.
  lifecycle {
    ignore_changes = [runbook_type]
  }
}

resource "azurerm_automation_runbook" "stop_vm" {
  name                    = "Stop-LeaderPrismDevVM"
  location                = azurerm_resource_group.rg.location
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  log_verbose             = false
  log_progress            = true
  runbook_type            = "PowerShell72"

  content = <<-PS
    param(
      [Parameter(Mandatory=$true)][string]$ResourceGroupName,
      [Parameter(Mandatory=$true)][string]$VMName
    )
    Connect-AzAccount -Identity | Out-Null
    Stop-AzVM -ResourceGroupName $ResourceGroupName -Name $VMName -Force
  PS

  # See start_vm — same provider read-back quirk.
  lifecycle {
    ignore_changes = [runbook_type]
  }
}

resource "azurerm_automation_schedule" "start_weekday_morning" {
  name                    = "start-weekday-morning"
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  frequency               = "Week"
  interval                = 1
  timezone                = local.business_hours_timezone
  start_time              = local.start_schedule_anchor
  week_days               = local.business_days
}

resource "azurerm_automation_schedule" "stop_weekday_evening" {
  name                    = "stop-weekday-evening"
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  frequency               = "Week"
  interval                = 1
  timezone                = local.business_hours_timezone
  start_time              = local.stop_schedule_anchor
  week_days               = local.business_days
}

resource "azurerm_automation_job_schedule" "start_job" {
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  schedule_name           = azurerm_automation_schedule.start_weekday_morning.name
  runbook_name            = azurerm_automation_runbook.start_vm.name

  parameters = {
    resourcegroupname = azurerm_resource_group.rg.name
    vmname            = azurerm_linux_virtual_machine.vm.name
  }

  depends_on = [azurerm_role_assignment.automation_vm_contributor]
}

resource "azurerm_automation_job_schedule" "stop_job" {
  resource_group_name     = azurerm_resource_group.rg.name
  automation_account_name = azurerm_automation_account.aa.name
  schedule_name           = azurerm_automation_schedule.stop_weekday_evening.name
  runbook_name            = azurerm_automation_runbook.stop_vm.name

  parameters = {
    resourcegroupname = azurerm_resource_group.rg.name
    vmname            = azurerm_linux_virtual_machine.vm.name
  }

  depends_on = [azurerm_role_assignment.automation_vm_contributor]
}
