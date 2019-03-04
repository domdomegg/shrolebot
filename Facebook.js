'use strict';

const User = require('./FacebookUser.js');
const LogicHandler = require('./index.js');

exports.handler = (event, context, callback) => {
	// GET request is Facebook performing verification
	if (event.httpMethod == 'GET') {
		const queryParams = event.queryStringParameters;
		if (!queryParams || !queryParams['hub.verify_token']) {
			callback(null, {
				'body': 'Missing validation token',
				'statusCode': 400
			});
			return;
		}

		if (!queryParams['hub.challenge']) {
			callback(null, {
				'body': 'Missing challenge',
				'statusCode': 400
			});
			return;
		}

		if (queryParams['hub.verify_token'] != process.env.VERIFY_TOKEN) {
			callback(null, {
				'body': 'Wrong validation token',
				'statusCode': 401
			});
			return;
		}

		callback(null, {
			'body': queryParams['hub.challenge'],
			'statusCode': 200
		});
	
	// POST request represents new messages
	} else if (event.httpMethod == 'POST') {
		const data = JSON.parse(event.body);

		// Make sure this is a page subscription
		if (data.object != 'page') {
			callback(null, {
				'body': "UNSUPPORTED_OPERATION",
				'statusCode': 415
			});
		}

		// Iterate over each entry - there may be multiple if batched
		// e.messaging always only has one event, so take index 0
		data.entry.map(e => e.messaging[0]).forEach(event => {
			if (event.message) {
				handleMessage(event.sender.id, event.message);
			} else if (event.postback) {
				handlePostback();
			} else {
				callback(null, {
					'body': "UNSUPPORTED_OPERATION",
					'statusCode': 415
				});
				return;
			}
		});

		// Let Facebook know we got the message
		callback(null, {
			'body': "EVENT_RECEIVED",
			'statusCode': 200
		});
	}
}

// Handles messages events
function handleMessage(facebook_psid, received_message) {
	let user = new User(facebook_psid);

	if (!received_message || !received_message.text) {
		LogicHandler.handleNoMessage(user);
	} else {
		let msg = received_message.text;	
		console.log("Recieved message '" + msg + "' from user with PSID " + user.facebook_psid);
		LogicHandler.handleMessage(user, msg);
	}
}

// Handles messaging_postbacks events
function handlePostback() {

}