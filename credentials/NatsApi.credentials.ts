import { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class NatsApi implements ICredentialType {
	name = 'natsApi';
	displayName = 'NATS API';
	documentationUrl = 'https://docs.n8n.io/nodes/n8n-nodes-base.nats/';
	test = {
		request: {
			url: ''
		}
	}
	icon = `file:../nodes/Nats/nats.svg` as Icon;

	properties: INodeProperties[] = [
		{
			displayName: 'Queue',
			name: 'queue',
			type: 'string',
			required: true,
			default: 'n8n_queue',
			placeholder: 'n8n_queue',
		},
		{
			displayName: 'Servers',
			name: 'servers',
			type: 'string',
			default: '',
			placeholder: 'nats:4442',
		},
		{
			displayName: 'Timeout',
			name: 'timeout',
			type: 'number',
			default: 30000,
			description: 'The time to await a response in ms',
			hint: 'Value in milliseconds',
		},
		// {
		// 	displayName: 'SSL',
		// 	name: 'ssl',
		// 	type: 'boolean',
		// 	default: true,
		// },
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'boolean',
			default: false,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			displayOptions: {
				show: {
					authentication: [true],
				},
			},
			default: '',
			description: 'Optional username if authenticated is required',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			displayOptions: {
				show: {
					authentication: [true],
				},
			},
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Optional password if authenticated is required',
		},
	];
}
