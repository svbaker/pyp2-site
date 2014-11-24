// Pamperyourpoultry,com Version 2.0
// Sean V. Baker - sean.baker@bb-technologies.com

var http = require("http");
var https = require('https');
var exec = require('child_process').exec;

var fs = require('fs');

// To be converted still:
// var breedPage = require('breedPage');
// var breedUploadViewer = require('breedUploadViewer');
// var photoUploader = require('photoUploader');

var url = require('url');
var errtrack = require('./server/util/errTrack.js');
var mysql = require('mysql');
var forceDomain = require('node-force-domain');
var middleware = require('./server/middleware');

var routes = require('./server/routes');

// Configure EXPRESS
var express = require('express');
var hbs = require('express-hbs');

var helpers = require('./site/helpers');

var server = express();

server.enable('trust proxy');

// Setup Handlebars
server.set('view engine', 'hbs');
server.engine('hbs', hbs.express3({  
  defaultLayout: __dirname + '/site/views/layouts/main.hbs',
  partialsDir: __dirname + '/site/views/partials',
  layoutsDir: __dirname + '/site/views/layouts'
}));
server.set('views', __dirname + '/site/views');
helpers.loadSiteHelpers(hbs);

console.log('\n\n-------------------- Node Version: ' + process.version + ' --------------');
console.log('Initializing node server...');

// Override default of 5 max sockets -----
http.Agent.defaultMaxSockets = 100;

// Archive old log file(s) and create new log file
var logFile
exec('mv ' + __dirname + '/log/*.log ' + __dirname + '/log/archive', 
  function(err, stdout, stderr) {
    if (err) {
    	console.log('Log archiving message: ' + stderr);
    	// process.exit(1);
    } else {
    	console.log('Prior log files archived to ' + __dirname + '/log/archive');
    }
});


// Create new log file
var dt = new Date();
var log_filename = __dirname + '/log/pyp_'
	+ dt.getFullYear() + '_'
	+ (dt.getMonth() + 1)
	+ '_' + dt.getDate()
	+ '-' + dt.getHours()
	+ '_' + dt.getMinutes()
	+ '_' + dt.getSeconds() + '.log';

logFile = fs.createWriteStream(log_filename, {flags: 'a'});
console.log('Logging site access and errors to: ' + log_filename);

// Set up environment using json setup config file
var env_settings = {};
var env_filepath = __dirname + '/env.json';
var ssl_filepath = __dirname + '/ssl/';

console.log('Looking for env.json file at ' + env_filepath);

if (fs.existsSync(env_filepath)) {
	try {
		var env_data = JSON.parse(fs.readFileSync(env_filepath));
		
		env_settings.dbConnSettings = env_data.db;
		env_settings.paypalSettings = env_data.paypal;
		env_settings.emailSettings = env_data.email;
		env_settings.encryption_key = env_data.encryption_key;
		env_settings.port = env_data.port;
		env_settings.sslport = env_data.sslport;
		env_settings.host = env_data.host;
		env_settings.webroot_path = env_data.webroot_path;
		env_settings.env_mode = env_data.env_mode;

		if (env_data.logSQL == 'Y') {
			env_settings.logSQL = true;
		} else {
			env_settings.logSQL = false;
		}
		env_settings.notification_email = env_data.notification_email;
		env_settings.logFile = logFile;

		console.log('Standard/SSL ports: ' + env_settings.port + '/' + env_settings.sslport);
		console.log('Webroot path: ' + env_settings.webroot_path);

		// Initialize database connection pool
		env_settings.dbConnSettings.queueLimit = 50;
		env_settings.connection_pool = mysql.createPool(env_settings.dbConnSettings);

	} catch(err) {
		console.log('Error loading config JSON file or pasring contents: ' + err.message);
		process.exit(1);
	}

} else {
	console.log('ERROR: No env.json config file found');
	process.exit(1);
}


// Set up SSL
var hskey = fs.readFileSync(ssl_filepath + 'key.pem');
var hscert = fs.readFileSync(ssl_filepath + 'cert.pem');
var hsca = fs.readFileSync(ssl_filepath + 'ca.pem');
var ssl_options = {
	key: hskey,
	cert: hscert,
	ca: hsca
};

// For managing static file server cache control
var oneDay = 86400000;


// EXPRESS -------

// server.use(breedPage.servePage(__dirname + '/public'));

server.use(middleware.sslRoute(env_settings));
server.use(middleware.oldsiteRedirector(env_settings));
server.use(express.logger({stream: logFile}));

server.use(forceDomain({
	hostname: env_settings.host,
	protocol: 'http',
	type: 'permanent'
}));

server.use(express.favicon('public/images/favicon.ico'));
server.use(express.compress());
server.use(express.json());
server.use(express.urlencoded());
server.use(express.methodOverride());

// Set up routes
routes.api(server, env_settings);
routes.site(server, env_settings);
routes.sslSite(server, env_settings);
server.use(server.router);

server.use(express.static(__dirname + '/public'));

// Still being converted:
// server.use(photoUploader.contestSubmit(env_settings));
// server.use(photoUploader.contestEntry(env_settings));

server.use(function(req, res) {
	errtrack.logErr('Could not find file or handler for: ' + req.url, req, env_settings);
	res.status(404);
	var context = {title: 'Pampered Poultry - Page not found'};
	res.render('http-404', context);
});

server.use(function(err, req, res, next) {
	errtrack.logErr('Error trapped by Connect: ' + err.message + ' : ' + err.stack, req, env_settings);
	res.status(500);
	var context = {title: 'Pampered Poultry - Server error'};
	res.render('http-500', context);
});

http.createServer(server).listen(env_settings.port);
https.createServer(ssl_options, server).listen(env_settings.sslport);

console.log('HTTP server listening on port ' + env_settings.port);
console.log('Secure HTTPS server listening on port ' + env_settings.sslport);
// End EXPRESS -----
