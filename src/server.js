'use strict';

var artik = require('./artik').start;
var bodyParser  = require('body-parser');
var express  = require('express');
var OAuth2Strategy = require('passport-oauth2');
var passport = require('passport');

// Load environment variables from the `.env` file in the working directory
require('dotenv').load();

var HOST = 'http://localhost';
var PORT = 4200;
var ARTIK_APP_CLIENT_ID = process.env.ARTIK_APP_CLIENT_ID;
var ARTIK_APP_CLIENT_SECRET = process.env.ARTIK_APP_CLIENT_SECRET;

function startServer() {
  var app = express();

  app.use(bodyParser.json());

  app.use(passport.initialize());

  var currentUser = {};
  app.use(passport.session());
  passport.deserializeUser(function(id, done) {
    done(null, currentUser);
  });
  passport.serializeUser(function(user, done) {
    currentUser = user;
    done(null, 'foo');
  });

  passport.use(new OAuth2Strategy({
    authorizationURL: 'https://accounts.artik.cloud/authorize',
    tokenURL: 'https://accounts.artik.cloud/token',
    clientID: ARTIK_APP_CLIENT_ID,
    clientSecret: ARTIK_APP_CLIENT_SECRET,
    callbackURL: HOST + ':' + PORT + '/callback'
  },
    function(accessToken, refreshToken, profile, done) {
      console.log('ARTIK Cloud OAuth2 token retrieved: ' + accessToken);
      // Start the ARTIK Cloud device using the token
      artik(accessToken);
      return done(null, {
        accessToken: accessToken,
        profile: profile
      });
    }
  ));

  app.get('/',
    passport.authenticate('oauth2')
  );

  app.get('/callback',
    passport.authenticate('oauth2', { failureRedirect: '/error', successRedirect: '/authenticated' })
  );

  app.get('/authenticated', function(req, res) {
    res.send('<h1>Successful ARTIK Cloud authentication!</h1>');
  });

  app.get('/error', function(req, res) {
    res.status(403).send('<h1>Error during ARTIK Cloud authentication!</h1>');
  });

  app.listen(PORT, function() {
    var url = HOST + ':' + PORT;
    console.log('Listening to ' + url + '...');
    // Opening the url in the system's default browser
    // require('openurl').open(url);
  });
}

module.exports = {
  start: startServer
};
