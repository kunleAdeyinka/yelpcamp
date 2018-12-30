const express = require("express");
const router = express.Router();
const passport = require("passport");

const User = require("../models/user");
const keys = require("../config/keys");

// index route
router.get("/", (req, res) => {
    res.render("landing");
});

// registration to show the form
router.get("/register", (req, res) => {
    res.render("register");
});
//submit registration information
router.post("/register", (req, res) => {
    let newUser = new User({ username: req.body.username});

    if(req.body.admincode === keys.adminCode){
        newUser.isAdmin = true;
    }

    User.register(newUser, req.body.password, (err, user) => {
        if(err){
            req.flash("error", err.message);
            return res.render("register");
        }

        passport.authenticate("local")(req, res, () => {
            req.flash("success", "Welcome to YelpCamp " + user.username);
            res.redirect("/campgrounds");
        });
    });
});

// show login page
router.get("/login", (req, res) => {
    res.render("login");
});

// submit login information
router.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
        
    }), (req, res) => {
   
});

//logout of the application
router.get("/logout", (req, res) => {
    req.logout();
    req.flash("success", "Logged you out!");
    res.redirect("/campgrounds");
});
module.exports = router;


