// ==============================================================================
// Complete Enterprise Azure Infrastructure as Code (Bicep)
// GreenRE Autonomous Compliance & Smart Operation System
// ==============================================================================
// Deploys:
// 1. Azure Event Hubs Namespace + Event Hub (IoT Streaming Ingestion)
// 2. Azure AI Search Service (Semantic Cognitive Regulatory Retrieval)
// 3. Azure OpenAI Service + GPT-4o Model Deployment
// 4. Azure Key Vault (Zero-Trust Secret Management)
// 5. Azure Monitor & Application Insights (End-to-End Observability)
// 6. User-Assigned Managed Identity (Passwordless Cloud Auth)
// 7. Azure Container App Environment (Production Deployment)
// ==============================================================================

@description('Azure Region for resource deployment')
param location string = resourceGroup().location

@description('Environment name prefix')
param environmentPrefix string = 'greenre'

@description('SKU for Azure Event Hubs')
param eventHubSku string = 'Standard'

@description('SKU for Azure AI Search')
param searchSku string = 'standard'

var uniqueSuffix = uniqueString(resourceGroup().id)

// ------------------------------------------------------------------------------
// 1. Managed Identity (Passwordless Cloud Architecture)
// ------------------------------------------------------------------------------
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${environmentPrefix}-identity-${uniqueSuffix}'
  location: location
}

// ------------------------------------------------------------------------------
// 2. Azure Monitor: Log Analytics & Application Insights (Observability)
// ------------------------------------------------------------------------------
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${environmentPrefix}-law-${uniqueSuffix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${environmentPrefix}-appinsights-${uniqueSuffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
}

// ------------------------------------------------------------------------------
// 3. Azure Key Vault (Secure Secret Management)
// ------------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${environmentPrefix}-kv-${uniqueSuffix}'
  location: location
  properties: {
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: false
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: managedIdentity.properties.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
    enableRbacAuthorization: false
  }
}

// ------------------------------------------------------------------------------
// 4. Azure Event Hubs Namespace & Event Hub (Telemetry Streaming)
// ------------------------------------------------------------------------------
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2021-11-01' = {
  name: '${environmentPrefix}-eh-ns-${uniqueSuffix}'
  location: location
  sku: {
    name: eventHubSku
    tier: eventHubSku
    capacity: 1
  }
  properties: {
    isAutoInflateEnabled: false
    maximumThroughputUnits: 0
  }
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2021-11-01' = {
  parent: eventHubNamespace
  name: 'greenre-telemetry'
  properties: {
    messageRetentionInDays: 7
    partitionCount: 4
  }
}

resource consumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2021-11-01' = {
  parent: eventHub
  name: '$Default'
}

// ------------------------------------------------------------------------------
// 5. Azure AI Search Service (Hybrid Semantic Search)
// ------------------------------------------------------------------------------
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '${environmentPrefix}-search-${uniqueSuffix}'
  location: location
  sku: {
    name: searchSku
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    semanticSearch: 'free'
  }
}

// ------------------------------------------------------------------------------
// 6. Azure OpenAI Service + Model Deployments
// ------------------------------------------------------------------------------
resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${environmentPrefix}-aoai-${uniqueSuffix}'
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: '${environmentPrefix}-aoai-${uniqueSuffix}'
    publicNetworkAccess: 'Enabled'
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: 'gpt-4o'
  sku: {
    name: 'Standard'
    capacity: 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-05-13'
    }
  }
}

// ------------------------------------------------------------------------------
// 7. Store Connection Secrets in Azure Key Vault
// ------------------------------------------------------------------------------
resource secretEventHubConn 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-EVENTHUB-CONNECTION-STRING'
  properties: {
    value: listKeys(resourceId('Microsoft.EventHub/namespaces/authorizationRules', eventHubNamespace.name, 'RootManageSharedAccessKey'), '2021-11-01').primaryConnectionString
  }
}

resource secretSearchApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-SEARCH-API-KEY'
  properties: {
    value: listAdminKeys(searchService.id, '2023-11-01').primaryKey
  }
}

resource secretOpenAiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AZURE-OPENAI-KEY'
  properties: {
    value: listKeys(openAiAccount.id, '2023-05-01').key1
  }
}

resource secretHmacSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'EDGE-GATEWAY-HMAC-SECRET'
  properties: {
    // Replace with your actual pre-shared key value at deployment time via --parameters
    value: 'greenre-edge-preshared-secret-2026'
  }
}

// ------------------------------------------------------------------------------
// 8. Azure Container Apps (API Hosting)
// ------------------------------------------------------------------------------
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'greenre-aca-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, '2022-10-01').primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'greenre-api'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 5000
        transport: 'http'
      }
      secrets: [
        {
          name: 'azure-openai-key'
          keyVaultUrl: secretOpenAiKey.properties.secretUri
          identity: managedIdentity.id
        }
        {
          name: 'azure-search-api-key'
          keyVaultUrl: secretSearchApiKey.properties.secretUri
          identity: managedIdentity.id
        }
        {
          name: 'azure-eventhub-connection-string'
          keyVaultUrl: secretEventHubConn.properties.secretUri
          identity: managedIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'greenre-api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Replace with your ACR image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'AZURE_OPENAI_ENDPOINT', value: openAiAccount.properties.endpoint }
            { name: 'AZURE_SEARCH_ENDPOINT', value: 'https://${searchService.name}.search.windows.net' }
            { name: 'AZURE_EVENTHUB_NAME', value: eventHub.name }
            { name: 'AZURE_KEYVAULT_URL', value: keyVault.properties.vaultUri }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
      }
    }
  }
}

// ------------------------------------------------------------------------------
// Outputs
// ------------------------------------------------------------------------------
output MANAGED_IDENTITY_CLIENT_ID string = managedIdentity.properties.clientId
output KEY_VAULT_URI string = keyVault.properties.vaultUri
output APPLICATION_INSIGHTS_CONNECTION_STRING string = appInsights.properties.ConnectionString
output EVENTHUB_NAMESPACE string = eventHubNamespace.name
output EVENTHUB_NAME string = eventHub.name
output SEARCH_ENDPOINT string = 'https://${searchService.name}.search.windows.net'
output OPENAI_ENDPOINT string = openAiAccount.properties.endpoint
output CONTAINER_APP_FQDN string = containerApp.properties.configuration.ingress.fqdn
output CONTAINER_APP_ENV string = containerAppsEnv.name

