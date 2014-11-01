var express = require('express');

// API Modules
var products = require('../api/products.js');
var orders = require('../api/orders.js');
var ops = require('../api/ops.js');
var chikipedia = require('../api/chikipedia.js');

// API Routes
exports.api = function(server, env_settings) {

	var productsAPI = products(env_settings);
	var ordersAPI = orders(env_settings);
	var opsAPI = ops(env_settings);

	//server.get('/api/products/getOnHand', api.products.getOnHand);
	server.get('/api/products/getOnHand', productsAPI.getOnHand);

	// server.get('/api/products/:cat_code', api.products.getProducts);
	server.get('/api/products/:cat_code', productsAPI.getProducts);
	server.post('/api/orders/post-order', ordersAPI.postOrder);



	// OPS ------------------------

	// Non-token non-json-input routes:
	server.get('/ops/ajax/getBreedMenus', opsAPI.getBreedMenus);
	server.get('/ops/ajax/getProdMenus', opsAPI.getProdMenus);
	server.post('/ops/ajax/getProd/:id', opsAPI.getProd);
	server.get('/ops/ajax/getInvoice/:order_num', opsAPI.getInvoice);
	server.post('/ops/file-uploader', express.bodyParser(), opsAPI.fileUploader);

	// Parse JSON input data into req.ops_post_data:
	server.all('/ops/ajax/*', opsAPI.parseInput);

	// Non-token routes:
	server.post('/ops/ajax/login', opsAPI.login);
	
	// Validate user access token
	server.all('/ops/ajax/*', opsAPI.validateToken);

	// Token validated routes:
	server.post('/ops/ajax/filterList', opsAPI.filterList);
	server.post('/ops/ajax/getBreed', opsAPI.getBreed);
	server.post('/ops/ajax/addBreedPlumage', opsAPI.addBreedPlumage);
	server.post('/ops/ajax/addPlumage', opsAPI.addPlumage);
	server.post('/ops/ajax/removePlumage', opsAPI.removePlumage);
	server.post('/ops/ajax/addBreed', opsAPI.addBreed);
	server.post('/ops/ajax/updateBreed', opsAPI.updateBreed);
	server.post('/ops/ajax/addProd', opsAPI.addProd);
	server.post('/ops/ajax/updateProd', opsAPI.updateProd);
	server.post('/ops/ajax/getorder/:order_num', opsAPI.getorder);
	server.put('/ops/ajax/updateOrder/:order_num', opsAPI.updateOrder);
	server.put('/ops/ajax/shipOrder/:order_num', opsAPI.shipOrder);
	server.put('/ops/ajax/voidOrder/:order_num', opsAPI.voidOrder);
	server.post('/ops/ajax/retireFileUpload', opsAPI.retireFileUpload);

};

// Web site handler routes
exports.site = function(server, env_settings) {

	var chikipediaAPI = chikipedia(env_settings);

	server.get('/', function(req, res) {  
		var context = {title: 'Pampered Poultry'};
		res.render('index', context);
	});

	server.get('/diapers', function(req, res) {  
		var context = {title: 'Pampered Poultry - Chicken Diapers'};
		res.render('diapers', context);
	});

	server.get('/feather-guards', function(req, res) {  
		var context = {title: 'Pampered Poultry - Feather Guards'};
		res.render('feather-guards', context);
	});

	server.get('/attire', function(req, res) {  
		var context = {title: 'Pampered Poultry - Chicken Attire'};
		res.render('attire', context);
	});

	server.get('/gifts', function(req, res) {  
		var context = {title: 'Pampered Poultry - Gift Shop'};
		res.render('gifts', context);
	});

	server.get('/contact-us', function(req, res) {  
		var context = {title: 'Pampered Poultry - Contact Us'};
		res.render('contact-us', context);
	});

	server.get('/order-confirmation', function(req, res) {  
		var context = {title: 'Pampered Poultry - Order Confirmation'};
		res.render('order-confirmation', context);
	});

	server.get('/contest-submission', function(req, res) {  
		var context = {title: 'Pampered Poultry - Photo contest submission form', hideCart: true};

		chikipediaAPI.getBreeds(function(breeds) {
			if (breeds) {
				context.breeds = breeds;
				res.render('contest-submission', context);
			} else {
				res.render('http-500', context);
			}
		})

	});

	server.get('/404', function(req, res) {  
		var context = {title: 'Pampered Poultry - Page not found'};
		res.render('http-404', context);
	});

	server.get('/500', function(req, res) {  
		var context = {title: 'Pampered Poultry - Server error'};
		res.render('http-500', context);
	});

};


// SSL site handler routes
exports.sslSite = function(server, env_settings) {

	var ordersAPI = orders(env_settings);

	server.get('/secure/cart', function(req, res) {  
		var context = {title: 'Pampered Poultry - Shopping Cart', hideCart: true};
		ordersAPI.getCountries(function(countries) {
			if (countries) {
				context.countries = countries;
				res.render('cart', context);
			} else {
				res.render('http-500', context);
			}
		})
	});

	server.get('/secure/checkout', function(req, res) {  
		var context = {title: 'Pampered Poultry - Checkout', hideCart: true};

		ordersAPI.getCountries(function(countries) {
			ordersAPI.getStates(function(states) {
				if (countries && states) {
					context.countries = countries;
					context.states = states;
					res.render('checkout', context);
				} else {
					res.render('http-500', context);
				}
			})
		});

	});

}
