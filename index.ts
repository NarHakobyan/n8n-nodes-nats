// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { connect, type ConnectionOptions, headers, JSONCodec } from 'nats';
import { type IDataObject, LoggerProxy as Logger } from 'n8n-workflow';
// eslint-disable-next-line @n8n/community-nodes/no-restricted-imports
import { v4 as uuid } from 'uuid';

async function main() {
	const jsonCodec = JSONCodec<IDataObject>();

	const queue = 'n8n_queue';
	const subject = 'domainSettings.enableSsl';
	const connectionOptions: ConnectionOptions = {
		timeout: 5000,
		waitOnFirstConnect: true,
		servers: ['localhost:4222'],
	};

	const natsClient = await connect(connectionOptions);

	Logger.info(`connected to ${natsClient.getServer()}`);

	const message: IDataObject = {
		id: uuid(),
		pattern: subject,
		data: { 'token': 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoiQ0hFQ0tfSE9TVF9UT0tFTiIsImhvc3QiOiJjYXJlZXJzLWRldi5yZXhpLmFwcCIsImRvbWFpblNldHRpbmdzSWQiOiI1NTBmMzk0MC0zNDNjLTRjODEtODI5ZS02ZDFmNDJmZmYxZWIiLCJpYXQiOjE2NjM1OTkwNDF9.qnVpW25WApatsRJ6rKSivK1Ea2LaL32EIQhzFzGR--kbEaWoprRPAHCDdpc95nBafJ8kbGizyKDuFzLdONKF8moVRTPnFODcBF-dwJUoA9zGJTaM_ePoGiMv3a8Iy9_bPxY5UGnGEtDH3-Z3hExQInD7zqH2dTliWVCIZvm8M9hFm9Ntbh3cYihKWMH11ZdwP_dNfXyo34WHT8GflMFT020mq8Fpnf_nTKhlhg-9m1b5F23JxmMyIaNUvtXmkkUhxvl2grzFXC305sssp8jzEdfI3lDiRdFs8OIBLwUWiIkcVl0QlxDMvyATuEUxts_0y2_a9F7a1gZr4RCV6d-5BQm6SVz8hQLDz3pKA6qYIbOLIvVV0OzReTWdGfnVUUzTBT9L_Uorla5OtpMsgjeWl4tv5_WOusUaI9q6aY6YL-n_ZMEuQtXwDRZUaCtiOPZWSPFngq5plKgjD_e5r_KTNywEiOPUDXPlYKjo78UHHkQz83E5BJtTZ2lZqoi3mk8omOY2uVO9ZuVagAPeWG1o052q6wKaX47MEnqgLAhwFMxW-tP6Xn4G2m_Oo9EwgAAF-EVZHJUJGglic1u8X8nKt4Fbxpm9_S-u2tuQLLCGwiZJLfFt8RvBF3Ugfj7DO49SH75HzNoi5ta2WxuB-etQNvxOzKp7LZMEU3GyimLmTOI' },
	};

	const msgHdrs = headers();

	natsClient.closed()
		.then((err) => {
			if (err) {
				Logger.error(
					`service ${queue} exited because of error: ${err}`,
				);
			}
		});


	natsClient.publish(subject, jsonCodec.encode(message), {
		headers: msgHdrs,
	});

}

main();
