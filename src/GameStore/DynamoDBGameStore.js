'use strict'

const { DocumentClient } = require('aws-sdk/clients/dynamodb')
const dynamoDB = new DocumentClient({
  ...(process.env.JEST_WORKER_ID && { endpoint: 'localhost:8000', sslEnabled: false, region: 'local-env' }),
  params: {
    TableName: process.env.TABLE_NAME
  }
})
const userGenerator = require('../common/userGenerator.js')

// User class
class GameStore {
  // Gets a game by gameID
  getByGameID (gameID) {
    const params = {
      Key: {
        gameID: gameID
      }
    }

    return dynamoDB.get(params).promise()
      .then(data => {
        if (!data.Item) {
          const error = new Error('Game not found in database')
          error.code = 'GameNotFound'
          throw error
        }

        return data.Item
      })
      .then(unwrapPlayers)
  }

  // Creates a game with an owner, returns a promise of a gameID if successful
  createGameWithOwner (user) {
    const gameID = generateGameID()
    const putParams = {
      Item: {
        gameID: gameID,
        gameOwner: user.toString(),
        players: dynamoDB.createSet([user.toString()]),
        ttl: getTTL()
      },
      ConditionExpression: 'attribute_not_exists(gameID)'
    }

    return dynamoDB.put(putParams).promise().then(() => gameID)
  }

  // Deleted a game with the given gameID, returns the game that was deleted
  deleteGame (gameID) {
    const deleteParams = {
      Key: {
        gameID: gameID
      },
      ReturnValues: 'ALL_OLD'
    }
    return dynamoDB.delete(deleteParams).promise()
      .then(data => data.Attributes)
      .then(unwrapPlayers)
  }

  // Update a game's TTL
  updateTTL (gameID) {
    const TTLparams = {
      Key: {
        gameID: gameID
      },
      AttributeUpdates: {
        ttl: {
          Action: 'PUT',
          Value: getTTL()
        }
      }
    }
    return dynamoDB.update(TTLparams).promise()
  }

  // Add given user to a game with given gameID
  addUserToGame (user, gameID) {
    const params = {
      Key: {
        gameID: gameID
      },
      UpdateExpression: 'ADD players :user',
      ExpressionAttributeValues: {
        ':user': dynamoDB.createSet([user.toString()])
      },
      ConditionExpression: 'attribute_exists(gameID)',
      ReturnValues: 'ALL_NEW'
    }

    return dynamoDB.update(params).promise()
      .catch(err => {
        if (err.code === 'ConditionalCheckFailedException') {
          const error = new Error('Game not found in database')
          error.code = 'GameNotFound'
          throw error
        }

        throw err
      })
      .then(data => data.Attributes)
      .then(unwrapPlayers)
  }

  // Remove a user from a game
  removeUserFromGame (user, gameID) {
    const params = {
      Key: {
        gameID: gameID
      },
      UpdateExpression: 'DELETE players :user',
      ExpressionAttributeValues: {
        ':user': dynamoDB.createSet([user.toString()])
      },
      ConditionExpression: 'attribute_exists(gameID) AND not gameOwner = :user AND contains(players, :user)',
      ReturnValues: 'ALL_NEW'
    }
    return dynamoDB.update(params).promise()
      .catch(err => {
        if (err.code === 'ConditionalCheckFailedException') {
          const error = new Error('Game not found in database or player is not in the game or is the owner')
          error.code = 'GameNotFoundOrPlayerNotInGameOrIsOwner'
          throw error
        }

        throw err
      })
      .then(data => data.Attributes)
      .then(unwrapPlayers)
  }

  // Get games owned by a user
  getGamesOwnedBy (user) {
    const params = {
      IndexName: 'gameOwnerGSI',
      KeyConditionExpression: 'gameOwner = :user',
      ExpressionAttributeValues: {
        ':user': user.toString()
      }
    }

    return dynamoDB.query(params).promise()
      .then(data => data.Items.map(unwrapPlayers))
  }
}

function unwrapPlayers (gameObj) {
  gameObj.players = gameObj.players.values.map(JSON.parse).map(userGenerator)
  gameObj.owner = userGenerator(JSON.parse(gameObj.gameOwner))
  delete gameObj.gameOwner
  return gameObj
}

function generateGameID () {
  return Math.floor(Math.random() * (9998 - 1000 + 1) + 1000)
}

function getTTL () {
  return Math.floor(Date.now() / 1000) + 86400 // 24 hour TTL
}

module.exports = GameStore
