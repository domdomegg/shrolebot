'use strict'

const DynamoDBGameStore = require('../GameStore/DynamoDBGameStore.js')
const gameStore = new DynamoDBGameStore()

// Every handler must await ALL its sends before resolving: the Lambda
// runtime freezes the container as soon as the async handler returns, so a
// fire-and-forget sendMessage only completes (if ever) when a later
// invocation thaws the container.

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
  return user.sendMessage('Something went wrong getting the message to me. Please tell Adam if you see this error.')
}

async function handleDatabase (user, msg) {
  if (process.env.STAGE !== 'dev') {
    console.warn(`${user} tried command '${msg}' in stage '${process.env.STAGE}'`)
    return user.sendMessage(`Cannot get database entry while in stage ${process.env.STAGE}`)
  }

  const [gameID, err] = extractGameId(msg, 'database')
  if (err) {
    return user.sendMessage(err)
  }

  try {
    const game = await gameStore.getByGameID(gameID)
    await user.sendMessage(JSON.stringify(game, null, '\t'))
  } catch (err) {
    if (err.code === 'GameNotFound') {
      return user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
    }

    console.error(err)
    await user.sendMessage('Unknown error retrieving database')
  }
}

async function handleCreate (user, msg) {
  try {
    try {
      const games = await gameStore.getGamesOwnedBy(user)
      await Promise.all(games.map(async (game) => {
        if (game.gameID === 9999) {
          return user.sendMessage(`Not cancelling test game ${game.gameID}`)
        }

        const deletedGame = await gameStore.deleteGame(game.gameID)
        await user.sendMessage(`Cancelled previous game ${deletedGame.gameID}`)
        await Promise.all(deletedGame.players
          .filter((player) => !player.equals(user))
          .map((player) => player.sendMessage(`The host cancelled game ${deletedGame.gameID}`)))
      }))
    } catch (err) {
      console.error(err)
      await user.sendMessage('Failed to cancel old games, but continuing anyways.')
    }

    const gameID = await gameStore.createGameWithOwner(user)
    await user.sendMessage(`Created game ${gameID} 🎉 - tell your friends to join with 'join ${gameID}'`)
  } catch (err) {
    console.error(err)
    await user.sendMessage('Error creating game, please try again.')
  }
}

async function handleJoin (user, msg) {
  const [gameID, err] = extractGameId(msg, 'join')
  if (err) {
    return user.sendMessage(err)
  }

  try {
    const game = await gameStore.addUserToGame(user, gameID)
    await Promise.all([user.getFirstNamePromise(), game.owner.getFirstNamePromise()])
    await user.sendMessage(`Joined ${game.owner.firstName}'s game ${game.gameID} 🎉`)
    await game.owner.sendMessage(`${user.firstName} joined game ${game.gameID}`)
    if (game.players.length === 5) {
      await game.owner.sendMessage(`You can now start it with 'start ${game.gameID}' ✨`, [`start ${game.gameID}`])
    }
  } catch (err) {
    if (err.code === 'GameNotFound') {
      return user.sendMessage(`Game "${gameID}" not found 😕 - check the game id is correct`)
    }

    console.error(err)
    await user.sendMessage('An unknown error occured (1) - please report this at https://github.com/domdomegg/shrolebot/issues/new')
  }
}

async function handleLeave (user, msg) {
  const gameID = parseInt(msg.slice(6, 10))

  try {
    const game = await gameStore.removeUserFromGame(user, gameID)
    if (!game) return

    await user.sendMessage(`You've left game ${game.gameID}`)
    await user.getFirstNamePromise()
    await Promise.all(game.players.map((player) => player.sendMessage(`${user.firstName} left game ${game.gameID}`)))
  } catch (err) {
    if (err.code === 'GameNotFound') {
      return user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
    }

    if (err.code === 'NotInGame') {
      return user.sendMessage(`You are not in game ${gameID}`)
    }

    if (err.code === 'CannotRemoveGameOwner') {
      return user.sendMessage(`You are the creator of game ${gameID}, so you cannot leave. You might want to create a new game instead.`, ['create'])
    }

    if (err.code === 'GameNotFound|PlayerNotInGame|CannotRemoveGameOwner') {
      return user.sendMessage(`Game ${gameID} not found, or you are not in game ${gameID}, or you are the creator so cannot leave.`)
    }

    console.error(err)
    await user.sendMessage('Unknown error retrieving database')
  }
}

async function handleStart (user, msg) {
  const [gameID, err] = extractGameId(msg, 'start')
  if (err) {
    return user.sendMessage(err)
  }

  try {
    const game = await gameStore.getByGameID(gameID)

    if (!user.equals(game.owner)) {
      const firstName = await game.owner.getFirstNamePromise()
      return await user.sendMessage(`Only ${firstName}, who created the game, can start it.`, [`players ${gameID}`])
    }

    if (game.players.length < 5) {
      return await user.sendMessage(`At least 5 players are needed to start a game - currently there ${game.players.length === 1 ? 'is' : 'are'} only ${game.players.length} 😞`)
    }
    if (game.players.length > 10) {
      return await user.sendMessage(`A maximum of 10 people can play a game - currently there are ${game.players.length} 😮`)
    }

    await user.sendMessage(`Game starting with ${game.players.length} players 🎲`)

    await gameStore.updateTTL(gameID)

    // Get people's roles
    const [hitler, fascists, liberals] = calcPlayerRoles(game.players)

    // Get people's names
    await Promise.all(game.players.map((p) => p.getFirstNamePromise()))

    if (fascists.length === 1) {
      await hitler.sendMessage(`You are Hitler! The other fascist is ${fascists[0].firstName}. 😈`)
      await fascists[0].sendMessage(`You are fascist! Hitler is ${hitler.firstName}. 😈`)
    } else {
      await hitler.sendMessage('You are Hitler! 😈')

      for (const fascistPlayer of fascists) {
        const otherFascists = fascists.filter(f => f !== fascistPlayer)
        if (otherFascists.length === 1) {
          await fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascist is ${otherFascists[0].firstName}. 😈`)
        } else {
          await fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascists are ${otherFascists.map(f => f.firstName).join(' and ')}. 😈`)
        }
      }
    }

    await hitler.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')
    await Promise.all(fascists.map((player) => player.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')))

    await Promise.all(liberals.map(async (player) => {
      await player.sendMessage('You are liberal! 😇')
      await player.sendMessage('You can show your group membership at https://goo.gl/x1hekt')
    }))
  } catch (err) {
    if (err.code === 'GameNotFound') {
      await user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
      return user.sendMessage('Games time out after 24 hours, so you might need to create a new one ⌛')
    }

    console.error(err)
    await user.sendMessage('An unknown error occured (3) - please report this at https://github.com/domdomegg/shrolebot/issues/new')
  }
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

async function handlePlayers (user, msg) {
  const [gameID, err] = extractGameId(msg, 'players')
  if (err) {
    return user.sendMessage(err)
  }

  try {
    const game = await gameStore.getByGameID(gameID)
    await Promise.all(game.players.map(p => p.getFirstNamePromise()))
    await user.sendMessage(`There ${game.players.length === 1 ? 'is 1 player' : `are ${game.players.length} players`} in game ${game.gameID}:\n${game.players.map(p => p.firstName + (p.equals(game.owner) ? ' (👑 creator)' : '')).sort().join('\n')}`)
  } catch (err) {
    if (err.code === 'GameNotFound') {
      return user.sendMessage(`Game ${gameID} not found 😕 - check the game id is correct`)
    }

    console.error(err)
    await user.sendMessage('Unknown error retrieving database')
  }
}

async function handleHelp (user, msg) {
  let sentMessage = false

  if (msg.includes('create')) {
    await user.sendMessage('🆕 \'create\' starts a new game. You\'ll be given a game id to share with your friends, who can join with \'join <game id>\'. Creating a new game will cancel any previous games you were the owner of.', ['create'])
    sentMessage = true
  }

  if (msg.includes('join')) {
    await user.sendMessage('🙌 \'join <game id>\' (for example \'join 1234\') joins an existing game. The game creator will have been told the game id when they created it with \'create\'.')
    sentMessage = true
  }

  if (msg.includes('leave')) {
    await user.sendMessage('😢 \'leave <game id>\' (for example \'leave 1234\') leaves an existing game you previously joined.')
    sentMessage = true
  }

  if (msg.includes('start')) {
    await user.sendMessage('🎲 \'start <game id>\' (for example \'start 1234\') starts an existing game you\'re the creator of. This will allocate everyone roles, and can be called as many times as you want, allocating each player a random role each time.')
    sentMessage = true
  }

  if (msg.includes('players')) {
    await user.sendMessage('🧑‍🤝‍🧑 \'players <game id>\' (for example \'players 1234\') lists all the players who have joined the specified game, and identifies the creator.')
    sentMessage = true
  }

  if (msg.includes('version')) {
    await user.sendMessage('#️⃣ \'version\' returns the current version of the software you\'re talking too. You\'ll probably only need this if you\'re reporting a problem.', ['version'])
    sentMessage = true
  }

  if (msg.includes('database')) {
    await user.sendMessage('🕵 \'database <game id>\' (for example \'database 1234\') returns the information in the database for that game. Only available in dev.')
    sentMessage = true
  }

  if (msg.includes('list')) {
    await user.sendMessage(
      '📜 All supported commands:\ncreate\njoin <game id>\nleave <game id>\nstart <game id>\nplayers <game id>\nhelp\nhelp <command>\nversion' + (process.env.STAGE === 'dev' ? '\ndatabase <game id>' : ''),
      ['help create', 'help join', 'help start']
    )
    sentMessage = true
  }

  if (!sentMessage) {
    await user.sendMessage(
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
