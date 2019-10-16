'use strict'

process.env.NTBA_FIX_319 = 1
var TelegramBot = require('node-telegram-bot-api')
var telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_ACCESS_TOKEN, { polling: false })

const AbstractUser = require('./AbstractUser')

class TelegramUser extends AbstractUser {
  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }

  sendMessage (msg) {
    return telegramBot.sendMessage(this.networkScopedId, msg)
  }
}

module.exports = TelegramUser
