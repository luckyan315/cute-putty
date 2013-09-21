
/**
 * Module dependencies.
 */

var express = require('express')
, routes = require('./routes')
, user = require('./routes/user')
, http = require('http')
, path = require('path');


var socketIo = require('socket.io');
var pty = require('pty.js');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/term', function(req, res, next){
  res.render('terminal');
});

var httpServer = http.createServer(app);

var socket = null;
    
/* Pseudo terminal   process.env.SHELL */
var term = pty.fork('bash', [], {
  name: 'xterm',
  cols: 80,
  rows: 24,
  cwd: process.env.HOME
});
term.on('data', function(data){
  if( socket ){
    socket.emit('data', data);
  }

});

var io = socketIo.listen(httpServer);

io.sockets.on("connection", function(client) {
  console.log('socket.io connected!');

  socket = client;
  
  client.on('data', function(data){
    term.write(data);
  });

  client.on('disconnect', function(){
    socket = null;
  });
});

httpServer.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
