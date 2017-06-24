
const WebSocket = require('ws')
const sox = require('./core')
const connect = sox(WebSocket)
module.exports = connect

