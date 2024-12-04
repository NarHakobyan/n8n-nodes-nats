![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n NATS Node

This is a n8n node to send and receive messages from NATS. The node is based on the [nats](https://www.npmjs.com/package/nats) package.

## Installation

### Local

To install the node locally, navigate to your n8n data directory and run the following command:

```bash
npm install --save n8n-nodes-nats
```

### Docker

To install the node using Docker, add the following line to the `services` block in your `docker-compose.yml` file:

```yaml
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - ./n8n:/root/.n8n
    environment:
      N8N_CUSTOM_NODES: '["n8n-nodes-nats"]'
```

### Using the n8n UI

1. Open your n8n instance in a web browser.
2. Click on "Settings" in the left-hand navigation panel.
3. Click on "Community nodes" in the left-hand navigation panel.
4. Click on the "Install" button.
5. Fill in the name of the node: "n8n-nodes-nats".
6. Click "Install"


## Usage

### Input

The input node can be configured to send messages to a NATS subject. The message can be configured to be static or to be the result of a previous node.

### Output

The output node can be configured to receive messages from a NATS subject. The message can be configured to be the received message or to be the result of a previous node.

## License

This project is licensed under the [MIT License](
