'use strict'

const DynamoDBGameStore = require('../GameStore/DynamoDBGameStore.js')
const gameStore = new DynamoDBGameStore()

exports.handleMessage = (user, msg) => {
  msg = msg.toLowerCase()

  if (msg.startsWith('database')) return handleDatabase(user, msg)
  else if (msg.startsWith('create')) return handleCreate(user, msg)
  else if (msg.startsWith('join')) return handleJoin(user, msg)
  else if (msg.startsWith('leave')) return handleLeave(user, msg)
  else if (msg.startsWith('start')) return handleStart(user, msg)
  else if (msg.startsWith('players')) return handlePlayers(user, msg)
  else if (msg.startsWith('help')) return handleHelp(user, msg)
  else if (msg.startsWith('version')) return handleVersion(user, msg)
  else return handleUnrecognized(user, msg)
}

exports.handleNoMessage = (user) => {
  user.sendMessage('Something went wrong getting the message to me. Please tell Adam if you see this error.')
}

function handleDatabase (user, msg) {
  if (process.env.STAGE !== 'dev') {
    console.warn(`${user} tried command '${msg}' in stage '${process.env.STAGE}'`)
    return user.sendMessage(`Cannot get database entry while in stage ${process.env.STAGE}`)
  }

  const [gameID, err] = extractGameId(msg, 'database')
  if (err) {
    user.sendMessage(err)
    return
  }

  return gameStore.getByGameID(gameID)
    .then(game =>
      user.sendMessage(JSON.stringify(game, null, '\t'))
    )
    .catch(err => {
      if (err.code === 'GameNotFound') {
        return user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
      }

      console.error(err)
      return user.sendMessage('Unknown error retrieving database')
    })
}

function handleCreate (user, msg) {
  gameStore.getGamesOwnedBy(user)
    .then(games => {
      return Promise.all(games.map(game => {
        if (game.gameID === 9999) {
          user.sendMessage(`Not cancelling test game ${game.gameID}`)
          return Promise.resolve()
        }

        return gameStore.deleteGame(game.gameID)
          .then(game => {
            user.sendMessage(`Cancelled previous game ${game.gameID}`)

            game.players.forEach(player => {
              if (player.equals(user)) return
              player.sendMessage(`The host cancelled game ${game.gameID}`)
            })
          })
      }))
    })
    .catch(err => {
      console.error(err)
      user.sendMessage('Failed to cancel old games, but continuing anyways.')
    })
    .then(() => {
      return gameStore.createGameWithOwner(user)
    })
    .then(gameID => {
      user.sendMessage(`Created game ${gameID} 🎉 - tell your friends to join with 'join ${gameID}'`)
    })
    .catch(err => {
      console.error(err)
      user.sendMessage('Error creating game, please try again.')
    })
}

function handleJoin (user, msg) {
  const [gameID, err] = extractGameId(msg, 'join')
  if (err) {
    user.sendMessage(err)
    return
  }

  gameStore.addUserToGame(user, gameID)
    .then(game => {
      Promise.all([user.getFirstNamePromise(), game.owner.getFirstNamePromise()]).then(_ => {
        user.sendMessage(`Joined ${game.owner.firstName}'s game ${game.gameID} 🎉`)
        game.owner.sendMessage(`${user.firstName} joined game ${game.gameID}`)
        if (game.players.length === 5) {
          game.owner.sendMessage(`You can now start it with 'start ${game.gameID}' ✨`, [`start ${game.gameID}`])
        }
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game "${gameID}" not found 😕 - check the game id is correct`)
        return
      }

      console.error(err)
      user.sendMessage('An unknown error occured (1) - please report this at https://github.com/domdomegg/shrolebot/issues/new')
    })
}

function handleLeave (user, msg) {
  const gameID = parseInt(msg.slice(6, 10))
  gameStore.removeUserFromGame(user, gameID)
    .then(game => {
      if (!game) return

      user.sendMessage(`You've left game ${game.gameID}`)
      user.getFirstNamePromise()
        .then(_ => {
          game.players.forEach(player => {
            player.sendMessage(`${user.firstName} left game ${game.gameID}`)
          })
        })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
        return
      }

      if (err.code === 'NotInGame') {
        user.sendMessage(`You are not in game ${gameID}`)
        return
      }

      if (err.code === 'CannotRemoveGameOwner') {
        user.sendMessage(`You are the creator of game ${gameID}, so you cannot leave. You might want to create a new game instead.`, ['create'])
        return
      }

      if (err.code === 'GameNotFound|PlayerNotInGame|CannotRemoveGameOwner') {
        user.sendMessage(`Game ${gameID} not found, or you are not in game ${gameID}, or you are the creator so cannot leave.`)
        return
      }

      console.error(err)
      user.sendMessage('Unknown error retrieving database')
    })
}

function handleStart (user, msg) {
  const [gameID, err] = extractGameId(msg, 'start')
  if (err) {
    user.sendMessage(err)
    return
  }

  gameStore.getByGameID(gameID)
    .then(game => {
      if (!user.equals(game.owner)) {
        game.owner.getFirstNamePromise().then(firstName => {
          user.sendMessage(`Only ${firstName}, who created the game, can start it.`, [`players ${gameID}`])
        })
        return
      }

      if (game.players.length < 5) {
        user.sendMessage(`At least 5 players are needed to start a game - currently there ${game.players.length === 1 ? 'is' : 'are'} only ${game.players.length} 😞`)
        return
      }
      if (game.players.length > 10) {
        user.sendMessage(`A maximum of 10 people can play a game - currently there are ${game.players.length} 😮`)
        return
      }

      user.sendMessage(`Game starting with ${game.players.length} players 🎲`)

      gameStore.updateTTL(gameID)

      // Get people's roles
      const [hitler, fascists, liberals] = calcPlayerRoles(game.players)

      // Get people's names
      Promise.all(game.players.map(p => p.getFirstNamePromise())).then(_ => {
        if (fascists.length === 1) {
          hitler.sendMessage(`You are Hitler! The other fascist is ${fascists[0].firstName}. 😈`)
          fascists[0].sendMessage(`You are fascist! Hitler is ${hitler.firstName}. 😈`)
        } else {
          hitler.sendMessage('You are Hitler! 😈')

          fascists.forEach(fascistPlayer => {
            const otherFascists = fascists.filter(f => f !== fascistPlayer)
            if (otherFascists.length === 1) {
              fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascist is ${otherFascists[0].firstName}. 😈`)
            } else {
              fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascists are ${otherFascists.map(f => f.firstName).join(' and ')}. 😈`)
            }
          })
        }

        hitler.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')
        fascists.forEach(player => {
          player.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')
        })

        liberals.forEach(player => {
          player.sendMessage('You are liberal! 😇')
          player.sendMessage('You can show your group membership at https://goo.gl/x1hekt')
        })
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
        user.sendMessage('Games time out after 24 hours, so you might need to create a new one ⌛')
        return
      }

      console.error(err)
      user.sendMessage('An unknown error occured (3) - please report this at https://github.com/domdomegg/shrolebot/issues/new')
    })
}

function calcPlayerRoles (players) {
  // Calculate the number of each role
  const numHitler = 1
  const numNonHitlerFascist = Math.floor((players.length - 3) / 2)
  const numLiberal = players.length - 1 - numNonHitlerFascist

  // Create an array of roles
  const roles = ('H'.repeat(numHitler) + 'F'.repeat(numNonHitlerFascist) + 'L'.repeat(numLiberal)).split('')

  // Shuffle the roles
  shuffle(roles)

  let hitler; const fascists = []; const liberals = []
  for (let i = 0; i < players.length; i++) {
    if (roles[i] === 'H') hitler = players[i]
    else if (roles[i] === 'F') fascists.push(players[i])
    else if (roles[i] === 'L') liberals.push(players[i])
  }
  return [hitler, fascists, liberals]
}

function shuffle (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function handlePlayers (user, msg) {
  const [gameID, err] = extractGameId(msg, 'players')
  if (err) {
    user.sendMessage(err)
    return
  }

  gameStore.getByGameID(gameID)
    .then(game => {
      Promise.all(game.players.map(p => p.getFirstNamePromise())).then(_ => {
        user.sendMessage(`There ${game.players.length === 1 ? 'is 1 player' : `are ${game.players.length} players`} in game ${game.gameID}:\n${game.players.map(p => p.firstName + (p.equals(game.owner) ? ' (👑 creator)' : '')).sort().join('\n')}`)
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
        return
      }

      console.error(err)
      user.sendMessage('Unknown error retrieving database')
    })
}

function handleHelp (user, msg) {
  let sentMessage = false

  if (msg.includes('create')) {
    user.sendMessage('🆕 \'create\' starts a new game. You\'ll be given a game id to share with your friends, who can join with \'join <game id>\'. Creating a new game will cancel any previous games you were the owner of.', ['create'])
    sentMessage = true
  }

  if (msg.includes('join')) {
    user.sendMessage('🙌 \'join <game id>\' (for example \'join 1234\') joins an existing game. The game creator will have been told the game id when they created it with \'create\'.')
    sentMessage = true
  }

  if (msg.includes('leave')) {
    user.sendMessage('😢 \'leave <game id>\' (for example \'leave 1234\') leaves an existing game you previously joined.')
    sentMessage = true
  }

  if (msg.includes('start')) {
    user.sendMessage('🎲 \'start <game id>\' (for example \'start 1234\') starts an existing game you\'re the creator of. This will allocate everyone roles, and can be called as many times as you want, allocating each player a random role each time.')
    sentMessage = true
  }

  if (msg.includes('players')) {
    user.sendMessage('🧑‍🤝‍🧑 \'players <game id>\' (for example \'players 1234\') lists all the players who have joined the specified game, and identifies the creator.')
    sentMessage = true
  }

  if (msg.includes('version')) {
    user.sendMessage('#️⃣ \'version\' returns the current version of the software you\'re talking too. You\'ll probably only need this if you\'re reporting a problem.', ['version'])
    sentMessage = true
  }

  if (msg.includes('database')) {
    user.sendMessage('🕵 \'database <game id>\' (for example \'database 1234\') returns the information in the database for that game. Only available in dev.')
    sentMessage = true
  }

  if (msg.includes('list')) {
    user.sendMessage(
      '📜 All supported commands:\ncreate\njoin <game id>\nleave <game id>\nstart <game id>\nplayers <game id>\nhelp\nhelp <command>\nversion' + (process.env.STAGE === 'dev' ? '\ndatabase <game id>' : ''),
      ['help create', 'help join', 'help start']
    )
    sentMessage = true
  }

  if (!sentMessage) {
    user.sendMessage(
      'Quick guide:\n1️⃣ Someone creates a game with \'create\' and gets a game id.\n2️⃣ Other players join with \'join <game id>\' (e.g. \'join 1234\')\n3️⃣ The creator starts it with \'start <game id>\' (eg. \'start 1234\')\n\nFor more details run \'help list\' or \'help <command>\'',
      ['create', 'help list', 'help create']
    )
  }
}

function handleVersion (user, msg) {
  return user.sendMessage(`Version ${process.env.VERSION}`)
}

function handleUnrecognized (user, msg) {
  return user.sendMessage('I didn\'t understand that 😕 - try \'help\' if you\'re lost', ['help', 'help list'])
}

function extractGameId (msg, command) {
  const index = command.length + 1

  if (msg.length <= index) {
    return [undefined, `You must supply a game id, for example "${command} 1234"`]
  }
  if (msg.length !== index + 4) {
    return [undefined, `Game "${msg.slice(index)}" not found 😕 - check the game id is correct (it should be a 4 digit number like "1234")`]
  }
  const gameIDstr = msg.slice(index, index + 4)
  if (!/^\d{4}$/.test(gameIDstr)) {
    return [undefined, `Game "${msg.slice(index)}" not found 😕 - check the game id is correct (it should be a 4 digit number like "1234")`]
  }
  const gameID = parseInt(gameIDstr)
  if (isNaN(gameID)) {
    return [undefined, `Game "${msg.slice(index)}" not found 😕 - check the game id is correct (it should be a 4 digit number like "1234")`]
  }

  return [gameID, undefined]
}
