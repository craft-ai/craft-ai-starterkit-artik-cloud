'use strict';

var express = require('express');
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth2');
var artik = require('./artik');

function authenticate() {
  let router = express.Router();

  const CLIENT_ID = process.env.ARTIK_APP_CLIENT_ID;
  const CLIENT_SECRET = process.env.ARTIK_APP_CLIENT_SECRET;
  const AUTH_URL = 'https://accounts.artik.cloud/authorize';
  const TOKEN_URL = 'https://accounts.artik.cloud/token';
  const CALL_BACK_URL = 'http://localhost:4200/auth/callback';
  const CALL_BACK_PATH = '/callback';

  router.use(passport.initialize());
  router.use(passport.session());

  passport.deserializeUser((id, done) => {
    done(null, 'user');
  });
  passport.serializeUser((user, done) => {
    done(null, 'user');
  });
  passport.use(new OAuth2Strategy({
    authorizationURL: AUTH_URL,
    tokenURL: TOKEN_URL,
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: CALL_BACK_URL
  },
    (accessToken, refreshToken, profile, done) => {
      console.log('token =', accessToken);
      artik(accessToken);
      return done(null, 'user');
    }
  ));
  router.get('/artik',
    passport.authenticate('oauth2')
  );

  router.get(CALL_BACK_PATH,
    passport.authenticate('oauth2', { failureRedirect: '/error', successRedirect: '/authenticated' })
  );

  return router;
}

exports.default = authenticate;
