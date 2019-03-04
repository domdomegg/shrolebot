'use strict';

const request = require('request-promise-native');
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({
	params: {
		TableName: process.env.TABLE_NAME,
	}
});

// User class
class User {
	constructor(facebook_psid) {
		this.facebook_psid = facebook_psid;
		this.first_name = null;
	}

	async getFirstNamePromise() {
		if (this.first_name == null) {
			const data = await request({
				"uri": `https://graph.facebook.com/${this.facebook_psid}?fields=first_name&access_token=${process.env.PAGE_ACCESS_TOKEN}`,
				"method": "GET",
				json: true
			});
			this.first_name = data.first_name
		}
		return this.first_name;
	}

	// Sends response messages via the Send API
	sendMessage(msg) {
		let request_body = {
			recipient: { id: this.facebook_psid },
			message: { text: msg }
		};

		// Send the HTTP request to the Messenger Platform
		request({
			"uri": "https://graph.facebook.com/v2.6/me/messages",
			"qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
			"method": "POST",
			"json": request_body
		})
		.then(() => { console.log("Message sent" + (msg ? ": " + msg : "")); })
		.catch(err => { console.error("Unable to send message:" + err); });
	}

	equals(user) {
		return this.facebook_psid == user.facebook_psid;
	}
}

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
function handleMessage(facebook_psid, received_message) {
	if (!received_message.text) {
		handleUnrecognized(null, facebook_psid);
	} else {
		let msg = received_message.text.toLowerCase();
		let user = new User(facebook_psid);
		console.log("Recieved message '" + msg + "' from user with PSID " + user.facebook_psid);

		if (msg.startsWith('database')) handleDatabase(msg, user);
		else if (msg.startsWith('create')) handleCreate(msg, user);
		else if (msg.startsWith('join')) handleJoin(msg, user);
		// TODO: else if (msg.startsWith('leave'))
		else if (msg.startsWith('start')) handleStart(msg, user);
		else if (msg.startsWith('players')) handlePlayers(msg, user);
		else if (msg.startsWith('help')) handleHelp(msg, user);
		else handleUnrecognized(msg, user);
	}
}

function handleDatabase(msg, user) {
	let gameID = parseInt(msg.slice(9, 13));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			return;
		}

		user.sendMessage(JSON.stringify(data.Item, null, '\t'));
	})
	.catch(err => {
		console.log(err);
		user.sendMessage(`Unknown error retrieving database`);
	});
}

function handleCreate(msg, user) {
	// Find previous games
	let scanParams = {
		FilterExpression: '#o = :o',
		ExpressionAttributeNames: { '#o': 'owner' },
		ExpressionAttributeValues: { ':o': user.facebook_psid }
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
			user.sendMessage(`Cancelling previous game ${data.Attributes.gameID}`);

			data.Attributes.players.values.map(facebook_psid => new User(facebook_psid)).forEach(player => {
				if (player.equals(user)) return;
				player.sendMessage(`The host cancelled game ${data.Attributes.gameID}`);
			});
		});
	})
	.catch(err => {
		console.log(err);
		user.sendMessage(`Failed to cancel old games, but continuing anyways.`);
	})
	.then(() => {
		let gameID = generateGameID();
		let putParams = {
			Item: {
				'gameID': gameID,
				'owner': user.facebook_psid,
				'players': dynamoDB.createSet([user.facebook_psid]),
				'ttl': Math.floor(Date.now() / 1000) + 86400 // 24 hour TTL
			},
			ConditionExpression: 'attribute_not_exists(gameID)'
		};

		return dynamoDB.put(putParams).promise().then(() => gameID);
	})
	.then(gameID => {
		user.sendMessage(`Created game ${gameID}`);
	})
	.catch(err => {
		console.log(err);
		user.sendMessage(`Error creating game, please try again.`);
	});
}

function generateGameID() {
	return Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
}

function handleJoin(msg, user) {
	let gameID = parseInt(msg.slice(5, 9));
	let params = {
		Key: {
			'gameID': gameID,
		},
		UpdateExpression: 'ADD players :player',
		ExpressionAttributeValues: {
			":player": dynamoDB.createSet([user.facebook_psid])
		},
		ConditionExpression: 'attribute_exists(gameID)',
		ReturnValues: "ALL_NEW",
	};

	dynamoDB.update(params, function (err, data) {
		if (err) {
			if (err.code == 'ConditionalCheckFailedException') {
				user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			} else {
				console.log(err);
				user.sendMessage(`An unknown error occured (1) - please tell Adam if you see this!`);
			}
		} else if (!data.Attributes) {
			console.log(err);
			user.sendMessage(`An unknown error occured (2) - please tell Adam if you see this!`);
		} else {
			let owner = new User(data.Attributes.owner)

			Promise.all([user.getFirstNamePromise(), owner.getFirstNamePromise()]).then(_ => {
				user.sendMessage(`Joined ${owner.first_name}'s game ${data.Attributes.gameID}`);
				owner.sendMessage(`${user.first_name} joined game ${data.Attributes.gameID}`);
			})
		}
	});
}

function handleStart(msg, user) {
	let gameID = parseInt(msg.slice(6, 10));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			user.sendMessage(`Games time out after 24 hours, so you might need to create a new one`);
			return;
		}

		if (data.Item.owner != user.facebook_psid) {
			user.sendMessage(`Only the person who created the game can start it.`);
			return;
		}

		let players = data.Item.players.values.map(facebook_psid => new User(facebook_psid));

		if (players.length < 5) {
			user.sendMessage(`At least 5 players are needed to start a game - currently there ${players.length == 1 ? 'is' : 'are'} only ${players.length}`);
			return;
		}
		if (players.length > 10) {
			user.sendMessage(`A maximum of 10 people can play a game - currently there are ${players.length}`);
			return;
		}

		user.sendMessage(`Game starting with ${players.length} players`);

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

		// Get people's roles
		let [hitler, fascists, liberals] = calcPlayerRoles(players);

		// Get people's names
		Promise.all(players.map(p => p.getFirstNamePromise())).then(_ => {
			if (fascists.length == 1) {
				hitler.sendMessage(`You are Hitler! The other fascist is ${fascists[0].first_name}`);
				fascists[0].sendMessage(`You are fascist! Hitler is ${hitler.first_name}`);
			} else {
				hitler.sendMessage(`You are Hitler!`);

				fascists.forEach(fascistPlayer => {
					let otherFascists = fascists.filter(f => f != fascistPlayer);
					if (otherFascists.length == 1) {
						fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.first_name} and the other fascist is ${otherFascists[0].first_name}.`);
					} else {
						fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.first_name} and the other fascists are ${otherFascists.map(f => f.first_name).join(' and ')}.`);
					}
				});
			}

			hitler.sendMessage(`You can show your group membership at https://goo.gl/dvwKVp`);
			fascists.forEach(player => {
				player.sendMessage(`You can show your group membership at https://goo.gl/dvwKVp`);
			});

			liberals.forEach(player => {
				player.sendMessage(`You are liberal!`);
				player.sendMessage(`You can show your group membership at https://goo.gl/x1hekt`);
			});
		});
	})
	.catch(err => {
		console.log(err);
		user.sendMessage(`An unknown error occured (3) - please tell Adam if you see this!`);
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

function handlePlayers(msg, user) {
	let gameID = parseInt(msg.slice(8, 12));
	let params = {
		Key: {
			'gameID': gameID
		}
	};

	dynamoDB.get(params).promise()
	.then(data => {
		if (!data.Item) {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			return;
		}

		let playerPSIDs = data.Item.players.values
		
		// This doesn't really add anything as if they know the gameID they can join
		// anyways, however it might be useful in the future
		if (playerPSIDs.indexOf(user.facebook_psid) == -1) {
			user.sendMessage(`Only players who have joined the game can view other players.`);
			return;
		}
		
		let players = playerPSIDs.map(facebook_psid => new User(facebook_psid));
		let owner = new User(data.Item.owner);
		Promise.all(players.map(p => p.getFirstNamePromise())).then(_ => {
			user.sendMessage(`There ${players.length == 1 ? `is 1 player` : `are ${players.length} players`} in game ${data.Item.gameID}:\n${players.map(p => p.first_name + (p.equals(owner) ? " (creator)" : "")).sort().join('\n')}`);
		});
	})
	.catch(err => {
		console.log(err);
		user.sendMessage(`Unknown error retrieving database`);
	});
}

function handleHelp(msg, user) {
	user.sendMessage(`Supported commands:\ncreate\njoin <gameID>\nstart <gameID>\nplayers <gameID>\nhelp`);
}

function handleUnrecognized(msg, user) {
	user.sendMessage(`Unrecognized command, try 'help' for a list that work`);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}