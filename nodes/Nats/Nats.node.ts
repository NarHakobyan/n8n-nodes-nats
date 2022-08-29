import { v4 as uuid } from 'uuid';
import { connect, ConnectionOptions, createInbox, headers, JSONCodec, Msg } from 'nats';

import { IExecuteFunctions } from 'n8n-core';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription, JsonObject, NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

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
		inputs: ['main'],
		outputs: ['main'],
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
				displayName: 'Only Emit',
				name: 'onlyEmit',
				type: 'boolean',
				default: false,
				description: 'Whether to send the data to Nats without waiting for a response',
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
						displayName: 'Acks',
						name: 'acks',
						type: 'boolean',
						default: false,
						description: 'Whether or not producer must wait for acknowledgement from all replicas',
					},
					{
						displayName: 'Compression',
						name: 'compression',
						type: 'boolean',
						default: false,
						description: 'Whether to send the data in a compressed format using the GZIP codec',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		const responseData: IDataObject[] = [];
		const subscriptionsPromise: Array<Promise<unknown>> = [];

		try {
			const options = this.getNodeParameter('options', 0) as IDataObject;
			const sendInputData = this.getNodeParameter('sendInputData', 0) as boolean;

			const credentials = await this.getCredentials('natsApi');

			const servers = ((credentials.servers as string) || '')
				.split(',')
				.filter(Boolean)
				.map((item) => item.trim()) as string[];

			const queue = credentials.queue as string;

			const connectionOptions: ConnectionOptions = {
				name: queue,
				servers,
			};

			if (credentials.authentication === true) {
				if (!(credentials.username && credentials.password)) {
					throw new NodeOperationError(
						this.getNode(),
						'Username and password are required for authentication',
					);
				}
				connectionOptions.user = credentials.username as string;
				connectionOptions.pass = credentials.password as string;
			}

			const natsClient = await connect(connectionOptions);

			natsClient.closed()
				.then((err) => {
					if (err) {
						console.error(
							`service ${queue} exited because of error: ${err.message}`,
						);
					}
				});
			const jsonCodec = JSONCodec<IDataObject>();

			for (let i = 0; i < items.length; i++) {
				const subject = this.getNodeParameter('subject', i) as string;
				const jsonParameters = this.getNodeParameter('jsonParameters', i) as boolean;
				const onlyEmit = this.getNodeParameter('onlyEmit', i) as boolean;

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
					} catch (exception) {
						throw new NodeOperationError(this.getNode(), 'Headers must be a valid json');
					}
				} else {
					const values = (this.getNodeParameter('headersUi', i) as IDataObject)
						.headerValues as IDataObject[];
					hdrs = {};
					if (values !== undefined) {
						for (const value of values) {
							//@ts-ignore
							headers[value.key] = value.value;
						}
					}
				}

				for (const [key, value] of Object.entries(hdrs)) {
					if (!msgHdrs.has(key)) {
						msgHdrs.set(key, value as string);
					}
				}

				if(onlyEmit) {
					natsClient.publish(subject, jsonCodec.encode(message), {
						headers: msgHdrs,
					});

					return [this.helpers.returnJsonArray({
						success: true,
					})];
				}

				const inbox = createInbox();

				const subscription = natsClient.subscribe(inbox, {
					queue,
					timeout: options.sessionTimeout as number,
				});

				subscription.closed.then(() => {
						console.error(
							`subscription ${subscription.getID()} closed`,
						);
				});

				const startListener = async () => {
					for await (const msg of subscription) {
						const dataObject: IDataObject = {};

						// if (options.jsonParseMessage) {
						// 	try {
						// 		value = JSON.parse(value);
						// 	} catch (error) {}
						// }
						const value = jsonCodec.decode(msg.data);

						// if (options.onlyMessage) {
						// 	//@ts-ignore
						// 	data = value;
						// } else {
						dataObject.data = value;
						// }

						console.log(`[${subscription.getProcessed()}]: ${dataObject}`);

						subscription.unsubscribe();
						return dataObject;
					}

					console.log(`[${subscription.getProcessed()}]: done`);
				};

				subscriptionsPromise.push(startListener());

				natsClient.publish(subject, jsonCodec.encode(message), {
					reply: inbox,
					headers: msgHdrs,
				});
			}

			const promisesResponses = await Promise.allSettled(subscriptionsPromise);

			// @ts-ignore
			promisesResponses.forEach((response: JsonObject) => {
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
						return;
					}
				}

				responseData.push({
					json: {
						success: response.value,
					},
				});
			});

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
