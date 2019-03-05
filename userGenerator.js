'use strict';

const FacebookUser = require('./FacebookUser.js');

module.exports = (u) => {
	switch (u.network_name) {
		case 'FACEBOOK':
			return new FacebookUser(u.network_name, u.network_scoped_id, u.first_name);
	}
	throw new Error(`Unknown network name: ${u.network_name}`);
};