const { DocumentClient } = require('aws-sdk/clients/dynamodb')
const dynamoDB = new DocumentClient({
  endpoint: 'localhost:8000',
  sslEnabled: false,
  region: 'local-env',
  params: {
    TableName: process.env.TABLE_NAME
  }
})

it('should insert into and retrieve from table', async () => {
  await dynamoDB.put({
    Item: {
      gameID: 1234,
      gameOwner: '{"firstName":"somebody","networkName":"MOCK"}',
      players: dynamoDB.createSet(['{"firstName":"somebody","networkName":"MOCK"}', '{"firstName":"someone else","networkName":"MOCK"}']),
      ttl: 1602451810
    }
  }).promise()

  const { Item } = await dynamoDB.get({
    Key: {
      gameID: 1234
    }
  }).promise()

  expect(Item.gameID).toBe(1234)
  expect(Item.gameOwner).toBe('{"firstName":"somebody","networkName":"MOCK"}')
  expect(Item.players.values).toEqual(['{"firstName":"somebody","networkName":"MOCK"}', '{"firstName":"someone else","networkName":"MOCK"}'])
  expect(Item.ttl).toBe(1602451810)
})
