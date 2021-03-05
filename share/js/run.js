$(function() {
    $("div.run").each(function() {
        var root = $(this);

        var run_id = root.attr('data-run-id');
        var run_uri = base_uri + 'run/' + run_id;
        $.ajax(run_uri, {
            'data': { 'content-type': 'application/json' },
            'success': function(item) {
                var dash = t2hui.dashboard.build_table([item]);
                root.prepend($('<h3>Run: ' + run_id + '</h3>'), dash, $('<hr />'));

                var jobs_uri = run_uri + '/jobs';
                var table = t2hui.run.build_table(jobs_uri, item);
                root.append(table);
            },
        });

    });
});

t2hui.run = {};

t2hui.run.build_table = function(uri, run) {
    var columns = [
        { 'name': 'tools', 'label': 'tools', 'class': 'tools', 'builder': t2hui.run.tool_builder },

        { 'name': 'try', 'label': 'T', 'class': 'count', 'builder': t2hui.run.build_try },

        { 'name': 'pass_count',  'label': 'P', 'class': 'count', 'builder': t2hui.run.build_pass },
        { 'name': 'fail_count',  'label': 'F', 'class': 'count', 'builder': t2hui.run.build_fail },

        { 'name': 'exit',  'label': 'exit',  'class': 'exit', 'builder': t2hui.run.build_exit },

        { 'name': 'name', 'label': 'file/job name', 'class': 'job_name', 'builder': t2hui.run.build_name },
    ];

    var table = new FieldTable({
        'class': 'run_table',
        'id': 'run_jobs',
        'fetch': uri,
        'sortable': run.status == 'running' ? false : true,

        'init': t2hui.run.init_table,

        'modify_row_hook': t2hui.run.modify_row,
        'place_row': t2hui.run.place_row,

        'dynamic_field_attribute': 'fields',
        'dynamic_field_fetch': t2hui.run.field_fetch,
        'dynamic_field_builder': t2hui.run.field_builder,

        'row_redraw_reposition': t2hui.run.redraw_reposition,
        'row_redraw_compare': t2hui.run.redraw_compare,
        'row_redraw_check': t2hui.run.redraw_check,
        'row_redraw_fetch': t2hui.run.redraw_fetch,
        'row_redraw_interval': 1 * 1000,

        'columns': columns,
    });

    return table.render();
};

t2hui.run.redraw_reposition = function(old, item) {
    if (old.status != item.status) { return true }
    if (old.fail_count == 0 && item.fail_count > 0) { return true }
    return false;
}

t2hui.run.redraw_compare = function(old, item) {
    if (old.status != item.status) { return false }
    if (old.pass_count != item.pass_count) { return false }
    if (old.fail_count != item.fail_count) { return false }
    return true;
}

t2hui.run.redraw_check = function(item) {
    if (item.status == 'pending') { return true }
    if (item.status == 'running') { return true }
    return false;
};

t2hui.run.redraw_fetch = function(item) {
    return base_uri + 'job/' + item.job_key;
};

t2hui.run.build_pass = function(item, col, data) {
    var val = item.pass_count || '0';
    col.text(val);
    col.addClass('count');
};

t2hui.run.build_fail = function(item, col, data) {
    var val = item.fail_count || '0';
    col.text(val);
    col.addClass('count');
};

t2hui.run.build_try = function(item, col, data) {
    var val = item.job_try || '0';
    col.text(val);
    col.addClass('count');
};

t2hui.run.build_exit = function(item, col, data) {
    var val = item.exit_code != null ? item.exit_code : 'N/A';
    col.text(val);
};

t2hui.run.build_name = function(item, col, data) {
    var shrt = item.shortest_file || item.name;
    var lng  = item.file || item.name;

    var tt = t2hui.build_tooltip(col.parent(), lng);
    var tooltable = $('<table class="tool_table"></table>');
    var toolrow = $('<tr></tr>');
    tooltable.append(toolrow);

    var toolcol = $('<td></td>');
    toolcol.append(tt);

    var textcol = $('<td>' + shrt + '</td>');

    toolrow.append(toolcol, textcol);

    col.append(tooltable);
};

t2hui.run.tool_builder = function(item, tools, data) {
    var params = $('<div class="tool etoggle" title="See Job Parameters"><img src="/img/data.png" /></div>');
    tools.append(params);
    params.click(function() {
        $('#modal_body').empty();
        $('#modal_body').text("loading...");
        $('#free_modal').slideDown();

        var uri = base_uri + 'job/' + item.job_key;

        $.ajax(uri, {
            'data': { 'content-type': 'application/json' },
            'success': function(job) {
                $('#modal_body').empty();
                $('#modal_body').jsonView(job.parameters, {collapsed: true});
            },
        });
    });

    var link = base_uri + 'job/' + item.job_key;
    var go = $('<a class="tool etoggle" title="Open Job" href="' + link + '"><img src="/img/goto.png" /></a>');
    tools.append(go);
};

t2hui.run.modify_row = function(row, item) {
    if (item.short_file) {
        if (item.retry == true) {
            row.addClass('iffy_set');
            row.addClass('retry_txt');
        }
        else if (item.status == 'canceled') {
            row.addClass('iffy_set');
        }
        else if (item.status == 'pending') {
            row.addClass('pending_set');
        }
        else if (item.status == 'running') {
            row.addClass('running_set');
            if (item.fail_count > 0) {
                row.addClass('error_set');
            }
        }
        else if (item.fail == true) {
            row.addClass('error_set');
        }
        else {
            row.addClass('success_set');
        }
    }
};

t2hui.run.field_builder = function(data, name) {
    var it;
    data.fields.forEach(function(field) {
        if (field.name === name) {
            it = field.data;
            return false;
        }
    });

    return it;
};

t2hui.run.field_fetch = function(field_data, item) {
    return base_uri + 'job/' + item.job_key;
};

t2hui.run.build_jobs = function(run_id) {
    var root = $('<div class="run" data-run-id="' + run_id + '"></div>');
    var uri = base_uri + 'run/' + run_id + "/jobs";
    var table = t2hui.run.build_table(uri);
    root.append(table);
    return root;
};

t2hui.run.init_table = function(table, state) {
    var body = state['body'];

    state['fail'] = $('<tr class="job_index fail"></tr>');
    body.append(state['fail']);

    state['running'] = $('<tr class="job_index running"></tr>');
    body.append(state['running']);

    state['pending'] = $('<tr class="job_index pending"></tr>');
    body.append(state['pending']);

    state['other'] = $('<tr class="job_index other"></tr>');
    body.append(state['other']);

    state['retry'] = $('<tr class="job_index retry"></tr>');
    body.append(state['retry']);
}

t2hui.run.place_row = function(row, item, table, state) {
    console.log(item);
    if (!item.short_file) {
        state['header'].after(row);
        return true;
    }

    if (item.retry) {
        state['retry'].before(row);
        return true;
    }

    if (item.fail_count > 0 && item.status == 'running') {
        state['fail'].after(row);
        return true;
    }

    if (item.fail_count > 0) {
        state['fail'].before(row);
        return true;
    }

    if (item.status == 'running') {
        state['running'].before(row);
        return true;
    }

    if (item.status == 'pending') {
        state['pending'].before(row);
        return true;
    }

    state['other'].before(row);
    return true;
};
