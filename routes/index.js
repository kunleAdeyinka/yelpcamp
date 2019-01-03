const express = require("express");
const router = express.Router();
const passport = require("passport");
const async = require("async");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const User = require("../models/user");
const Campground = require("../models/campground");
const keys = require("../config/keys");
const middleware = require("../middleware");


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
    let newUser = new User({ 
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        avatar: req.body.avatar
    });

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

// forgot password route
router.get("/forgot", (req, res) => {
    res.render("forgot");
});

// forgot password form post
router.post("/forgot", (req, res, next) => {
    async.waterfall([
        (done) => {
            crypto.randomBytes(20, (err, buf) => {
                const token = buf.toString("hex");
                done(err, token);
            });
        },(token, done) => {
            User.findOne({ email: req.body.email }, (err, foundUser) => {
                if(!foundUser){
                    req.flash("error", "No account with that email address exists.");
                    return res.redirect("/forgot");
                }

                foundUser.resetPasswordToken = token;
                foundUser.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                foundUser.save((err) => {
                    done(err, token, foundUser);
                });
            });
        },(token, foundUser, done) => {
            const smtTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "quantum.analytica.test@gmail.com",
                    pass: process.env.GMAILPW
                }
            });
            const mailOptions = {
                to: foundUser.email,
                from: "quantum.analytica.test@gmail.com",
                subject: "YelpCamp.com Password Reset",
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtTransport.sendMail(mailOptions, (err) => {
                console.log('mail sent');
                req.flash("success", "An e-mail has been sent to " + foundUser.email + " with further instructions.");
                done(err, 'done');
            });
        }
    ], (err) => {
        if(err) return next(err);
        res.redirect("/forgot");
    });
});

// localets the user and sets the reset token
router.get("/reset/:token", (req, res) => {
    User.findOne({ 
        resetPasswordToken: req.params.token, 
        resetPasswordExpires: { $gt: Date.now() } }, 
        (err, foundUser) => {
            if(!foundUser){
                req.flash("error", "Password reset token is invalid or has expired.");
                return res.redirect("/forgot");
            }
            res.render("reset", {token: req.params.token});
        }
    );
});

// route to enter new password and confirm the password
router.post("/reset/:token", (req, res) => {
    async.waterfall([
        (done) => {
            User.findOne({ 
                resetPasswordToken: req.params.token, 
                resetPasswordExpires: { $gt: Date.now() } 
            }, (err, foundUser) => {
                if (!foundUser) {
                    req.flash("error", "Password reset token is invalid or has expired.");
                    return res.redirect("back");
                }

                if(req.body.password === req.body.confirm) {
                    foundUser.setPassword(req.body.password, (err) => {
                        foundUser.resetPasswordToken = undefined;
                        foundUser.resetPasswordExpires = undefined;
          
                        foundUser.save((err) => {
                            req.logIn(foundUser, (err) => {
                                done(err, foundUser);
                            });
                        });
                    })
                } else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect("back");
                }
            });
        },(foundUser, done) => {
            const smtTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "quantum.analytica.test@gmail.com",
                    pass: process.env.GMAILPW
                }
            });

            const mailOptions = {
                to: foundUser.email,
                from: 'quantum.analytica.test@gmail.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                'This is a confirmation that the password for your account ' + foundUser.email + ' has just been changed.\n'
            };

            smtTransport.sendMail(mailOptions, (err) => {
                req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
        }
    ], (err) => {
        if(err) return next(err);
        res.redirect("/campgrounds");
    });
});

// user profiles
router.get("/users/:id", middleware.isLoggedIn, (req, res) => {
    User.findById(req.params.id, (err, foundUser) => {
        if(err){
            req.flash("error", "Something went wrong.");
            res.redirect("/");
        }
        Campground.find().where('author.id').equals(foundUser._id).exec((err, campgrounds) => {
            if(err){
                req.flash("error", "Something went wrong.");
                res.redirect("/");
            }
            res.render("users/show", {user: foundUser, campgrounds: campgrounds});
        });
    });
});
module.exports = router;


