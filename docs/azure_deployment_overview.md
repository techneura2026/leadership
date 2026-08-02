# Azure Deployment & Resource Overview (LeaderPrism Dev)

This document provides a comprehensive overview of the current Azure deployment for **LeaderPrism**. It details the active resources, network configurations, software architecture, cost breakdown, and deployment workflows. This document acts as a single source of truth for developers and AI agents to instantly understand the system state and architecture.

---

## 1. System & Subscription Meta

- **Subscription Name:** `Leadership subscription`
- **Subscription ID:** `a9c17b61-74a0-4f5c-bc7b-86e5f55d2d40`
- **Tenant:** `devtechneura252.onmicrosoft.com` (ID: `e587ae02-b30e-4a2a-880a-f0e5cf1f32d8`)
- **Active Environment:** `dev` (Development)
- **Primary Region:** `Central US` (`centralus`)
- **Resource Group:** `leaderprism-rg-dev` (Provisioned status: `Succeeded`)

---

## 2. Active Azure Resources

Below is the list of active resources provisioned under the `leaderprism-rg-dev` resource group:

| Resource Name | Type | Location | Status | Details / Description |
| :--- | :--- | :--- | :--- | :--- |
| [leaderprism-vm-dev](file:///c:/Work/leader/infra/terraform/main.tf#L126) | `Microsoft.Compute/virtualMachines` | `centralus` | `Running` | Standard D2s v3 (2 vCPU, 8 GB RAM), Ubuntu 22.04 LTS |
| `leaderprism-vm-dev_OsDisk_1_0d4d5db95d4848ba85e0a3424c37bb70` | `Microsoft.Compute/disks` | `centralus` | `Succeeded` | OS Disk (30 GB, Standard HDD LRS, ReadWrite caching) |
| [leaderprism-pip-dev](file:///c:/Work/leader/infra/terraform/main.tf#L29) | `Microsoft.Network/publicIPAddresses` | `centralus` | `Succeeded` | Static Standard IPv4 address associated with VM |
| [leaderprism-nsg-dev](file:///c:/Work/leader/infra/terraform/main.tf#L39) | `Microsoft.Network/networkSecurityGroups` | `centralus` | `Succeeded` | Inbound traffic firewall rules |
| [leaderprism-vnet-dev](file:///c:/Work/leader/infra/terraform/main.tf#L13) | `Microsoft.Network/virtualNetworks` | `centralus` | `Succeeded` | Virtual Network (CIDR: `10.0.0.0/16`) |
| [leaderprism-nic-dev](file:///c:/Work/leader/infra/terraform/main.tf#L106) | `Microsoft.Network/networkInterfaces` | `centralus` | `Succeeded` | Network interface linking VM, VNet Subnet, and Public IP |
| [leaderprism-automation-dev](file:///c:/Work/leader/infra/terraform/auto_shutdown.tf#L19) | `Microsoft.Automation/automationAccounts` | `centralus` | `Succeeded` | Automation Account (Basic SKU) running the VM start/stop schedule below |
| [leaderprism-landing-dev](file:///c:/Work/leader/infra/terraform/main.tf#L176) | `Microsoft.Web/staticSites` | `centralus` | `Succeeded` | Static Web App (Free SKU) hosting the landing site (`landing/`), globally CDN-distributed at `gentle-sea-02e23e510.7.azurestaticapps.net` |

---

## 3. Network Security & Routing

The Network Security Group (`leaderprism-nsg-dev`) defines the firewall rules for incoming traffic to the VM:

- **Virtual Network Space:** `10.0.0.0/16`
- **Subnet Space:** `10.0.1.0/24` (Name: `leaderprism-subnet-dev`)
- **DNS/FQDN:** `leaderprism-dev-app.centralus.cloudapp.azure.com`
- **Public IP Address:** `132.196.58.142`

### Inbound Port Rules

| Priority | Name | Port(s) | Protocol | Source | Access | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1001` | **SSH** | `22` | TCP | `*` (Any) | `Allow` | Secure shell administration access |
| `1002` | **HTTP** | `80` | TCP | `*` (Any) | `Allow` | Unencrypted web traffic (redirected by Caddy to HTTPS) |
| `1003` | **HTTPS** | `443` | TCP | `*` (Any) | `Allow` | Secure client web application traffic |
| `1004` | **API** | `3001` | TCP | `*` (Any) | `Allow` | Direct access to backend API server |
| `1005` | **Web** | `3000` | TCP | `*` (Any) | `Allow` | Direct access to Next.js frontend port |

> [!NOTE]
> Database (port `5432`) and Redis (port `6379`) are exposed on localhost/internal network interfaces within the VM, but they do **not** have inbound rules in the NSG, ensuring they are not reachable from the public internet.

---

## 4. Software Architecture & VM Services

The virtual machine is configured to run the application using **Docker Compose** (`docker-compose.yml`) for local orchestration inside the VM.

### Container Layout

- **Caddy (Reverse Proxy):** Serves as the entry point (`ports 80 & 443`). Configured to automatically request and manage SSL certificates.
  - Matches paths `/api/*` -> redirects internally to `api:3001`.
  - Matches paths `/api/docs*` -> redirects internally to Swagger UI at `api:3001`.
  - Matches all other paths `/*` -> redirects internally to `web:3000`.
- **API (NestJS):** Runs the main backend application on port `3001`. Contains business logic, database migrations, and integrations.
- **Web (Next.js):** Runs the client frontend dashboard on port `3000`.
- **DB (PostgreSQL 16):** Database layer storing transactional details. Auto-initialized using migrations and seeds.
- **Redis 7:** Caching and asynchronous processing queue layer utilizing BullMQ.

### VM Host Tools

- **Node.js 20** is installed on the host.
- **PM2** is globally installed (though primary processes run inside Docker containers).
- **Docker Engine** and **Docker Compose Plugin** are active and enabled to autostart on VM boot.

---

## 5. Cost Breakdown & Infrastructure Estimates

Below is the monthly cost breakdown based on Microsoft Azure's standard retail pay-as-you-go rates in the `Central US` region, **after** the auto-shutdown schedule described in [Section 5a](#5a-auto-shutdown--auto-start-schedule):

| Resource | SKU | Unit Cost (Est.) | Monthly Total (Est.) | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Virtual Machine** | `Standard_D2s_v3` | ~$0.096 / hr | **~$27.50** | 2 vCPU, 8 GiB RAM. VM is deallocated nights + weekends — ~286 running hours/month (Mon-Fri 08:00-20:00 Asia/Colombo) vs. 730 previously. |
| **OS Disk** | `Standard HDD LRS (S4)` | ~$1.54 / month | **~$1.54** | 30 GB standard disk storage. Billed regardless of VM power state. |
| **Public IP** | `Standard IPv4 (Static)` | ~$0.0036 / hr | **~$2.63** | Billed while attached, independent of VM running state. |
| **Automation Account** | `Basic` | Free tier: 500 min/mo | **$0.00** | ~44 runbook jobs/month (22 start + 22 stop), each a few seconds — well within the free monthly job-run minutes. |
| **Bandwidth** | `Data Transfer Egress` | Free first 100 GB | **$0.00+** | Variable depending on file uploads/downloads. |
| **VNet & Security Group**| `Standard` | Free | **$0.00** | Azure Network structures are included at no cost. |
| **Static Web App** | `Free` | Free tier: 100 GB bandwidth/mo | **$0.00** | Landing site — static export, globally CDN-distributed. |
| **Total Estimated Cost**| | | **~$31.67 / month** | Down from ~$74.25/month (~57% reduction). |

> [!NOTE]
> The Public IP and OS Disk are billed whether the VM is running or deallocated — only compute (VM) cost scales down with the schedule. Disassociating/deleting the Public IP when idle would save the remaining ~$2.63/month but would change the FQDN/IP on every restart, which isn't worth it for a dev box with a stable DNS label.

### 5a. Auto-Shutdown / Auto-Start Schedule

Since `leaderprism-vm-dev` is a single VM (not a scale set or App Service), there's no literal "scale to zero" — the equivalent is deallocating it outside business hours. This is Terraform-managed in [infra/terraform/auto_shutdown.tf](file:///c:/Work/leader/infra/terraform/auto_shutdown.tf):

- **Automation Account:** `leaderprism-automation-dev` (Basic SKU, system-assigned managed identity).
- **RBAC:** The identity is granted `Virtual Machine Contributor`, scoped only to `leaderprism-vm-dev` (not the whole resource group).
- **Runbooks:** `Start-LeaderPrismDevVM` / `Stop-LeaderPrismDevVM` — PowerShell 7.2 runbooks (Az modules preinstalled) calling `Start-AzVM` / `Stop-AzVM -Force`.
- **Schedule:** Both run on a weekly Mon-Fri recurrence, timezone `Asia/Colombo`:
  - **Start:** 08:00, Mon-Fri
  - **Stop:** 20:00, Mon-Fri
  - Because neither schedule fires on Saturday/Sunday, the VM stays deallocated from Friday 20:00 through Monday 08:00, covering nights and weekends in one mechanism.
- **Manual override:** If someone needs the VM outside these hours, start/stop it directly (`az vm start/deallocate -g leaderprism-rg-dev -n leaderprism-vm-dev`, or the Azure Portal) — the schedule will simply re-assert itself at the next scheduled transition.

---

## 6. Continuous Integration & Deployment

The deployment workflow is fully automated via GitHub Actions:

- **Workflow File:** [.github/workflows/deploy-dev.yml](file:///c:/Work/leader/.github/workflows/deploy-dev.yml)
- **Trigger:** Automatic execution on push/merge to the `master` branch.
- **Actions:**
  1. Installs Node.js dependencies and builds package assets (`shared`, `api`, `web`).
  2. Compiles a deployment package tarball (`deploy.tar.gz`).
  3. Transfers the tarball to `/home/ubuntu/app` on the VM using SCP.
  4. Runs SSH scripts to unpack the tarball, generate the production `.env` file, build and spin up the Docker containers, run Database Migrations (`TypeORM`), and execute Seeds.

The landing site deploys independently:

- **Workflow File:** [.github/workflows/deploy-landing.yml](file:///c:/Work/leader/.github/workflows/deploy-landing.yml)
- **Trigger:** Push to `master` touching `landing/**`, or manual dispatch.
- **Actions:** Builds the Next.js static export (`npm run build -w landing` → `landing/out`) and uploads it directly to the `leaderprism-landing-dev` Static Web App via `Azure/static-web-apps-deploy@v1`, using the deployment token from `terraform output -raw landing_static_web_app_deployment_token` stored as the `AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING` GitHub secret.

---

## 7. Current System Verification Status

- **DNS Reachability:** Checked and active.
- **SSL Certificate:** Succeeded. Caddy serves auto-renewed HTTPS certificates.
- **Redirect Test:** Hitting `https://leaderprism-dev-app.centralus.cloudapp.azure.com/` returns `HTTP 307 Temporary Redirect` to `/login?from=%2F`, validating that Caddy routing to Next.js and frontend authentication is active and online.

---

## 8. Known Infrastructure Gaps — Resources the App Expects but Terraform Does Not Provision

**Update (2026-08-02):** The frontend/backend gap remediation work (Tier 0 items 0f/0g) added Terraform resource *definitions* for Blob Storage and Azure Communication Services to `infra/terraform/main.tf`/`outputs.tf` — the code now exists and is syntactically/schematically valid (`terraform fmt -check` and `terraform validate` both pass against the real provider). **`terraform apply` was deliberately not run** — this environment has a real, live Terraform state file behind an actual provisioned VM, and applying/provisioning new billed Azure resources is a decision for whoever holds Azure billing authority, not something to do unilaterally from a code-implementation pass. So the table below still reflects what's **actually live in Azure right now** (Section 2 is unchanged and still accurate) — only the "Terraform code exists" column has changed for two of the three rows.

| Expected Resource | Terraform Resource Type | Code defined? | Actually provisioned? | App-side evidence it's expected |
| :--- | :--- | :--- | :--- | :--- |
| **Blob Storage** (for report PDFs, future file uploads) | `azurerm_storage_account` + `azurerm_storage_container` | ✅ Yes, as of 2026-08-02 (`main.tf`) | ❌ Not provisioned — needs `terraform apply` | `ReportEntity.blobUrl` column exists but is never written to (backend doesn't call `@azure/storage-blob` yet either — see Tier 2B in the remediation plan); `.env.example`/`api/.env.test` define `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_REPORTS`, `AZURE_STORAGE_CONTAINER_UPLOADS` as blank placeholders |
| **Azure Communication Services** (email) | `azurerm_communication_service` (+ `azurerm_email_communication_service` + domain association) | ✅ Yes, as of 2026-08-02 (`main.tf`) | ❌ Not provisioned — needs `terraform apply` | `AZURE_COMMUNICATION_CONNECTION_STRING` is blank in `.env.example`; **the backend side is now fully implemented** (`@azure/communication-email` wired into `NotificationsService`, sends real email whenever this env var is populated, falls back to log-only when it's blank) — provisioning this resource and populating the connection string is now the *only* remaining step to make real email delivery live on this VM |
| **Key Vault / secrets manager** | `azurerm_key_vault` | ❌ Not defined | ❌ Not provisioned | DB password, JWT secrets, etc. are plain Terraform variables in `terraform.tfvars`, passed into the VM's generated `.env` as plaintext GitHub Actions secrets via `.github/workflows/deploy-dev.yml`. Explicitly out of scope for the remediation plan — flagged, not fixed. |

**Practical consequences on this VM today:**
- **Report PDFs are written to the container's local filesystem** (`api/reports/` inside the `api` container), not Blob Storage. Since this is currently a single VM/single container, downloads work today — but there is no shared/durable storage backing them, no retention policy, and this breaks the moment the API ever runs as more than one instance or is redeployed mid-download. Backend code to actually upload to blob once the resource exists (`PdfService`, `reporting.service.ts`) has **not** been written yet either — provisioning the resource alone isn't sufficient, Tier 2B's backend half is still needed too.
- **No email is ever sent from this deployment yet** — but this is now purely an infrastructure gap, not a code gap. Once `azurerm_communication_service` is applied and its connection string is added to `.github/workflows/deploy-dev.yml`'s generated `.env`, invitation/rater-nomination/reminder/report-ready/password-reset emails will start sending for real with no further code changes. Until then, everything still only logs to the container's stdout (`docker compose logs api`).
- **Secrets are not centrally managed.** Rotating a secret today means updating GitHub Actions secrets and re-running the deploy workflow; there's no Key Vault reference or managed-identity-based secret access.

**To actually provision Blob Storage and Communication Services on this VM**, someone with Azure billing authority needs to run `terraform plan` then `terraform apply` from `infra/terraform/`, then add the resulting `storage_connection_string`/`communication_connection_string` outputs to `.github/workflows/deploy-dev.yml`'s generated `.env` (the workflow file was already updated this session to pass these through — it just has no value to pass until the resources exist). See `docs/frontend-backend-gap-remediation-plan.md` (Tier 0 items 0f/0g, Tier 2B) for the full implementation plan.
