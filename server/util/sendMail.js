var email   = require("emailjs");

sendEmail = function sendEmail(emailInfo, emailSettings, callback) {

  	var server  = email.server.connect(emailSettings);

    server.send(emailInfo, function(err, message) {
		// console.log('Email status: ' + JSON.stringify(message));
		callback(err);
    });

}

/* Expose public functions ------ */
exports.sendEmail = sendEmail;
