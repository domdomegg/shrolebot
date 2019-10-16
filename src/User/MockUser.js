const AbstractUser = require('./AbstractUser')

class MockUser extends AbstractUser {
  constructor () {
    super(...arguments)
    this.sendMessage = jest.fn().mockResolvedValue()
  }

  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }
}

module.exports = MockUser
