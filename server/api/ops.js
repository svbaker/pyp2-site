var errtrack = require('../util/errTrack.js');
var md5 = require("blueimp-md5").md5;
var paypal_sdk = require('paypal-rest-sdk');

// Required for file uploads -------
var fs = require('fs');
var mysql = require('mysql');
var Hashids = require("hashids"),
		hashids = new Hashids("bbatpyp12345", 4, 'abcdefghijklmnopqrstuvwxyz123456789'); // Salt, min length of hash, alphabet
var gm = require('gm');

genKey = function (inInt) {
	// Generate short hash keys from a positive integer so users can key them easily
	return hashids.encrypt(inInt);
};
// -----------------------------------


module.exports = function(env_settings) {

	var logSQL = env_settings.logSQL;

	return {

		parseInput: function(req, res, next) {

			var data = req.body.data;
			var post_data;

			try {
				req.ops_post_data = JSON.parse(data);
			} catch(err) {
				errtrack.logErr('Error parsing JSON: ' + data, req, env_settings);
				res.send(JSON.stringify({status: 'FAILED', status_text: 'Error parsing JSON'}));
				return false;
			}
			next();
		},

		validateToken: function(req, res, next) {
			// This function validates ops security token
			// and then calls next() to continue to next ops routes

			var post_data = req.ops_post_data;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT * from ops_sessions WHERE token = ' + connection.escape(post_data.ACCESS_TOKEN);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows.length == 1) {
						// Validation passed, so continue to next ops route
						// and delete ACCESS_TOKEN from input data to clean
						delete req.ops_post_data.ACCESS_TOKEN;
						connection.release();
						next();
					} else {
						// Invalid token, send back error to client
						console.log('INVALID ACCESS TOKEN');
						connection.release();
						res.send(JSON.stringify({status: 'FAILED', status_text: 'Invalid token.'}));
						return;
					}

				});
			});

		},

		login: function(req, res) {

			var dt = new Date();
			var client_ip = getClientAddress(req);

			var data = req.body.data;
			var post_data;

			try {
				post_data = JSON.parse(data);
			} catch(err) {
				errtrack.logErr('Error parsing JSON: ' + data, req, env_settings);
				res.send(JSON.stringify({status: 'FAILED', status_text: 'Error parsing JSON'}));
				return false;
			}

			var userid = post_data.userid;
			var pwd = post_data.pwd;

			var sql, return_name, return_email;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT * from ops_users WHERE userid = ' + connection.escape(userid);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows.length > 0) {

						if (rows[0].password == pwd) {
							return_name = rows[0].name;
							return_email = rows[0].email;

							new_token = md5(userid + '-' + String(dt) + '-' + String(client_ip));
							console.log('New OPS hash token assigned for login user ' + userid + ': ' + new_token);

							var token_expire_date = new Date(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());

							sql = 'INSERT INTO ops_sessions (userid, token, expire_date) VALUES (';
							sql += connection.escape(userid) + ',' + connection.escape(new_token) + ',' + connection.escape(token_expire_date) + ')';

							if (logSQL) {
								console.log(sql);
							}

							connection.query(sql, function(err, result) {

								if (err) {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
									return;
								}

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: {
									name: return_name,
									email: return_email,
									token: new_token,
									token_expire_date: token_expire_date.toJSON()
								}}));
								return;
							});


						} else {
							connection.release();
							res.send(JSON.stringify({status: 'FAILED', status_text: 'Invalid login.'}));
							return;
						}

					} else {
						connection.release();
						res.send(JSON.stringify({status: 'FAILED', status_text: 'Invalid login: No such user.'}));
						return;
					}


				});
			});
		},


		getBreedMenus:	function(req, res) {

			var return_menus = {};

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT * from breeds_class ORDER BY parent_class';

				if (logSQL) {
					console.log(sql);
				}

				// Breed Class menu ---------
				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					var breed_class_menu = '<option value=""></option>';
					var parent_class = '';

					for (var i = 0; i < rows.length; i++) {
						if (rows[i].parent_class != parent_class) {
							if (parent_class != '') {
								breed_class_menu += '</optgroup>';
							}
							parent_class = rows[i].parent_class;
							breed_class_menu += '<optgroup label="' + rows[i].parent_class + '">';
						}
						if (rows[i].class.length > 0) {
							breed_class_menu += '<option value="' + rows[i].code + '">' + rows[i].class + '</option>';
						} else {
							breed_class_menu += '<option value="' + rows[i].code + '">' + rows[i].parent_class + '</option>';
						}
					}
					breed_class_menu += '</optgroup>';

					return_menus.breed_class_menu = breed_class_menu;


					// Comb menu ---------
					sql = 'SELECT comb_name from breed_comb ORDER BY comb_name';

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, rows, fields) {

						if (err) {
							errtrack.reportOpsErr(err, res, sql);
							connection.release();
							return;
						}

						var comb_menu = '<option value=""></option>';

						for (var i = 0; i < rows.length; i++) {
							comb_menu += '<option value="' + rows[i].comb_name + '">' + rows[i].comb_name + '</option>';
						}

						return_menus.comb_menu = comb_menu;


						// Plumage menu ---------
						sql = 'SELECT * from breed_plumage ORDER BY color';

						if (logSQL) {
							console.log(sql);
						}

						connection.query(sql, function(err, rows, fields) {

							if (err) {
								errtrack.reportOpsErr(err, res, sql);
								connection.release();
								return;
							}

							var plumage_menu = '<option value="">--Select color to add--</option>';

							for (var i = 0; i < rows.length; i++) {
								plumage_menu += '<option value="' + rows[i].code + '">' + rows[i].color + '</option>';
							}

							return_menus.plumage_menu = plumage_menu;

							connection.release();
							res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_menus}));
							return;

						});

					});

				});

			});

		},


		filterList: function (req, res) {

			var post_data = req.ops_post_data;

			var col_query_string = '';
			var delim;

			// console.log('post_data=' + JSON.stringify(post_data));

			var ops_function = post_data.query_settings.ops_function;
			var cols = post_data.query_settings.cols;
			var sortList = post_data.sort_list;
			var sortString = '';

			// Build select columns list for query
			delim = '';
			for (var i = 0; i < cols.length; i++) {
				if (cols[i].db_field) {
					col_query_string += delim + cols[i].db_field + ' AS ' + cols[i].db_alias;
					delim = ', ';
					if (cols[i].link_record_id_db_field) {
						col_query_string += delim + cols[i].link_record_id_db_field + ' AS ' + cols[i].link_record_id_db_alias;
					}
				}
			}

			// Build sort list
			delim = 'ORDER BY ';
			for (var i = 0; i < sortList.length; i++) {
				sortString += delim + sortList[i].field + ' ' + sortList[i].sortOrder;
				delim = ', '
			}


			switch(ops_function) {

				case 'breed':

					sql = 'SELECT ' + col_query_string;
					sql += ', (SELECT COUNT(*) FROM posts WHERE breed_id = breeds.id) as uploads '
					sql += 'FROM breeds, breeds_class ';
					sql += 'WHERE breeds_class.code = breeds.breed_class_code ';

					for (var prop in post_data.filter_vars) {
						if (post_data.filter_vars[prop]) {
							sql += "AND " + prop + " LIKE '%" + post_data.filter_vars[prop] + "%' ";
						}
					}

					sql += sortString;

					break;


				case 'prod':

					sql = 'SELECT ' + col_query_string;
					sql += ", (SELECT CONCAT(hash, '.', file_ext) FROM file_uploads WHERE control_code = 'PROD' and status = 'A' and control_rec_id = products.id LIMIT 1) AS img_name ";
					sql += ", (SELECT file_url FROM file_uploads WHERE control_code = 'PROD' and status = 'A' and control_rec_id = products.id LIMIT 1) AS img_url ";
					sql += ' FROM products, product_cats WHERE product_cats.code = products.cat_code ';

					for (var prop in post_data.filter_vars) {
						if (post_data.filter_vars[prop]) {
							sql += "AND " + prop + " LIKE '%" + post_data.filter_vars[prop] + "%' ";
						}
					}

					sql += sortString;

					break;


				case 'order':

					sql = 'SELECT ' + col_query_string;
					sql += ', (SELECT SUM(qty) FROM order_detail od WHERE od.order_num = order_header.order_num) AS qty ';
					sql += ', order_header.items_total_cost + order_header.shipping_cost AS total ';
					sql += 'FROM order_header, countries ';
					sql += 'WHERE countries.code = order_header.country_code ';

					for (var prop in post_data.filter_vars) {

						switch (prop) {

							case 'order_start_date':
								if (post_data.filter_vars[prop]) {
									sql += "AND order_date >= STR_TO_DATE('" + post_data.filter_vars[prop] + "', '%m/%d/%Y') ";
								}
								break;

							case 'order_end_date':
								if (post_data.filter_vars[prop]) {
									sql += "AND order_date <= STR_TO_DATE('" + post_data.filter_vars[prop] + "', '%m/%d/%Y') ";
								}
								break;

							default:
								if (post_data.filter_vars[prop]) {
									sql += "AND " + prop + " LIKE '%" + post_data.filter_vars[prop] + "%' ";
								}
								break;

						}

					}

					sql += sortString;

					break;


			}

			if (logSQL) {
				console.log(sql);
			}

			env_settings.connection_pool.getConnection(function(err, connection) {

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {rows: rows}}));
					connection.release();
					return;

				});

			});

		},


		getBreed: function(req, res) {

			var post_data = req.ops_post_data;
			var return_data = {plumage_codes: []};

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT * FROM breeds WHERE id = ' + connection.escape(post_data.breed_id);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows) {
						if (rows.length == 1) {
							return_data.breed = rows[0];

							sql = 'SELECT p.code, p.color FROM breed_plumage p, breed_plumage_map m ';
							sql += 'WHERE m.breed_id = ' + connection.escape(parseInt(post_data.breed_id)) + ' ';
							sql += 'AND p.code = m.plumage_code ORDER BY p.color';

							if (logSQL) {
								console.log(sql);
							}

							connection.query(sql, function(err, rows, fields) {

								if (err) {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
									return;
								}

								return_data.plumage_codes = rows;

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
								return;

							});

						} else {
							connection.release();
							res.send(JSON.stringify({status: 'FAILED', status_text: 'No record found in database'}));
							return;
						}
					} else {
						connection.release();
						res.send(JSON.stringify({status: 'FAILED', status_text: 'No records found in database'}));
						return;
					}
				});

			});

		},

		addBreedPlumage: function(req, res) {

			var post_data = req.ops_post_data;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'INSERT INTO breed_plumage_map (breed_id, plumage_code, standard) VALUES (';
				sql += connection.escape(parseInt(post_data.breed_id)) + ', ';
				sql += connection.escape(parseInt(post_data.plumage_code)) + ', ';
				sql += connection.escape('Y') + ')';

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
					return;
				});

			});
		},

		addPlumage: function(req, res) {

			var post_data = req.ops_post_data;

			var new_code;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'INSERT INTO breed_plumage (color) VALUES (' + connection.escape(post_data.add_plumage_menu_color) + ')';

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					new_code = result.insertId;
					connection.release();

					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {new_code: new_code}}));
					return;

				});
			});
		},

		removePlumage: function(req, res) {

			var post_data = req.ops_post_data;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'DELETE FROM breed_plumage_map ';
				sql += 'WHERE breed_id = ' + connection.escape(parseInt(post_data.breed_id)) + ' ';
				sql += 'AND plumage_code = ' + connection.escape(parseInt(post_data.plumage_code));

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
					return;
				});

			});
		},

		addBreed: function(req, res) {

			var post_data = req.ops_post_data;

			var isql = '';
			var vsql = '';
			var delim = '';
			var id;

			env_settings.connection_pool.getConnection(function(err, connection) {

				// Begin DB Transaction
				connection.query('BEGIN', function(err) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					isql = 'INSERT INTO breeds (';
					vsql = ' VALUES (';

					for (var prop in post_data) {
						if (prop != 'plumage_array') {
							isql += delim + prop;
							vsql += delim + connection.escape(cnull(post_data[prop]));
							delim = ',';
						}
					}

					sql = isql + ')' + vsql + ')';

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, result) {

						if (err) {
							connection.query('ROLLBACK', function() {
								errtrack.reportOpsErr(err, res, sql);
								connection.release();
							});
							return;
						}

						id = result.insertId;
						
						// recursive call to insert plumages
						insertPlumage(post_data.plumage_array);

					});

					function insertPlumage(plumage_array) {

						if (plumage_array.length == 0) {
							// Last plumage insert done

							connection.query('COMMIT', function(err) {

								if (err) {
									connection.query('ROLLBACK', function() {
										errtrack.reportOpsErr(err, res, sql);
										connection.release();
									});
									return;
								}

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: {id: id}}));
								return;

							});

							return;
						}


						sql = 'INSERT INTO breed_plumage_map (breed_id, plumage_code, standard) VALUES (';
						sql += connection.escape(id) + ',' + connection.escape(parseInt(plumage_array.pop())) + ',' + connection.escape('Y') + ')';

						if (logSQL) {
							console.log(sql);
						}

						connection.query(sql, function(err, result) {

							if (err) {
								connection.query('ROLLBACK', function() {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
								});
								return;
							}

							insertPlumage(plumage_array);
						});
					}

				}); // End DB Transaction

			}); // End DB Connection

		},

		updateBreed: function(req, res) {

			var post_data = req.ops_post_data;

			var delim = '';

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'UPDATE breeds SET ';

				for (var prop in post_data) {
					if ((prop != 'plumage_array') && (prop != 'breed_id')) {
						sql += delim + prop + '=';
						sql += connection.escape(cnull(post_data[prop]));
						delim = ', ';
					}
				}

				sql += ' WHERE id = ' + connection.escape(post_data.breed_id);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
					return;
				});
			});
		},

		getProdMenus: function(req, res) {

			var return_menus = {};

			env_settings.connection_pool.getConnection(function(err, connection) {

				// Product Category menu --------
				sql = 'SELECT * from product_cats ORDER BY cat_name';

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					var prod_cat_menu = '<option value=""></option>';

					for (var i = 0; i < rows.length; i++) {
							prod_cat_menu += '<option value="' + rows[i].code + '">' + rows[i].cat_name + '</option>';
					}

					return_menus.prod_cat_menu = prod_cat_menu;

					// Product sizes menu ---------
					sql = 'SELECT * from product_sizes ORDER BY order_num';

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, rows, fields) {

						if (err) {
							errtrack.reportOpsErr(err, res, sql);
							connection.release();
							return;
						}

						var prod_size_menu = '';
						//prod_size_menu += '<option value=""></option>';

						for (var i = 0; i < rows.length; i++) {
								prod_size_menu += '<option value="' + rows[i]['size'] + '">' + rows[i]['size'] + '</option>';
						}

						return_menus.prod_size_menu = prod_size_menu;

						connection.release();
						res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_menus}));
						return;
					});
				});
			});
		},

		getProd: function(req, res) {

			var edit_id = req.params.id;

			if (edit_id != parseInt(edit_id)) {
				res.send(JSON.stringify({status: 'FAILED', status_text: 'Invalid edit id'}));
				return;
			}

			var return_data = {};

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT * FROM products WHERE id = ' + connection.escape(+edit_id);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows) {
						if (rows.length == 1) {
							return_data.formData = rows[0];

							sql = "SELECT * FROM file_uploads WHERE control_code = 'PROD' AND status = 'A' ";
							sql += "AND control_rec_id = " + connection.escape(+edit_id);
							sql += ' ORDER BY id';

							if (logSQL) {
								console.log(sql);
							}

							connection.query(sql, function(err, rows, fields) {

								if (err) {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
									return;
								}

								if (rows) {
									return_data.uploadsArray = rows;
								}

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
								return;
							});


						} else {
							connection.release();
							res.send(JSON.stringify({status: 'FAILED', status_text: 'No record found in database'}));
							return;
						}
					} else {
						connection.release();
						res.send(JSON.stringify({status: 'FAILED', status_text: 'No records found in database'}));
						return;
					}

				});

			});

		},

		addProd: function(req, res) {
			var post_data = req.ops_post_data;

			var isql = '';
			var vsql = '';
			var delim = '';
			var id;
			var return_ids = [];

			env_settings.connection_pool.getConnection(function(err, connection) {

				processSizes();

				function processSizes() {
					var thisSize;
					if (post_data.size.length > 0) {
						thisSize = post_data.size.shift();

						isql = 'INSERT INTO products (';
						vsql = ' VALUES (';

						delim = '';
						for (var prop in post_data) {
							isql += delim + prop;
							if (prop != 'size') {
								vsql += delim + connection.escape(cnull(post_data[prop]));
								delim = ',';
							} else {
								vsql += delim + connection.escape(thisSize);
							}
						}

						sql = isql + ')' + vsql + ')';

						if (logSQL) {
							console.log(sql);
						}

						connection.query(sql, function(err, result) {

							if (err) {
								errtrack.reportOpsErr(err, res, sql);
								connection.release();
								return;
							}

							return_ids.push(result.insertId);
							processSizes();
						});

					} else {
						connection.release();
						res.send(JSON.stringify({status: 'OK', status_text: '', payload: {ids: return_ids}}));
						return;
					}
				}

			});

		},

		updateProd: function(req, res) {

			var post_data = req.ops_post_data;
			var delim = '';

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'UPDATE products SET ';

				for (var prop in post_data) {
					if (prop != 'prod_id') {
						sql += delim + prop + '=';
						sql += connection.escape(cnull(post_data[prop]));
						delim = ', ';
					}
				}

				sql += ' WHERE id = ' + connection.escape(post_data.prod_id);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
					return;
				});

			});
			
		},

		getorder: function(req, res) {

			var post_data = req.ops_post_data;
			var order_num = req.params.order_num;

			var return_data = {};

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT oh.*, c.country, c2.country AS bill_country, CONCAT(oh.expire_month, '/', oh.expire_year) AS expires ";
				sql += 'FROM order_header oh, countries c, countries c2 ';
				sql += 'WHERE oh.order_num = ' + connection.escape(order_num) + ' ';
				sql += 'AND c.code = oh.country_code ';
				sql += 'AND c2.code = oh.bill_country_code';

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows) {
						if (rows.length == 1) {

							return_data.order_header = rows[0];

							sql = "SELECT *, CONCAT('#', prod_id, ': ', prod_name) AS item_desc FROM order_detail ";
							sql += 'WHERE order_num = ' + connection.escape(parseInt(order_num)) + ' ';
							sql += 'ORDER BY line_item';

							if (logSQL) {
								console.log(sql);
							}

							connection.query(sql, function(err, rows, fields) {

								if (err) {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
									return;
								}

								return_data.order_detail = rows;

								connection.release();
								res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
								return;

							});

						} else {
							connection.release();
							res.send(JSON.stringify({status: 'FAILED', status_text: 'No record found in database'}));
							return;
						}
					} else {
						connection.release();
						res.send(JSON.stringify({status: 'FAILED', status_text: 'No records found in database'}));
						return;
					}
				});

			});

		},

		updateOrder: function(req, res) {

			var post_data = req.ops_post_data;
			var order_num = req.params.order_num;

			var delim = '';

			process_update();

			function process_update() {

				env_settings.connection_pool.getConnection(function(err, connection) {

					sql = 'UPDATE order_header SET ';

					for (var prop in post_data) {
						if (prop != 'order_num') {
							sql += delim + prop + '=';
							sql += connection.escape(cnull(post_data[prop]));
							delim = ', ';
						}
					}

					sql += ' WHERE order_num = ' + connection.escape(order_num);

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, result) {

						if (err) {
							errtrack.reportOpsErr(err, res, sql);
							connection.release();
							return;
						}

						connection.release();
						res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
						return;
					});
				});

			}

		},

		shipOrder: function(req, res) {

			paypal_sdk.configure(env_settings.paypalSettings);

			var post_data = req.ops_post_data;
			var order_num = req.params.order_num;

			var delim = '';

			var capture_id, capture_amt, capture_date_str, capture_date;

			var capture_json = {
	  			"amount": {
					"currency": "USD",
					"total": post_data.total
				},
				"is_final_capture": true
			};

			console.log('Capture Auth ' + post_data.auth_id);
			console.log('\nCapture JSON ' + JSON.stringify(capture_json));

			paypal_sdk.authorization.capture(post_data.auth_id, capture_json, function (err, capture) {

			    if (err) {
			        console.log(JSON.stringify(err));
			        res.send(JSON.stringify({status: 'ERROR', status_text: 'Auth capture failed', payload: err}));
					return;

			    } else {
			        console.log('Paypal capture response: ' + JSON.stringify(capture));

			        if (capture.state == 'completed') {
			        	capture_id = capture.id;
			        	capture_amt = capture.amount.total;
			        	capture_date_str = capture.create_time;

			        	if (capture_date_str) {
			        		capture_date = new Date(capture_date_str);
			        	}

			        } else {
			        	console.log('Auth capture failed, state = ' + capture.state);
			        	res.send(JSON.stringify({status: 'ERROR', status_text: 'Auth capture failed', payload: {}}));
			        	return;
			        }

			        process_update();
			    }

			});



			function process_update() {

				env_settings.connection_pool.getConnection(function(err, connection) {

					sql = 'UPDATE order_header SET ';

					sql += "order_status = 'C'";
					sql += ",payment_status = 'C'";
					sql += ',capture_id = ' + connection.escape(capture_id);
					sql += ',capture_amt = ' + connection.escape(capture_amt);
					sql += ',capture_date = ' + connection.escape(capture_date);

					sql += ' WHERE order_num = ' + connection.escape(order_num);

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, result) {

						if (err) {
							errtrack.reportOpsErr(err, res, sql);
							connection.release();
							return;
						}

						connection.release();
						res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
						return;
					});
				});

			}

		},


		voidOrder: function(req, res) {

			paypal_sdk.configure(env_settings.paypalSettings);

			var post_data = req.ops_post_data;
			var order_num = req.params.order_num;

			var void_id, void_date_str, void_date;
			var delim = '';

			console.log('Void Auth ' + post_data.auth_id);

			paypal_sdk.authorization.void(post_data.auth_id, function (err, authorization) {

			    if (err) {
			        console.log(JSON.stringify(err));
			        res.send(JSON.stringify({status: 'ERROR', status_text: 'Auth void failed', payload: err}));
					return;

			    } else {
			        console.log('Paypal authorization response: ' + JSON.stringify(authorization));

			        if (authorization.state == 'voided') {
			        	void_id = authorization.id;
			        	void_date_str = authorization.create_time;

			        	if (void_date_str) {
			        		void_date = new Date(void_date_str);
			        	}

			        } else {
			        	console.log('Auth void failed, state = ' + authorization.state);
			        	res.send(JSON.stringify({status: 'ERROR', status_text: 'Auth void failed', payload: {}}));
			        	return;
			        }

			        process_update();
			    }

			});



			function process_update() {

				env_settings.connection_pool.getConnection(function(err, connection) {

					sql = 'UPDATE order_header SET ';

					sql += "order_status = 'X'";
					sql += ",payment_status = 'V'";
					sql += ',void_id = ' + connection.escape(void_id);
					sql += ',void_date = ' + connection.escape(void_date);

					sql += ' WHERE order_num = ' + connection.escape(order_num);

					if (logSQL) {
						console.log(sql);
					}

					connection.query(sql, function(err, result) {

						if (err) {
							errtrack.reportOpsErr(err, res, sql);
							connection.release();
							return;
						}


						// Update inventory
						sql = "SELECT prod_id, qty FROM order_detail ";
						sql += "WHERE order_num = " + connection.escape(order_num);

						connection.query(sql, function(err, rows, fields) {

							if (err) {
								errtrack.reportOpsErr(err, res, sql);
								connection.release();
								return;
							}

							processInvUpdate(rows);

							function processInvUpdate(items) {
								if (items.length == 0) {
									// Done all order line items
									connection.release();
									res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
									return;
								}

								var thisItem = items.pop();
								sql = "UPDATE products SET on_hand = on_hand - " + connection.escape(thisItem.qty);
								sql += " WHERE id = " + connection.escape(thisItem.prod_id);

								connection.query(sql, function(err, result) {

									if (err) {
										errtrack.reportOpsErr(err, res, sql);
										connection.release();
										return;
									}

									processInvUpdate(items);

								});

							}


						});

					});

				});

			}

		},


		getInvoice: function (req, res) {

			var order_num = req.params.order_num;
			var html = '';
			var dt = new Date();
			var nowDate = (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();
			var shipping, orderTot;

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT oh.*, c.country, CONCAT(oh.expire_month, '/', oh.expire_year) AS expires ";
				sql += 'FROM order_header oh, countries c ';
				sql += 'WHERE oh.order_num = ' + connection.escape(order_num) + ' ';
				sql += 'AND c.code = oh.country_code'

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					if (rows) {
						if (rows.length == 1) {

							shipping = rows[0].shipping_cost;
							orderTot = rows[0].items_total_cost + +shipping;

							html += '<!DOCTYPE html><html><head><title>PamperYourPoultry - Invoice #' + order_num + '</title>';
							html += '<style>td {white-space: nowrap; vertical-align: top;}</style>';
							html += '<link rel="shortcut icon" href="/images/favicon.ico"></head><body>';

							html += '<table width=1000 style="border-style: solid; border-width: 1px; border-color: #000; padding: 25px;">';
							html += '<tr><td width="50%"><img src="/images/site/logo.png"><br>';
							html += '<div style="padding-left: 80px; font-size: 85%; position: relative; left: -16px; top: 0;">';
							html += '95 Windsor Rd<br>';
							html += 'Claremont, NH 03743<br>';
							html += '(603) 558-4934';
							html += '</div></td><td width="50%" align="right"><div style="padding-right: 50px;">';
							html += '<span style="font-size: 120%; font-weight: bold;">Invoice #' + order_num + '</span><br>';
							html += '<em>' + nowDate + '</em></div></td></tr>';
							html += '<tr><td colspan=2 height=40>&nbsp;</td></tr>';
							html += '<tr><td><table border=0><tr><td valign="top">Ship to:</td><td>';
							html += '<div style="margin-left:8px; padding: 4px; border-style: solid; border-width: 1px; border-color: #000;">';
							html += rows[0].name + '<br>';
							html += rows[0].add1 + '<br>';
							if (rows[0].add2) {
								html += rows[0].add2 + '<br>';
							}
							html += rows[0].city + ', ' + rows[0].state + ' ' + rows[0].zip + '<br>';
							html += rows[0].country;

							html += '</div></td></tr></table></td><td>';

							html += '<table border=0>';
							html += '<tr><td valign="top">Bill to:</td><td><div style="margin-left:8px; padding: 4px; border-style: solid; border-width: 1px; border-color: #000;">';
							html += rows[0].bill_add1 + '<br>';
							if (rows[0].bill_add2) {
								html += rows[0].bill_add2 + '<br>';
							}
							html += rows[0].bill_city + ', ' + rows[0].bill_state + ' ' + rows[0].bill_zip + '<br>';

							html += '</div></td></tr></table></td></tr><tr><td colspan=2 height=30>&nbsp;</td></tr><tr><td colspan=2 align="center" height=600>';
							html += '<table style="border-style: solid; border-width: 1px; border-color: #000;" width="70%" align="center">';
							html += '<tr bgcolor="#d0d0d0"><th align="center">Qty</th><th align="left">Description</th><th align="right">Amount</th></tr>';



							sql = "SELECT *, CONCAT('#', prod_id, ': ', prod_name) AS item_desc FROM order_detail ";
							sql += 'WHERE order_num = ' + connection.escape(parseInt(order_num)) + ' ';
							sql += 'ORDER BY line_item';

							if (logSQL) {
								console.log(sql);
							}

							connection.query(sql, function(err, rows, fields) {

								if (err) {
									errtrack.reportOpsErr(err, res, sql);
									connection.release();
									return;
								}

								for (var i = 0; i < rows.length; i++) {
									html += '<tr><td align="center">' + rows[i].qty + '</td><td>' + rows[i].item_desc + '</td>';
									html += '<td align="right">$' + formatCurrency(rows[i].sell_price * rows[i].qty) + '</td>';
									html += '</tr>';
								}

								html += '<tr><td>&nbsp;</td><td align="right">Shipping:&nbsp;&nbsp;</td><td align="right">$' + formatCurrency(shipping) + '</td></tr>';
								html += '<tr><td colspan=2>&nbsp;</td></tr><tr>';
								html += '<td style="border-top-style: solid; border-top-width: 1px; border-top-color: #000;">&nbsp;</td>';
								html += '<td style="border-top-style: solid; border-top-width: 1px; border-top-color: #000;" align="right">Order Total:&nbsp;&nbsp;</td>';
								html += '<td style="border-top-style: solid; border-top-width: 1px; border-top-color: #000;" align="right"><strong>$' + formatCurrency(orderTot) + '</strong></td></tr>';
								html += '</table></td></tr>';

								html += '<tr><td colspan=2><div style="font-size: 120%; padding: 25px;"><p><em>Thank you for your order!</em></p>';
								html += '<p>Be sure to like us on Facebook at <a href="#">www.facebook.com/PamperYourPoultry</a> to get<br>';
								html += 'all the latest updates and connect with pampered poultry around the globe.</p>';
								html += '<p>Website: <a href="#">www.pamperyourpoultry.com</a> | email us at <a href="mailto:pamperyourpoultry@yahoo.com">pamperyourpoultry@yahoo.com</a></p>';
								html += '</div></td></tr></table></body></html>';

								connection.release();
								res.send(html);
								return;

							});

						} else {
							connection.release();
							res.send('Order not found on server.');
							return;
						}
					} else {
						connection.release();
						res.send('Order not found on server.');
						return;
					}
				});

			});
		},

		retireFileUpload: function(req, res) {

			var post_data = req.ops_post_data;
			var delim = '';

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "UPDATE file_uploads SET status = 'I' ";
				sql += ' WHERE id = ' + connection.escape(post_data.id);

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, result) {

					if (err) {
						errtrack.reportOpsErr(err, res, sql);
						connection.release();
						return;
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: {}}));
					return;
				});
			});

		},

		fileUploader: function(req, res) {

			var max_files = req.body.max_files || 1;
			var site_path = req.body.site_path;
			var control_code = req.body.control_code;
			var control_rec_id = req.body.control_rec_id;
			var thumbsizeJSON = req.body.thumbsize;
			var thumbSize;

			var userFiles = [];
			var uploadedFiles = [];

			// console.log('body=' + JSON.stringify(req.body) + '\n\n');
			// console.log('ACCESS_TOKEN = ' + req.body.ACCESS_TOKEN);

			console.log('Upload started...');

			if (Array.isArray(req.files.userImages)) {
				userFiles = req.files.userImages;
			} else {
				userFiles.push(req.files.userImages);
			}

			// Validate input
			if (userFiles.length > max_files) {
				if (max_files > 1) {
					res.send(JSON.stringify({
						status: 'ERROR',
						status_msg: 'You can only load up to ' + max_files + ' images.'
					}));
					return;
				} else {
					res.send(JSON.stringify({
						status: 'ERROR',
						status_msg: 'You can only load one image at a time.'
					}));
					return;
				}
			}

			if (!site_path) {
				res.send(JSON.stringify({
					status: 'ERROR',
					status_msg: 'site_path not provided.'
				}));
				return;
			}

			if (!control_code) {
				res.send(JSON.stringify({
					status: 'ERROR',
					status_msg: 'control_code not provided.'
				}));
				return;
			}

			if (control_rec_id) {
				if (control_rec_id != parseInt(control_rec_id)) {
					res.send(JSON.stringify({
						status: 'ERROR',
						status_msg: 'control_rec_id invalid.'
					}));
					return;
				}
			}

			if (thumbsizeJSON) {
				try {
					thumbSize = JSON.parse(thumbsizeJSON);
				} catch(err) {
					res.send(JSON.stringify({
						status: 'ERROR',
						status_msg: 'Error parsing JSON thumbsize'
					}));
					return;
				}
			}

			console.log('Starting upload process.');

			// Call recursive function to process all files in array
			processFiles(userFiles, uploadedFiles);

			function processFiles(filesArray, uploadedFilesArray) {

				var thisArray, pathToServer, userFilename, file_ext, sql, hash, dbid;
				var dt = new Date();
				var connectionInfo = env_settings.dbConnSettings;
				var connection;

				if (filesArray.length > 0) {
					thisArray = filesArray.shift();

					userFilename = thisArray.name;

					pathToServer = env_settings.webroot_path;

					file_ext = userFilename.split('.').pop();
					console.log('Processing file ' + userFilename + ' with extension ' + file_ext);

					connection = mysql.createConnection(connectionInfo);

					sql = 'INSERT INTO file_uploads (';
					sql += 'control_code,';

					if (control_rec_id) {
						sql += 'control_rec_id,';
					}

					sql += 'user_filename,';
					sql += 'file_ext,';
					sql += 'upload_date';
					sql += ') values (';
					sql += connection.escape(control_code) + ',';

					if (control_rec_id) {
						sql += connection.escape(+control_rec_id) + ',';
					}

					sql += connection.escape(userFilename) + ',';
					sql += connection.escape(file_ext) + ',';
					sql += connection.escape(dt);
					sql += ')';

					console.log(sql);

					connection.query(sql, function(err, result) {
						if (err) throw err;

						hash = genKey(result.insertId);
						dbid = result.insertId;
						console.log('Insert complete - new id is ' + result.insertId + ' and hash is ' + hash);

						console.log('Rename ' + thisArray.path + ' to ' + pathToServer + site_path + hash + '.' + file_ext);

						fs.rename(
						thisArray.path,
						pathToServer + site_path + hash + '.' + file_ext,
						function(error) {
							if (error) {
								console.log(error);
								res.send(JSON.stringify({status: 'ERROR',
									status_msg: 'File uploaded cancelled, server error: ' + error
								}));
								return;
							}

							// Create Thumbnail
							var largeImageFile = pathToServer + site_path + hash + '.' + file_ext;
							var smallImageFile = pathToServer + site_path + hash + '_thumb.' + file_ext;

							console.log('Thumbsize: ' + JSON.stringify(thumbSize));
							var aspect, resizeHeight, resizeWidth;

							// Get uploaded image size
							gm(largeImageFile)
								.size(function (err, size) {
								if (err) throw err;

								// Resize to keep largest dimmension
								aspect = (size.width > size.height ? 'wider' : 'taller');

								if (aspect == 'wider') {
									resizeHeight = thumbSize.height;
									resizeWidth = Math.round(thumbSize.height * (size.width / size.height));
								} else {
									resizeWidth = thumbSize.width;
									resizeHeight = Math.round(thumbSize.width * (size.height / size.width));
								}

								// Resize image, trim to thumbnail aspect ratio, write to disk
								gm(largeImageFile)
								.resize(resizeWidth, resizeHeight)
								.gravity('Center')
								.extent(thumbSize.width, thumbSize.height)
								.write(smallImageFile, function (error) {
									if (err) throw err;

									sql = "UPDATE file_uploads SET hash = " + connection.escape(hash) + ",";
									sql += "file_url = " + connection.escape(site_path + hash + '.' + file_ext) + ", ";
									sql += 'thumb_url = ' + connection.escape(site_path + hash + '_thumb.' + file_ext) + " ";
									sql += "WHERE id = " + result.insertId;

									console.log(sql);

									connection.query(sql, function(err, result) {
										if (err) throw err;

										uploadedFilesArray.push({
										img_path: site_path + hash + '.' + file_ext,
										img_thumb_path: site_path + hash + '_thumb.' + file_ext,
										id: dbid
										});

										processFiles(filesArray, uploadedFilesArray);

									});

								});

							});

						});

					});


				} else {
					// All files complete
					console.log('Done all files in array');
					console.log(JSON.stringify(uploadedFilesArray));

					res.send(JSON.stringify({
						status: 'OK',
						status_msg: '',
						uploads: uploadedFilesArray
					}));
					return;
				}
					
			}



		}


	}

};

// Get client IP address ----------------------
getClientAddress = function (req) {
		return (req.headers['x-forwarded-for'] || '').split(',')[0] 
				|| req.connection.remoteAddress;
};

function formatCurrency(num) {
	num = isNaN(num) || num === '' || num === null ? 0.00 : num;
	return parseFloat(num).toFixed(2);
}


function cnull(f) {
	if (f.length == 0) {
		return null
	} else {
		return f;
	}
}



