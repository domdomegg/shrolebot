const utils = require('../utils')

const dynamoDB = utils.getDocumentClient()
const gameStore = utils.getGameStore()

it('can retrieve a game by gameID', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = utils.getLineNumber()
  await dynamoDB.put({
    Item: {
      gameID,
      gameOwner: owner.toString(),
      players: dynamoDB.createSet([owner, otherPlayer].map(p => p.toString())),
      ttl: 1602451810
    }
  }).promise()

  // WHEN
  const game = await gameStore.getByGameID(gameID)

  // THEN
  expect(game.gameID).toBe(gameID)
  expect(game.owner.equals(owner)).toBe(true)
  expect(game.players).toHaveLength(2)
  expect(game.players[0].equals(owner)).toBe(true)
  expect(game.players[1].equals(otherPlayer)).toBe(true)
  expect(game.ttl).toBe(1602451810)
})

it('can create a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')

  // WHEN
  const gameID = await gameStore.createGameWithOwner(owner)

  // THEN
  const game = await gameStore.getByGameID(gameID)
  expect(game.gameID).toBe(gameID)
  expect(game.owner.equals(owner)).toBe(true)
  expect(game.players).toHaveLength(1)
  expect(game.players[0].equals(owner)).toBe(true)
})

it('should create games with a TTL <= 1 day', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const secondsInADay = 60 * 60 * 24

  // WHEN
  const gameID = await gameStore.createGameWithOwner(owner)

  // THEN
  const game = await gameStore.getByGameID(gameID)
  expect(game.ttl).toBeLessThanOrEqual((Date.now() / 1000) + secondsInADay)
})

it('can delete a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  await gameStore.deleteGame(gameID)

  // THEN
  await gameStore.getByGameID(gameID)
    .then(
      () => fail('Game was still in the database when it should have been deleted'),
      err => expect(err.code).toBe('GameNotFound')
    )
})

it('should return the old game on deletion', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  const oldGame = await gameStore.deleteGame(gameID)

  // THEN
  expect(oldGame.gameID).toBe(gameID)
  expect(oldGame.owner.equals(owner)).toBe(true)
})

it('can update a game\'s TTL', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const gameID = 1235
  await dynamoDB.put({
    Item: {
      gameID,
      gameOwner: owner.toString(),
      players: dynamoDB.createSet([owner.toString()]),
      ttl: 0
    }
  }).promise()
  expect((await gameStore.getByGameID(gameID)).ttl).toBe(0)

  // WHEN
  await gameStore.updateTTL(gameID)

  // THEN
  expect((await gameStore.getByGameID(gameID)).ttl).toBeGreaterThan(0)
})

it('can add a user to a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)
  expect((await gameStore.getByGameID(gameID)).players).toHaveLength(1)

  // WHEN
  await gameStore.addUserToGame(otherPlayer, gameID)

  // THEN
  const game = await gameStore.getByGameID(gameID)
  expect(game.players).toHaveLength(2)
  expect(game.players[0].equals(owner)).toBe(true)
  expect(game.players[1].equals(otherPlayer)).toBe(true)
})

it('should return the updated game on adding a user to a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  const game = await gameStore.addUserToGame(otherPlayer, gameID)

  // THEN
  expect(game.players).toHaveLength(2)
  expect(game.players[0].equals(owner)).toBe(true)
  expect(game.players[1].equals(otherPlayer)).toBe(true)
})

it('should be idempotent in adding a user to a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  await gameStore.addUserToGame(otherPlayer, gameID)
  await gameStore.addUserToGame(otherPlayer, gameID)
  await gameStore.addUserToGame(otherPlayer, gameID)
  const game = await gameStore.addUserToGame(otherPlayer, gameID)

  expect(game.players).toHaveLength(2)
})

it('should fail if adding a user to a non-existent game', async () => {
  // GIVEN
  const player = utils.createMockUser('somebody')
  const nonExistentGameID = utils.getLineNumber()

  // WHEN
  await gameStore.addUserToGame(player, nonExistentGameID)
    // THEN
    .then(
      () => fail('Adding user to non-existent game should not be possible'),
      err => expect(err.code).toBe('GameNotFound')
    )
})

it('can remove a user from a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)
  await gameStore.addUserToGame(otherPlayer, gameID)
  expect((await gameStore.getByGameID(gameID)).players).toHaveLength(2)

  // WHEN
  await gameStore.removeUserFromGame(otherPlayer, gameID)

  // THEN
  const game = await gameStore.getByGameID(gameID)
  expect(game.players).toHaveLength(1)
  expect(game.players[0].equals(owner)).toBe(true)
})

it('should return the updated game on removing a user from a game', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)
  await gameStore.addUserToGame(otherPlayer, gameID)

  // WHEN
  const game = await gameStore.removeUserFromGame(otherPlayer, gameID)

  // THEN
  expect(game.players).toHaveLength(1)
  expect(game.players[0].equals(owner)).toBe(true)
})

it('should fail if removing a user from a game they are not in', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  await gameStore.removeUserFromGame(otherPlayer, gameID)
    // THEN
    .then(
      () => fail('Removing user from a game they are not in should not be possible'),
      err => expect(err.code).toContain('PlayerNotInGame')
    )
})

it('should fail if removing a user from a non-existent game', async () => {
  // GIVEN
  const player = utils.createMockUser('somebody')
  const nonExistentGameID = utils.getLineNumber()

  // WHEN
  await gameStore.removeUserFromGame(player, nonExistentGameID)
    // THEN
    .then(
      () => fail('Removing user from non-existent game should not be possible'),
      err => expect(err.code).toContain('GameNotFound')
    )
})

it('should fail if removing the game owner', async () => {
  // GIVEN
  const owner = utils.createMockUser('somebody')
  const otherPlayer = utils.createMockUser('someone else')
  const gameID = await gameStore.createGameWithOwner(owner)
  await gameStore.addUserToGame(otherPlayer, gameID)

  // WHEN
  await gameStore.removeUserFromGame(owner, gameID)
    // THEN
    .then(
      () => fail('Removing game owner from game should not be possible'),
      err => expect(err.code).toContain('CannotRemoveGameOwner')
    )
})

it('can get games owned by a user when they have none', async () => {
  // GIVEN
  const owner = utils.createMockUser(`someone ${utils.getLineNumber()}`)

  // WHEN
  const games = await gameStore.getGamesOwnedBy(owner)

  // THEN
  expect(games).toHaveLength(0)
})

it('can get games owned by a user when they have one', async () => {
  // GIVEN
  const owner = utils.createMockUser(`someone ${utils.getLineNumber()}`)
  const gameID = await gameStore.createGameWithOwner(owner)

  // WHEN
  const games = await gameStore.getGamesOwnedBy(owner)

  // THEN
  expect(games).toHaveLength(1)
  expect(games[0].gameID).toBe(gameID)
  expect(games[0].owner.equals(owner)).toBe(true)
})
