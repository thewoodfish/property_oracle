// imports
const express = require('express');
const app = express();
const port = 4000;

// static files
app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/js', express.static(__dirname + 'public/js'));
app.use('/img', express.static(__dirname + 'public/img'));

// set views
app.set('views', './views');
app.set('view engine', 'ejs');

app.get('', (req, res) => {
    res.render('index', { text: 'This is sparta' });
});

app.get('/new-user', (req, res) => {
    createNewUser(req.body, res);
});

// handler functions
async function createNewUser(req, res) {

}


// listen on port 3000
app.listen(port, () => console.info(`listening on port ${port}`));