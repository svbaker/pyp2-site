var normalized_ccnum;
var card_type;
var buttons_suspended = false;

$(document).ready(function() {

	// Continue shopping button
    $('.backNav').click(function(event) {
		event.preventDefault();
		if (!buttons_suspended) {
			backToCart();
		} else {
			return false;
		}
    });

    $('.placeOrder').click(function(event) {
    	event.preventDefault();
    	if (!buttons_suspended) {
    		$('#process_order_msgbox').hide();
    		placeOrder();
    	} else {
    		return false;
    	}
    });

});


// Save state and redirect for back to cart
function backToCart() {
	saveFormChanges();
	window.location.href = 'cart';
}


// Load form data from storage or cookies into DOM
function loadFormData() {

	// Shipping and contact form
	$('#shippingForm').find('.postData').each(function() {
		$(this).val(ORDERFORM.form_data[$(this).attr('id').slice(10)]);
	});

	// Payment form
	$('#paymentForm').find('.postData').each(function() {
		$(this).val(ORDERFORM.form_data[$(this).attr('id').slice(10)]);
	});

	// Billing form
	$('#billingForm').find('.postData').each(function() {
		$(this).val(ORDERFORM.form_data[$(this).attr('id').slice(10)]);
	});

}

// Save any form state changes to local object and to local storage or cookies
function saveFormChanges() {

	// Shipping and contact form
	$('#shippingForm').find('.postData').each(function() {
		var field = $(this).attr('id').slice(10);
		var val = $(this).val();
		ORDERFORM.form_data[field] = val;
	});

	// Payment form
	$('#paymentForm').find('.postData').each(function() {
		var field = $(this).attr('id').slice(10);
		var val = $(this).val();
		ORDERFORM.form_data[field] = val;
	});

	// Billing form
	$('#billingForm').find('.postData').each(function() {
		var field = $(this).attr('id').slice(10);
		var val = $(this).val();
		ORDERFORM.form_data[field] = val;
	});

	ORDERFORM.saveState();
}


// Called from global.js once user state has loaded from cookies or local storage
function localInitFunc() {

	backURL = getCookie('backURL');
	if (!backURL) {
		backURL = ''; // Home page
	}

	var itemsTot = CART.itemsCostTot();
	var shipping = CART.calcShipping(ORDERFORM.form_data.country_code).cost;

	// Load order summary
	$('#orderSummary_itemsTot').html('$' + formatCurrency(itemsTot));
	$('#orderSummary_shipping').html('$' + formatCurrency(shipping));
	$('#orderSummary_orderTot').html('$' + formatCurrency(itemsTot + shipping));

	// Default billing country if not already set
	if (!ORDERFORM.form_data.bill_country_code) {
		ORDERFORM.form_data.bill_country_code = ORDERFORM.form_data.country_code;
	}

	// Load shipping and contact data
	$('#orderForm_country_code').val(ORDERFORM.form_data.country_code);

	// Load billing data
	$('#orderForm_bill_country_code').val(ORDERFORM.form_data.bill_country_code);

	// Set initial state menu versions
	setStateMenuVersion($('#orderForm_country_code').val(), $('#shippingForm'));
	setStateMenuVersion($('#orderForm_bill_country_code').val(), $('#billingForm'));

	// Load form data from cookies or local storage
	loadFormData();


	// ----------- Set up event handlers --------------

	// Handle country code changes
	$('#orderForm_country_code').change(function() {
		setStateMenuVersion($('#orderForm_country_code').val(), $('#shippingForm'));
	});

	$('#orderForm_bill_country_code').change(function() {
		setStateMenuVersion($('#orderForm_bill_country_code').val(), $('#billingForm'));
	});


	// ------ Billing same as shipping checkbox -------------------
	$('#billingSameAsShipping').change(function() {
		if ($('#billingSameAsShipping').attr('checked')) {
			$('#orderForm_bill_country_code').val($('#orderForm_country_code').val());
			$('#orderForm_card_name').val($('#orderForm_name').val());
			$('#orderForm_bill_add1').val($('#orderForm_add1').val());
			$('#orderForm_bill_add2').val($('#orderForm_add2').val());
			$('#orderForm_bill_city').val($('#orderForm_city').val());
			$('#orderForm_bill_state_code').val($('#orderForm_state_code').val());
			$('#orderForm_bill_state').val($('#orderForm_state').val());
			$('#orderForm_bill_zip').val($('#orderForm_zip').val());

			setStateMenuVersion($('#orderForm_bill_country_code').val(), $('#billingForm'));
		}
	});


	// Save form updates to cookies/storage and handle per-form validation cues
    $('body').on('blur', '.validated-input', function() {

        var msg_dom_id = '#' + $(this).attr('id') + '-msg';
        if ($(this).val().length == 0) {
            $(msg_dom_id).show();
            $(this).css('border-color', '#d00');
        } else {
            $(msg_dom_id).hide();
            $(this).css('border-color', '#959595');
        }

        if ($(this).attr('id') == 'orderForm_email') {
            if (!validEmail($('#orderForm_email').val())) {
                $('#orderForm_email-msg').show();
                $('#orderForm_email').css('border-color', '#d00');
            }
        }

        saveFormChanges();

    });


	// Save state input fields form updates to cookies/storage and handle per-form validation cues
    $('body').on('blur', '.stateField-input', function() {

        var msg_dom_id = '#' + $(this).attr('id') + '-msg';
        if ($(this).val().length == 0) {
            $(msg_dom_id).show();
            $(this).css('border-color', '#d00');
        } else {
            $(msg_dom_id).hide();
            $(this).css('border-color', '#959595');
        }

        saveFormChanges();

    });

    // Hide validation message when user moves to address issue
	$('body').on('focus', '.validated-input,.stateField-input', function() {
		$('.validation_message').hide(300);
	});



}


function setStateMenuVersion(country_code, formElement) {
	if (country_code == CART.united_states_country_code) {
		// To USA
		formElement.find('.non-us').hide();
		formElement.find('.us-only').show();
	} else {
		// From US
		formElement.find('.us-only').hide();
		formElement.find('.non-us').show();
	}
}


// Save form, validate, and place order
function placeOrder() {
	var validator = new CCNumberValidator();
	var isValid = true;

	saveFormChanges();


	// Validate basic form elements
	$('.validated-input').each(function() {
		var msg_dom_id = '#' + $(this).attr('id') + '-msg';
        if ($(this).val().length == 0) {
            $(msg_dom_id).show();
            $(this).css('border-color', '#d00');
            isValid = false;
        } else {
            $(msg_dom_id).hide();
            $(this).css('border-color', '#959595');
        }
	});

	if (!validEmail($('#orderForm_email').val())) {
    	$('#orderForm_email-msg').show();
		$('#orderForm_email').css('border-color', '#d00');
		isValid = false;
	}




	if ($('#orderForm_country_code').val() == CART.united_states_country_code) {
		if ($('#orderForm_state_code').val().length == 0) {
			$('#orderForm_state_code-msg').show();
			$('#orderForm_state_code').css('border-color', '#d00');
			isValid = false;
		} else {
			$('#orderForm_state_code-msg').hide();
			$('#orderForm_state_code').css('border-color', '#959595');
		}
	} else {
		if ($('#orderForm_state').val().length == 0) {
			$('#orderForm_state-msg').show();
			$('#orderForm_state').css('border-color', '#d00');
			isValid = false;
		} else {
			$('#orderForm_state-msg').hide();
			$('#orderForm_state').css('border-color', '#959595');
		}
	}


	if ($('#orderForm_bill_country_code').val() == CART.united_states_country_code) {
		if ($('#orderForm_bill_state_code').val().length == 0) {
			$('#orderForm_bill_state_code-msg').show();
			$('#orderForm_bill_state_code').css('border-color', '#d00');
			isValid = false;
		} else {
			$('#orderForm_bill_state_code-msg').hide();
			$('#orderForm_bill_state_code').css('border-color', '#959595');
		}
	} else {
		if ($('#orderForm_bill_state').val().length == 0) {
			$('#orderForm_bill_state-msg').show();
			$('#orderForm_bill_state').css('border-color', '#d00');
			isValid = false;
		} else {
			$('#orderForm_bill_state-msg').hide();
			$('#orderForm_bill_state').css('border-color', '#959595');
		}
	}


    // -----Payment validation ------------
    if ($('#orderForm_card_number').val().length > 0) {
	    
	    validator.validate($('#orderForm_card_number').val(), function(result) {
		    if (result.error) {
		        alert("There was an error validating your card, please try again.");
		        $('#orderForm_card_number-msg').show();
	        	$('#orderForm_card_number').css('border-color', '#d00');
	        	isValid = false;
		    } else {
		    	if (result.luhn_valid && result.length_valid) {
		    		normalized_ccnum = result.ccnum;
		    		card_type = result.type
		    	} else {
		    		normalized_ccnum = null;
		    		$('#orderForm_card_number-msg').show();
	        		$('#orderForm_card_number').css('border-color', '#d00');
	        		isValid = false;
		    	}
		    }
		});
	}


	if (!validCVV($('#orderForm_ccv').val())) {
		$('#orderForm_ccv-msg').show();
        $('#orderForm_ccv').css('border-color', '#d00');
        isValid = false;
	}

    if (!isValid) {
        // alert('We are missing some information.\n   Please review the fields in red.');

		$('html, body').animate({scrollTop: $(document).height()-$(window).height()}, 200);

        $('#process_order_msgbox').show(300);
        // $('#process_order_msgbox').delay(7500).hide(800);
    } else {
    	submitToServer();
    } 

}


function submitToServer() {

	// Put site into wait mode
	var spinner = ajaxWaitingStatus(document.getElementById('checkoutButtonsRow'));
	buttons_suspended = true;
	$('.global_button').addClass('global_button_disable');

	// Load form and cart data into object to be sent to server
	var formVals = ORDERFORM.form_data;

	// Normalize state data depending on country code
	if (ORDERFORM.form_data.country_code == CART.united_states_country_code) {
		formVals.state = ORDERFORM.form_data.state_code;
	}

	if (ORDERFORM.form_data.bill_country_code == CART.united_states_country_code) {
		formVals.bill_state = ORDERFORM.form_data.bill_state_code;
	}

	delete formVals.state_code;
	delete formVals.bill_state_code;

	// Save cart summary data
	formVals.items_total_cost = CART.itemsCostTot();
	formVals.shipping_cost = CART.calcShipping(ORDERFORM.form_data.country_code).cost;

	// Payment data and cart items
	formVals.card_number = normalized_ccnum;
	formVals.card_type = card_type;
	formVals.cart = CART.cartItems;

	$.ajax({
		url: '/api/orders/post-order',
		type: 'POST',
		data: {data: JSON.stringify(formVals)},
		dataType: 'json',
		jsonp: false, // Work around issue where jQuery replaces ?? in JSON data with timestamp (Ticket #8417)
		timeout: 120000,

		success: function(data) {

			spinner.stop();
			buttons_suspended = false;
			$('.global_button').removeClass('global_button_disable');

			if (data.status != 'OK') {
				// alert('There was an problem sending your order to the server, please try again.');

				$('#process_charge_msgbox').show(300);

				return false;
			}

			// Clear cart and order form data
			CART.resetCart();
			CART.saveCartState();
			ORDERFORM.resetFormData();
			ORDERFORM.saveState();

			// Save order confirmation number
			setCookie('order_conf_num', data.payload.order_num);
			window.location.href = thisSiteFullurl + 'order-confirmation';

		},

		error: function(a, b, c) {
			spinner.stop();
			buttons_suspended = false;
			$('.global_button').removeClass('global_button_disable');
			
			alert('There was an problem sending your order to the server, please try again.');
		}
	});

}


// Create a "waiting spinner" centered in given DOM element
function ajaxWaitingStatus(locationTarget) {
    var opts = {
      lines: 13, // The number of lines to draw
      length: 12, // The length of each line
      width: 4, // The line thickness
      radius: 10, // The radius of the inner circle
      corners: 1, // Corner roundness (0..1)
      rotate: 0, // The rotation offset
      color: '#555', // #rgb or #rrggbb
      speed: 1, // Rounds per second
      trail: 60, // Afterglow percentage
      shadow: false, // Whether to render a shadow
      hwaccel: false, // Whether to use hardware acceleration
      className: 'spinner', // The CSS class to assign to the spinner
      zIndex: 2e9, // The z-index (defaults to 2000000000)
      top: 'auto', // Top position relative to parent in px
      left: '440px' // Left position relative to parent in px
    };
    
    var spinner = new Spinner(opts).spin(locationTarget);

    return spinner;
}



