'use strict';

const userGenerator = require('./userGenerator.js');
const LogicHandler = require('./index.js');

var TelegramBot = require('node-telegram-bot-api');
var telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_ACCESS_TOKEN, {polling: false});    

exports.handler = (event, context, callback) => {
	// POST request represents new messages
	if (event.httpMethod == 'POST' && event.body) {
		const data = JSON.parse(event.body).message;

		if(data.chat.type != 'private') {
			telegramBot.sendMessage(data.chat.id, `This bot only works in private chats`);
			return;
		};
		
		let user = userGenerator({
			network_name: 'TELEGRAM',
			network_scoped_id: data.chat.id,
			first_name: data.from.first_name
		});
	
		if (!data.text) {
			LogicHandler.handleNoMessage(user);
		} else {
			let msg = data.text;
			console.log("Recieved message '" + msg + "' from chat with id " + data.chat.id);
			LogicHandler.handleMessage(user, msg);
		}

		callback(null, {
			'body': "EVENT_RECEIVED",
			'statusCode': 200
		});
	}
};