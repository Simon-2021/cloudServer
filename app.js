var express = require("express");
var http = require("http");
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var logger = require('morgan');
var path = require('path');
var index = require('./routes/index');

var app = express();

app.set("views",__dirname+"/views");
// app.set("view engine","ejs");
app.engine("html",require("ejs").__express);
app.set('view engine', 'html');

app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api',index);

app.listen(3000, '192.168.0.106', function(){
    console.log("The server of gp is created at the port of 3000.");
});

module.exports = app;
// app.use(function(req, res, next) {
//    var err = new Error('Not Found');
//    err.status = 404;
//    next(err);
//  });

// app.use(function(err, req, res, next) {
//     res.status(err.status || 500);
//     res.render('error', {
//         status: err.status,
//         message: err.message
//     });
// });

// var routes = require('./routes');
// app.get('/', routes.index);
// app.post('/api/login', routes.login);
// app.get('/about', routes.about);
// app.get('/info', routes.info);
