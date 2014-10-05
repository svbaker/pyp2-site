var errtrack = require('../util/errTrack.js');


module.exports = function(env_settings) {

	var logSQL = env_settings.logSQL;

	return {

		getProducts: function(req, res) {

			var cat_code = req.params.cat_code;

			var return_data = {};
			var last_size = '';

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT p.*, ";
				sql += "(SELECT file_url FROM file_uploads WHERE control_code = 'PROD' and status = 'A' and control_rec_id = p.id LIMIT 1) AS file_url, ";
				sql += "(SELECT thumb_url FROM file_uploads WHERE control_code = 'PROD' and status = 'A' and control_rec_id = p.id LIMIT 1) AS thumb_url ";
				sql += "FROM products p, product_sizes ps ";
				sql += "WHERE ps.size = p.size AND p.status = 'A' and p.on_hand > 0 ";
				if (cat_code) {
					sql += "AND p.cat_code = " + connection.escape(cat_code) + " ";
				}
				sql += "ORDER BY ps.order_num";

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						connection.release();
						errtrack.reportErr(err, req, res, env_settings, sql);
						return;
					}

						if (rows) {
							for (var i = 0; i < rows.length; i++) {
								if (rows[i].size != last_size) {
									return_data[rows[i].size] = [];
									last_size = rows[i].size;
								}
								return_data[rows[i].size].push(rows[i]);
							}
						}

						connection.release();
						res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
						return;

				});

			});

		},

		getOnHand: function (req, res) {

			var data = req.body.data;
			var post_data;

			try {
				post_data = JSON.parse(data);
			} catch(err) {
				errtrack.logErr('Error parsing JSON: ' + data, req, env_settings);
				res.send(JSON.stringify({status: 'FAILED', status_detail: 'Error parsing JSON'}));
				return false;
			}

			var return_data = [];
			var cartItems = post_data.cartItems;
			var delim = '';

			if (cartItems.length == 0) {
				res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
				return;
			}

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = 'SELECT id AS prod_id, on_hand FROM products ';
				sql += 'WHERE id IN (';

				for (var i = 0; i < cartItems.length; i++) {
					sql += delim + cartItems[i].prod_id;
					delim = ',';
				}

				sql += ')';

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {
					if (err) {
						connection.release();
						errtrack.reportErr(err, req, res, env_settings, sql);
						return;
					}

					for (i = 0; i < rows.length; i++) {
						return_data.push({prod_id: rows[i].prod_id, on_hand: rows[i].on_hand});
					}

					connection.release();
					res.send(JSON.stringify({status: 'OK', status_text: '', payload: return_data}));
					return;

				 });
			});
		}

	}

};



