var url = require('url');

sslRoute = function(env_settings) {

	return function sslRoute(req, res, next) {

		var non_ssl_routes = ['/','/diapers', '/feather-guards', '/attire', '/contact-us', '/order-confirmation'];

		// Determin if request is on secure port
		var ssl = (req.connection.encrypted);
		
		var ssl_port = '';
		var std_port = '';
		var isNonSSLroute = false;

		if (env_settings.env_mode == 'DEV') {
			ssl_port = ':' + env_settings.sslport;
			std_port = ':' + env_settings.port;
		}

		if ((req.url.toLowerCase().slice(0, 8) == '/secure/') || 
			(req.url.toLowerCase().slice(0, 4) == '/ops')) {
			// Force SSL for all /secure/ resources
			if (!ssl) {
				console.log('Secure request made not in SSL: ' + req.url);
				console.log('Redirecting to https://' + env_settings.host + ssl_port + req.url);
				res.writeHead(301,
					{Location: 'https://' + env_settings.host + ssl_port + req.url}
				);
				res.end();
				return;
			}
		} else {
			// Force non-ssl for any non /secure/ routes

			if (ssl) {

				for (var i = 0; i < non_ssl_routes.length; i++) {
					if (non_ssl_routes[i] == req.url.toLowerCase()) {
						isNonSSLroute = true;
						break;
					}
				}

				if (isNonSSLroute) {
					console.log('SSL request made to non-secure resource: ' + req.url);
					console.log('Redirecting to http://' + env_settings.host + std_port + req.url);
					res.writeHead(301,
						{Location: 'http://' + env_settings.host + std_port + req.url}
					);
					res.end();
					return;
				}
			}

		}

		next();

	}

}


exports.sslRoute = sslRoute;
