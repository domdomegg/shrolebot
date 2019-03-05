'use strict';

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({
	params: {
		TableName: process.env.TABLE_NAME,
	}
});

// User class
class GameStore {
	constructor() {}

	// Gets a game by gameID
	getByGameID(gameID) {
		let params = {
			Key: {
				'gameID': gameID
			}
		};
		
		return dynamoDB.get(params).promise()
		.then(data => {
			if (!data.Item) {
				let error = new Error('Game not found in database');
				error.code = 'GameNotFound';
				throw error;
			}
			
			return data.Item;
		});
	}

	// Creates a game with an owner, returns a promise of a gameID if successful
	createGameWithOwner(owner) {
		let gameID = generateGameID();
		let putParams = {
			Item: {
				'gameID': gameID,
				'players': [
					owner
				],
				'ttl': getTTL()
			},
			ConditionExpression: 'attribute_not_exists(gameID)'
		};

		return dynamoDB.put(putParams).promise().then(() => gameID);
	}

	// Deleted a game with the given gameID, returns the game that was deleted
	deleteGame(gameID) {
		let deleteParams = {
			Key: {
				'gameID': gameID
			},
			ReturnValues: "ALL_OLD",
		};
		return dynamoDB.delete(deleteParams).promise().then(data => data.Attributes);
	}

	// Update a game's TTL
	updateTTL(gameID) {
		let TTLparams = {
			Key: {
				'gameID': gameID,
			},
			AttributeUpdates: {
				'ttl': {
					Action: 'PUT',
					Value: getTTL()
				}
			}
		};
		return dynamoDB.update(TTLparams).promise();
	}

	// Add given user to a game with given gameID
	addUserToGame(user, gameID) {
		let params = {
			Key: {
				'gameID': gameID,
			},
			UpdateExpression: 'SET players = list_append(players, :player)',
			ExpressionAttributeValues: {
				":player": [user]
			},
			ConditionExpression: 'attribute_exists(gameID)',
			ReturnValues: "ALL_NEW",
		};
		
		return dynamoDB.update(params).promise()
		.catch(err => {
			if (err.code == 'ConditionalCheckFailedException') {
				let error = new Error('Game not found in database');
				error.code = 'GameNotFound';
				throw error;
			}

			throw err;
		})
		.then(data => {
			if (!data.Attributes) {
				let error = new Error('Game not found in database');
				error.code = 'GameNotFound';
				throw error;
			}
			
			return data.Attributes;
		});
	}

	// Remove a user from a game
	removeUserFromGame(user, gameID) {
		return this.getByGameID(gameID)
		.then(game => {
			let index = userIndexOf(game.players, user);
			if (index == -1) {
				let error = new Error('User is not in that game');
				error.code = 'NotInGame';
				throw error;
			}

			if (index == 0) {
				let error = new Error('User is game owner');
				error.code = 'RemoveGameOwner';
				throw error;
			}
			
			let params = {
				Key: {
					'gameID': gameID,
				},
				UpdateExpression: 'REMOVE players[' + index + ']',
				ConditionExpression: 'attribute_exists(gameID)',
				ReturnValues: "ALL_NEW",
			};
			return dynamoDB.update(params).promise()
			.then(data => data.Attributes);
		});
	}

	// Get games owned by a user
	getGamesOwnedBy(owner) {
		// Find previous games
		let scanParams = {
			FilterExpression: 'players[0].network_name = :owner_network_name and players[0].network_scoped_id = :owner_network_scoped_id',
			ExpressionAttributeValues: {
				':owner_network_name': owner.network_name,
				':owner_network_scoped_id': owner.network_scoped_id
			}
		};
		return dynamoDB.scan(scanParams).promise();
	}
}

function generateGameID() {
	return Math.floor(Math.random() * (9998 - 1000 + 1) + 1000);
}

function getTTL() {
	return Math.floor(Date.now() / 1000) + 86400; // 24 hour TTL
}

function userIndexOf(arr, user) {
	for (let i = 0; i < arr.length; i++) {
		if (user.equals(arr[i])) return i;
	}
	return -1;
}

module.exports = GameStore;