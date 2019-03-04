const request = require('request-promise-native');

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

module.exports = User;