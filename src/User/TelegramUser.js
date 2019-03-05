'use strict';

var TelegramBot = require('node-telegram-bot-api');
var telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_ACCESS_TOKEN, {polling: false});

const request = require('request-promise-native');
const AbstractUser = require('./AbstractUser.js');

class TelegramUser extends AbstractUser {
	getFirstNamePromise() {
		return Promise.resolve(this.first_name);
	}

	sendMessage(msg) {
		return telegramBot.sendMessage(this.network_scoped_id, msg);
	}
}

module.exports = TelegramUser;