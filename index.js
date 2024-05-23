const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: ["http://localhost:5173", "https://car-doctor-sazidulalam47.vercel.app/"],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xyqwep0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// my middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('Verifying token', token);
    if (!token) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'Not authorized' });
        }
        req.user = decoded;
        next();
    })

};

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        // await client.connect();

        const database = client.db("CarDoctorDB");
        const serviceCollection = database.collection("services");
        const productCollection = database.collection("products");
        const orderCollection = database.collection("orders");
        const userCollection = database.collection("users");

        // admin check middleware
        const verifyAdmin = async (req, res, next) => {
            const email = req.user?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            console.log({ isAdmin: isAdmin });
            console.log("check email", email);
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            next();
        };


        //jwt auth
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
            res
                .cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                })
                .send({ success: true });
        });

        app.get("/logout", async (req, res) => {
            res.clearCookie("token")
                .send({ success: true });
        });


        // services api
        app.get("/services", async (req, res) => {
            const result = await serviceCollection.find().toArray();
            res.send(result);
        });

        app.get("/services/titles", async (req, res) => {
            const query = {};
            const options = {
                projection: { title: 1 },
            };
            const result = await serviceCollection.find(query, options).toArray();
            res.send(result);
        });

        app.get("/services/min", async (req, res) => {
            const query = {};
            const options = {
                projection: { title: 1, img: 1, price: 1 },
            };
            const result = await serviceCollection.find(query, options).toArray();
            res.send(result);
        });

        app.get("/services/min/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = {
                projection: { title: 1, img: 1, price: 1 },
            };
            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        });

        app.get("/services/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await serviceCollection.findOne(query);
            res.send(result);
        });

        app.get("/products", async (req, res) => {
            const result = await productCollection.find().toArray();
            res.send(result);
        });

        app.get("/products/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result);
        });

        app.post("/orders", verifyToken, async (req, res) => {
            const order = req.body;
            console.log(order);
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

        app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
            const result = await orderCollection.find().toArray();
            res.send(result);
        });

        app.get("/orders/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.user.email) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const query = { email: email };
            const result = await orderCollection.find(query).toArray();
            res.send(result);
        });

        app.get("/orders/:id", verifyToken, async (req, res) => {
            try {
                const id = req.params.id;

                //check admin
                const email = req.user?.email;
                const queryAdmin = { email: email };
                const user = await userCollection.findOne(queryAdmin);
                const admin = user?.role === "admin";
                console.log({ admin: admin });

                const query = { _id: new ObjectId(id) };
                const result = await orderCollection.findOne(query);
                if (result.email !== req.user.email && !admin) {
                    return res.status(403).send({ message: 'Forbidden' });
                }
                res.send(result);
            }
            catch {
                res.status(404).send({ message: 'Not Found' });
            }
        });

        app.patch("/orders/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const order = req.body;
            console.log(id, order);
            const filter = { _id: new ObjectId(id) };
            const UpdatedOrder = {
                $set: {
                    order: {
                        _id: order._id,
                        title: order.title,
                        img: order.img,
                        price: order.price,
                        status: order.status,
                        type: order.type,
                    }
                }
            };
            const result = await orderCollection.updateOne(filter, UpdatedOrder);
            res.send(result);
        });

        app.delete("/orders/:id", verifyToken, async (req, res) => {
            const id = req.params.id;

            //check admin
            const email = req.user?.email;
            const queryAdmin = { email: email };
            const user = await userCollection.findOne(queryAdmin);
            const admin = user?.role === "admin";
            console.log({ admin: admin });

            const query = { _id: new ObjectId(id) };
            const order = await orderCollection.findOne(query);
            if (order.email !== req.user.email && !admin) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        app.patch("/users", verifyToken, async (req, res) => {
            const user = req.body;
            console.log(user);
            const filter = { email: user.email };
            const options = { upsert: true };
            const UpdatedUser = {
                $set: {
                    name: user.name,
                    phone: user.phone,
                    phone2: user.phone2,
                    address: user.address,
                }
            };
            const result = await userCollection.updateOne(filter, UpdatedUser, options);
            res.send(result);
        });

        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get("/users/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.user.email) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (req.user?.email !== email) {
                return res.status(403).send({ message: 'Forbidden' });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const admin = user.role === "admin";

            res.send({ admin });
        });




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    catch {
        console.log('some thing went wrong');
    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Car Doctor Server is running');
});

app.listen(port, () => {
    console.log(`Car Doctor Server is running on port ${port}`);
});