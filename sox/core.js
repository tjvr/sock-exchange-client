(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.Sox = factory()
  }
}(this, function() {
  return function(WebSocket) {

    const emitter = (function() {
      /*
       * From https://github.com/nathan/v2/blob/master/emitter.js
       */

      function on(e, fn) {
        const m = this._listeners || (this._listeners = new Map)
        const l = m.get(e)
        if (l) !l.includes(fn) && l.push(fn)
        else m.set(e, [fn])
        return this
      }
      function once(e, fn) {
        const bound = x => {
          fn(x)
          this.unlisten(e, bound)
        }
        this.on(e, bound)
        return this
      }
      function unlisten(e, fn) {
        const m = this._listeners
        if (!m) return this
        const l = m.get(e)
        if (!l) return this
        const i = l.indexOf(fn)
        if (i !== -1) l.splice(i, 1)
        return this
      }
      function toggleListener(e, fn, value) {
        if (value) this.on(e, fn)
        else this.unlisten(e, fn)
      }
      function listeners(e) {
        const m = this._listeners
        return m ? m.get(e) || [] : []
      }
      function emit(e, arg) {
        const m = this._listeners
        if (!m) return
        const l = m.get(e)
        if (!l) return
        for (let i = l.length; i--;) l[i](arg)
        return this
      }

      const PROPERTIES = {
        on: {value: on},
        once: {value: once},
        unlisten: {value: unlisten},
        toggleListener: {value: toggleListener},
        listeners: {value: listeners},
        emit: {value: emit},
      }

      return function emitter(o) {
        Object.defineProperties(o, PROPERTIES)
      }
    }());


    class Sox {
      constructor(ws) {
        this.ws = ws
        ws.addEventListener('message', this._onMessage.bind(this))
        this.on('welcome', this._onWelcome.bind(this))
        this.on('position', this._onPosition.bind(this))
        this.on('book', this._onBook.bind(this))
        this.on('trade', this._onTrade.bind(this))

        ws.addEventListener('close', e => this.emit('close', e))

        // order tracking
        this.orders = Object.create(null)
        this.highestId = 0
        this.on('fill', this._onFill.bind(this))
        this.on('out', this._onOut.bind(this))
      }

      send(name, msg) {
        let json = Object.assign({}, msg, {_type: name})
        this.ws.send(JSON.stringify(json))
      }

      _onMessage(e) {
        let json = JSON.parse(e.data)
        let type = json._type
        delete json._type
        this.emit(type, json)
      }

      /* * */

      _onWelcome({symbols}) {
        this.symbols = symbols
        this.stocks = symbols.map(s => new Stock(s, this))
      }

      _onPosition({balance, positions}) {
        this.balance = balance
        this.positions = positions
      }

      _onBook({symbol, buys, sells}) {
        let stock = this.stocks.find(s => s.symbol === symbol)
        stock.emit('book', {buys, sells})
      }

      _onTrade({symbol, price, size}) {
        let stock = this.stocks.find(s => s.symbol === symbol)
        stock.emit('trade', {price, size})
      }

      /* * */

      buy(symbol, price, size) { return this.order(symbol, 'buy', price, size) }
      sell(symbol, price, size) { return this.order(symbol, 'sell', price, size) }

      order(symbol, dir, price, size) {
        let order = new Order(symbol, dir, price, size)
        let order_id = this._register(order)
        this.send(dir, {order_id, symbol, price, size})
        return order
      }

      cancel(order) {
        //delete this.orders[order._id]
        this.send('cancel', {order_id: order._id})
      }

      _register(order) {
        let order_id = this.highestId = (this.highestId + 1) % 0xffff
        //if (this.orders[order_id]) throw 'oops'
        this.orders[order_id] = order
        order._sox = this
        return order._id = order_id
      }

      _onFill({order_id, price, size}) {
        let order = this.orders[order_id]
        order.emit('fill', {price, size})
      }

      _onOut({order_id}) {
        let order = this.orders[order_id]
        order._sox = null
        delete this.orders[order_id]
        order.emit('out')
      }
    }
    emitter(Sox.prototype)


    class Stock {
      constructor(symbol, sox) {
        this._sox = sox
        this.symbol = symbol
        this.buys = []
        this.sells = []

        this.on('book', this._onBook.bind(this))
      }

      buy(price, size) { return this.order('buy', price, size) }
      sell(price, size) { return this.order('sell', price, size) }
      order(dir, price, size) { return this._sox.order(this.symbol, dir, price, size) }
      
      _onBook({buys, sells}) {
        this.buys = buys
        this.sells = sells
      }
    }
    emitter(Stock.prototype)


    class Order {
      constructor(symbol, dir, price, size) {
        Object.assign(this, {symbol, dir, price, size})
      }

      cancel() {
        this._sox.cancel(this)
      }
    }
    emitter(Order.prototype)

     
    function connect(host, name, token, cb) {
      let ws = new WebSocket(`ws://${host}/ws`)
       
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({_type: 'identify', name, token}))
      })

      function message(e) {
        let json = JSON.parse(e.data)
        if (json._type === 'error') reject(json.error)
        ws.removeEventListener('message', message)
        var sox = new Sox(ws)
        sox._onMessage(e) // deliver first message by hand

        // wait for position message
        sox.once('position', () => {
          setTimeout(() => {
            cb(sox)
          })
        })
      }
      ws.addEventListener('message', message)
    }

    return connect
  }
}))
