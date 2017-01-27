var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var chaiHttp = require('chai-http');
var Promise = require('bluebird');
var learning = require('../src/learning');
var artik = require('../src/artik');
var server = require('../src/server');
require('dotenv').load({ silent: true });

chai.use(chaiAsPromised);
chai.use(chaiHttp);

var client = learning.craftClient;
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
  before(() => new Promise(resolve => {
    server.start();
    setTimeout(resolve, 200);
  }));

  it('run', done => chai.request.agent(url)
    .post('/signin')
    .query(query)
    .send(data)
    .then(res => {
      chai.expect(res).to.have.status(200);
      return new Promise(resolve => setTimeout(resolve, 800));
    })
    .then(() => client.getAgent('LightColor'))
    .then(res => {
      chai.expect(res.id).to.equal('LightColor');
      return artik.sendMessageToDevice(process.env.ARTIK_CRAFT_DEVICE_ID, { actions: [{ name: 'personDetected', parameters: { id: 'nono' } }] }, 'action');
    })
    .then(res => {
      chai.expect(res).to.equal('OK');
      return new Promise(resolve => setTimeout(resolve, 1200));
    })
    .then(() => client.getAgentContext('LightColor'))
    .then(res => {
      chai.expect(res.context.Presence).to.equal(1);
      return artik.sendMessageToDevice(process.env.ARTIK_CRAFT_DEVICE_ID, { actions: [{ name: 'lightColorChanged', parameters: { redComponent: 0 } }] }, 'action');
    })
    .then(res => {
      chai.expect(res).to.equal('OK');
      return new Promise(resolve => setTimeout(resolve, 1200));
    })
    .then(() => client.getAgentContext('LightColor'))
    .then(res => {
      chai.expect(res.context.LightColor).to.equal('green');
      return new Promise(resolve => setTimeout(resolve, 1500));
    })
    .then(() => learning.takeLightColorDecision())
    .then(res => {
      chai.expect(res).to.equal('green');
      done();
    })
  );
});
