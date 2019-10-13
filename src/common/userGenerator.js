'use strict'

const FacebookUser = require('../User/FacebookUser.js')
const TelegramUser = require('../User/TelegramUser.js')
const MockUser = require('../User/MockUser.js')

module.exports = (u) => {
  switch (u.networkName) {
    case 'FACEBOOK':
      return new FacebookUser(u.networkName, u.networkScopedId, u.firstName)
    case 'TELEGRAM':
      return new TelegramUser(u.networkName, u.networkScopedId, u.firstName)
    case 'MOCK':
      return new MockUser(u.networkName, u.networkScopedId, u.firstName)
  }
  throw new Error(`Unknown network name: ${u.networkName}`)
}
