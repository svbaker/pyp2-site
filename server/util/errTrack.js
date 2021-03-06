var fs = require('fs');
var sendMail = require('./sendMail.js');

reportErr = function (err, req, res, env_settings, sql) {
	var dt = new Date();
	var ip = getClientAddress(req);
	var errRpt = ip + ' - TRAPPED ERROR - ' + dt + ' - ' + JSON.stringify(err);
	if (sql) {
		errRpt += ' - SQL=' + sql;
	}
	console.log(errRpt);
	env_settings.logFile.write(errRpt + '\n');
	res.send(JSON.stringify({status: 'ERROR', status_text: 'Server Error', payload: {}}));

	return;
}


logErr = function (err, req, env_settings, sql, errNote) {
	var dt = new Date();
	var errNoteMsg = errNote || '';
	var ip = getClientAddress(req);
	var errRpt = ip + ' - ' + errNoteMsg + ' - TRAPPED ERROR - ' + dt + ' - ' + JSON.stringify(err);

	if (sql) {
		errRpt += ' - SQL=' + sql;
	}
	console.log(errRpt);
	env_settings.logFile.write(errRpt + '\n');
	return;
}

reportOpsErr = function (err, res, sql, errNote) {
	var dt = new Date();
	var errNoteMsg = errNote || '';
	if (errNoteMsg) {
		errNoteMsg += ' - ';
	}
	var errRpt = errNoteMsg + 'TRAPPED ERROR - ' + dt + ' - ' + JSON.stringify(err);

	if (sql) {
		errRpt += ' - SQL=' + sql;
	}
	console.log(errRpt);
	res.send(JSON.stringify({status: 'ERROR', status_text: 'Server Error', payload: {}}));
	return;
}

logOpsErr = function (err, sql, errNote) {
	var dt = new Date();
	var errNoteMsg = errNote || '';
	if (errNoteMsg) {
		errNoteMsg += ' - ';
	}
	var errRpt = errNoteMsg + 'TRAPPED ERROR - ' + dt + ' - ' + JSON.stringify(err);

	if (sql) {
		errRpt += ' - SQL=' + sql;
	}
	console.log(errRpt);
	return;
}

// Get client IP address ----------------------
getClientAddress = function (req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0] 
        || req.connection.remoteAddress;
};

/* Expose public functions ------ */
exports.reportErr = reportErr;
exports.logErr = logErr;
exports.reportOpsErr = reportOpsErr;
exports.logOpsErr = logOpsErr;

