npm run build
npm link
cd /usr/local/lib/node_modules/n8n
export N8N_LOG_LEVEL=info
export N8N_LOG_OUTPUT=console
npm link n8n-nodes-nats && n8n start
