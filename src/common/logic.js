'use strict'

const DynamoDBGameStore = require('../GameStore/DynamoDBGameStore.js')
const gameStore = new DynamoDBGameStore()

exports.handleMessage = (user, msg) => {
  msg = msg.toLowerCase()

  if (msg.startsWith('database')) handleDatabase(user, msg)
  else if (msg.startsWith('create')) handleCreate(user, msg)
  else if (msg.startsWith('join')) handleJoin(user, msg)
  else if (msg.startsWith('leave')) handleLeave(user, msg)
  else if (msg.startsWith('start')) handleStart(user, msg)
  else if (msg.startsWith('players')) handlePlayers(user, msg)
  else if (msg.startsWith('help')) handleHelp(user, msg)
  else handleUnrecognized(user, msg)
}

exports.handleNoMessage = (user) => {
  user.sendMessage('Something went wrong getting the message to me. Please tell Adam if you see this error.')
}

function handleDatabase (user, msg) {
  if (process.env.STAGE !== 'dev') {
    user.sendMessage(`Cannot get database entry while in stage ${process.env.STAGE}`)
    console.warn(`${user} tried command '${msg}' in stage '${process.env.STAGE}'`)
    return
  }

  const gameID = parseInt(msg.slice(9, 13))
  gameStore.getByGameID(gameID)
    .then(game => {
      user.sendMessage(JSON.stringify(game, null, '\t'))
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found - check the number is correct`)
        return
      }

      console.error(err)
      user.sendMessage('Unknown error retrieving database')
    })
}

function handleCreate (user, msg) {
  gameStore.getGamesOwnedBy(user)
    .then(games => {
      return Promise.all(games.map(game => {
        if (game.gameID === 9999) {
          user.sendMessage(`Not cancelling test game ${game.gameID}`)
          return
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
      user.sendMessage(`Created game ${gameID}`)
    })
    .catch(err => {
      console.error(err)
      user.sendMessage('Error creating game, please try again.')
    })
}

function handleJoin (user, msg) {
  const gameID = parseInt(msg.slice(5, 9))

  gameStore.addUserToGame(user, gameID)
    .then(game => {
      Promise.all([user.getFirstNamePromise(), game.owner.getFirstNamePromise()]).then(_ => {
        user.sendMessage(`Joined ${game.owner.firstName}'s game ${game.gameID}`)
        game.owner.sendMessage(`${user.firstName} joined game ${game.gameID}`)
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found - check the number is correct`)
        return
      }

      console.error(err)
      user.sendMessage('An unknown error occured (1) - please tell Adam if you see this!')
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
        user.sendMessage(`Game ${gameID} not found - check the number is correct`)
        return
      }

      if (err.code === 'NotInGame') {
        user.sendMessage(`You are not in game ${gameID}`)
        return
      }

      if (err.code === 'CannotRemoveGameOwner') {
        user.sendMessage(`You are the creator of game ${gameID}, so you cannot leave. You might want to create a new game instead.`)
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
  const gameID = parseInt(msg.slice(6, 10))
  gameStore.getByGameID(gameID)
    .then(game => {
      if (!user.equals(game.owner)) {
        user.sendMessage('Only the person who created the game can start it.')
        return
      }

      if (game.players.length < 5) {
        user.sendMessage(`At least 5 players are needed to start a game - currently there ${game.players.length === 1 ? 'is' : 'are'} only ${game.players.length}`)
        return
      }
      if (game.players.length > 10) {
        user.sendMessage(`A maximum of 10 people can play a game - currently there are ${game.players.length}`)
        return
      }

      user.sendMessage(`Game starting with ${game.players.length} players`)

      gameStore.updateTTL(gameID)

      // Get people's roles
      const [hitler, fascists, liberals] = calcPlayerRoles(game.players)

      // Get people's names
      Promise.all(game.players.map(p => p.getFirstNamePromise())).then(_ => {
        if (fascists.length === 1) {
          hitler.sendMessage(`You are Hitler! The other fascist is ${fascists[0].firstName}`)
          fascists[0].sendMessage(`You are fascist! Hitler is ${hitler.firstName}`)
        } else {
          hitler.sendMessage('You are Hitler!')

          fascists.forEach(fascistPlayer => {
            const otherFascists = fascists.filter(f => f !== fascistPlayer)
            if (otherFascists.length === 1) {
              fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascist is ${otherFascists[0].firstName}.`)
            } else {
              fascistPlayer.sendMessage(`You are fascist! Hitler is ${hitler.firstName} and the other fascists are ${otherFascists.map(f => f.firstName).join(' and ')}.`)
            }
          })
        }

        hitler.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')
        fascists.forEach(player => {
          player.sendMessage('You can show your group membership at https://goo.gl/dvwKVp')
        })

        liberals.forEach(player => {
          player.sendMessage('You are liberal!')
          player.sendMessage('You can show your group membership at https://goo.gl/x1hekt')
        })
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found - check the number is correct`)
        user.sendMessage('Games time out after 24 hours, so you might need to create a new one')
        return
      }

      console.error(err)
      user.sendMessage('An unknown error occured (3) - please tell Adam if you see this!')
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
  const gameID = parseInt(msg.slice(8, 12))
  gameStore.getByGameID(gameID)
    .then(game => {
      Promise.all(game.players.map(p => p.getFirstNamePromise())).then(_ => {
        user.sendMessage(`There ${game.players.length === 1 ? 'is 1 player' : `are ${game.players.length} players`} in game ${game.gameID}:\n${game.players.map(p => p.firstName + (p.equals(game.owner) ? ' (creator)' : '')).sort().join('\n')}`)
      })
    })
    .catch(err => {
      if (err.code === 'GameNotFound') {
        user.sendMessage(`Game ${gameID} not found - check the number is correct`)
        return
      }

      console.error(err)
      user.sendMessage('Unknown error retrieving database')
    })
}

function handleHelp (user, msg) {
  user.sendMessage('Supported commands:\ncreate\njoin <gameID>\nleave <gameID>\nstart <gameID>\nplayers <gameID>\nhelp')
}

function handleUnrecognized (user, msg) {
  user.sendMessage('Unrecognized command, try \'help\' for a list that work')
}
