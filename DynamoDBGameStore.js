'use strict';

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({
	params: {
		TableName: process.env.TABLE_NAME,
	}
});
const request = require('request-promise-native');

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
				'owner': owner.facebook_psid,
				'players': dynamoDB.createSet([owner.facebook_psid]),
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
			UpdateExpression: 'ADD players :player',
			ExpressionAttributeValues: {
				":player": dynamoDB.createSet([user.facebook_psid])
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

	// Get games owned by a user
	getGamesOwnedBy(owner) {
		// Find previous games
		let scanParams = {
			FilterExpression: '#o = :o',
			ExpressionAttributeNames: { '#o': 'owner' },
			ExpressionAttributeValues: { ':o': owner.facebook_psid }
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

module.exports = GameStore;