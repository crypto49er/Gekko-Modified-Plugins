var email = require("emailjs");
var _ = require('lodash');
var log = require('../core/log.js');
var util = require('../core/util.js');
var config = util.getConfig();
var mailConfig = config.mailer;
var buyPrice = 0.0;
var profitLoss = 0.0;
var profitPercentage = 0.0;

var Mailer = function(done) {
  _.bindAll(this);

  this.server;
  this.price = 'N/A';

  this.done = done;
  this.setup();
};

Mailer.prototype.setup = function(done) {
  var setupMail = function(err, result) {
    if(result) {
      console.log('Got it.');
      mailConfig.password = result.password;
    }

    if(_.isEmpty(mailConfig.to))
      mailConfig.to = mailConfig.email;
    if(_.isEmpty(mailConfig.from))
      mailConfig.from = mailConfig.email;
    if(_.isEmpty(mailConfig.user) && mailConfig.smtpauth)
      mailConfig.user = mailConfig.email;

    this.server = email.server.connect({
      user: mailConfig.user,
      password: mailConfig.password,
      host: mailConfig.server,
      ssl: mailConfig.ssl,
      port: mailConfig.port,
      tls: mailConfig.tls
    });

    if(mailConfig.sendMailOnStart) {
      this.mail(
        "Gekko has started",
        [
          "I'm using the ",
          config.tradingAdvisor.method,
          " strategy. I've just started watching ",
          config.watch.exchange,
          ' ',
          config.watch.currency,
          '/',
          config.watch.asset,
          ". I'll let you know when I got some advice."
        ].join(''),
        _.bind(function(err) {
          this.checkResults(err);
          this.done();
        }, this)
      );
    } else
      this.done();

    log.debug('Setup email adviser.');
  };

  if(!mailConfig.password) {
    // ask for the mail password
    var prompt = require('prompt-lite');
    prompt.start();
    var warning = [
      '\n\n\tYou configured Gekko to mail you advice, Gekko needs your email',
      'password to send emails (to you). Gekko is an opensource project',
      '[ http://github.com/askmike/gekko ], you can take my word but always',
      'check the code yourself.',
      '\n\n\tWARNING: If you have not downloaded Gekko from the github page above we',
      'CANNOT guarantuee that your email address & password are safe!\n'
    ].join('\n\t');
    log.warn(warning);
    prompt.get({name: 'password', hidden: true}, _.bind(setupMail, this));
  } else {
    setupMail.call(this);
  }
};

Mailer.prototype.mail = function(subject, content, done) {
  
  this.server.send({
    text: content,
    from: mailConfig.from,
    to: mailConfig.to,
    subject: mailConfig.tag + subject
  }, done || this.checkResults);
};

Mailer.prototype.processCandle = function(candle, done) {
  this.price = candle.close;

  done();
};

Mailer.prototype.processAdvice = function(advice) {

  if (advice.recommendation == "soft" && mailConfig.muteSoft) return;

  if (advice.recommendation == "long") {
  var text = [
    'Gekko is watching ',
    config.watch.exchange,
    ' and has detected a new trend, advice is to go ',
    advice.recommendation,
    '.\n\nThe current ',
    config.watch.asset,
    ' price is ',
    config.watch.currency,
    ' ',
    this.price
  ].join('');

  buyPrice = this.price;
  }

  if (advice.recommendation == "short") {

    profitLoss = this.price - buyPrice;
    profitPercentage = ((this.price / buyPrice) - 1) * 100;
    profitLoss = profitLoss.toFixed(2);
    profitPercentage = profitPercentage.toFixed(2);

    var text = [
      'Gekko is watching ',
      config.watch.exchange,
      '/',
      config.watch.currency,
      '/',
      config.watch.asset,
      ' and has detected a new trend, advice is to go ',
      advice.recommendation,
      '.\n\nPreviously, Gekko issued a buy signal at ',
      buyPrice,
      ' and the current price is ',
      this.price,
      '.\n\nThe trade resulted in a profit (or loss) of ',
      profitLoss,
      ', a gain or loss of ',
      profitPercentage,
      ' percent. '
    ].join('');
  
    buyPrice = 0;
    profitLoss = 0;
    profitPercentage = 0;
    }

  var subject = 'New advice: go ' + advice.recommendation;

  this.mail(subject, text);
};

Mailer.prototype.processStratNotification = function({ content }) {
  const subject = `New notification from ${config.tradingAdvisor.method}`;
  const text = [
    'Gekko received new notification :\n\n',
    content
  ].join('');

  this.mail(subject, text);
}

Mailer.prototype.checkResults = function(err) {
  if(err)
    log.warn('error sending email', err);
  else
    log.info('Send advice via email.');
};

module.exports = Mailer;
