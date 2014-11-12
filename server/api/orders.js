var errtrack = require('../util/errTrack.js');
var paypal_sdk = require('paypal-rest-sdk');
var sendMail = require('../util/sendMail.js');

module.exports = function(env_settings) {

	var logSQL = env_settings.logSQL;

	return {

		getCountries: function getCountries(callback) {

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT 1 AS sort1, code, country FROM countries WHERE status='A' AND quick_list='Y' ";
				sql += "UNION SELECT 2 AS sort1, code, country FROM countries WHERE status='A' ORDER BY sort1, country;";

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						console.log('Error getting countries: ' + JSON.stringify(err));
						callback();
						return;
					}

					connection.release();
					callback(rows);
					return;

				});
			});
		},

		getStates: function getStates(callback) {

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT * FROM states WHERE country_code = 'US' ORDER BY state;";

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						console.log('Error getting states: ' + JSON.stringify(err));
						callback();
						return;
					}

					connection.release();
					callback(rows);
					return;

				});
			});
		},






		postOrder: function postOrder(req, res) {

			paypal_sdk.configure(env_settings.paypalSettings);

			var data = req.body.data;
			var post_data;

			var notification_email = env_settings.notification_email;

			try {
				post_data = JSON.parse(data);
			} catch(err) {
				errtrack.logErr('Error parsing JSON: ' + data, req, env_settings);
				res.send(JSON.stringify({status: 'FAILED', status_detail: 'Error parsing JSON'}));
				return false;
			}

			var formdata;
			var delim = '';
			var order_num;

			var emailLineItemsTxt = '';
			var emailLineItemsHtml = '';

			var emailChargesTxt = '';
			var emailChargesHtml = '';

			var order_total = post_data.shipping_cost + post_data.items_total_cost;
			var order_total_str = order_total.toFixed(2);

			var parsed_first_name = '';
			var parsed_last_name = '';

			var payment_id, payment_auth_id, payment_auth_expires_str, payment_auth_expires;

			for (var nindx = post_data.card_name.length - 1; nindx >= 0; nindx--) {
				if (post_data.card_name[nindx] == ' ') {
					parsed_first_name = post_data.card_name.substring(0, nindx);
					break;
				} else {
					parsed_last_name = post_data.card_name[nindx] + parsed_last_name;
				}
			}

			// Process Paypal Authorization
			var payment_json = {
			    "intent": "authorize",
			    "payer": {
			        "payment_method": "credit_card",
			        "funding_instruments": [{
			            "credit_card": {
			                "type": post_data.card_type,
			                "number": post_data.card_number,
			                "expire_month": post_data.expire_month,
			                "expire_year": post_data.expire_year,
			                "cvv2": post_data.ccv,
			                "first_name": parsed_first_name,
			                "last_name": parsed_last_name,
			                "billing_address": {
			                    "line1": post_data.bill_add1,
			                    "line2": post_data.bill_add2,
			                    "city": post_data.bill_city,
			                    "state": post_data.bill_state,
			                    "postal_code": post_data.bill_zip,
			                    "country_code": post_data.bill_country_code
			                }
			            }
			        }]
			    },
			    "transactions": [{
			        "amount": {
			            "total": order_total_str,
			            "currency": "USD"
			        },
			        "description": "Pampered Poultry Order"
			    }]
			};

			console.log('\npayment data: ' + JSON.stringify(payment_json) + '\n');
			

			paypal_sdk.payment.create(payment_json, function (err, payment) {

			    if (err) {
			        console.log('PAYPAL ERROR: ' + JSON.stringify(err));
			        res.send(JSON.stringify({status: 'ERROR', status_text: 'We were not able to process your payment.', payload: err}));
					return;

			    } else {
			        console.log('Paypal response: ' + JSON.stringify(payment));

			        if (payment.state == 'approved') {

			        	payment_id = payment.id;
			        	payment_auth_id = payment.transactions[0].related_resources[0].authorization.id;
			        	payment_auth_expires_str = payment.transactions[0].related_resources[0].authorization.valid_until;
			        	if (payment_auth_expires_str) {
			        		payment_auth_expires = new Date(payment_auth_expires_str);
			        	} else {
			        		payment_auth_expires_str = Date();
			        	}


			        } else {
			        	console.log('Payment failed, state = ' + payment.state);
			        	res.send(JSON.stringify({status: 'ERROR', status_text: 'We were not able to process your payment.', payload: {}}));
			        	return;
			        }

			        save_order();
			    }

			});


			function save_order() {
				env_settings.connection_pool.getConnection(function(err, connection) {

					// Process form data to database
					var dt = new Date();
					var isql, vsql, sql;

					// Begin DB Transaction
					connection.query('BEGIN', function(err) {

						if (err) {
							connection.release();
							errtrack.reportErr(err, req, res, env_settings, sql);
							return;
						}

						isql = 'INSERT INTO order_header (';
						vsql = ' VALUES ('

						isql += 'order_date';
						vsql += connection.escape(dt);

						isql += ',payment_id';
						vsql += ',' + connection.escape(payment_id);

						isql += ',auth_id';
						vsql += ',' + connection.escape(payment_auth_id);

						isql += ',auth_expires';
						vsql += ',' + connection.escape(payment_auth_expires);

						for (var prop in post_data) {
							if (prop != 'cart') {
								// Ignore card_number since it is not saved to DB
								if ((prop != 'card_number') && (prop != 'ccv')) {
									isql += ',' + prop;
									vsql += ',' + connection.escape(cnull(post_data[prop]));
								}
							}
						}

						sql = isql + ')' + vsql + ');';

						if (logSQL) {
							console.log(sql);
						}

						emailChargesTxt += 'Shipping: $' + formatCurrency(post_data.shipping_cost) + '\n';
						emailChargesTxt += 'Order Total: $' + formatCurrency(post_data.shipping_cost + post_data.items_total_cost) + '\n';

						emailChargesHtml += '<tr><td></td><td align="right"><i>Shipping:</i></td>';
						emailChargesHtml += '<td align="right" style="border-top:1px solid #e5e5e5;"><i>$' + formatCurrency(post_data.shipping_cost) + '</i></td>';
						emailChargesHtml += '</tr><tr><td></td>';
						emailChargesHtml += '<td align="right" style="font-size: 15px;"><b>Order Total:</b></td>';
						emailChargesHtml += '<td align="right" style="font-size: 15px;"><b>$' + formatCurrency(post_data.shipping_cost + post_data.items_total_cost) + '</b></td></tr>';

						// Insert order_header record
						connection.query(sql, function(err, result) {

							if (err) {
								connection.query('ROLLBACK', function() {
									connection.release();
									errtrack.reportErr(err, req, res, env_settings, sql);
								});
								return;
							}

							order_num = result.insertId;
				
							// Add cart items to order_detail (recursively)
							processCart(1);

						});



						function processCart(line_item) {
							var isql, vsql, sql;
							var thisLineItem = post_data.cart.shift();

							var thisItemDesc = '';
							var thisItemExtPrice;

							if (thisLineItem.prodSize) {
								thisItemDesc += thisLineItem.prodSize + ' ';
							}

							thisItemDesc += thisLineItem.desc + ' ' + thisLineItem.name;

							isql = 'INSERT INTO order_detail (';
							vsql = ' VALUES (';

							isql += 'order_num';
							vsql += connection.escape(order_num);

							isql += ',line_item';
							vsql += ',' + connection.escape(line_item);

							isql += ',prod_id';
							vsql += ',' + connection.escape(thisLineItem.prod_id);

							isql += ',prod_name';
							vsql += ',' + connection.escape(thisItemDesc);

							isql += ',sell_price';
							vsql += ',' + connection.escape(thisLineItem.price);

							isql += ',qty';
							vsql += ',' + connection.escape(thisLineItem.qty);

							sql = isql + ')' + vsql + ');';

							if (logSQL) {
								console.log(sql);
							}

							thisItemExtPrice = '$' + (thisLineItem.price * thisLineItem.qty).toFixed(2);
							emailLineItemsTxt += '   Qty. ' + thisLineItem.qty + ': ' + thisItemDesc + '\n';

							emailLineItemsHtml += '<tr><td align="center">' + thisLineItem.qty + '</td>';
							emailLineItemsHtml += '<td align="left">' + thisItemDesc + '</td>';
							emailLineItemsHtml += '<td align="right">' + thisItemExtPrice + '</td></tr>';

							// Insert order_detail line item
							connection.query(sql, function(err, result) {

								if (err) {
									connection.query('ROLLBACK', function() {
										connection.release();
										errtrack.reportErr(err, req, res, env_settings, sql);
									});
									return;
								}

								// Update inventory
								sql = 'UPDATE products SET on_hand = on_hand - ' + connection.escape(+thisLineItem.qty) + ' ';
								sql += 'WHERE id = ' + connection.escape(+thisLineItem.prod_id);

								if (logSQL) {
									console.log(sql);
								}

								connection.query(sql, function(err, result) {

									if (err) {
										connection.query('ROLLBACK', function() {
											connection.release();
											errtrack.reportErr(err, req, res, env_settings, sql);
										});
										return;
									}

									if (post_data.cart.length > 0) {
										processCart(line_item + 1);
									} else {
										finalizeOrder();
									}

								});

							});

							
						}

						function finalizeOrder() {
							if (env_settings.env_mode == 'PROD') {
								sendConfirmationEmail(post_data.email, post_data.name, order_num, notification_email, req)
							} else {
								// console.log('Email would be sent to ' + post_data.name + ', ' + post_data.email);
								sendConfirmationEmail(post_data.email, post_data.name, order_num, notification_email, req)
							}

							// Commit DB Transaction
							connection.query('COMMIT', function(err) {

								if (err) {
									connection.query('ROLLBACK', function() {
										connection.release();
										errtrack.reportErr(err, req, res, env_settings, sql);
									});
									return;
								}

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: {order_num: order_num}}));
								return;

							});

						}



						function sendConfirmationEmail(emailTo, emailToFullname, order_num, notification_email) {

							var eTxt = '';
							var eHtml = '';

							eTxt += 'Thank you for your order! Your order number is #' + order_num + '\n\n';
							eTxt += 'We are excited you share our enthusiasm for "Pampering Poultry!"\n\n';
							eTxt += 'Your order details:\n\n';

							eHtml += '<table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border:1px solid #e5e5e5; max-width: 600px; font-size: 15px; font-family: Verdana, sans-serif;"><tbody>';
							eHtml += '<tr><td colspan="2" style="background-color: #ddf8d0;"><p style="margin: 8px 20px">';
							eHtml += '<a href="http://www.pamperyourpoultry.com" target="_blank">';
							eHtml += '<img src="http://www.pamperyourpoultry.com/images/site/pyptext2.png" width="250" height="52" alt="Pampered Poultry">';
							eHtml += '</a></p></td></tr><tr><td colspan="2">';
							eHtml += '<p style="margin: 20px">Thank you for your order! Your order number is <b>#' + order_num + '</b>.</p>';
							eHtml += '<p style="margin: 20px">We are excited you share our enthusiasm for "Pampering Poultry!"</p>';
							eHtml += '<p style="margin: 20px 20px 8px 20px;">Your order details:</p></td></tr><tr><td colspan="2">';
							eHtml += '<table width="90%" cellpadding="5" cellspacing="0" style="background: #ffffff; border:1px solid #e5e5e5; max-width: 600px; font-size: 13px; margin-left: 20px;">';
							eHtml += '<tbody><tr style="background-color:#e0e0e0;"><th style="margin-left: 20px;">Qty.</th>';
							eHtml += '<th align="left">Item Description</th><th align="right">Ext. Price</th></tr>';

							// Inject Order details here
							eTxt += emailLineItemsTxt + '\n';
							eHtml += emailLineItemsHtml;

							eTxt += emailChargesTxt + '\n';
							eHtml += emailChargesHtml;

							eTxt += 'Chickens come in all shapes and sizes and we always love to hear feedback from our customers on the fit and functionality of our products. ';
							eTxt += 'Please feel free to email pictures, comments or questions to me at julie@pamperyourpoultry.com ';
							eTxt += 'or call Julie at (603) 558-4934.\n\n';
							eTxt += 'Julie Baker\n';
							eTxt += 'Pampered Poultry\n';
							eTxt += 'julie@pamperyourpoultry.com\n\n';

							eHtml += '</tbody></table></td></tr><tr><td colspan="2">';
							eHtml += '<p style="margin: 20px 40px; font-size: 13px;"><i>Chickens come in all shapes and sizes and ';
							eHtml += 'we always love to hear feedback from our customers on the fit and functionality of our products. ';
							eHtml += 'Please feel free to email pictures, comments or questions to me at ';
							eHtml += '<a style="color: #348eda;" href="mailto:julie@pamperyourpoultry.com">julie@pamperyourpoultry.com</a> ';
							eHtml += 'or call Julie at (603) 558-4934.</i></p></td></tr><tr><td><p style="margin: 20px">Julie Baker<br>Pampered Poultry<br>';
							eHtml += '<a style="color: #348eda;" href="mailto:julie@pamperyourpoultry.com">julie@pamperyourpoultry.com</a></p>';
							eHtml += '</td><td><a href="http://www.pamperyourpoultry.com" target="_blank">';
							eHtml += '<img style="border: none;" src="http://www.pamperyourpoultry.com/images/site/logo.png" width="78" height="78" alt="Pampered Poultry Logo">';
							eHtml += '</a></td></tr></tbody></table>';

							console.log('Sending order confirmation email to: ' + emailTo);

							// console.log('\nTEXT: ' + eTxt + '\n\nHTML: ' + eHtml + '\n\n');

							// Send email
							sendMail.sendEmail(
								{
									text: eTxt,
									from: 'Pampered Poultry <julie@pamperyourpoultry.com>',
									to: emailToFullname + ' <' + emailTo + '>',
									bcc: notification_email,
									subject: 'Thank you for your Pampered Poultry order',
									attachment: [
										{data: eHtml, alternative: true}
									]
								},
								env_settings.emailSettings,
								function (err) {
									if (err) {
										// Log any email errors for reference
										errtrack.logErr(err, req, env_settings, null, 'Error sending order conf email: ' + JSON.stringify(err));
									}
								}
							);

						}

					}); // End DB Transaction

				}); // End DB Connection

			} // end save_order function

		} // End postOrder




	}

};


function cnull(f) {
	if (f.length == 0) {
		return null
	} else {
		return f;
	}
}

function formatCurrency(num) {
	num = isNaN(num) || num === '' || num === null ? 0.00 : num;
	return parseFloat(num).toFixed(2);
}


