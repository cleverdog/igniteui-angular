(function () {
    const baseUrl = $('body').data('base-url');
    const versionsJson = $('body').data('api-versions-json');

    $.ajax({
        url: versionsJson,
        type: "get",
        xhrFields: {
            withCredentials: false
        }
    }).done((data) =>  {
        const folders = data.folders;
        const select = $('#versions')

        folders.forEach(f => {
            select.append($('<option>', {
                value: `${baseUrl}/angular-docs/${f}/typescript`,
                text: f
            }));
        });

        if (sessionStorage.apiVersion) {
            select.val(sessionStorage.apiVersion);
        }
    });

    $('#versions').on('change', (...rest) => {
        const val = $('#versions').val();
        sessionStorage.apiVersion = val;
        window.location.replace(val);
    });
})();
