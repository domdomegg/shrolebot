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
}

module.exports = GameStore;