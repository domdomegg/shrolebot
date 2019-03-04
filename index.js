'use strict';

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({
	params: {
		TableName: process.env.TABLE_NAME,
	}
});
const User = require('./FacebookUser.js');

exports.handleMessage = (user, msg) => {
	msg = msg.toLowerCase();

	if (msg.startsWith('database')) handleDatabase(user, msg);
	else if (msg.startsWith('create')) handleCreate(user, msg);
	else if (msg.startsWith('join')) handleJoin(user, msg);
	// TODO: else if (msg.startsWith('leave'))
	else if (msg.startsWith('start')) handleStart(user, msg);
	else if (msg.startsWith('players')) handlePlayers(user, msg);
	else if (msg.startsWith('help')) handleHelp(user, msg);
	else handleUnrecognized(user, msg);
}

exports.handleNoMessage = (user) => {
	user.sendMessage(`Something went wrong getting the message to me. Please tell Adam if you see this error.`);
}

function handleDatabase(user, msg) {
	if (process.env.STAGE != 'dev') {
		user.sendMessage(`Cannot get database entry while in stage ${process.env.STAGE}`);
		console.warn(`User ${user.facebook_psid} tried command '${msg}' in stage '${process.env.STAGE}'`);
		return;
	}

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
		console.error(err);
		user.sendMessage(`Unknown error retrieving database`);
	});
}

function handleCreate(user, msg) {
	// Find previous games
	let scanParams = {
		FilterExpression: '#o = :o',
		ExpressionAttributeNames: { '#o': 'owner' },
		ExpressionAttributeValues: { ':o': user.facebook_psid }
	};
	dynamoDB.scan(scanParams).promise()
	.then(data => {
		return Promise.all(data.Items.map(item => {
			if (item.gameID == 9999) {
				user.sendMessage(`Not cancelling test game ${item.gameID}`);
				return;
			}

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
			if (!data || !data.Attributes || !data.Attributes.gameID) return;

			user.sendMessage(`Cancelled previous game ${data.Attributes.gameID}`);

			data.Attributes.players.values.map(facebook_psid => new User(facebook_psid)).forEach(player => {
				if (player.equals(user)) return;
				player.sendMessage(`The host cancelled game ${data.Attributes.gameID}`);
			});
		});
	})
	.catch(err => {
		console.error(err);
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
		console.error(err);
		user.sendMessage(`Error creating game, please try again.`);
	});
}

function generateGameID() {
	return Math.floor(Math.random() * (9998 - 1000 + 1) + 1000);
}

function handleJoin(user, msg) {
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
				console.error(err);
				user.sendMessage(`An unknown error occured (1) - please tell Adam if you see this!`);
			}
		} else if (!data.Attributes) {
			console.error(err);
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

function handleStart(user, msg) {
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
		console.error(err);
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

function handlePlayers(user, msg) {
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
		console.error(err);
		user.sendMessage(`Unknown error retrieving database`);
	});
}

function handleHelp(user, msg) {
	user.sendMessage(`Supported commands:\ncreate\njoin <gameID>\nstart <gameID>\nplayers <gameID>\nhelp`);
}

function handleUnrecognized(user, msg) {
	user.sendMessage(`Unrecognized command, try 'help' for a list that work`);
}