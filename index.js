'use strict';

const DynamoDBGameStore = require('./DynamoDBGameStore.js');
const gameStore = new DynamoDBGameStore();
const userGenerator = require('./userGenerator.js');

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
		console.warn(`${user} tried command '${msg}' in stage '${process.env.STAGE}'`);
		return;
	}

	let gameID = parseInt(msg.slice(9, 13));
	gameStore.getByGameID(gameID)
	.then(game => {
		user.sendMessage(JSON.stringify(game, null, '\t'));
	})
	.catch(err => {
		if (err.code == 'GameNotFound') {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			return;
		}

		console.error(err);
		user.sendMessage(`Unknown error retrieving database`);
	});
}

function handleCreate(user, msg) {
	gameStore.getGamesOwnedBy(user)
	.then(data => {
		return Promise.all(data.Items.map(game => {
			if (game.gameID == 9999) {
				user.sendMessage(`Not cancelling test game ${game.gameID}`);
				return;
			}

			return gameStore.deleteGame(game.gameID);
		}));
	})
	.then(returnValues => {
		returnValues.forEach(game => {
			if (!game || !game.gameID) return;

			user.sendMessage(`Cancelled previous game ${game.gameID}`);

			game.players.map(p => userGenerator(p)).forEach(player => {
				if (player.equals(user)) return;
				player.sendMessage(`The host cancelled game ${game.gameID}`);
			});
		});
	})
	.catch(err => {
		console.error(err);
		user.sendMessage(`Failed to cancel old games, but continuing anyways.`);
	})
	.then(() => {
		return gameStore.createGameWithOwner(user);
	})
	.then(gameID => {
		user.sendMessage(`Created game ${gameID}`);
	})
	.catch(err => {
		console.error(err);
		user.sendMessage(`Error creating game, please try again.`);
	});
}

function handleJoin(user, msg) {
	let gameID = parseInt(msg.slice(5, 9));

	gameStore.addUserToGame(user, gameID)
	.then(game => {
		let owner = userGenerator(game.players[0]);

		Promise.all([user.getFirstNamePromise(), owner.getFirstNamePromise()]).then(_ => {
			user.sendMessage(`Joined ${owner.first_name}'s game ${game.gameID}`);
			owner.sendMessage(`${user.first_name} joined game ${game.gameID}`);
		});
	})
	.catch(err => {
		if (err.code == 'GameNotFound') {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			return;
		}

		console.error(err);
		user.sendMessage(`An unknown error occured (1) - please tell Adam if you see this!`);
	});
}

function handleStart(user, msg) {
	let gameID = parseInt(msg.slice(6, 10));
	gameStore.getByGameID(gameID)
	.then(game => {
		if (!user.equals(game.players[0])) {
			user.sendMessage(`Only the person who created the game can start it.`);
			return;
		}

		let players = game.players.map(p => userGenerator(p));

		if (players.length < 5) {
			user.sendMessage(`At least 5 players are needed to start a game - currently there ${players.length == 1 ? 'is' : 'are'} only ${players.length}`);
			return;
		}
		if (players.length > 10) {
			user.sendMessage(`A maximum of 10 people can play a game - currently there are ${players.length}`);
			return;
		}

		user.sendMessage(`Game starting with ${players.length} players`);

		gameStore.updateTTL(gameID);

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
		if (err.code == 'GameNotFound') {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			user.sendMessage(`Games time out after 24 hours, so you might need to create a new one`);
			return;
		}

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
	gameStore.getByGameID(gameID)
	.then(game => {
		let players = game.players.map(p => userGenerator(p));
		let owner = game.players[0];

		Promise.all(players.map(p => p.getFirstNamePromise())).then(_ => {
			user.sendMessage(`There ${players.length == 1 ? `is 1 player` : `are ${players.length} players`} in game ${game.gameID}:\n${players.map(p => p.first_name + (p.equals(owner) ? " (creator)" : "")).sort().join('\n')}`);
		});
	})
	.catch(err => {
		if (err.code == 'GameNotFound') {
			user.sendMessage(`Game ${gameID} not found - check the number is correct`);
			return;
		}

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