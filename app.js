require('dotenv').config();

const express = require("express");
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const methodOverride = require("method-override");
const flash = require("connect-flash");

const keys = require("./config/keys");
const User = require("./models/user");
//const seedDB = require("./seeds"); //seeds the database with sample data

const commentRoutes = require("./routes/comments");
const campgroundRoutes = require("./routes/campgrounds");
const indexRoutes = require("./routes/index");


const app = express();



//connect to mlab db
mongoose.set('useFindAndModify', false);
mongoose.connect(process.env.mongoURI);
mongoose.connection.once('open', () => {
    console.log('connected to database..Yelpcampdb');
});
//seedDB();

//passport config
app.use(require("express-session")({
    secret: "Once upon a time in history",
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//allow cross origin request
app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));


app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});


app.use(indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);


app.listen(4000, () => {
    console.log("Yelpcamp server has started");
});