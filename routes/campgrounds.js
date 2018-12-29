const express = require("express");
const router = express.Router();

const Campground = require("../models/campground");
const middleware = require("../middleware");


//show all campgrounds
router.get("/", (req, res) => {
    Campground.find({}, (err, allCampgrounds) => {
        if(err){
            console.log(err);
        }else{
            res.render("campgrounds/index", { campgrounds: allCampgrounds });
        }
    });
});

//add a new campground
router.post("/", middleware.isLoggedIn,  (req, res) => {

    let campName = req.body.name;
    let campImage = req.body.image;
    let description = req.body.description;
    let price = req.body.price;
    let author = {
        id: req.user._id,
        username: req.user.username
    };

    let newCampground = { name: campName, price: price, image: campImage, description: description, author: author };
    Campground.create(newCampground, (err, newlyCreated) => {
        if(err){
          console.log(err);  
        }else{
            res.redirect("/campgrounds");
        }

    });
});

// show create new campground form
router.get("/new", middleware.isLoggedIn,  (req, res) => {
    res.render("campgrounds/new");
});

// show a particular campground
router.get("/:id", (req, res) => {
    Campground.findById(req.params.id).populate("comments").exec((err, foundCampground) => {
        if(err || !foundCampground){
            req.flash("error", "Campground not found");
            res.redirect("back");
        }else{
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

//edit campground
router.get("/:id/edit", middleware.checkCampgroundOwnerShip, (req, res) => {
    Campground.findById(req.params.id, (err, foundCampground) => {
        if(err){
            req.flash("error", "Cannot find Campground");
            res.redirect("/campgrounds");
        }else{
            res.render("campgrounds/edit", {campground: foundCampground});
        }    
        
    });        
});

//update campground
router.put("/:id", middleware.checkCampgroundOwnerShip, (req, res) => {
    
    Campground.findByIdAndUpdate(req.params.id, req.body.campground, (err, updateCampground) => {
        if(err){
            req.flash("error", "Cannot find Campground");
            res.redirect("/campgrounds");
        }else{
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

// destroy campground route
router.delete("/:id", middleware.checkCampgroundOwnerShip, (req, res) => {
    Campground.findByIdAndRemove(req.params.id, (err) => {
        if(err){
            req.flash("error", "Cannot find Campground");
            res.redirect("/campgrounds");
        }else{
            res.redirect("/campgrounds");
        }
    });
});

module.exports = router;