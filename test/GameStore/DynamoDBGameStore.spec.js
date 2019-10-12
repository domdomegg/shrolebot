process.env.TABLE_NAME = 'secret-hitler-role-bot-dev-games'
const { DocumentClient } = require('aws-sdk/clients/dynamodb')
const dynamoDB = new DocumentClient({
  endpoint: 'localhost:8000',
  sslEnabled: false,
  region: 'local-env',
  params: {
    TableName: process.env.TABLE_NAME
  }
})
jest.mock('../../src/common/userGenerator.js', () => jest.fn(({ firstName }) => firstName))

const DynamoDBGameStore = require('../../src/GameStore/DynamoDBGameStore')
const gameStore = new DynamoDBGameStore()

it('should be able to retrieve a game by gameID', async () => {
  await dynamoDB.put({
    Item: {
      gameID: 1234,
      gameOwner: '{"firstName": "somebody"}',
      players: dynamoDB.createSet(['{"firstName": "somebody"}', '{"firstName": "someone else"}']),
      ttl: 1602451810
    }
  }).promise()

  const game = await gameStore.getByGameID(1234)

  expect(game.gameID).toBe(1234)
  expect(game.owner).toBe('somebody')
  expect(game.players).toEqual(['somebody', 'someone else'])
  expect(game.ttl).toBe(1602451810)
})
