// Azure Database for PostgreSQL Flexible Server
param appName string
param location string
param environment string
param adminPassword string

var serverName = '${appName}-postgres-${environment}'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: environment == 'prod' ? 'Standard_D2ds_v4' : 'Standard_B1ms'
    tier: environment == 'prod' ? 'GeneralPurpose' : 'Burstable'
  }
  properties: {
    administratorLogin: 'leaderprism'
    administratorLoginPassword: adminPassword
    version: '16'
    storage: { storageSizeGB: environment == 'prod' ? 128 : 32 }
    backup: {
      backupRetentionDays: environment == 'prod' ? 35 : 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: 'leaderprism'
  properties: { charset: 'utf8', collation: 'en_US.utf8' }
}

output connectionString string = 'postgresql://leaderprism:${adminPassword}@${serverName}.postgres.database.azure.com/leaderprism?sslmode=require'
