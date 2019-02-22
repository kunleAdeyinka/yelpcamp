const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const cloudinary = require("cloudinary");

const Campground = require("../models/campground");
const middleware = require("../middleware");

const storage = multer.diskStorage({
    filename: (req, file, callback) => {
        callback(null, Date.now() + file.originalname);
    }
});

const imageFilter = (req, file, cb) => {
    //accepts image files only
    if(!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)){
        return cb(new Error('Only image files are allowed!.'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: imageFilter });

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});


//show all campgrounds
router.get("/", (req, res) => {
    let noMatch = null;

    if(req.query.search){

        const regex = new RegExp(middleware.escapeRegex(req.query.search), 'gi');

        Campground.find({name: regex}, (err, allCampgrounds) => {
            if(err){
                console.log(err);
            }else{
                if(allCampgrounds.length < 1) {
                    noMatch = "No campgrounds match that query, please try again.";
                }
                res.render("campgrounds/index", { campgrounds: allCampgrounds, noMatch: noMatch });
            }
        });
    }else{
        Campground.find({}, (err, allCampgrounds) => {
            if(err){
                console.log(err);
            }else{
                res.render("campgrounds/index", { campgrounds: allCampgrounds, noMatch: noMatch });
            }
        });
    }    
});

//add a new campground
router.post("/", middleware.isLoggedIn,  upload.single('image'), (req, res) => {

    var locationArray = [];

    axios.get("https://api.mapbox.com/v4/geocode/mapbox.places/" + req.body.campground.location + ".json?access_token=pk.eyJ1IjoiYWFkZXlpbmthMDA3IiwiYSI6ImNqcTk0ZWptZTB2YWM0M2s0dm4ycHBhazEifQ.4Lz7IcxUsjLrskOC6z0cPQ")
    .then(response => {
        locationArray = response.data.features[0].geometry.coordinates;
        
        if(!locationArray.length){
            req.flash("error", "Invalid Address");
            return res.redirect("back");
        }

        var lat = locationArray[1];
        var lng = locationArray[0];
    
        cloudinary.uploader.upload(req.file.path, (result) => {
            // add cloudinary url for the image to the campground object under image property
            req.body.campground.image = result.secure_url;
            req.body.campground.imageId = result.public_id;
            // add author to campground
            req.body.campground.author = {
                id: req.user._id,
                username: req.user.username
            };

            var newCampground = { 
                name: req.body.campground.name, 
                price: req.body.campground.price, 
                image: req.body.campground.image, 
                imageId: req.body.campground.imageId,
                description: req.body.campground.description, 
                author: req.body.campground.author,
                location: req.body.campground.location,
                lat: lat,
                lng: lng 
            };

            Campground.create(newCampground, (err, newlyCreated) => {
                if(err){
                    req.flash('error', err.message);
                    return res.redirect('back');
                }else{
                    console.log(newlyCreated);
                    res.redirect("/campgrounds/") + + newlyCreated.id;
                }
            });
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
router.put("/:id", middleware.checkCampgroundOwnerShip, upload.single('image'), (req, res) => {
    
    Campground.findById(req.params.id, async (err, foundCampground) => {
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        }else{
            foundCampground.name = req.body.campground.name;
            foundCampground.price = req.body.campground.price;
            foundCampground.description =  req.body.campground.description;

            let locationObj = {};
            

            if(req.body.campground.location !== foundCampground.location){

                locationObj =  await middleware.fetchLocation(req.body.campground.location, req, res);
                
                foundCampground.lat = locationObj.center[1];
                foundCampground.lng = locationObj.center[0];
                foundCampground.location = locationObj.place_name;
            }

            if(req.file){
                try{
                    await cloudinary.v2.uploader.destroy(foundCampground.imageId); 
                    let result = await cloudinary.v2.uploader.upload(req.file.path);
                    
                    console.log(result);

                    //foundCampground.imageId = result.public_id;
                    //foundCampground.image = result.secure_url; 
                }catch(err){
                    req.flash("error", err.message);
                   return res.redirect("back");
                }                                                
            }

            foundCampground.save();
            req.flash("success","Successfully Updated!");
            res.redirect("/campgrounds/" + foundCampground._id);
        }
        
        
    });   
});

// destroy campground route
router.delete("/:id", middleware.checkCampgroundOwnerShip, (req, res) => {
    Campground.findById(req.params.id, async (err, foundCampground) => {
        if(err){
            req.flash("error", "Cannot find Campground");
            res.redirect("/campgrounds");
        }
        try{
            await cloudinary.v2.uploader.destroy(foundCampground.imageId); 
            foundCampground.remove();
            req.flash("success", "Campground was deleted")
            res.redirect("/campgrounds");
        }catch(err){
            req.flash("error", err.message);
           return  res.redirect("back");
        }            
    });
});

module.exports = router;