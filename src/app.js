const Koa = require('koa');
const convert = require('koa-convert');
const bodyParser = require('koa-bodyparser');
const cors = require('kcors');
const router = require('./router');
const app = new Koa();

app.use(convert(cors()));
app.use(bodyParser());
app.use(router);
app.listen(3000);
app.on('error', function (error, ctx) {
    console.log("server error: ", error, ctx)
});
console.log('server start at port: 3000');