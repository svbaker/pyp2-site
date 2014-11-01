

var PROD_FUNC = {

	ops_function: 'prod',
	domFieldPrefix: '#prod_fields_',

	init: function() {
		// Set up function specific event handlers and settings
		$('#prod_fields_cat_code').change(function() {

			switch ($('#prod_fields_cat_code').val()) {
				case 'MAGNET':
				case 'CARD':
				case 'COUPSIGN':
				case 'CHICKEN-ATTIRE':
					$('#prod_fields_display_type').val('MEDIUM');
					break;
				default:
					$('#prod_fields_display_type').val('SMALL');
			}

			/*
			if ($('#prod_fields_cat_code').val() == 'MAGNET') {
				$('#prod_fields_display_type').val('MEDIUM');
			} else {
				$('#prod_fields_display_type').val('SMALL');
			}
			*/

		});
	},

	filter_menus_loaded: false,

	getImgUploadOptions: function() {

		var thumbSize, fullSize;

		// Possiblr image sizes
		var thumbSizes = {
			SMALL: {width: 77, height: 122},
			MEDIUM: {width: 154, height: 122}
		};

		var fullsizes = {
			SMALL: {width: 606, height: 960},
			MEDIUM: {width: 909, height: 720}
		};

		// Set image sizes based on display_type
        if ($('#prod_fields_display_type').val()) {
        	thumbSize = thumbSizes[$('#prod_fields_display_type').val()];
        	fullSize = fullsizes[$('#prod_fields_display_type').val()];
        } else {
        	thumbSize = thumbSizes.SMALL;
        	fullSize = fullsizes.SMALL;
        }

		return {
			ops_function: PROD_FUNC.ops_function,
			site_path: '/images/site/products/',
			max_files: 1,
			control_code: 'PROD',
			control_rec_id: APP_STATE.current_function_form_edit_id,
			thumb_size: thumbSize,
			full_size: fullSize,
			styles: {
			    thumbSize: 'width:' + thumbSize.width + 'px; height:' + thumbSize.height + 'px;',
			    surroundSize: 'width:' + (3 + thumbSize.width) + 'px; height:' + (3 + thumbSize.height) + 'px;',
			    inputSize: 'width:' + (12 + thumbSize.width) + 'px;',
			    addButtonSize: 'width:' + (3 + thumbSize.width) + 'px; height:' + (+thumbSize.height - 9) + 'px;'
    		}
		}
	},

	setupAddForm: function() {
		// Allow multiple input for new product adds
		$('#prod_fields_size').attr('multiple', 'multiple');
		$('#prod_fields_size').attr('size', 4);
	},

	loadForm: function(edit_id) {

		var html, imgUploadOpts;

		// Only allow single size entries for product edits
		$('#prod_fields_size').removeAttr('multiple');
		$('#prod_fields_size').attr('size', '1');

		// Load edit form from server
	    $.ajax({
		    url: "/ops/ajax/getProd/" + edit_id,
		    type: 'POST',
		    timeout: 10000,
		    dataType: 'json',
		    cache: false,
		    jsonp: false,

		    success: function(data) {
		        if (data.status == 'OK') {
		            populateDOM(data.payload.formData, data.payload.uploadsArray);
		        } else {
		            alert('Debug warning: ' + data.status_text);
		        }
		    },
		    error: function(a, b, c) {
		        alert('Debug warning: Could not reach server to get menus ' + b);
		    }
	    });

	    $('#' + PROD_FUNC.ops_function + 'Form_edit_id').html('<strong>' + edit_id + '</strong>');


	    function populateDOM(formData, uploadsArray) {

	    	var new_li_html = '';

	    	// Load form data
	        $('#' + PROD_FUNC.ops_function + 'Form_form').find('input,select,textarea').each(function(i) {
				$('#' + $(this).attr('id')).val(formData[$(this).attr('id').slice(PROD_FUNC.ops_function.length + 8)]);
	        });


			// Set up image upload area
			$('#prodForm_uploads_list').empty();
			imgUploadOpts = PROD_FUNC.getImgUploadOptions();
			imgUploadOpts.control_rec_id = edit_id;

			$('#prodForm_uploads_list').append(genImgUploadHtml(imgUploadOpts));

	        UploaderTimerId = setInterval(function() {
	            if($('#' + PROD_FUNC.ops_function + '_userImageInput').val() !== '') {
	                clearInterval(UploaderTimerId);
	                $('#' + PROD_FUNC.ops_function + '_image_uploadForm').submit();
	            }
	        }, 500);

	        // Attache submit handler for new file upload form
	        $('#' + PROD_FUNC.ops_function + '_image_uploadForm').submit(imageUploadSubmitFunction);
	        // ---------------


	        // Load any uploaded images
	        if (uploadsArray) {

	            for (var i = 0; i < uploadsArray.length; i++) {

	                new_li_html += '<li class="form_image-box active" data-dbid="' + uploadsArray[i].id +'" style="' + imgUploadOpts.styles.surroundSize + '">';
	                new_li_html += '<div class="form_image-container" style="';
	                new_li_html += 'background: url(/images/site/products/' + uploadsArray[i].hash + '_thumb.' + uploadsArray[i].file_ext + ') no-repeat left top;';
	                new_li_html += 'background-position: center;';
	                new_li_html += 'background-size: cover;' + imgUploadOpts.styles.thumbSize;
	                new_li_html += '"><a href="#" class="remove"></a>';
	                new_li_html += '<a href="' + uploadsArray[i].file_url + '" rel="lightbox" title="" class="preview"></a>';
	                new_li_html += '</div></li>';

	            }

	            $('#' + PROD_FUNC.ops_function + '_image_add').before(new_li_html)

	            $('#' + PROD_FUNC.ops_function + 'Form_uploads_list > li').slice(imgUploadOpts.max_files).remove();

	        }

	        // Set image size help display
	        $('#prodForm').find('.img-size-help').html(imgUploadOpts.full_size.width + ' x ' + imgUploadOpts.full_size.height);

	    }

	},

	getMenus: function(callback) {
		// Load form specific menus from server and populate DOM with results
		$.ajax({
            url: "/ops/ajax/getProdMenus",
            type: 'GET',
            timeout: 10000,
            dataType: 'json',
            success: function(data) {
                if (data.status == 'OK') {
                    $('#prod_fields_cat_code').html(data.payload.prod_cat_menu);
                    $('#prod_fields_size').html(data.payload.prod_size_menu);

                    if (!callback) {
                    	// No callback provided when called from open_func
                    	// So load control panel menus if not already loaded
                    	if (!PROD_FUNC.filter_menus_loaded) {
							$('#prod_filter_cat_code').html('<option value="">-Category-</option>' + data.payload.prod_cat_menu);
							$('#prod_filter_size').html('<option value="">-Size-</option>' + data.payload.prod_size_menu);
                    		PROD_FUNC.filter_menus_loaded = true;
                    	}
                    } else {
                    	// Callback is provided from open_form
                    	// Don't refresh control panel menus
                    }

                    if (callback) {
                        callback();
                    }
                } else {
                    alert('Debug warning: ' + data.status_text);
                }

            },
            error: function(a, b, c) {
                alert('Debug warning: Could not reach server to get menus ' + b);
            }
		});

	},



	postForm: function() {
		// Post EDIT or INSERT form to server

		var ops_function = PROD_FUNC.ops_function;
	    var domPrefix = PROD_FUNC.domFieldPrefix;

	    // Validate form data
	    var is_valid = true;

	    // Check all standard required fields
	    $('#' + ops_function + 'Form').find('.required').each(function(i) {
	        if ($(this).val()) {
	        	// Good data, remove any validation warning style
	            $(this).css('border-color', '');
	        } else {
	        	// Missing data, highlight element
	            $(this).css('border-color', '#d00');
	            is_valid = false;
	        }
	    });


	    // Check each number field for numeric values
	    if (!isNumber($(domPrefix + 'on_hand').val())) {
	        $(domPrefix + 'on_hand').css('border-color', '#d00');
	        is_valid = false;
	    } else {
	        $(domPrefix + 'on_hand').css('border-color', '');
	    }

	    // Warn user and end process if any validation failed
	    if (!is_valid) {
	        alert('You are missing required data.');
	        return false;
	    }

	    // Form data is ready to be posted to server
	    var post_data = {}
	    var handler;

	    // Load each standard field into the post_data object
	    $('#' + ops_function +'Form_form').find('input,select,textarea').each(function(i) {
	    	if ($(this).attr('id')) {
	    		post_data[$(this).attr('id').slice(ops_function.length + 8)] = $('#' + $(this).attr('id')).val();
	    	}
	    });


	    // Pick server handler based on mode
	    if (APP_STATE.current_function_form_mode == 'INSERT') {
	        handler = 'addProd';
	    } else {
	        handler = 'updateProd';
	        // Set edit id value to support update process
	        post_data.prod_id = APP_STATE.current_function_form_edit_id;
	    }

	    post_data.ACCESS_TOKEN = ACCESS_TOKEN;

	    // Post data to server
	    $.ajax({
	        url: "/ops/ajax/" + handler,
	        type: 'POST',
	        timeout: 10000,
	        dataType: 'json',
	        data: {data: JSON.stringify(post_data)},
	        jsonp: false,

	        success: function(data) {
	            if (data.status == 'OK') {
	
	                // Mark form as unchanged
	                $('#' + ops_function + 'Form').data('changePending', false);

	                if (APP_STATE.current_function_form_mode == 'INSERT') {
	                	// Go to edit page - first of n records created
	                	close_form(ops_function, function() {
	                		edit(data.payload.ids[0]);
	                	});
	                } else {
	                	// Go to list page
	                	filterList(ops_function);
	                }

	            } else {
	                alert('Debug warning: ' + data.status_text);
	            }

	        },
	        error: function(a, b, c) {
	            alert('Debug warning: Could not reach server to update product ' + b);
	        }
	    });

	}


};





