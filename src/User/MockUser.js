'use strict'

const AbstractUser = require('./AbstractUser.js')

class MockUser extends AbstractUser {
  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }

  sendMessage (msg) {
    console.log(`MockUser '${this}' sending message '${msg}'`)
  }
}

module.exports = MockUser
