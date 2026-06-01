param appName string
param location string
param environment string
param jwtAccessSecret string
param jwtRefreshSecret string

var vaultName = '${appName}-kv-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

resource jwtAccessSecretRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-access-secret'
  properties: { value: jwtAccessSecret }
}

resource jwtRefreshSecretRes 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-refresh-secret'
  properties: { value: jwtRefreshSecret }
}

output vaultUri string = keyVault.properties.vaultUri
