var api = require('../api');

exports.api = function(server, env_settings) {

    api.init(env_settings);

    server.get('/api/products/getOnHand', api.products.getOnHand);
    server.get('/api/products/:cat_code', api.products.getProducts);
    server.post('/api/orders/post-order', api.orders.postOrder);


    // OPS ------------------------

    // Non-token non-json-input routes:
    server.get('/ops/ajax/getBreedMenus', api.ops.getBreedMenus);
    server.get('/ops/ajax/getProdMenus', api.ops.getProdMenus);
    server.post('/ops/ajax/getProd/:id', api.ops.getProd);
    server.get('/ops/ajax/getInvoice/:order_num', api.ops.getInvoice);
    server.post('/ops/file-uploader', api.ops.fileUploader);

    // Parse JSON input data into req.ops_post_data:
    server.all('/ops/ajax/*', api.ops.parseInput);

    // Non-token routes:
    server.post('/ops/ajax/login', api.ops.login);
    
    // Validate user access token
    server.all('/ops/ajax/*', api.ops.validateToken);

    // Token validated routes:
    server.post('/ops/ajax/filterList', api.ops.filterList);
    server.post('/ops/ajax/getBreed', api.ops.getBreed);
    server.post('/ops/ajax/addBreedPlumage', api.ops.addBreedPlumage);
    server.post('/ops/ajax/addPlumage', api.ops.addPlumage);
    server.post('/ops/ajax/removePlumage', api.ops.removePlumage);
    server.post('/ops/ajax/addBreed', api.ops.addBreed);
    server.post('/ops/ajax/updateBreed', api.ops.updateBreed);
    server.post('/ops/ajax/addProd', api.ops.addProd);
    server.post('/ops/ajax/updateProd', api.ops.updateProd);
    server.post('/ops/ajax/getorder/:order_num', api.ops.getorder);
    server.put('/ops/ajax/updateOrder/:order_num', api.ops.updateOrder);
    server.post('/ops/ajax/retireFileUpload', api.ops.retireFileUpload);

};

exports.site = function(server) {

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

      api.chikipedia.getBreeds(function(breeds) {
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


exports.sslSite = function(server) {
    server.get('/secure/cart', function(req, res) {  
        var context = {title: 'Pampered Poultry - Shopping Cart', hideCart: true};
        api.orders.getCountries(function(countries) {
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

        api.orders.getCountries(function(countries) {
            api.orders.getStates(function(states) {
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
