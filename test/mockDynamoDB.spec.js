const { DocumentClient } = require('aws-sdk/clients/dynamodb')
const dynamoDB = new DocumentClient({
  endpoint: 'localhost:8000',
  sslEnabled: false,
  region: 'local-env',
  params: {
    TableName: 'secret-hitler-role-bot-dev-games'
  }
})

it('should insert into and retrieve from table', async () => {
  await dynamoDB.put({
    Item: {
      gameID: 1234,
      gameOwner: 'somebody',
      players: dynamoDB.createSet(['somebody', 'someone else']),
      ttl: 1602451810
    }
  }).promise()

  const { Item } = await dynamoDB.get({
    Key: {
      gameID: 1234
    }
  }).promise()

  expect(Item.gameID).toBe(1234)
  expect(Item.gameOwner).toBe('somebody')
  expect(Item.players.values).toEqual(['somebody', 'someone else'])
  expect(Item.ttl).toBe(1602451810)
})
