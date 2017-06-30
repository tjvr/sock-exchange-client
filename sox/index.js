
const WebSocket = require('ws')
const sox = require('./core')
const connect = sox(WebSocket)

function connectAs(host, name, token, cb) {
  return connect(host, sox => sox.identify(name, token, cb))
}

module.exports = {
  connect,
  connectAs,
}

