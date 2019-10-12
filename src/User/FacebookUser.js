'use strict'

const request = require('request-promise-native')
const AbstractUser = require('./AbstractUser.js')

class FacebookUser extends AbstractUser {
  async getFirstNamePromise () {
    if (this.firstName == null) {
      const data = await request({
        uri: `https://graph.facebook.com/${this.networkScopedId}?fields=first_name&access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
        method: 'GET',
        json: true
      })
      this.firstName = data.first_name
    }
    return this.firstName
  }

  // Sends response messages via the Send API
  sendMessage (msg) {
    const requestBody = {
      recipient: { id: this.networkScopedId },
      message: { text: msg }
    }

    // Send the HTTP request to the Messenger Platform
    return request({
      uri: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: requestBody
    })
      .then(() => { console.log('Message sent' + (msg ? ': ' + msg : '')) })
      .catch(err => { console.error('Unable to send message:' + err) })
  }
}

module.exports = FacebookUser
