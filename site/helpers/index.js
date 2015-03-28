var hbs = require('express-hbs');
var siteHelpers = {};


siteHelpers.countriesMenu = function (countries) {

	var last_sort1 = 0;
	var default_val = 'US'; // USA
	var sel = '';

	var countries_menu = '<optgroup label><option value="">Select Country</option></optgroup>';
	countries_menu += '<optgroup label="------------">';

	for (var i = 0; i < countries.length; i++) {
		if ((countries[i].sort1 == 2) && (last_sort1 == 1)) {
			countries_menu += '</optgroup><optgroup label="------------">';
		}
			if (countries[i].code == default_val) {
				sel = ' SELECTED';
				default_val = ''; // Only select first match
			} else {
				sel = '';
			}
		countries_menu += '<option value="' + countries[i].code + '"' + sel + '>' + countries[i].country + '</option>';
		last_sort1 = countries[i].sort1;
	}

	countries_menu += '</optgroup>';

	return new hbs.SafeString(countries_menu);
};



siteHelpers.statesMenu = function (states) {

	var states_menu = '<optgroup label><option value="">Select State</option></optgroup>';
	states_menu += '<optgroup label="------------">';

	for (var i = 0; i < states.length; i++) {
		states_menu += '<option value="' + states[i]['state_code'] + '">' + states[i]['state'] + '</option>';
	}
	states_menu += '</optgroup>';

	return new hbs.SafeString(states_menu);
};


siteHelpers.breedsMenu = function (breeds) {

	var last_class = '';
	var breeds_menu = '<optgroup label=""><option value="">-- Select Breed --</option><option value="0">Other</option><option value="0">Unknown</option></optgroup>';

	for (var i = 0; i < breeds.length; i++) {
		if (breeds[i].breed_class != last_class) {
			if (last_class) {
				breeds_menu += '</optgroup>';
			}
			breeds_menu += '<optgroup label="' + breeds[i].breed_class + '">';
			last_class = breeds[i].breed_class;
		}
		breeds_menu += '<option value="' + breeds[i].id + '">' + breeds[i].breed + '</option>';
	}
	breeds_menu += '</optgroup>';

	return new hbs.SafeString(breeds_menu);
};


registerHelpers = function (siteHbs) {
	siteHbs.registerHelper('countries_menu', siteHelpers.countriesMenu);
	siteHbs.registerHelper('states_menu', siteHelpers.statesMenu);
	siteHbs.registerHelper('breeds_menu', siteHelpers.breedsMenu);
}

module.exports = siteHelpers;
module.exports.loadSiteHelpers = registerHelpers;

