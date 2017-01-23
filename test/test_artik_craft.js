var _ = require('lodash');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var chaiHttp = require('chai-http');
var Promise = require('bluebird');
require('dotenv').load({ silent: true });

chai.use(chaiAsPromised);
chai.use(chaiHttp);

var url = 'https://accounts.artik.cloud';

var data = {
  email: process.env.ARTIK_USR_MAIL || 'ops@craft.ai',
  password: process.env.ARTIK_USR_PWD
};

var query = {
  client_id: process.env.ARTIK_APP_CLIENT_ID,
  account_type: 'ARTIKCLOUD',
  redirect_uri: 'http://localhost:4200/callback',
  account_types: 'true'
};

describe('ARTIK - craft ai integration', () => {
  before(() => new Promise((resolve, reject) => {
    require('../src/server');
    setTimeout(resolve, 1000);
  }));
  it('fail to connect to ARTIK', done => chai.request.agent(url)
    .post('/signin')
    .query(query)
    .send({ email: data.email, password: _.join(_.shuffle(data.password), '') })
    .catch(err => {
      chai.expect(err).to.have.status(400);
      done();
    })
  );

  it('successfully connected to ARTIK', done => chai.request.agent(url)
    .post('/signin')
    .query(query)
    .send(data)
    .then(res => {
      chai.expect(res).to.have.status(200);
      done();
    })
  );
});
