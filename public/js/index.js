$(document).ready(function() {

	// Set up Fancy box to display larger product pictures
	$(".fancybox").fancybox();

	// Handle flockPack special add to cart
	$('#flockPackAddButton').click(function(event) {
		event.preventDefault();
		var size = $('#SPEC_flockpack_size').val();
		var prod_id;

		if (!size) {
			alert('Please select your Flock Pack size');
			return false;
		}

		switch (size) {
			case 'Large':
				prod_id = 71;
				break;
			case 'Medium':
				prod_id = 72;
				break;
			case 'Small':
				prod_id = 73;
				break;
			case 'X-Small':
				prod_id = 74;
				break;
		}

		CART.cartItems.push({
			prod_id: prod_id,
			qty: 1,
			name: 'Flock Pack',
			prodSize: size,
			desc: 'Feather Guard',
			price: 38,
			on_hand: 10
		});

		CART.updateCartState();

	});


	// Handle Christmas special add to cart
	$('#christmasAddButton').click(function(event) {
		event.preventDefault();
		var size = $('#SPEC_christmas_size').val();
		var prod_id;

		if (!size) {
			alert('Please select your size');
			return false;
		}

		switch (size) {
			case 'Large':
				prod_id = 97;
				break;
			case 'Medium':
				prod_id = 98;
				break;
			case 'Small':
				prod_id = 99;
				break;
		}

		CART.cartItems.push({
			prod_id: prod_id,
			qty: 1,
			name: 'Dress Set',
			prodSize: size,
			desc: 'Golden Gala',
			price: 24.95,
			on_hand: 1
		});

		CART.updateCartState();

	});

});
