// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { v4 as uuid } from 'uuid';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { connect, ConnectionOptions, createInbox, headers, JSONCodec } from 'nats';

import {
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
	NodeApiError,
	LoggerProxy as Logger,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

export class Nats implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nats',
		name: 'nats',
		icon: 'file:nats.svg',
		group: ['transform'],
		version: 1,
		description: 'Sends messages to a Nats',
		defaults: {
			name: 'Nats',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'natsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				placeholder: 'subject-name',
				description: 'Name of the queue of subject to publish to',
			},
			{
				displayName: 'Send Input Data',
				name: 'sendInputData',
				type: 'boolean',
				default: true,
				description: 'Whether to send the the data the node receives as JSON to Kafka',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				displayOptions: {
					show: {
						sendInputData: [false],
					},
				},
				default: '',
				description: 'The message to be sent',
			},
			{
				displayName: 'JSON Parameters',
				name: 'jsonParameters',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Headers',
				name: 'headersUi',
				placeholder: 'Add Header',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						jsonParameters: [false],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'headerValues',
						displayName: 'Header',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Headers (JSON)',
				name: 'headerParametersJson',
				type: 'json',
				displayOptions: {
					show: {
						jsonParameters: [true],
					},
				},
				default: '',
				description: 'Header parameters as JSON (flat object)',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				default: {},
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Only Emit',
						name: 'onlyEmit',
						type: 'boolean',
						default: false,
						description: 'Whether to send the data to Nats without waiting for a response',
					},
				],
			},
		],
		usableAsTool: true,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const jsonCodec = JSONCodec<IDataObject>();
		const sendInputData = this.getNodeParameter('sendInputData', 0) as boolean;
		const credentials = await this.getCredentials('natsApi') as {
			servers: string,
			queue: string,
			timeout: number,
			authentication?: boolean,
			username?: string,
			password?: string,
		};
		const servers = credentials.servers
			.split(',')
			.filter(Boolean)
			.map((item) => item.trim());

		const queue = credentials.queue;

		const responseData: IDataObject[] = [];
		const subscriptionsPromise: Array<Promise<unknown>> = [];

		const connectionOptions: ConnectionOptions = {
			reconnect: true,
			timeout: credentials.timeout,
			maxReconnectAttempts: -1,
			waitOnFirstConnect: true,
			servers,
		};

		if (credentials.authentication) {
			if (!(credentials.username && credentials.password)) {
				throw new NodeOperationError(
					this.getNode(),
					'Username and password are required for authentication',
				);
			}
			connectionOptions.user = credentials.username;
			connectionOptions.pass = credentials.password;
		}

		try {
			const natsClient = await connect(connectionOptions);
			Logger.info(`connected to ${natsClient.getServer()}`);

			natsClient.closed()
				.then((err) => {
					if (err) {
						Logger.error(
							`service ${queue} exited because of error: ${err}`,
						);
					}
				});

			for (let i = 0; i < items.length; i++) {
				const subject = this.getNodeParameter('subject', i) as string;
				const jsonParameters = this.getNodeParameter('jsonParameters', i) as boolean;
				const options = this.getNodeParameter('options', i) as {
					onlyEmit: boolean,
				};

				const message: IDataObject = {
					id: uuid(),
					pattern: subject,
				};

				if (sendInputData) {
					message.data = items[i].json;
				} else {
					message.data = JSON.parse(this.getNodeParameter('message', i) as string);
				}

				const msgHdrs = headers();

				let hdrs = {};
				if (jsonParameters) {
					try {
						hdrs = JSON.parse(this.getNodeParameter('headerParametersJson', i) as string);
					} catch {
						throw new NodeOperationError(this.getNode(), 'Headers must be a valid json');
					}
				} else {
					const values = (this.getNodeParameter('headersUi', i) as IDataObject)
						.headerValues as IDataObject[];
					hdrs = {};
					if (values !== undefined) {
						for (const value of values) {
							//@ts-expect-error error
							headers[value.key] = value.value;
						}
					}
				}

				for (const [key, value] of Object.entries(hdrs)) {
					if (!msgHdrs.has(key)) {
						msgHdrs.set(key, value as string);
					}
				}

				if (options.onlyEmit) {
					natsClient.publish(subject, jsonCodec.encode(message), {
						headers: msgHdrs,
					});

					await natsClient.drain();
					await natsClient.close();

					return [this.helpers.returnJsonArray({
						success: true,
					})];
				}

				const inbox = createInbox();

				const subscription = natsClient.subscribe(inbox, {
					queue,
				});

				subscription.closed.then(() => {
					Logger.error(
						`subscription ${subscription.getID()} closed`,
					);
				});

				const startListener = async () => {
					for await (const msg of subscription) {
						const dataObject: IDataObject = {};
						dataObject.data = jsonCodec.decode(msg.data);

						Logger.info(`[${subscription.getProcessed()}]: ${JSON.stringify(dataObject)}`);

						subscription.unsubscribe();
						return dataObject;
					}

					Logger.info(`[${subscription.getProcessed()}]: done`);

					return undefined;
				};

				subscriptionsPromise.push(startListener());


				natsClient.publish(subject, jsonCodec.encode(message), {
					reply: inbox,
					headers: msgHdrs,
				});
			}

			const promisesResponses = await Promise.allSettled(subscriptionsPromise);

			for (const response of promisesResponses) {
				if (response.status !== 'fulfilled') {
					if (!this.continueOnFail()) {
						throw new NodeApiError(this.getNode(), response);
					} else {
						// Return the actual reason as error
						responseData.push({
							json: {
								error: response.reason,
							},
						});
						continue;
					}
				}

				responseData.push({
					json: {
						success: response.value,
					},
				});
			}

			await natsClient.close();

			if (!responseData.length) {
				responseData.push({
					success: true,
				});
			}

			return [this.helpers.returnJsonArray(responseData)];

		} catch (error) {
			if (this.continueOnFail()) {
				return [this.helpers.returnJsonArray({ error: error.message })];
			} else {
				throw error;
			}
		}
	}
}
