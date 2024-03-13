const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();

// if we are trying to require from our
// own files, we need the './'
const { connect } = require('./MongoUtil');
const { authenticateWithJWT } = require('./middleware');

// create the express application
const app = express();

// enable cors
app.use(cors());

// set JSON as the means of
// receiving requests and sending responses
app.use(express.json());

// A jwt is sometimes known as an 'access token' because it grants access
// to your services or protected routes

const generateAccessToken = (id, email) => {
    return jwt.sign({
        'user_id': id,
        'email': email
    }, process.env.TOKEN_SECRET, {
        expiresIn: "1h"
    });
}

async function main() {
    // connection string is now from the .env file
    const uri = process.env.MONGO_URI;
    // get the database using the `connect` function
    const db = await connect(uri, "sctp02_University");

    // create the routes after connecting to the database
    app.get("/course", async function (req, res) {
        try {
            // empty criteria object
            // Note: if we do a .find({}) it will return all the documents in the collection
            const criteria = {};

            if (req.query.coursename) {
                criteria.coursename = {
                    '$regex': req.query.coursename,
                    '$options': 'i'
                }
            }

            if (req.query.subjects) {
                criteria.subjects = {
                    '$in': [req.query.subjects]
                }
            }

            // get all the sightings
            const results = await db.collection("course").find(criteria).toArray();

            res.json({
                'course': results
            })
        } catch (e) {
            res.status(500);
            res.json({
                'error': e
            })
        }

    });

   
    app.post("/course", async function (req, res) {
       
        try {
            const coursename = req.body.course_name;
            const subjects = req.body.subjects;
            const datetime = req.body.datetime ? new Date(req.body.datetime) : new Date();

            if (!coursename) {
                res.status(400);
                res.json({
                    'error': 'A coursename must be provided'
                });
                return;
            }

            if (!subjects || !Array.isArray(subjects)) {
                res.status(400);
                res.json({
                    'error': 'subjects must be provided and must be an array'
                })
            }

            // insert a new document based on what the client has sent
            const result = await db.collection("course").insertOne({
                'coursename': coursename,
                'subjects': subjects,
                'datetime': datetime
            });
            res.json({
                'result': result
            })
        } catch (e) {
            // e will contain the error message
            res.status(500); // internal server error
            res.json({
                'error': e
            })
        }

    })

    app.get('/course/:id', async (req, res) => {
        try {
          const id = new ObjectId(req.params.id);
          const course = await db.collection('course').findOne({_id: id});
          if (course) {
            res.json(course);
          } else {
            res.status(404).json({ message: 'course not found' });
          }
        } catch (error) {
          res.status(500).json({ message: 'Error fetching course', error: error.message });
        }
      });    


      app.patch("/course/:id", async function (req,res){
        const instructor = req.body.instructor;

        if(!instructor){
            res.status(400).json({"error":"bad input"})
            return;
        }

        const result = await db.collection("course").updateOne({
            '_id': new ObjectId(req.params.id)
        }, {
            '$set': {
                'instructor': {
                    "name": "John Smith",
                    "department": "Computer Science",
                    "office": "Room 123"
                }
            }
        })

        res.status(202).json({
            'result': "accepted"
        })

      })


      app.put('/course/:id', async function (req, res) {
        try {
            const coursename = req.body.coursename;
            const subjects = req.body.subjects;
            const datetime = req.body.datetime ? new Date(req.body.datetime) : new Date();

            if (!coursename || !subjects || !Array.isArray(subjects)) {
                res.status(400); // bad request -- the client didn't follow the specifications for our endpoint
                res.json({
                    'error': 'Invalid data provided'
                });
                return;
            }

            const result = await db.collection("course").updateOne({
                '_id': new ObjectId(req.params.id)
            }, {
                '$set': {
                    'coursename': coursename,
                    'subjects': subjects,
                    'datetime': datetime
                }
            })

            res.json({
                'result': result
            })
        } catch (e) {
            res.status(500);
            res.json({
                'error': 'Internal Server Error'
            })
        }

    })



    app.delete('/course/:id', async function (req, res) {
        await db.collection('course').deleteOne({
            '_id': new ObjectId(req.params.id)
        });

        res.json({
            'message': "Deleted"
        })
    })


    app.post('/student', async function (req, res) {

        // hashing with bcrypt is an async function
        // bcyrpt.hash takes two argument:
        // 1. the plaintext that you want to hash
        // 2. how secure you want it
        const hashedPassword = await bcrypt.hash(req.body.password, 12);
        const result = await db.collection('student').insertOne({
            'email': req.body.email,
            'password': hashedPassword
        })
        res.json({
            'result': result
        })
    })

    app.post('/login', async function (req, res) {
        // 1. Find the user by email address
        const user = await db.collection('student')
            .findOne({
                email: req.body.email
            });


        // 2. Check if the password matches
        if (user) {
            // bcrypt.compare()
            // - first arugment is the plaintext
            // - second argument is the hashed version 
            if (await bcrypt.compare(req.body.password, user.password)) {
                // valid login - so generate the JWT
                const token = generateAccessToken(user._id, user.email);
                res.json({
                    'token': token
                })
            } else {
                res.status(400);
                res.json({
                    'error': 'Invalid login credentials1'
                })
            }
        } else {
            res.status(400);
            return res.json({
                'error': 'Invalid login credentials2'
            })
        }

        // 3. Generate and send back the JWT (aka access token)
    });

    app.get('/profile', authenticateWithJWT, async function (req, res) {

        res.json({
            'message': 'success in accessing protected route',
            'payload': req.payload
        })
    })

    app.get('/payment', authenticateWithJWT, async function (req, res) {
        res.json({
            'message': "accessing protected payment route"
        })
    })

    
      


}

main();

app.listen(3000, function () {
    console.log("Server has started");
});
