require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { nanoId } = require('nanoid');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const otpGenerator = require('otp-generator');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');




//question array
const questionArray = [
    "Who would you choose as your prom date?",
    "Who's most likely to make your heart skip a beat?",
    "Which celebrity crush resembles your ideal partner?",
    "Who would you share a late-night walk under the stars with?",
    "What's the perfect movie genre for a date night?",
    "Who do you think has the best smile in your batch?",
    "Who's the most likely to give you butterflies?",
    "What’s your ideal first date idea?",
    "Who would you invite for a cozy coffee date?",
    "Which professor would you least want to see on a date?",
    "Who’s the best at pulling off a romantic gesture?",
    "What’s the most romantic spot on campus for a date?",
    "Who would you trust to plan a dream date?",
    "Which fictional couple gives you major relationship goals?",
    "Who’s the most charming person in your department?",
    "Which of your friends would play cupid for you?",
    "What’s the best outfit for a perfect date night?",
    "Who would you serenade with a love song?",
    "If you had to propose, where on campus would you do it?",
    "Who’s the most dateable person in your club/society?"
];

//The number of chance the premium user gets for polling
const premiumUserPollChances = 3;

//Store the user data
const user = {};

// Store the likes data in memory
const likesMap = new Map(); // { email: likeCount }

// Create a map to store users and the list of users they have liked
const userLikesMap = new Map(); // { userEmail: [likedEmail1, likedEmail2, ...] }

//openPool status of premium users, if a user is in this means he or she is premium user no matter whether the toggle is off or on.
const openPoolStatus = {};

//password reset otps
const passwordResetOtp = {};

// // Stores premium users at the current moment for fast I/o
// const premiumUsers = [];
let premiumUsers = {};

//Stores the poll chnaces the premium users have used 
const premiumPollChancesUsed = {};

//Toggle button for open pool for premium users
const toggleOnForOpenPool = {};

//Switch variable for user and fake user.
let isOkToUseUserModel = false;

//No of user in user model, update it as a new user sign ups
let realUserCount = 0;








const app = express();


// Middleware to parse cookies
app.use(cookieParser());

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());



// Secret key for JWT
const JWT_SECRET = 'helloWorld';



// // MongoDB schema for OTP storage
// const otpSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true },
//     password: { type: String, required: true },
//     otp: { type: String, required: true },
//     createdAt: { type: Date, default: Date.now, expires: 600 }, // Expire after 5 minutes
// });
const otpSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    instaId: { type: String, default: "blitzProm_official" },
    gender: { type: String, enum: ['male', 'female'], required: true }, // Added gender field
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // Expire after 5 minutes
});




//MongoDB schema for user data storage
// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true },
//     password: { type: String, required: true },
// },
//     { timestamps: true });
// const userSchema = new mongoose.Schema({
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     instaId: { type: String, default: null } // Not unique, not required, default set to null
// });


const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    instaId: { type: String, default: "blitzProm_official" }, // Not unique, not required, default set to null
    gender: { type: String, enum: ['male', 'female',], required: true },
    likes: { type: Number, required: true, default: 0 } // Default value is 0
});



const userSchemaFake = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    instaId: { type: String, default: "blitzProm_official" }, // Not unique, not required, default set to null
    gender: { type: String, enum: ['male', 'female',], required: true },
    likes: { type: Number, required: true, default: 0 } // Default value is 0
});


// Leaderboard schema
const leaderboardSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    instaId: { type: String, default: null }, // Not unique, not required, default set to null
    gender: { type: String, enum: ['Male', 'Female'], required: true },
    likes: { type: Number, required: true, default: 0 }
});

//Exhausted poll users
const exhaustedPollUsersSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' } // Automatically delete after 3 hours
});


// //premium user schema
// const premiumUserSchema = new mongoose.Schema({
//     email: { type: String, required: true, unique: true },
//     purchasedAt: { type: Date, default: Date.now },
//     premiumPeriod: { type: Number, required: true }, // Premium period in seconds
//     expiresAt: {
//         type: Date,
//         default: function () {
//             return new Date(this.purchasedAt.getTime() + this.premiumPeriod * 1000); // premiumPeriod in seconds, convert to milliseconds
//         }
//     }
// });


const premiumUserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    txnID: { type: String, required: true }, // Added required txnID field
    createdAt: { type: Date, default: Date.now },
    premiumPeriod: { type: Number, required: true }, // Premium period in seconds
    toggleOnForOpenPool: { type: Boolean, default: false }, // Default is false
    expiresAt: {
        type: Date,
        default: function () {
            return new Date(this.createdAt.getTime() + this.premiumPeriod * 1000); // Convert seconds to milliseconds
        }
    }
});

// Create a TTL index on `expiresAt` field, which will delete the document when `expiresAt` is reached
premiumUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });


// const premiumUserSchema = new mongoose.Schema({
//     email: { type: String, required: true, unique: true },
//     createdAt: { type: Date, default: Date.now },
//     premiumPeriod: { type: Number, required: true }, // Premium period in seconds
//     toggleOnForOpenPool: { type: Boolean, default: false }, // Default is false
//     // Use expires to automatically delete after the premium period has passed
//     expiresAt: {
//         type: Date,
//         default: function () {
//             return new Date(this.createdAt.getTime() + this.premiumPeriod * 1000); // premiumPeriod in seconds, converted to milliseconds
//         },
//         expires: function () {
//             // Calculate expiry time in seconds (automatically removes the document after this time)
//             return this.premiumPeriod; // in seconds
//         }
//     }
// });


// const premiumUserSchema = new mongoose.Schema({
//     email: { type: String, required: true, unique: true },
//     purchasedAt: { type: Date, default: Date.now },
//     premiumPeriod: { type: Number, required: true }, // Premium period in seconds
//     expiresAt: {
//         type: Date,
//         default: function () {
//             return new Date(this.purchasedAt.getTime() + this.premiumPeriod * 1000); // premiumPeriod in seconds, convert to milliseconds
//         }
//     },
//     toggleOnForOpenPool: { type: Boolean, default: false } // Default is false
// });


// Define the schema for user likes
const userLikesSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, unique: true },
    likedEmails: { type: [String], default: [] } // Array of liked user emails
});









const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

const exhaustedPollUsers = mongoose.model('exhaustedPollUsers', exhaustedPollUsersSchema);

//Model for otp
const OtpModel = mongoose.model('Otp', otpSchema);

//Model for user
const userModel = mongoose.model('users', userSchema);

//Model for user
const userModelFake = mongoose.model('usersModelFake', userSchemaFake);

//premium user model
const premiumUserModel = mongoose.model('premiumUsers', premiumUserSchema);
// 
// Create the model
const userLikesMapModel = mongoose.model("userLikesMap", userLikesSchema);









// Nodemailer transporter (configure with your email service)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '2023uee1511@mnit.ac.in',
        pass: 'enthusiast',
    },
});









async function syncUserLikesMapToDb() {
    try {
        console.log("Syncing user likes to DB...");

        // Iterate over userLikesMap and update the database
        for (const [userEmail, likedEmails] of userLikesMap.entries()) {
            await userLikesMapModel.findOneAndUpdate(
                { userEmail: userEmail },
                { likedEmails: likedEmails },
                { upsert: true } // Create a new document if it doesn't exist
            );
        }

        console.log("User likes successfully synced to DB.");
    } catch (error) {
        console.error("Error syncing user likes to DB:", error);
    }
}



//Initial fetching of the data of userLikedMap from the Db
async function loadUserLikesMapFromDb() {
    try {
        console.log("Loading user likes from DB...");
        const userLikesList = await userLikesMapModel.find();

        // Populate the userLikesMap
        userLikesMap.clear(); // Clear old data before reloading
        userLikesList.forEach(user => {
            userLikesMap.set(user.userEmail, user.likedEmails);
        });

        console.log("User likes loaded successfully:", userLikesMap);
    } catch (error) {
        console.error("Error loading user likes from DB:", error);
    }
}




// async function syncPremiumUsersForwithInitializationOfTheServerOnly() {
//     try {
//         // Fetch the premium users from the database
//         const users = await premiumUserModel.find();

//         // Store the current users in the premiumUsers array
//         users.forEach(user => {
//             premiumPollChancesUsed[user.email] = 0;
//         });

//         console.log(premiumPollChancesUsed);

//         console.log("Premium users synced:", premiumUsers);
//     } catch (error) {
//         console.error("Error syncing premium users:", error);
//     }
// }

async function syncPremiumUsersForwithInitializationOfTheServerOnly() {
    try {
        // Fetch the premium users from the database, instead of only premium users add all the users so that if any new user comes to premium, then his entry is already there with count as 0.
        const users = await userModelFake.find({});

        // Store the current users in the premiumPollChancesUsed object only if not already present
        users.forEach(user => {
            if (!(user.email in premiumPollChancesUsed)) { // Check if user email exists
                premiumPollChancesUsed[user.email] = 1;
            }
        });

        console.log(premiumPollChancesUsed);
        console.log("Premium users synced.");
    } catch (error) {
        console.error("Error syncing premium users:", error);
    }
}




async function syncPremiumUsers() {
    try {
        // Fetch the premium users from the database
        const users = await premiumUserModel.find();

        // Clear the old data in premiumUsers array
        premiumUsers = {};

        // Store the current users in the premiumUsers array
        users.forEach(user => {
            premiumUsers[user.email] = user;
            openPoolStatus[user.email] = user.toggleOnForOpenPool;
            // premiumUsers.push(user.email); // Storing only emails (as per your use case)
        });

        console.log("The open pool status : ", openPoolStatus);
        console.log("Premium users synced:", premiumUsers);
    } catch (error) {
        console.error("Error syncing premium users:", error);
    }
}




//To sysnc the likes data with user collection likes in Db from js object likesMap
const syncLikesWithDB = async () => {
    try {
        if (likesMap.size === 0) return; // If no likes to update, skip

        console.log("Syncing likes with database...");

        //If we are shifted to real user collection
        // Prepare bulk update operations
        const bulkOps = [];
        likesMap.forEach((likeCount, email) => {
            bulkOps.push({
                updateOne: {
                    filter: { email },
                    update: { $set: { likes: likeCount } }
                }
            });
        });

        // Perform bulk update
        if (bulkOps.length > 0) {
            await userModelFake.bulkWrite(bulkOps);
            console.log(`Likes data synced for ${bulkOps.length} users.`);
        }
    } catch (error) {
        console.error("Error syncing likes with DB:", error);
    }
};






// Function to sync in-memory data with DB (optional), this is for user data only.
const syncDataFromDB = async () => {
    try {
        if (isOkToUseUserModel) {//If we shifted to real user collection
            // Fetch the latest data from DB
            const usersFromDB = await userModel.find({});

            // Update the in-memory user object with fresh data from DB
            usersFromDB.forEach(u => {
                user[u.email] = u;  // Refresh the data in memory
            });
        } else {//If we still using fake user collection
            // Fetch the latest data from DB
            const usersFromDB = await userModelFake.find({});

            // Update the in-memory user object with fresh data from DB
            usersFromDB.forEach(u => {
                user[u.email] = u;  // Refresh the data in memory
            });
        }

        console.log("User data synced from DB.");
    } catch (err) {
        console.error("Error syncing data from DB:", err);
    }
};






// Initialize user data and likes on server start
const initializeUserData = async () => {
    try {
        if (isOkToUseUserModel) {
            // Fetch all users from the database
            const usersFromDB = await userModel.find({});

            // Store them in the in-memory user object
            usersFromDB.forEach(u => {
                user[u.email] = u;  // Assuming email as unique identifier
                // Initialize like count in likesMap
                likesMap.set(u.email, u.likes || 0);  // Assuming 'likes' field exists on user model
            });
        } else {
            // Fetch all users from the database
            const usersFromDB = await userModelFake.find({});

            // Store them in the in-memory user object
            usersFromDB.forEach(u => {
                user[u.email] = u;  // Assuming email as unique identifier
                // Initialize like count in likesMap
                likesMap.set(u.email, u.likes || 0);  // Assuming 'likes' field exists on user model
            });
        }

        console.log("User obj just after initialization : ", user);
        console.log("Likes map after initializatio :", likesMap);

        console.log("User data initialized in memory:", Object.keys(user).length);
        console.log("Likes data initialized in memory:", likesMap.size);

    } catch (err) {
        console.error("Error initializing user data:", err);
    }
};




// Function to generate JWT and set it in the cookie
function generateToken(user) {
    console.log("generating token .....");
    // Create JWT payload with user details
    const payload = {
        email: user.email,
    };

    // Generate JWT token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15d' });

    console.log("From generate token token is :", token);

    // Set cookie with the JWT token (expires in 15 days)
    // const options = {
    //     httpOnly: true,  // Ensures cookie cannot be accessed via JavaScript
    //     secure: process.env.NODE_ENV === 'production', // Ensures cookie is only sent over HTTPS in production
    //     expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),  // 15 days expiration
    //     };

    // Set cookie
    return token;
}

//function to choose random question, returns an array of 10 different questions selected ramdomly !
function getRandomQuestions(questionArray, count = 10) {
    if (questionArray.length === 0) {
        return ["No questions available!"];
    }

    // Shuffle the array to randomize questions
    const shuffledArray = questionArray.sort(() => Math.random() - 0.5);

    // Return the first `count` questions or all questions if less than `count`
    return shuffledArray.slice(0, Math.min(count, questionArray.length));
}

// Function to extract year and branch code from email
function extractYearAndBranch(email) {
    const year = email.substring(0, 4);
    const branchCode = email.substring(4, 7); // Assumes branch code is 3 characters long
    return { year, branchCode };
}



// Function to increment likes for given emails
function incrementLikes(emailArray) {
    emailArray.forEach(email => {
        if (!likesMap.has(email)) {
            likesMap.set(email, 1); // Initialize to 0 if the email is not in the map
        }
        likesMap.set(email, likesMap.get(email) + 1); // Increment the like count
    });
}

// Function to get the current like count for a specific email
function getLikeCount(email) {
    return likesMap.get(email) || 0; // Return 0 if the email is not found
}

// Function to get mutual likes (users whom the current user has liked and vice versa)
function getMutualLikes(currentUserEmail) {
    const mutualLikes = [];
    const likedUsers = getUsersLikedByCurrentUser(currentUserEmail); // Get users liked by the current user

    if (likedUsers.length === 0) {
        return mutualLikes;
    }

    likedUsers.forEach((likedUserEmail) => {
        // Check if the liked user has also liked the current user
        const likedByUser = userLikesMap.get(likedUserEmail) || [];
        if (likedByUser.includes(currentUserEmail)) {
            mutualLikes.push(user[likedUserEmail]);
        }
    });

    return mutualLikes;
}


function getAllUserDataOfLikesSent(emailArray) {
    const newAr = [];

    emailArray.forEach((USER) => {
        newAr.push(user[USER]);
    });

    return newAr;
}


// Function to add likes to the map
function addLikes(userEmail, likedEmailsArray) {
    if (!userLikesMap.has(userEmail)) {
        userLikesMap.set(userEmail, []); // Initialize an empty array if user doesn't exist
    }

    // Get the current list of likes and update it
    const currentLikes = userLikesMap.get(userEmail);

    likedEmailsArray.forEach(email => {
        if (!currentLikes.includes(email)) {
            currentLikes.push(email); // Add the email to the likes if not already present
        }
    });

    userLikesMap.set(userEmail, currentLikes); // Update the map with the new list
}

// // Function to get the list of users liked by a specific user
// function getLikedUsers(userEmail) {
//     return userLikesMap.get(userEmail) || []; // Return the list or an empty array if not found
// }

// Function to get users liked by the current user
function getUsersLikedByCurrentUser(currentUserEmail) {
    // Check if the current user exists in the userLikesMap
    if (userLikesMap.has(currentUserEmail)) {
        return userLikesMap.get(currentUserEmail);
    }
    return []; // Return an empty array if the user hasn't liked anyone
}


// Dummy function to verify JWT (you can replace it with your actual JWT verification logic)
function verifyTokenFunctionally(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Replace with your secret key
        return decoded;
    } catch (error) {
        return null;
    }
}





// Middleware to verify the JWT token and check the session
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1]; // Expecting format: Bearer <token>

    console.log(token);
    if (!token) {
        return res.status(401).json({ message: 'Token not provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token is not valid' });
        }
        req.user = decoded; // Save the decoded token in the request for further use
        next();
    });
}




app.post('/passwordReset', async (req, res) => {
    console.log("Inside password reset");
    try {
        const data = req.body;

        const otp = data.otp;
        const email = data.email;
        const password = data.password;

        if (otp === null) {
            res.status(500).json({ error: 'Invalid OTP' });

        }

        const mail = passwordResetOtp[otp];

        if (mail === null) {
            res.status(500).json({ error: 'Expired OTP' });

        }

        // Find the user by email (which is unique)
        const user = await userModel.findOne({ email });

        if (user === null || user === undefined) {
            return res.status(404).json({ message: 'User not found for updating the profile ....' });
        }

        user.password = password || user.password; // Ideally, hash the password before saving

        // Save the updated user data
        await user.save();

        delete passwordResetOtp.otp;

        return res.status(200).json({ message: 'Password reset successfully', user });
    } catch (error) {
        console.log(error);
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Error resetting password:' });
    }




});






app.post('/passwordResetOtp', async (req, res) => {
    console.log("resest otp req came ...");
    try {
        const data = req.body;

        const email = data.email;



        // Generate a 6-digit OTP
        const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

        // Send OTP via email
        await transporter.sendMail({
            from: '2023uee1511@mnit.ac.in',
            to: email,
            subject: 'Your OTP for resetting password',
            text: `Your OTP is: ${otp}`,
        });

        passwordResetOtp[`${otp}`] = email;

        console.log(passwordResetOtp);

        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.log(error);
        console.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }




});






// Endpoint to handle the plan selection
app.post('/txn', verifyToken, async (req, res) => {
    const { plan, txnId } = req.body;

    if (!plan) {
        return res.status(400).json({ message: 'Email and plan are required' });
    }

    // Check if the user is authenticated via JWT (optional security check)
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const EMAIL = req.user.email;


    let timerDuration;
    switch (Number(plan)) {
        case 1: // 3 hours
            timerDuration = 3 * 60 * 60;
            break;
        case 2: // 12 hours
            timerDuration = 12 * 60 * 60;
            break;
        case 3: // 24 hours
            timerDuration = 24 * 60 * 60;
            break;
        default://15days
            timerDuration = 24 * 60 * 60 * 15;
    }

    // Add email to openPoolStatus
    // openPoolStatus[email] = false;  // Initialize with 'false'
    //Only update this in db with the toggle for open pool as false, rest it will sync to th eserver js file data within one minute

    // Create a new premium user
    const newUser = new premiumUserModel({
        email: EMAIL,
        txnID: txnId,
        premiumPeriod: timerDuration, // 3 hours in seconds
    });

    deleteExhaustedUser(EMAIL);

    // Save the new user document to the database
    newUser.save()
        .then((savedUser) => {
            console.log('Premium user saved:', savedUser);
        })
        .catch((err) => {
            console.error('Error saving premium user:', err);
        });




    // Set the timer based on the selected plan
    // let timerDuration;
    // switch (Number(plan)) {
    //     case 1: // 3 hours
    //         timerDuration = 3 * 60 * 60 * 1000;
    //         break;
    //     case 2: // 12 hours
    //         timerDuration = 12 * 60 * 60 * 1000;
    //         break;
    //     case 3: // 24 hours
    //         timerDuration = 24 * 60 * 60 * 1000;
    //         break;
    //     case 4: // Permanent (never delete)
    //         // No timer needed for plan 4
    //         return res.status(200).json({ message: 'User is now a permanent premium user' });
    //     default:
    //         return res.status(400).json({ message: 'Invalid plan' });
    // }

    // // Set a timeout to delete the user's email after the given time (if not permanent)
    // setTimeout(() => {
    //     delete openPoolStatus[email];
    //     console.log(`Deleted ${email} after ${plan} plan duration.`);
    //     console.log(openPoolStatus);
    // }, 10000);

    console.log("The open pool status : ", openPoolStatus);
    console.log("The premium users : ", premiumUsers);

    return res.status(200).json({ message: `Plan ${plan} applied` });

});




const deleteExhaustedUser = async (email) => {
    try {
        const user = await exhaustedPollUsers.findOne({ email }); // Find user by email

        if (user) {
            await exhaustedPollUsers.deleteOne({ email }); // Delete if found
            console.log(`User with email ${email} deleted.`);
        } else {
            console.log(`User with email ${email} not found.`);
        }
    } catch (error) {
        console.error("Error:", error);
    }
};






// PUT route to update user profile
app.put('/updateProfile', verifyToken, async (req, res) => {
    console.log("Hi from update profile handler ...");
    const { name, branch, year, instaId, password } = req.body;
    const email = req.user.email; // Extract email from JWT token (assuming email is in the payload)

    console.log("The body of the update profile req is : ", req.body);

    try {
        // Find the user by email (which is unique)
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found for updating the profile ....' });
        }

        // Update the user's profile fields
        user.name = name || user.name;
        user.instaId = instaId || user.instaId;
        user.password = password || user.password; // Ideally, hash the password before saving

        console.log("The user from the update section is : ", user);

        // Save the updated user data
        await user.save();

        const USER = await premiumUserModel.findOne({ email });

        console.log("The user from update profile but premium user finding if : ", USER);
        console.log(req.body.isPremiumUser);
        console.log(req.body.upForOpenPool);
        if (req.body.isPremiumUser && USER !== null && USER !== undefined) {
            console.log("hey !");

            USER.toggleOnForOpenPool = req.body.upForOpenPool;




            // Save the updated user data
            const result = await USER.save();
            // const result = await premiumUserModel.updateOne(
            //     { email: `${req.body.email}` },  // Find the user with the provided email
            //     { $set: { toggleOnForOpenPool: `${req.body.upForOpenPool}` } }  // Update the toggleOnForOpenPool field to true
            // );

            // const result = await premiumUserModel.updateOne(
            //     { email: req.body.email },  // Find the user with the provided email
            //     { $set: { toggleOnForOpenPool: Boolean(req.body.upForOpenPool) } }  // Ensure it's a Boolean value
            // );

            // const result = await premiumUserModel.findOneAndUpdate(
            //     { email: req.body.email }, // Find user by email
            //     { $set: { toggleOnForOpenPool: req.body.upForOpenPool === "true" } }
            // );

            // const result = await premiumUserModel.updateOne(
            //     { email: req.body.email },
            //     { $set: { toggleOnForOpenPool: req.body.upForOpenPool } }
            // );

            console.log("The result of updating premiumUser data : ", result);
        }

        return res.status(200).json({ message: 'Profile updated successfully ...', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error updating profile' });
    }
});






//Check if the email format is correct.
app.use('/signUp', (req, res, next) => {
    const reqBody = req.body;

    // Extract the email from the request body
    const email = reqBody.email;

    console.log("emiall : ", email);

    // Define the valid email format using a regular expression
    const emailRegex = /^[2][0-9]{3}[Uu](?:CP|AI|EC|EE|CE|ME|CH|MT|AR|cp|ai|ec|ee|ce|me|ch|mt|ar)[0-9]{4}@mnit\.ac\.in$/;

    if (emailRegex.test(email)) {
        // If the email is valid, proceed to the next middleware or route handler
        // return res.end("hi ....");
        next();
    } else {
        // If the email is invalid, reject the request
        res.status(400).json({ error: 'Invalid email format' });
    }
});
app.use('/login', (req, res, next) => {
    console.log("req get ..... 1 mid ware");
    const reqBody = req.body;

    // Extract the email from the request body
    const email = reqBody.email;

    // Define the valid email format using a regular expression
    const emailRegex = /^[2][0-9]{3}[Uu](?:CP|AI|EC|EE|CE|ME|CH|MT|AR|cp|ai|ec|ee|ce|me|ch|mt|ar)[0-9]{4}@mnit\.ac\.in$/;

    if (emailRegex.test(email)) {
        // If the email is valid, proceed to the next middleware or route handler
        // return res.end("hi ....");
        next();
    } else {
        // If the email is invalid, reject the request
        res.status(400).json({ error: 'Invalid email format' });
    }
});





// Route to get polls (question sets) for the authenticated user
app.get('/polls', verifyToken, async (req, res) => {
    const email = req.user.email; // Extract email from the decoded JWT token

    try {
        console.log("In try of sending options ....");
        //First find the user in the exhausted poll collection
        const emailExists = await exhaustedPollUsers.findOne({ email });

        if (emailExists) {
            return res.status(200).json({ message: 'Exhausted', createdAtTime: emailExists.createdAt });
        }

        // Get the 10 sets of 4 options based on the email
        const optionsSet = await getUserOptions(email);

        // Send the options set and the email of the user as a response
        res.status(200).json({
            email: email,
            options: optionsSet,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching the options : ', error: error.message });
    }
});


//Endpoint for getting liked data of polls session
app.post('/pollsData', async (req, res) => {
    //Get the data of liked user form the user and put the user in exhausted poll user list
    //increse the like counts for each of the user which have name in the list

    try {
        const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Authorization header

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: No token provided while getting liked data ' });
        }

        const decoded = verifyTokenFunctionally(token);
        if (!decoded) {
            return res.status(401).json({ message: 'Unauthorized: Invalid token while getting liked data ' });
        }

        const { userEmail, likedEmails } = req.body;

        // Handle the logic to store the like data, e.g., update the map or database
        console.log('User Email:', userEmail);
        console.log('Liked Emails:', likedEmails);

        incrementLikes(likedEmails);
        addLikes(userEmail, likedEmails);

        console.log(" The user to user like map is :", userLikesMap);
        console.log("Like count map is :", likesMap);

        console.log(premiumUsers);


        // Check if the user is a premium user (using the fast lookup in premiumUsers array)
        // const User = premiumUsers.find(user => user === userEmail);

        const User = premiumUsers[userEmail];

        console.log(User);
        console.log(userEmail);

        if (User) {
            console.log(" in premiun section ...");

            // If the user is a premium user, check if they have used all poll chances
            if (premiumPollChancesUsed[userEmail] >= premiumUserPollChances) {

                // If they have exhausted their chances, save the user to exhaustedPollUsers
                const exhaustedUser = new exhaustedPollUsers({ email: userEmail });
                await exhaustedUser.save();
                premiumPollChancesUsed[userEmail] = 0;
                console.log(`User ${userEmail} has exhausted their polling chances.`);
            } else {
                // If they haven't exhausted their chances, increment the poll chances
                premiumPollChancesUsed[userEmail] += 1;
                console.log(`User ${userEmail} has used another polling chance. Remaining chances: ${premiumUserPollChances - premiumPollChancesUsed[userEmail]}`);
            }
        } else {
            console.log(" in not premiun section ...");
            // If the user is not a premium user, allow them to poll and increment their chances
            const exhaustedUser = new exhaustedPollUsers({ email: userEmail });
            await exhaustedUser.save();
            console.log(`User ${userEmail} has exhausted their polling chances.`);




            // nonPremiumPollChancesUsed[userEmail] = (nonPremiumPollChancesUsed[userEmail] || 0) + 1;
            // console.log(`User ${userEmail} (non-premium) has used a polling chance.`);
        }



        // try {
        //     // Check if the user is a premium user (using the fast lookup in premiumUsers array)
        //     const premiumUser = premiumUsers.find(user => user.email === userEmail);

        //     if (premiumUser) {
        //         // If the user is a premium user, check if they have used all poll chances
        //         if (premiumPollChancesUsed[userEmail] >= premiumUser.pollChances) {
        //             // If they have exhausted their chances, save the user to exhaustedPollUsers
        //             const exhaustedUser = new exhaustedPollUsers({ email: userEmail });
        //             await exhaustedUser.save();
        //             console.log(`User ${userEmail} has exhausted their polling chances.`);
        //         } else {
        //             // If they haven't exhausted their chances, increment the poll chances
        //             premiumPollChancesUsed[userEmail] += 1;
        //             console.log(`User ${userEmail} has used another polling chance. Remaining chances: ${premiumUser.pollChances - premiumPollChancesUsed[userEmail]}`);
        //         }
        //     } else {
        //         // If the user is not a premium user, allow them to poll and increment their chances
        //         nonPremiumPollChancesUsed[userEmail] = (nonPremiumPollChancesUsed[userEmail] || 0) + 1;
        //         console.log(`User ${userEmail} (non-premium) has used a polling chance.`);
        //     }
        // } catch (error) {
        //     console.error("Error handling polling:", error);
        // }



        // const exhaustedUser = new exhaustedPollUsers({ email: userEmail });
        // await exhaustedUser.save();

        res.status(201).json({ message: 'Email saved for 3 hours successfully in exhausted users' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error saving email in exhausted users' });
    }
    // try {
    //     const exhaustedUser = new exhaustedPollUsers({ email: userEmail });
    //     await exhaustedUser.save();

    //     res.status(201).json({ message: 'Email saved for 3 hours successfully in exhausted users' });
    // } catch (error) {
    //     console.error(error);
    //     res.status(500).json({ message: 'Error saving email in exhausted users' });
    // }

    // Respond with success
    // res.status(200).json({ message: 'Exhausted user saved successfully and liked data saved too' });

});






// Endpoint to initiate signup and send OTP
app.post('/signUp', async (req, res) => {
    const { name, gender, email, password } = req.body;

    try {

        const USER = await userModel.findOne({ email });
        console.log(USER);

        if (USER) {
            return res.status(200).json({ message: 'Email already registered' });
        }

        // Generate a 6-digit OTP
        const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });

        let data = { name, gender, email, password, otp };

        if (req.body.instaId !== null && req.body.instaId !== undefined) {
            data.instaId = req.body.instaId;
        }

        // Store OTP in the database
        let otpEntry = new OtpModel(data);
        await otpEntry.save();

        // Send OTP via email
        await transporter.sendMail({
            from: '2023uee1511@mnit.ac.in',
            to: email,
            subject: 'Your OTP for Signup',
            text: `Your OTP is: ${otp}`,
        });

        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.log(error);
        console.error('Error sending OTP:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

function capitalizeMiddle(text) {
    // Split the email into parts before and after '@'
    const [localPart, domain] = text.split('@');

    // Extract the middle code (after year and before student ID)
    const year = localPart.slice(0, 4); // First 4 characters (year)
    const middleCode = localPart.slice(4, 7); // Middle 3 characters (branch code)
    const studentId = localPart.slice(7); // Remaining part (student ID)

    // Convert the middle code to uppercase
    const updatedMiddleCode = middleCode.toUpperCase();

    // Reassemble the email
    const updatedLocalPart = `${year}${updatedMiddleCode}${studentId}`;
    return `${updatedLocalPart}@${domain}`;
}

// // Function to get 10 sets of 4 options
// async function getUserOptions(email) {
//     const { year, branchCode } = extractYearAndBranch(email);

//     // Query users with the same year and branch code
//     const sameYearAndBranch = await userModel.find({ email: { $regex: `^${year}${branchCode}` } }).limit(40);

//     // Query users with the same year but different branch code
//     const sameYearDifferentBranch = await userModel.find({ email: { $regex: `^${year}` } }).limit(40);

//     // Query random users if there are not enough results
//     const randomUsers = await userModel.aggregate([{ $sample: { size: 40 } }]);

//     // Combine the results, prioritizing users with the same year and branch code
//     let selectedUsers = [];
//     selectedUsers = [...sameYearAndBranch, ...sameYearDifferentBranch, ...randomUsers];

//     // Shuffle the users and select the first 10 sets of 4
//     selectedUsers = selectedUsers.sort(() => Math.random() - 0.5).slice(0, 40);

//     // Format the selected users into sets of 4 options
//     const optionsSet = [];
//     for (let i = 0; i < 10; i++) {
//         optionsSet.push(selectedUsers.slice(i * 4, (i + 1) * 4));
//     }

//     return optionsSet;
// }





// Function to get 10 sets of 4 options from in-memory user data
async function getUserOptions(email) {
    const { year, branchCode } = extractYearAndBranch(email);
    const currentUser = user[email]; // Get the current user's data

    if (!currentUser) {
        return []; // Return an empty array if the user does not exist
    }

    // Gender-specific filter: opposite gender only
    const oppositeGender = currentUser.gender === 'male' ? 'female' : 'male';

    // Find users with the same year and branch code, opposite gender
    const sameYearAndBranch = Object.values(user).filter(
        (u) => u.gender === oppositeGender && u.year === year && u.branchCode === branchCode
    );

    // Find users with the same year but different branch code, opposite gender
    const sameYearDifferentBranch = Object.values(user).filter(
        (u) => u.gender === oppositeGender && u.year === year && u.branchCode !== branchCode
    );

    // Find random users, opposite gender
    const randomUsers = Object.values(user).filter(
        (u) => u.gender === oppositeGender
    );

    // Combine the results, prioritizing users with the same year and branch code
    let selectedUsers = [];
    selectedUsers = [...sameYearAndBranch, ...sameYearDifferentBranch, ...randomUsers];

    // Shuffle the users and select the first 40 (max limit)
    selectedUsers = selectedUsers.sort(() => Math.random() - 0.5).slice(0, 40);

    const filteredUsers = selectedUsers.map(user => ({
        name: user.name,
        email: user.email,
        gender: user.gender,
        likes: user.likes,
    }));

    console.log("Helllo");

    // console.log("The selected user are, ", selectedUsers, "the filteredUsers are", filteredUsers);

    // Format the selected users into sets of 4 options
    const optionsSet = [];
    for (let i = 0; i < 10; i++) {
        // If there are not enough users to form a full set, stop adding sets
        if (filteredUsers.length >= (i + 1) * 4) {
            optionsSet.push(filteredUsers.slice(i * 4, (i + 1) * 4));
        } else {
            // Add the remaining users as a smaller set
            optionsSet.push(filteredUsers.slice(i * 4));
            break;
        }
    }

    return optionsSet;
}







app.use('/login', async (req, res, next) => {
    console.log("req get ..... 2 mid ware");

    const { email, password } = req.body;

    try {
        // Check if the user exists in the database
        // const User = await userModel.findOne({ capitalizeMiddle(email) });
        const user = await userModel.findOne({ email });

        if (!user) {
            // If the email doesn't exist, respond with an error message
            return res.status(404).json({ error: 'Email not registered' });
        }

        // Compare the provided password with the stored password in plain text
        if (password !== user.password) {
            // If the passwords don't match, respond with an error message
            return res.status(400).json({ error: 'Incorrect password' });
        }

        // If email and password match, return success message
        // return res.status(200).json({ message: 'Login successful' });

        next();
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'An error occurred while logging in' });
    }
});





// Example route to log in user and set JWT token in the cookie
app.post('/login', (req, res) => {
    console.log("req get ..... 3 mid ware");

    const reqBody = req.body;

    console.log("Hellooo ...");

    console.log(reqBody);

    try {
        const user = {
            email: reqBody.email,
        };

        console.log(user);

        if (reqBody.token !== null && reqBody.token !== undefined) {
            // Generate JWT token
            const token = reqBody.token;

            console.log("Token : ", token);

            // Set the token in the cookie
            // res.cookie('auth_token', token);
            // res.cookie('auth_token', token, {
            //     httpOnly: true, // Make sure cookie is accessible only through HTTP(S)
            //     secure: process.env.NODE_ENV === 'production', // Only in production if HTTPS is enabled
            //     expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days expiration
            // });

            // return res.redirect('/');
            // Send success response
            return res.status(200).json({ token });
        } else {
            // Generate JWT token
            const token = generateToken(user);

            console.log("Token : ", token);

            // Set the token in the cookie
            // res.cookie('auth_token', token);
            // res.cookie('auth_token', token, {
            //     httpOnly: true, // Make sure cookie is accessible only through HTTP(S)
            //     secure: process.env.NODE_ENV === 'production', // Only in production if HTTPS is enabled
            //     expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days expiration
            // });

            // return res.redirect('/');
            // Send success response
            return res.status(200).json({ token });
        }


    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'An error occurred while logging in' });

    }
});



// Endpoint to verify OTP to signup
app.post('/verifyOtp', async (req, res) => {
    const { otp } = req.body;

    try {
        // Find the OTP entry in the database

        console.log("OTP is :", otp);
        const otpEntry = await OtpModel.findOne({ otp });
        console.log("User enetry for the respective OTP is ", otpEntry);
        if (!otpEntry) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        const name = otpEntry.name;
        const email = otpEntry.email;
        const password = otpEntry.password;
        const gender = otpEntry.gender;
        const instaId = otpEntry.instaId;

        const newUser = new userModel({ name, gender, instaId, email, password });
        console.log(newUser);
        await newUser.save();
        // OTP is valid; proceed with signup
        await OtpModel.deleteMany({ otp }); // Clear OTPs for this email


        realUserCount++;

        res.status(200).json({ message: 'OTP verified successfully, login to use our service ...' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});


// //route for sending leader board analytics
// app.get('/leaderboard', async (req, res) => {
//     try {
//         // Fetch top 10 male users sorted by likes
//         const topMales = await Leaderboard.find({ gender: 'Male' })
//             .sort({ likes: -1 }) // Sort by likes in descending order
//             .limit(10) // Limit to top 10 results
//             .select('email instaId likes -_id'); // Select relevant fields

//         // Fetch top 10 female users sorted by likes
//         const topFemales = await Leaderboard.find({ gender: 'Female' })
//             .sort({ likes: -1 }) // Sort by likes in descending order
//             .limit(10) // Limit to top 10 results
//             .select('email instaId likes -_id'); // Select relevant fields

//         // Send both male and female lists in the response
//         res.status(200).json({
//             males: topMales,
//             females: topFemales,
//         });
//     } catch (error) {
//         console.error('Error fetching leaderboard:', error);
//         res.status(500).json({ error: 'Failed to fetch leaderboard data' });
//     }
// });




// // Route for sending leaderboard analytics
// app.get('/leaderboard', async (req, res) => {
//     try {
//         // Arrays to store male and female users
//         const maleUsers = [];
//         const femaleUsers = [];

//         // Loop through the users object to classify users based on gender
//         Object.keys(user).forEach(email => {
//             const User = user[email].toObject();  // Convert Mongoose document to plain object
//             const likeCount = likesMap.get(email) || 0; // Default to 0 if no like count exists

//             // Add the user to the corresponding gender array along with likeCount
//             if (User.gender === 'male') {
//                 maleUsers.push({ ...User, likeCount, email });
//             } else if (User.gender === 'female') {
//                 femaleUsers.push({ ...User, likeCount, email });
//             }
//         });

//         // Sort by likeCount in descending order and get the top 10 users
//         const topMales = maleUsers.sort((a, b) => b.likeCount - a.likeCount).slice(0, 10);
//         const topFemales = femaleUsers.sort((a, b) => b.likeCount - a.likeCount).slice(0, 10);

//         // Send both male and female leaderboard data in the response
//         res.status(200).json({
//             males: topMales.map(user => {
//                 const { password, _id, __v, ...userData } = user; // Destructure to exclude unwanted fields
//                 return {
//                     ...userData,
//                     likeCount: user.likeCount,
//                 };
//             }),
//             females: topFemales.map(user => {
//                 const { password, _id, __v, ...userData } = user; // Destructure to exclude unwanted fields
//                 return {
//                     ...userData,
//                     likeCount: user.likeCount,
//                 };
//             }),
//         });
//     } catch (error) {
//         console.error('Error fetching leaderboard:', error);
//         res.status(500).json({ error: 'Failed to fetch leaderboard data' });
//     }
// });
// Route for sending leaderboard analytics
app.get('/leaderboard', async (req, res) => {
    try {
        // Fetch all users from the database
        const users = await userModel.find({}, '-password -__v -_id'); // Exclude sensitive fields

        // Separate users by gender
        const maleUsers = users.filter(user => user.gender === 'male');
        const femaleUsers = users.filter(user => user.gender === 'female');

        // Sort by likes in descending order
        maleUsers.sort((a, b) => b.likes - a.likes);
        femaleUsers.sort((a, b) => b.likes - a.likes);

        // Take up to 10 users from each category, ensuring at least one if available
        const topMales = maleUsers.slice(0, Math.min(maleUsers.length, 10));
        const topFemales = femaleUsers.slice(0, Math.min(femaleUsers.length, 10));

        // Send the response ensuring no empty arrays
        res.status(200).json({
            males: topMales.length > 0 ? topMales : undefined,
            females: topFemales.length > 0 ? topFemales : undefined
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard data' });
    }
});





// GET /profile route
app.get('/profile', verifyToken, async (req, res) => {
    try {
        // Extract the user's email from the decoded token
        const userEmail = req.user.email;

        // Find the user in the database
        const user = await userModel.findOne({ email: userEmail });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Parse branch and year from the email (assuming the email has a specific format like 2023UEE1511@...)
        const year = `20${userEmail.substring(2, 4)}`; // Extract year (e.g., '2023')
        const branchCode = userEmail.substring(4, 7); // Extract branch code (e.g., 'UEE')
        const USER = premiumUsers[userEmail];

        console.log(USER);

        if (USER) {
            // Send the user details to the client
            res.status(200).json({
                name: user.name,
                gender: user.gender,
                branch: branchCode, // Return branch code
                year: year, // Return year
                instaId: user.instaId, // Return Instagram ID
                password: user.password,
                isPremiumUser: true,
                upForOpenPool: USER.toggleOnForOpenPool
            });
        } else {
            // Send the user details to the client
            res.status(200).json({
                name: user.name,
                gender: user.gender,
                branch: branchCode, // Return branch code
                year: year, // Return year
                instaId: user.instaId, // Return Instagram ID
                password: user.password,
                isPremiumUser: false
            });
        }

        // // Send the user details to the client
        // res.status(200).json({
        //     name: user.name,
        //     branch: branchCode, // Return branch code
        //     year: year, // Return year
        //     instaId: user.instaId, // Return Instagram ID
        //     password: user.password,
        // });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// GET /likesData endpoint for likesData1 which is only likes you got
app.get('/likesData1', verifyToken, (req, res) => {
    const userEmail = req.user.email; // Extract the email from the decoded token

    if (!userEmail) {
        return res.status(400).json({ message: 'Email is required in the token for likesData1' });
    }

    // Fetch the likes data
    // const likesYouGotCount = likesMap.get(userEmail) || 0;
    let likesYouGot = [];//Array of emails 


    // Iterate through the map and check if the given email appears in the arrays
    // userLikesMap.forEach((email, likedEmails) => {
    //     if (likedEmails.includes(userEmail)) {
    //         console.log(email);
    //         likesYouGot.push(email);
    //     }
    // });

    userLikesMap.forEach((likedEmails, email) => {
        if (likedEmails.includes(userEmail)) {
            console.log(email); // Debugging
            likesYouGot.push(user[email]);
        }
    });



    const docsWithoutPassword = likesYouGot.map(doc => {
        // Convert the Mongoose doc to a plain JavaScript object
        const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

        // Create a new object with only the required fields (name, email, etc.)
        const { name, email, gender, instaId } = docObject;

        // Return the new object with only the required fields
        return { name, email, gender, instaId };
    });





    // // Iterate over userLikesMap to find who liked the current user
    // for (const [likerEmail, likedEmails] of userLikesMap.entries()) {
    //     if (likedEmails.includes(userEmail)) {
    //         likedByUsers.push(user[likerEmail]);
    //     }
    // }

    console.log(userLikesMap);
    console.log("Likes you got while sending is : ", likesYouGot);

    // Respond with the likes data
    res.status(200).json({
        userEmail,
        isPremiumUser: isTheUserPremium(userEmail),
        likesYouGotCount: likesYouGot.length,
        likesYouGot: docsWithoutPassword   //is a array of emails 
    });
});



function isTheUserPremium(email) {
    return premiumUsers.hasOwnProperty(email);
}



// GET /likesData endpoint for likes you sent and matched which is likesData2
app.get('/likesData2', verifyToken, (req, res) => {
    const userEmail = req.user.email; // Extract the email from the decoded token

    try {
        if (!userEmail) {
            return res.status(400).json({ message: 'Email is required in the token for likesData2' });
        }

        // Fetch the likes data
        // const likesReceived = likesMap.get(userEmail) || 0;
        // const likedByUsers = [];//Array of emails 
        const likesYouSent = getAllUserDataOfLikesSent(getUsersLikedByCurrentUser(userEmail));//An array of emails
        const matched = getMutualLikes(userEmail);//an array of emails

        const likesYouSentCount = likesYouSent.length;
        const matchedCount = matched.length;







        // const likesYouSentDocsWithoutPassword = likesYouSent.map(doc => {
        //     // Convert the Mongoose doc to a plain JavaScript object
        //     const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

        //     // Create a new object with only the required fields (name, email, etc.)
        //     const { name, email, gender } = docObject;

        //     // Return the new object with only the required fields
        //     return { name, email, gender };
        // });

        const likesYouSentDocsWithoutPassword = likesYouSent
            .filter(doc => doc) // Remove undefined/null values
            .map(doc => {
                // Convert Mongoose doc to plain object
                const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

                // Extract required fields
                const { name, email, gender } = docObject;

                return { name, email, gender };
            });



        // const matchedDocsWithoutPassword = matched.map(doc => {
        //     // Convert the Mongoose doc to a plain JavaScript object
        //     const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

        //     // Create a new object with only the required fields (name, email, etc.)
        //     const { name, email, gender, instaId } = docObject;

        //     // Return the new object with only the required fields
        //     return { name, email, gender, instaId };
        // });

        const matchedDocsWithoutPassword = matched
            .filter(doc => doc) // Remove undefined/null values
            .map(doc => {
                // Convert Mongoose doc to a plain JavaScript object safely
                const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

                // Extract required fields
                const { name, email, gender, instaId } = docObject;

                return { name, email, gender, instaId };
            });



        // Iterate over userLikesMap to find who liked the current user
        // for (const [likerEmail, likedEmails] of userLikesMap.entries()) {
        //     if (likedEmails.includes(userEmail)) {
        //         likedByUsers.push(likerEmail);
        //     }
        // }

        // Respond with the likes data
        res.status(200).json({
            isPremiumUser: isTheUserPremium(userEmail),
            likesYouSent: likesYouSentDocsWithoutPassword,//Is an array of email
            matched: matchedDocsWithoutPassword,  //is a array of emails 
            likesYouSentCount,
            matchedCount,
        });
    } catch (err) {
        console.log("Error in sending likesData2 ....");
        console.log(err);
        res.status(500).json({ message: 'Internal server error while sending likesData2 ....' });

    }
});




// GET /likesData endpoint for open pool
app.get('/likesData3', verifyToken, (req, res) => {
    const userEmail = req.user.email; // Extract the email from the decoded token

    try {
        if (!userEmail) {
            return res.status(400).json({ message: 'Email is required in the token for likesData2' });
        }

        const data = getUsersForOpenPool(userEmail);


        const docsWithoutPassword = data.map(doc => {
            // Convert the Mongoose doc to a plain JavaScript object
            const docObject = doc.toObject({ getters: true, virtuals: true, versionKey: false });

            // Create a new object with only the required fields (name, email, etc.)
            const { name, email, gender, instaId } = docObject;

            // Return the new object with only the required fields
            return { name, email, gender, instaId };
        });

        // Respond with the likes data
        res.status(200).json({
            openPoolCount: Object.keys(data).length,
            openPoolUsers: docsWithoutPassword,
            isPremiumUser: isTheUserPremium(userEmail)

        });
    } catch (err) {
        console.log("Error in sending likesData3 ....");
        console.log(err);
        res.status(500).json({ message: 'Internal server error while sending likesData3 ....' });

    }
});


function getUsersForOpenPool(currentUserEmail) {
    return Object.keys(user)
        .filter(email => user[email].gender != user[currentUserEmail].gender && email !== currentUserEmail && premiumUsers[email]?.toggleOnForOpenPool)
        .map(email => user[email]); // Return only user data, not email as a key
}


app.put("/makeItAMatch", async (req, res) => {
    const { userEmail, otherUserEmail } = req.body;

    if (!userEmail || !otherUserEmail) {
        return res.status(400).json({ message: "Missing email data" });
    }
    // Perform DB operation to register the match
    const likedEmails = [];
    likedEmails.push(otherUserEmail);

    addLikes(userEmail, likedEmails);
    incrementLikes(likedEmails);



    console.log(`${userEmail} matched with ${otherUserEmail}`);

    res.json({ success: true, message: "Match created successfully!" });
});

app.put("/sendALike", async (req, res) => {
    const { userEmail, otherUserEmail } = req.body;

    if (!userEmail || !otherUserEmail) {
        return res.status(400).json({ message: "Missing email data" });
    }

    // Perform DB operation to save like data
    const likedEmails = [];
    likedEmails.push(otherUserEmail);

    addLikes(userEmail, likedEmails);
    incrementLikes(likedEmails);


    console.log(`${userEmail} liked ${otherUserEmail}`);

    res.json({ success: true, message: "Like sent successfully!" });
});







//sync likes from fake user model to real user model, because always the likes were first updates to fake user model which contains the user who haven't even registered
//Sync only for those user from fake user model whi are in real user model tooo.
async function syncLikesFromFakeUserModelToRealUserModel() {
    try {
        console.log("Syncing likes from Fake User Model to Real User Model...");

        // Fetch all emails from the real user model
        const realUserEmails = await userModel.distinct("email"); // Get only emails from real users

        // Fetch all matching users from the fake model
        const fakeUsers = await userModelFake.find({ email: { $in: realUserEmails } }, { email: 1, likes: 1 });

        // Prepare bulk update operations
        const bulkOps = fakeUsers.map(fakeUser => ({
            updateOne: {
                filter: { email: fakeUser.email },
                update: { $set: { likes: fakeUser.likes } }
            }
        }));

        // Execute bulk update if there are updates to make
        if (bulkOps.length > 0) {
            await userModel.bulkWrite(bulkOps);
            console.log(`Updated ${bulkOps.length} users' likes successfully.`);
        } else {
            console.log("No matching users found to sync.");
        }
    } catch (error) {
        console.error("Error syncing likes:", error);
    }
}






function compareUserCount() {
    console.log("comparing the user count ....");
    if (realUserCount > 999) {
        isOkToUseUserModel = true;
    }
}






async function syncRealToFakeUsers() {
    try {
        console.log("🔄 Syncing Real Users to Fake Users...");

        // Fetch all emails from the fake user model
        const fakeUserEmails = await userModelFake.distinct("email");

        // Fetch all users from the real model that are NOT in the fake model
        const newUsers = await userModel.find({ email: { $nin: fakeUserEmails } });

        if (newUsers.length === 0) {
            console.log("✅ No new users to sync.");
            return;
        }

        // Insert missing users into the fake model
        await userModelFake.insertMany(newUsers);

        console.log(`✅ Synced ${newUsers.length} new users to Fake User Model.`);
    } catch (error) {
        console.error("❌ Error syncing users:", error);
    }
}

















// Sync data every 10 sec 
setInterval(syncLikesFromFakeUserModelToRealUserModel, 10000);

// Sync data every 10 sec 
setInterval(compareUserCount, 10000);

// Sync data every 10 minutes (600000 ms)
setInterval(syncDataFromDB, 60000);

// Run sync function every 1 minutes 
setInterval(syncLikesWithDB, 60000);

// Run sync function every 1 minutes 
setInterval(syncPremiumUsersForwithInitializationOfTheServerOnly, 60000);

// Sync every 1 minute
setInterval(syncPremiumUsers, 5000);

// Set an interval to sync data every 1 minute
setInterval(syncUserLikesMapToDb, 60000); // 60000ms = 1 minute

// Run the sync function every 10 seconds
setInterval(syncRealToFakeUsers, 10000); // 10000ms = 10 seconds




let PORT = process.env.PORT || 8000;



mongoose.connect(process.env.MONGO_URL).then((data) => {
    console.log("Mongo connected successfullyyy ....");
    // Call the function when the server starts
    initializeUserData();
    // Call on server start
    syncPremiumUsers();
    //Only one time syncing of the poll count remaing by setting tehm to 0, at server starting
    syncPremiumUsersForwithInitializationOfTheServerOnly();
    //Initialization of the userLikesMap from the data from db
    loadUserLikesMapFromDb();
}).catch((error) => {
    console.log("Mongo connection failed .....");
});
app.listen(PORT, () => { console.log("Server strated ......") });



