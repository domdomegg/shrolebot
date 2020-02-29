'use strict'

const axios = require('axios').default
const AbstractUser = require('./AbstractUser')

class TelegramUser extends AbstractUser {
  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }

  sendMessage (msg, suggestions = []) {
    const requestBody = {
      chat_id: this.networkScopedId,
      text: msg
    }

    if (suggestions.length) {
      requestBody.reply_markup = {
        keyboard: suggestions.map(str => [{ text: str }]),
        one_time_keyboard: true
      }
    }

    return axios({
      method: 'POST',
      url: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_ACCESS_TOKEN}/sendMessage`,
      data: requestBody
    })
      .then(() => { console.log('Message sent' + (msg ? ': ' + msg : '')) })
      .catch(err => { console.error('Unable to send message:' + err) })
  }
}

module.exports = TelegramUser
