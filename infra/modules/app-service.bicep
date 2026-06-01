// Azure App Service Plan + two Web Apps (API and Web)
param appName string
param location string
param environment string
param postgresUrl string
param redisUrl string
param storageConnectionString string
param keyVaultUri string

var planName = '${appName}-plan-${environment}'
var apiName = '${appName}-api-${environment}'
var webName = '${appName}-web-${environment}'
var skuName = environment == 'prod' ? 'P2v3' : 'B1'

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: { name: skuName, tier: environment == 'prod' ? 'PremiumV3' : 'Basic' }
  properties: { reserved: true }
}

resource apiApp 'Microsoft.Web/sites@2023-01-01' = {
  name: apiName
  location: location
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3001' }
        { name: 'DATABASE_URL', value: postgresUrl }
        { name: 'REDIS_URL', value: redisUrl }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: storageConnectionString }
        { name: 'AZURE_KEY_VAULT_URI', value: keyVaultUri }
      ]
    }
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: webName
  location: location
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'INTERNAL_API_URL', value: 'https://${apiName}.azurewebsites.net' }
        { name: 'NEXT_PUBLIC_API_URL', value: 'https://${apiName}.azurewebsites.net/api/v1' }
      ]
    }
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
