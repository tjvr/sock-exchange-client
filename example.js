
const Sox = require('./sox')

const NAME = 'freddy'
const TOKEN = '123'

Sox.connectAs('socks.tjvr.org', NAME, TOKEN, sox => {
  console.log('connected as', NAME)
  console.log('balance:', sox.balance + '$')
  console.log(sox.positions)

  sox.on('error', e => { throw new Error(e.message) })
  sox.on('reject', e => console.log('rejected:', e.message))

  //sox.on('position', ({balance}) => console.log(balance))

  const stocks = sox.stocks
  function buy() {
    const order = stocks.SILK.buy(999, 10)
    order.on('out', buy)
    order.on('reject', () => setTimeout(buy, 1000))
  }
  buy()

  function sell() {
    const order = stocks.SILK.sell(1001, 10)
    order.on('out', sell)
    order.on('reject', () => setTimeout(sell, 1000))
  }
  sell()

  Object.keys(stocks).forEach(symbol => {
    const stock = sox.stocks[symbol]
    var bid, ask

    stock.on('book', ({buys, sells}) => {
      bid = buys.length ? buys[0].price : null
      ask = sells.length ? sells[0].price : null
      // ...??
    })
  })
})

