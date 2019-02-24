const express = require("express");
const router = express.Router();
const axios = require("axios");
const multer = require("multer");
const cloudinary = require("cloudinary");

const Campground = require("../models/campground");
const User = require("../models/user");
const Notification = require("../models/notification");
const Review = require("../models/review");

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
router.post("/", middleware.isLoggedIn,  upload.single('image'), async (req, res) => {

    let locationObj = await middleware.fetchLocation(req.body.campground.location, req, res);
    let result = {};

    if(req.file){
        try{
            result = await cloudinary.v2.uploader.upload(req.file.path);
        }catch(err){
            req.flash("error", err.message);
            return res.redirect("back");
        } 
        
    }

    let author = {
        id: req.user._id,
        username: req.user.username
    };


    let newCampground = {
        name: req.body.campground.name, 
        price: req.body.campground.price, 
        image: result.secure_url, 
        imageId: result.public_id,
        description: req.body.campground.description, 
        author: author,
        location: req.body.campground.location,
        lat: locationObj.center[1],
        lng: locationObj.center[0] 
    };

    try {
        let campground = await Campground.create(newCampground);
        let user = await User.findById(req.user._id).populate('followers').exec();
        let newNotification = {
            username: req.user.username,
            campgroundId: campground.id
        };

        for(const follower of user.followers) {
            let notification = await Notification.create(newNotification);
            follower.notifications.push(notification);
            follower.save();
        }

        res.redirect(`/campgrounds/${campground.id}`);
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
});


// show create new campground form
router.get("/new", middleware.isLoggedIn,  (req, res) => {
    res.render("campgrounds/new");
});

// show a particular campground
router.get("/:id", (req, res) => {
    Campground.findById(req.params.id).populate("comments").populate({
        path: "reviews",
        options: {sort: {createdAt: -1}}
    }).exec((err, foundCampground) => {
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
    
    //protect the campground.rating field from manipulation
    delete req.body.campground.rating;

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

                    foundCampground.imageId = result.public_id;
                    foundCampground.image = result.secure_url; 
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
        }else{
            try{
                await cloudinary.v2.uploader.destroy(foundCampground.imageId); 
            }catch(err){
                req.flash("error", err.message);
               return  res.redirect("back");
            } 
            Comment.remove({"_id": {$in: foundCampground.comments}}, (err) => {
                if (err) {
                    console.log(err);
                    return res.redirect("/campgrounds");
                }
                Review.remove({"_id": {$in: foundCampground.reviews}}, (err) => {
                    if (err) {
                        console.log(err);
                        return res.redirect("/campgrounds");
                    }
                    foundCampground.remove();
                    req.flash("success", "Campground was deleted")
                    res.redirect("/campgrounds");
                });
            });   
        }
              
    });
});


module.exports = router;