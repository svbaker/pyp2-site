var timerId;
var contest_entries_id;


$(document).ready(function() {

    timerId = setInterval(function() {
        if($('#userPhotoInput').val() !== '') {
            clearInterval(timerId);
             $('#uploadForm').submit();
        }
    }, 500);

    $('#uploadForm').submit(submitFunction);



    $('#formSubmit').click(function(e) {

        err_status = false;

        e.preventDefault();
        var filesToUpload = document.getElementById('userPhotoInput').files.length;
        
        if (filesToUpload == 0) {
            err_status = true;
            $('#photo-msg').show();
        }

        $('.requiredField').each(function() {
            if ($(this).val().length == 0) {
                err_status = true;
                $('#' + $(this).attr('id') + '-msg').show();
            }
        });


        if ($('#contest_email').val().length > 0) {
            if (!validEmail($('#contest_email').val())) {
                err_status = true;
                $('#contest_email-msg').show();
            } else {
                if ($('#contest_email').val() != $('#contest_email2').val()) {
                    err_status = true;
                    $('#contest_email2-msg').show();
                }
            }
        }

        if (err_status) {
            $('#contest_status_msg').show();
            return false;
        } else {
            submitEntry();
            return false;
        }
    });



    $('.requiredField').focus(function() {
        $('#contest_status_msg').hide();
        var msgid = '#' + $(this).attr('id') + '-msg';
        $(msgid).hide();
    });

/*
    $('.requiredField').blur(function() {
        if ($(this).val().length == 0) {
            $('#' + $(this).attr('id') + '-msg').show();
        }
    })
*/

    $('.button-remove').click(function(e) {
        e.preventDefault();
        contest_entries_id = null;
        $('.removeBox').hide();
        $('.removeBox').css('background-image', '');
        $('.upload-container').show();
        $('.uploadBox').show();

        document.getElementById("uploadForm").reset();
        timerId = setInterval(function() {
            if($('#userPhotoInput').val() !== '') {
                clearInterval(timerId);
                 $('#uploadForm').submit();
            }
        }, 500);

    });

});



function submitEntry() {

    var formVals = {
        id: contest_entries_id,
        name: $('#contest_name').val(),
        email: $('#contest_email').val(),
        phone: $('#contest_phone').val(),
        breed_id: $('#contest_breed').val()
    };

    $.ajax({
      
      url: '/contestSubmit',
      type: 'POST',
      data: JSON.stringify(formVals),
      contentType: "application/json; charset=utf-8",
      processData: false,
      dataType: 'json',
      timeout: 10000,
      success: function(data) {
        //window.location.replace("http://www.pamperyourpoultry.com/thankyou.asp");
        alert('Entry succeeded.');
        },

      error: function(a, b, c) {
        alert('Server error posting form: ' + b);
        }
    });


}

var submitFunction = function() {
    var filesToUpload = document.getElementById('userPhotoInput').files.length;
    $('#photo-msg').hide();
    var spinner = ajaxWaitingStatus(document.getElementById('image_add'));
    $('#loading_pane').show();


    // IMPORTANT: FireFox needs to expect JSON response as dataType "text"
    $(this).ajaxSubmit({
        dataType: 'text',

        error: function(xhr) {
            spinner.stop();
            $('#loading_pane').hide();
            alert('Error: ' + xhr.status);
        },

        success: function(response) {
            spinner.stop();

            res = JSON.parse(response);
            var thumbWidth = res.width;

            $('#loading_pane').hide();

            $('.button-remove').css('left', thumbWidth - 20 + 'px');
            
            contest_entries_id = res.id;
            $('.removeBox').css('background-image', 'url(' + res.img_thumb_path + ')');
            // $('.removeBox').css('background-repeat', 'no-repeat');

            $('.upload-container').hide();
            $('.uploadBox').hide();
            $('.removeBox').show();

            if(res.error){
                alert(res.error);
                return;
            }

        }
    });

    // Stop form from submitting and causing a refresh
    return false;

}

function ajaxWaitingStatus(locationTarget) {
    var opts = {
        lines: 13, // The number of lines to draw
        length: 7, // The length of each line
        width: 4, // The line thickness
        radius: 10, // The radius of the inner circle
        corners: 1, // Corner roundness (0..1)
        rotate: 0, // The rotation offset
        color: '#fff', // #rgb or #rrggbb
        speed: 1, // Rounds per second
        trail: 60, // Afterglow percentage
        shadow: false, // Whether to render a shadow
        hwaccel: false, // Whether to use hardware acceleration
        className: 'spinner', // The CSS class to assign to the spinner
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        top: 'auto', // Top position relative to parent in px
        left: 'auto' // Left position relative to parent in px
    };
    
    var spinner = new Spinner(opts).spin(locationTarget);

    return spinner;
}
