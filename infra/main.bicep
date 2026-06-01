// LeaderPrism Azure Infrastructure
// Deploy: az deployment group create -g leaderprism-rg-prod -f infra/main.bicep -p infra/parameters/prod.bicepparam

targetScope = 'resourceGroup'

param appName string = 'leaderprism'
param location string = resourceGroup().location
param environment string = 'prod'
param postgresAdminPassword string
param jwtAccessSecret string
param jwtRefreshSecret string

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    appName: appName
    location: location
    environment: environment
    adminPassword: postgresAdminPassword
  }
}

module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    appName: appName
    location: location
    environment: environment
  }
}

module storage 'modules/blob-storage.bicep' = {
  name: 'storage'
  params: {
    appName: appName
    location: location
    environment: environment
  }
}

module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVault'
  params: {
    appName: appName
    location: location
    environment: environment
    jwtAccessSecret: jwtAccessSecret
    jwtRefreshSecret: jwtRefreshSecret
  }
}

module appService 'modules/app-service.bicep' = {
  name: 'appService'
  params: {
    appName: appName
    location: location
    environment: environment
    postgresUrl: postgres.outputs.connectionString
    redisUrl: redis.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    keyVaultUri: keyVault.outputs.vaultUri
  }
}
