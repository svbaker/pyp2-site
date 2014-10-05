var errtrack = require('../util/errTrack.js');

module.exports = function(env_settings) {

	var logSQL = env_settings.logSQL;

	return {

		getBreeds: function(callback) {

			env_settings.connection_pool.getConnection(function(err, connection) {

				sql = "SELECT b.id, b.breed_name AS breed, b.breed_class_code AS class_code, ";
				sql += "bc.class AS breed_class, b.breed_is_standard ";
				sql += "FROM breeds b, breeds_class bc ";
				sql += "WHERE bc.code = b.breed_class_code ";
				sql += "ORDER BY bc.class, b.breed_name";

				if (logSQL) {
					console.log(sql);
				}

				connection.query(sql, function(err, rows, fields) {

					if (err) {
						console.log('Error getting breeds: ' + JSON.stringify(err));
						callback();
						return;
					}

					connection.release();
					callback(rows);
					return;

				});

			});

	    }

	}

};


