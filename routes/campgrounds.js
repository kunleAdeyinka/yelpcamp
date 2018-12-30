const express = require("express");
const router = express.Router();
const axios = require("axios");

const Campground = require("../models/campground");
const middleware = require("../middleware");

const url = ''


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

    var campName = req.body.name;
    var campImage = req.body.image;
    var description = req.body.description;
    var price = req.body.price;
    var locationArray = [];
    var author = {
        id: req.user._id,
        username: req.user.username
    };

    axios.get("https://api.mapbox.com/v4/geocode/mapbox.places/" + req.body.location + ".json?access_token=pk.eyJ1IjoiYWFkZXlpbmthMDA3IiwiYSI6ImNqcTk0ZWptZTB2YWM0M2s0dm4ycHBhazEifQ.4Lz7IcxUsjLrskOC6z0cPQ")
    .then(response => {
        locationArray = response.data.features[0].geometry.coordinates;
        
        if(!locationArray.length){
            req.flash("error", "Invalid Address");
            return res.redirect("back");
        }

        var lat = locationArray[1];
        var lng = locationArray[0];
        var location = response.data.features[0].text;
        var newCampground = { 
            name: campName, 
            price: price, 
            image: campImage, 
            description: description, 
            author: author,
            location: location,
            lat: lat,
            lng: lng 
        };

        Campground.create(newCampground, (err, newlyCreated) => {
            if(err){
              console.log(err);  
            }else{
                console.log(newlyCreated);
                res.redirect("/campgrounds");
            }
        });
    
    }).catch(error => {
        console.log(error);
        req.flash("error", "Invalid Address");
        return res.redirect("back");
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