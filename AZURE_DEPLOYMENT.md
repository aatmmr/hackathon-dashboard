# Azure Deployment Guide

This guide explains how to deploy the Hackathon Dashboard with WebSocket support on Azure, including session persistence.

## Architecture

When deployed on Azure, both frontend and backend are hosted together:

- **Frontend**: Azure Static Web Apps or Azure App Service
- **Backend**: Azure App Service (WebSocket server)
- **Storage**: Azure Table Storage (for session persistence)

## Prerequisites

- Azure account with active subscription
- Azure CLI installed (`az` command)
- Node.js 18+ installed locally
- Git repository with your code

## Option 1: Azure App Service (Recommended)

This option deploys both frontend and backend on Azure App Service with WebSocket support.

### Step 1: Create Resource Group

```bash
# Create resource group
az group create \
  --name hackathon-dashboard-rg \
  --location eastus2
```

### Step 2: Create App Service Plan

```bash
# Create App Service Plan (Basic tier supports WebSocket)
az appservice plan create \
  --name hackathon-plan \
  --resource-group hackathon-dashboard-rg \
  --sku B1 \
  --is-linux
```

### Step 3: Create Storage Account for Session Persistence

```bash
# Create storage account
az storage account create \
  --name hackathonstorage \
  --resource-group hackathon-dashboard-rg \
  --location eastus2 \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name hackathonstorage \
  --resource-group hackathon-dashboard-rg \
  --output tsv
```

Save the connection string for later use.

### Step 4: Create Web App for WebSocket Server

```bash
# Create web app
az webapp create \
  --resource-group hackathon-dashboard-rg \
  --plan hackathon-plan \
  --name hackathon-ws-server \
  --runtime "NODE:18-lts"

# Enable WebSocket
az webapp config set \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --web-sockets-enabled true
```

### Step 5: Configure Environment Variables

```bash
# Set environment variables
az webapp config appsettings set \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --settings \
    PORT=8080 \
    NODE_ENV=production \
    ENABLE_PERSISTENCE=true \
    STORAGE_TYPE=azure-table \
    AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>" \
    SESSION_MAX_DURATION_HOURS=24
```

Replace `<your-connection-string>` with the connection string from Step 3.

### Step 6: Deploy Server Code

```bash
# Navigate to server directory
cd server

# Create deployment package
zip -r deploy.zip .

# Deploy to Azure
az webapp deployment source config-zip \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --src deploy.zip

# Verify deployment
az webapp browse \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server
```

Your WebSocket server URL will be: `wss://hackathon-ws-server.azurewebsites.net`

### Step 7: Create Web App for Frontend

```bash
# Create web app for frontend
az webapp create \
  --resource-group hackathon-dashboard-rg \
  --plan hackathon-plan \
  --name hackathon-dashboard-app \
  --runtime "NODE:18-lts"

# Configure app settings
az webapp config appsettings set \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-dashboard-app \
  --settings \
    VITE_WEBSOCKET_URL=wss://hackathon-ws-server.azurewebsites.net \
    VITE_ENABLE_WEBSOCKET=true
```

### Step 8: Deploy Frontend

```bash
# Return to project root
cd ..

# Build frontend
npm install
npm run build

# Deploy frontend
cd dist
zip -r ../frontend-deploy.zip .
cd ..

az webapp deployment source config-zip \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-dashboard-app \
  --src frontend-deploy.zip
```

Your frontend URL will be: `https://hackathon-dashboard-app.azurewebsites.net`

## Option 2: Azure Static Web Apps + App Service

This option uses Azure Static Web Apps for the frontend and Azure App Service for the backend.

### Step 1: Create Static Web App

```bash
# Create static web app
az staticwebapp create \
  --name hackathon-dashboard \
  --resource-group hackathon-dashboard-rg \
  --source https://github.com/your-username/hackathon-dashboard \
  --location eastus2 \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

### Step 2: Follow Steps 3-6 from Option 1

Deploy the WebSocket server following steps 3-6 from Option 1.

### Step 3: Configure Static Web App

Add environment variable in Azure Portal:
- Go to Static Web App -> Configuration
- Add: `VITE_WEBSOCKET_URL` = `wss://hackathon-ws-server.azurewebsites.net`

## Option 3: Azure Container Instances

Deploy the WebSocket server as a container for easier scaling.

### Step 1: Create Container Registry

```bash
# Create container registry
az acr create \
  --resource-group hackathon-dashboard-rg \
  --name hackathonregistry \
  --sku Basic

# Login to registry
az acr login --name hackathonregistry
```

### Step 2: Build and Push Docker Image

```bash
# Create Dockerfile in server directory
cat > server/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
EOF

# Build image
cd server
docker build -t hackathon-ws-server .

# Tag and push
docker tag hackathon-ws-server hackathonregistry.azurecr.io/hackathon-ws-server:latest
docker push hackathonregistry.azurecr.io/hackathon-ws-server:latest
```

### Step 3: Deploy Container

```bash
# Get registry credentials
az acr credential show --name hackathonregistry

# Create container instance
az container create \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --image hackathonregistry.azurecr.io/hackathon-ws-server:latest \
  --dns-name-label hackathon-ws \
  --ports 8080 \
  --registry-login-server hackathonregistry.azurecr.io \
  --registry-username <username> \
  --registry-password <password> \
  --environment-variables \
    PORT=8080 \
    NODE_ENV=production \
    ENABLE_PERSISTENCE=true \
    STORAGE_TYPE=azure-table \
    AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>" \
    SESSION_MAX_DURATION_HOURS=24
```

Your WebSocket server URL will be: `ws://hackathon-ws.eastus2.azurecontainer.io:8080`

## Session Persistence Configuration

### Azure Table Storage

Session data is automatically persisted to Azure Table Storage with the following features:

- **Automatic Expiration**: Sessions expire after configured duration (default 24 hours)
- **Cleanup**: Expired sessions are automatically cleaned up every hour
- **Durability**: Data survives server restarts
- **Scalability**: Handles large numbers of sessions

### Configuration Options

Environment variables for session persistence:

```bash
# Enable/disable persistence
ENABLE_PERSISTENCE=true

# Storage backend
STORAGE_TYPE=azure-table  # or 'memory' for testing

# Azure connection
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...

# Session duration
SESSION_MAX_DURATION_HOURS=24  # Sessions expire after 24 hours
```

### Monitoring Sessions

Check active sessions:

```bash
# View table storage
az storage table list \
  --connection-string "<your-connection-string>"

# Query sessions
az storage entity query \
  --table-name HackathonSessions \
  --connection-string "<your-connection-string>"
```

## Scaling and Performance

### Horizontal Scaling

Azure App Service supports auto-scaling:

```bash
# Enable autoscale
az monitor autoscale create \
  --resource-group hackathon-dashboard-rg \
  --resource hackathon-ws-server \
  --resource-type Microsoft.Web/serverfarms \
  --name autoscale-rules \
  --min-count 1 \
  --max-count 5 \
  --count 1

# Add CPU-based rule
az monitor autoscale rule create \
  --resource-group hackathon-dashboard-rg \
  --autoscale-name autoscale-rules \
  --condition "CpuPercentage > 75 avg 5m" \
  --scale out 1
```

### Performance Optimization

1. **Use Premium Tier**: For better performance
2. **Enable CDN**: For static assets
3. **Use Redis**: For session state across instances (advanced)

## Monitoring and Diagnostics

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app hackathon-insights \
  --location eastus2 \
  --resource-group hackathon-dashboard-rg

# Link to Web App
az monitor app-insights component connect-webapp \
  --app hackathon-insights \
  --resource-group hackathon-dashboard-rg \
  --web-app hackathon-ws-server
```

### View Logs

```bash
# Stream logs
az webapp log tail \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server

# Download logs
az webapp log download \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server
```

## Security Best Practices

### 1. Use Managed Identity

```bash
# Enable managed identity
az webapp identity assign \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server

# Grant storage access
az role assignment create \
  --assignee <principal-id> \
  --role "Storage Table Data Contributor" \
  --scope /subscriptions/<sub-id>/resourceGroups/hackathon-dashboard-rg/providers/Microsoft.Storage/storageAccounts/hackathonstorage
```

### 2. Enable HTTPS Only

```bash
az webapp update \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --https-only true
```

### 3. Configure CORS

```bash
az webapp cors add \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --allowed-origins https://hackathon-dashboard-app.azurewebsites.net
```

## Cost Estimation

### Monthly Costs (USD)

| Service | Tier | Estimated Cost |
|---------|------|----------------|
| App Service Plan | B1 | $13-15 |
| Storage Account | Standard LRS | $1-2 |
| Data Transfer | First 5GB free | $0-5 |
| **Total** | | **~$15-22/month** |

### Cost Optimization

- Use Free tier during development
- Scale down during off-hours
- Use Azure Reservations for production (save up to 55%)

## Troubleshooting

### WebSocket Connection Issues

1. Verify WebSocket is enabled:
```bash
az webapp config show \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --query webSocketsEnabled
```

2. Check logs for errors:
```bash
az webapp log tail \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server
```

### Storage Connection Issues

1. Verify connection string:
```bash
az webapp config appsettings list \
  --resource-group hackathon-dashboard-rg \
  --name hackathon-ws-server \
  --query "[?name=='AZURE_STORAGE_CONNECTION_STRING']"
```

2. Test storage connectivity:
```bash
az storage table exists \
  --name HackathonSessions \
  --connection-string "<your-connection-string>"
```

## Cleanup

To delete all resources:

```bash
# Delete resource group (deletes all resources)
az group delete \
  --name hackathon-dashboard-rg \
  --yes \
  --no-wait
```

## Next Steps

1. Configure custom domain
2. Set up SSL certificate
3. Enable Application Insights monitoring
4. Configure backup and disaster recovery
5. Set up CI/CD pipeline with GitHub Actions

## References

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Table Storage Documentation](https://docs.microsoft.com/azure/storage/tables/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [WebSocket Support in Azure](https://docs.microsoft.com/azure/app-service/configure-common)
