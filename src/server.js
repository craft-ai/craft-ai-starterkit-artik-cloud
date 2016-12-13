'use strict';

var auth  = require('./auth').default;
var bodyParser  = require('body-parser');
var express  = require('express');

const PORT = 4200;
var router = express.Router();

let app = express();

app.use(bodyParser.json());
app.use('/auth', auth());
app.use('/', router);

router.get('/', function(req, res) {
  res.redirect('/auth/artik');
});

router.get('/authenticated', function(req, res) {
  res.json({ message: 'authentication succeeded' });
});

let server = app.listen(PORT, () => {
  let port = server.address().port;
  let addr = `http://localhost:${port}`;
  console.log(`Listening to ${addr}`);
  require('openurl').open(addr);
});
