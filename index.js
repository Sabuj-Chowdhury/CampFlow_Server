require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// token verify
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized!" });
  }
  const token = req.headers.authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized!" });
    }

    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i53p4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // ******************************* DB/COLLECTIONS(START) *******************************************
    const db = client.db("CampFlowDB");
    const userCollection = db.collection("users");
    const campCollection = db.collection("campaigns");
    const registrationCollection = db.collection("registrations");
    const paymentCollection = db.collection("payments");
    // ******************************* DB/COLLECTIONS(END) *******************************************

    // ******************************* ADMIN MIDDLEWARE(START) *******************************************
    // admin verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden!" });
      }
      next();
    };
    // ******************************* ADMIN MIDDLEWARE(END) *******************************************

    // ******************************* JWT(START) *******************************************
    // generate jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "24h",
      });
      res.send({ token });
    });
    // ******************************* JWT(END) *******************************************

    // ******************************* POST(START) *******************************************

    //save user data in the db
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "Already exist", insertedId: null });
      }
      const result = await userCollection.insertOne({
        ...user,
        role: "user",
        timeStamp: Date.now(),
      });
      res.send(result);
    });

    // add camp to db
    app.post("/add-camp", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await campCollection.insertOne(data);
      res.send(result);
    });

    // save registration data in registrationCollection and increase count on campCollection
    app.post("/camp/registration", verifyToken, async (req, res) => {
      // save data in db
      const data = req.body;
      const result = await registrationCollection.insertOne({
        ...data,
        timeStamp: Date.now(),
      });
      // increase count on campCollection
      const query = { _id: new ObjectId(data.registrationId) };
      const update = {
        $inc: { count: 1 },
      };
      const updateCount = await campCollection.updateOne(query, update);

      res.send(result);
    });

    // payment collection related api
    app.post("/payments", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await paymentCollection.insertOne(data);

      // update payment status in registration collection
      // const query = { _id: new ObjectId(data.registrationId) };
      // const updateDoc = {
      //   $set: {
      //     payment_status: "paid",
      //   },
      // };
      // const update = await registrationCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // *******STRIPE RELATED API'S*********
    // create payment intent
    app.post("/payment-intent", verifyToken, async (req, res) => {
      const data = req.body;

      const query = { _id: new ObjectId(data.campId) };
      const camp = await campCollection.findOne(query);
      let totalPrice;
      if (camp) {
        totalPrice = camp.price * 100; //price in cent's
        const { client_secret } = await stripe.paymentIntents.create({
          amount: totalPrice,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });
        res.send({ client_secret });
      }

      // const totalPrice = data.price * 100; //price in cent's
      // console.log(totalPrice);
    });

    // ******************************* POST(END) *******************************************

    // ******************************* GET(START) *******************************************

    //  ********USER RELATED API*********
    // get user data from db
    app.get("/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // check if a user is admin
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }

      res.send({ admin });
    });

    //  ********CAMP RELATED API*********
    // get all camps data
    app.get("/camps", async (req, res) => {
      const result = await campCollection.find().toArray();
      res.send(result);
    });

    // get popular camps for homepage
    app.get("/camps/popular", async (req, res) => {
      const sort = {
        count: -1,
      };
      const result = await campCollection.find().sort(sort).limit(6).toArray();
      res.send(result);
    });

    // get camp details by id
    app.get("/camp/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.findOne(query);
      res.send(result);
    });

    //  ********Registration RELATED API*********

    // TEMPORARY
    app.get("/registration/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "participant.email": email };
      const result = await registrationCollection.find(query).toArray();
      res.send(result);
    });

    // registration data by id
    app.get("/registration/pay/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await registrationCollection.findOne(query);
      res.send(result);
    });

    // get payment history
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "participant.email": email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    // ******************************* GET(END) *******************************************

    // ******************************* PUT/PATCH(START) *******************************************

    // user update by id
    app.patch("/user/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: data.name,
          image: data.image,
          address: data.address,
          phone: data.phone,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });
    // ******************************* PUT/PATCH(END) *******************************************

    // ******************************* DELETE(START) *****************************************

    // ********REGISTRATION RELATED API'S************
    // cancel/delete registration
    app.delete("/registration/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await registrationCollection.deleteOne(query);
      res.send(result);
    });

    // ******************************* DELETE(END) *******************************************

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from CampFlow Server..");
});

app.listen(port, () => {
  console.log(`CampFlow is running on port ${port}`);
});
