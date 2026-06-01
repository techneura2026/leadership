param appName string
param location string
param environment string

var redisName = '${appName}-redis-${environment}'

resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: environment == 'prod' ? 'Standard' : 'Basic'
      family: 'C'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

output connectionString string = '${redisName}.redis.cache.windows.net:6380,password=${redis.listKeys().primaryKey},ssl=True,abortConnect=False'
