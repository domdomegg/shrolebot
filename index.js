'use strict';

const request = require('request-promise-native');
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({
	params: {
		TableName: process.env.TABLE_NAME,
	}
});

exports.handler = (event, context, callback) => {

	// GET request is Facebook performing verification
	if (event.httpMethod == 'GET') {
		const queryParams = event.queryStringParameters;
		if (queryParams['hub.verify_token'] == process.env.VERIFY_TOKEN) {
			callback(null, {
				'body': queryParams['hub.challenge'],
				'statusCode': 200
			});
		} else {
			callback(null, {
				'body': 'Wrong validation token',
				'statusCode': 403
			});
		}

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
				handlePostback(event.sender.id, event.postback);
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
function handleMessage(sender_psid, received_message) {
	if (!received_message.text) {
		handleUnrecognized(null, sender_psid);
	} else {
		let msg = received_message.text.toLowerCase();
		console.log("Recieved message '" + msg + "' from user with PSID " + sender_psid);

		if (msg.startsWith('database')) handleDatabase(msg, sender_psid);
		else if (msg.startsWith('create')) handleCreate(msg, sender_psid);
		else if (msg.startsWith('join')) handleJoin(msg, sender_psid);
		// TODO: else if (msg.startsWith('leave'))
		else if (msg.startsWith('start')) handleStart(msg, sender_psid);
		else if (msg.startsWith('players')) handlePlayers(msg, sender_psid);
		else if (msg.startsWith('help')) handleHelp(msg, sender_psid);
		else handleUnrecognized(msg, sender_psid);
	}
}

function handleDatabase(msg, sender_psid) {
	let gameID = parseInt(msg.slice(9, 13));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			sendMessage(sender_psid, `Game ${gameID} not found - check the number is correct`);
			return;
		}

		sendMessage(sender_psid, JSON.stringify(data.Item, null, '\t'));
	})
	.catch(err => {
		console.log(err);
		sendMessage(sender_psid, `Unknown error retrieving database`);
	});
}

function handleCreate(msg, sender_psid) {
	// Find previous games
	let scanParams = {
		FilterExpression: '#o = :o',
		ExpressionAttributeNames: { '#o': 'owner' },
		ExpressionAttributeValues: { ':o': sender_psid }
	};
	dynamoDB.scan(scanParams).promise()
	.then(data => {
		return Promise.all(data.Items.map(item => {
			// Delete previous games
			let deleteParams = {
				Key: {
					'gameID': item.gameID
				},
				ReturnValues: "ALL_OLD",
			};
			return dynamoDB.delete(deleteParams).promise();
		}));
	})
	.then(returnValues => {
		returnValues.forEach(data => {
			sendMessage(sender_psid, `Cancelling previous game ${data.Attributes.gameID}`);

			data.Attributes.players.values.forEach(player => {
				if (player == sender_psid) return;
				sendMessage(player, `The host cancelled game ${data.Attributes.gameID}`);
			});
		});
	})
	.catch(err => {
		console.log(err);
		sendMessage(sender_psid, `Failed to cancel old games, but continuing anyways.`);
	})
	.then(() => {
		let gameID = generateGameID();
		let putParams = {
			Item: {
				'gameID': gameID,
				'owner': sender_psid,
				'players': dynamoDB.createSet([sender_psid]),
				'ttl': Math.floor(Date.now() / 1000) + 86400 // 24 hour TTL
			},
			ConditionExpression: 'attribute_not_exists(gameID)'
		};

		return dynamoDB.put(putParams).promise().then(() => gameID);
	})
	.then(gameID => {
		sendMessage(sender_psid, `Created game ${gameID}`);
	})
	.catch(err => {
		console.log(err);
		sendMessage(sender_psid, `Error creating game, please try again.`);
	});
}

function generateGameID() {
	return Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
}

function handleJoin(msg, sender_psid) {
	let gameID = parseInt(msg.slice(5, 9));
	let params = {
		Key: {
			'gameID': gameID,
		},
		UpdateExpression: 'ADD players :player',
		ExpressionAttributeValues: {
			":player": dynamoDB.createSet([sender_psid])
		},
		ConditionExpression: 'attribute_exists(gameID)',
		ReturnValues: "ALL_NEW",
	};

	dynamoDB.update(params, function (err, data) {
		if (err) {
			if (err.code == 'ConditionalCheckFailedException') {
				sendMessage(sender_psid, `Game ${gameID} not found - check the number is correct`);
			} else {
				console.log(err);
				sendMessage(sender_psid, `An unknown error occured (1) - please tell Adam if you see this!`);
			}
		} else if (!data.Attributes) {
			console.log(err);
			sendMessage(sender_psid, `An unknown error occured (2) - please tell Adam if you see this!`);
		} else {
			Promise.all([
				getFirstName(sender_psid),
				getFirstName(data.Attributes.owner)
			])
			.then(res => {
				let [joinerName, ownerName] = res;
				sendMessage(sender_psid, `Joined ${ownerName}'s game ${data.Attributes.gameID}`);
				sendMessage(data.Attributes.owner, `${joinerName} joined game ${data.Attributes.gameID}`);
			})
			.catch(err => {
				console.log("Failed to get names from Facebook graph API: " + err);
				sendMessage(sender_psid, `Joined game ${data.Attributes.gameID}`);
				sendMessage(data.Attributes.owner, `A user joined game ${data.Attributes.gameID}`);
			});
		}
	});
}

function handleStart(msg, sender_psid) {
	let gameID = parseInt(msg.slice(6, 10));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			sendMessage(sender_psid, `Game ${gameID} not found - check the number is correct`);
			sendMessage(sender_psid, `Games time out after 24 hours, so you might need to create a new one`);
			return;
		}

		if (data.Item.owner != sender_psid) {
			sendMessage(sender_psid, `Only the person who created the game can start it.`);
			return;
		}

		let players = data.Item.players.values;

		if (players.length < 5) {
			sendMessage(sender_psid, `At least 5 players are needed to start a game - currently there ${players.length == 1 ? 'is' : 'are'} only ${players.length}`);
			return;
		}
		if (players.length > 10) {
			sendMessage(sender_psid, `A maximum of 10 people can play a game - currently there are ${players.length}`);
			return;
		}

		sendMessage(sender_psid, `Game starting with ${players.length} players`);

		// Update the TTL
		let TTLparams = {
			Key: {
				'gameID': gameID,
			},
			AttributeUpdates: {
				'ttl': {
					Action: 'PUT',
					Value: Math.floor(Date.now() / 1000) + 86400 // 24 hour TTL
				}
			}
		};
		dynamoDB.update(TTLparams, (err, data) => { });

		// Get people's roles (list of psid's)
		let [hitler, fascists, liberals] = calcPlayerRoles(players);

		Promise.all(players.map(getFirstName))
		.then(ns => {
			let names = {};
			ns.forEach((n, i) => names[players[i]] = n)
			return names;
		})
		.then(names => {
			if (fascists.length == 1) {
				sendMessage(hitler, `You are Hitler! The other fascist is ${names[fascists[0]]}`);
				sendMessage(fascists[0], `You are fascist! Hitler is ${names[hitler]}`);
			} else {
				sendMessage(hitler, `You are Hitler!`);

				fascists.forEach(fascistPlayer => {
					let otherFascists = fascists.filter(f => f != fascistPlayer);
					if (otherFascists.length == 1) {
						sendMessage(fascistPlayer, `You are fascist! Hitler is ${names[hitler]} and the other fascist is ${names[otherFascists[0]]}.`);
					} else {
						sendMessage(fascistPlayer, `You are fascist! Hitler is ${names[hitler]} and the other fascist are ${otherFascists.map(f => names[f]).join(' and ')}.`);
					}
				});
			}

			sendMessage(hitler, `You can show your group membership at https://goo.gl/dvwKVp`);
			fascists.forEach(player => {
				sendMessage(player, `You can show your group membership at https://goo.gl/dvwKVp`);
			});

			liberals.forEach(player => {
				sendMessage(player, `You are liberal!`);
				sendMessage(player, `You can show your group membership at https://goo.gl/x1hekt`);
			});
		});
	})
	.catch(err => {
		console.log(err);
		sendMessage(sender_psid, `An unknown error occured (3) - please tell Adam if you see this!`);
	});
}

function calcPlayerRoles(players) {
	// Calculate the number of each role
	let numHitler = 1;
	let numNonHitlerFascist = Math.floor((players.length - 3) / 2);
	let numLiberal = players.length - 1 - numNonHitlerFascist;

	// Create an array of roles
	let roles = ('H'.repeat(numHitler) + 'F'.repeat(numNonHitlerFascist) + 'L'.repeat(numLiberal)).split('');

	// Shuffle the roles
	shuffle(roles);

	let hitler, fascists = [], liberals = [];
	for (let i = 0; i < players.length; i++) {
		if (roles[i] == 'H') hitler = players[i];
		else if (roles[i] == 'F') fascists.push(players[i]);
		else if (roles[i] == 'L') liberals.push(players[i]);
	}
	return [hitler, fascists, liberals];
}

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

function handlePlayers(msg, sender_psid) {
	let gameID = parseInt(msg.slice(8, 12));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			sendMessage(sender_psid, `Game ${gameID} not found - check the number is correct`);
			return;
		}

		let players = data.Item.players.values;

		// This doesn't really add anything as if they know the gameID they can join
		// anyways, however it might be useful in the future
		if (players.indexOf(sender_psid) == -1) {
			sendMessage(sender_psid, `Only players who have joined the game can view other players.`);
			return;
		}

		Promise.all(players.map(getFirstName))
		.then(ns => {
			let names = {};
			ns.forEach((n, i) => names[players[i]] = n)
			return names;
		})
		.then(names => {
			sendMessage(sender_psid, `There ${players.length == 1 ? `is 1 player` : `are ${players.length} players`} in game ${data.Item.gameID}:\n${players.map(p => names[p] + (p == data.Item.owner ? " (creator)" : "")).sort().join('\n')}`);
		});
	})
	.catch(err => {
		console.log(err);
		sendMessage(sender_psid, `Unknown error retrieving database`);
	});
}

function handleHelp(msg, sender_psid) {
	sendMessage(sender_psid, `Supported commands:\ncreate\njoin <gameID>\nstart <gameID>\nplayers <gameID>\nhelp`);
}

function handleUnrecognized(msg, sender_psid) {
	sendMessage(sender_psid, `Unrecognized command, try 'help' for a list that work`);
}

// Returns a promise to get a user's first name with the given psid
function getFirstName(psid) {
	return request({
		"uri": `https://graph.facebook.com/${psid}?fields=first_name&access_token=${process.env.PAGE_ACCESS_TOKEN}`,
		"method": "GET",
		json: true
	}).then(data => data.first_name)
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function sendMessage(sender_psid, message) {
	let request_body = {
		recipient: {
			id: sender_psid
		},
		message: {
			text: message
		}
	};

	// Send the HTTP request to the Messenger Platform
	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	})
	.then(() => {
		console.log("Message sent" + (message ? ": " + message : ""));
	})
	.catch(err => {
		console.error("Unable to send message:" + err);
	});
}