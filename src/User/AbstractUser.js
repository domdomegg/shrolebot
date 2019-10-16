'use strict'

class AbstractUser {
  constructor (networkName, networkScopedId, firstName) {
    this.networkName = networkName
    this.networkScopedId = networkScopedId
    this.firstName = firstName
  }

  getFirstNamePromise () {
    throw new Error('getFirstNamePromise should be implemented in a concrete class')
  }

  // Sends response messages, returns a promise
  sendMessage (msg) {
    throw new Error('sendMessage should be implemented in a concrete class')
  }

  equals (user) {
    return this.networkName === user.networkName && this.networkScopedId === user.networkScopedId
  }

  toString () {
    return JSON.stringify({
      firstName: this.firstName,
      networkName: this.networkName,
      networkScopedId: this.networkScopedId
    })
  }

  toBasicObject () {
    return {
      networkName: this.networkName,
      networkScopedId: this.networkScopedId,
      firstName: this.firstName
    }
  }
}

module.exports = AbstractUser
