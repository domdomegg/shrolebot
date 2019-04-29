'use strict';

class AbstractUser {
	constructor(network_name, network_scoped_id, first_name) {
		this.network_name = network_name;
		this.network_scoped_id = network_scoped_id;
		this.first_name = first_name;
	}

	getFirstNamePromise() {
		throw new Error('getFirstNamePromise should be implemented in a concrete class');
	}

	// Sends response messages via the Send API
	sendMessage(msg) {
		throw new Error('sendMessage should be implemented in a concrete class');
	}

	equals(user) {
		return this.network_name = user.network_name && this.network_scoped_id == user.network_scoped_id;
	}

	toString() {
		return JSON.stringify({
			first_name: this.first_name,
			network_name: this.network_name,
			network_scoped_id: this.network_scoped_id
		});
	}

	toBasicObject() {
		return {
			network_name: this.network_name,
			network_scoped_id: this.network_scoped_id,
			first_name: this.first_name,
		}
	}
}

module.exports = AbstractUser;