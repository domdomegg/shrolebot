'use strict'

const userGenerator = require('../common/userGenerator.js')
const LogicHandler = require('../common/logic.js')

exports.handler = (event, context, callback) => {
  // GET request is Facebook performing verification
  if (event.httpMethod === 'GET') {
    const queryParams = event.queryStringParameters
    if (!queryParams || !queryParams['hub.verify_token']) {
      callback(null, {
        body: 'Missing validation token',
        statusCode: 400
      })
      return
    }

    if (!queryParams['hub.challenge']) {
      callback(null, {
        body: 'Missing challenge',
        statusCode: 400
      })
      return
    }

    if (queryParams['hub.verify_token'] !== process.env.VERIFY_TOKEN) {
      callback(null, {
        body: 'Wrong validation token',
        statusCode: 401
      })
      return
    }

    callback(null, {
      body: queryParams['hub.challenge'],
      statusCode: 200
    })

    // POST request represents new messages
  } else if (event.httpMethod === 'POST') {
    const data = JSON.parse(event.body)

    // Make sure this is a page subscription
    if (data.object !== 'page') {
      callback(null, {
        body: 'UNSUPPORTED_OPERATION',
        statusCode: 415
      })
    }

    // Iterate over each entry - there may be multiple if batched
    // e.messaging always only has one event, so take index 0
    data.entry.map(e => e.messaging[0]).forEach(event => {
      if (event.message) {
        handleMessage(event.sender.id, event.message)
      } else if (event.postback) {
        handlePostback()
      } else {
        callback(null, {
          body: 'UNSUPPORTED_OPERATION',
          statusCode: 415
        })
      }
    })

    // Let Facebook know we got the message
    callback(null, {
      body: 'EVENT_RECEIVED',
      statusCode: 200
    })
  }
}

// Handles messages events
function handleMessage (facebookPsid, receivedMessage) {
  const user = userGenerator({
    networkName: 'FACEBOOK',
    networkScopedId: facebookPsid,
    firstName: null
  })

  if (!receivedMessage || !receivedMessage.text) {
    LogicHandler.handleNoMessage(user)
  } else {
    const msg = receivedMessage.text
    console.log("Recieved message '" + msg + "' from user with PSID " + facebookPsid)
    LogicHandler.handleMessage(user, msg)
  }
}

// Handles messaging_postbacks events
function handlePostback () {

}
