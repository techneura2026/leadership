using '../main.bicep'

param appName = 'leaderprism'
param location = 'southeastasia'
param environment = 'prod'
// Secrets: supply at deploy time via --parameters or Azure Key Vault references
// az deployment group create ... -p postgresAdminPassword=$POSTGRES_PASS jwtAccessSecret=$JWT_ACCESS ...
param postgresAdminPassword = ''
param jwtAccessSecret = ''
param jwtRefreshSecret = ''
