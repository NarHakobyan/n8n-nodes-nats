import {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeOperationError,
} from 'n8n-workflow';
import { connect, ConnectionOptions, JSONCodec } from 'nats';

export class NatsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nats Trigger',
		name: 'natsTrigger',
		icon: 'file:nats.svg',
		group: ['trigger'],
		version: 1,
		description: 'Consume messages from a Nats subject',
		defaults: {
			name: 'Nats Trigger',
		},
		inputs: [],
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
				required: true,
				placeholder: 'subject-name',
				description: 'Name of the queue of subject to consume from',
			},
			{
				displayName: 'Queue',
				name: 'queue',
				type: 'string',
				default: 'n8n_queue',
				required: true,
				placeholder: 'n8n_queue',
				description: 'Queue name',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const subject = this.getNodeParameter('subject') as string;

		const queue = this.getNodeParameter('queue') as string;

		const credentials = await this.getCredentials('natsApi');

		const servers = ((credentials.servers as string) || '')
			.split(',')
			.filter(Boolean)
			.map((item) => item.trim());

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

		// const options = this.getNodeParameter('options', {}) as IDataObject;


		const subscription = natsClient.subscribe(subject, {
			queue,
		});

		const jsonCodec = JSONCodec<IDataObject>();

		const startListener = async () => {
			for await (const msg of subscription) {
				 const dataObject = jsonCodec.decode(msg.data);

				console.log(`[${subscription.getProcessed()}]: ${dataObject}`);

				this.emit([this.helpers.returnJsonArray([dataObject])]);
			}
			console.log("subscription closed");
		};

		startListener();

		// The "closeFunction" function gets called by n8n whenever
		// the workflow gets deactivated and can so clean up.
		async function closeFunction() {
			await natsClient.close();
		}

		// The "manualTriggerFunction" function gets called by n8n
		// when a user is in the workflow editor and starts the
		// workflow manually. So the function has to make sure that
		// the emit() gets called with similar data like when it
		// would trigger by itself so that the user knows what data
		// to expect.
		async function manualTriggerFunction() {
			startListener();
		}

		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
