'use strict'

process.env.NTBA_FIX_319 = 1
const TelegramBot = require('node-telegram-bot-api')
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_ACCESS_TOKEN, { polling: false })

const AbstractUser = require('./AbstractUser')

class TelegramUser extends AbstractUser {
  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }

  sendMessage (msg, suggestions = []) {
    const options = {}
    if (suggestions.length) {
      options.reply_markup = {
        keyboard: suggestions.map(str => [{ text: str }]),
        one_time_keyboard: true
      }
    }

    return telegramBot.sendMessage(this.networkScopedId, msg, options)
  }
}

module.exports = TelegramUser
