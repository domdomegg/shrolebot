'use strict';

const request = require('request-promise-native');
const AbstractUser = require('./AbstractUser.js');

class FacebookUser extends AbstractUser {
	async getFirstNamePromise() {
		if (this.first_name == null) {
			const data = await request({
				"uri": `https://graph.facebook.com/${this.network_scoped_id}?fields=first_name&access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
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
			recipient: { id: this.network_scoped_id },
			message: { text: msg }
		};

		// Send the HTTP request to the Messenger Platform
		return request({
			"uri": "https://graph.facebook.com/v2.6/me/messages",
			"qs": { "access_token": process.env.FB_PAGE_ACCESS_TOKEN },
			"method": "POST",
			"json": request_body
		})
		.then(() => { console.log("Message sent" + (msg ? ": " + msg : "")); })
		.catch(err => { console.error("Unable to send message:" + err); });
	}
}

module.exports = FacebookUser;