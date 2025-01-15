const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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
    const db = client.db("CampFlowDB");
    const userCollection = db.collection("users");
    const campCollection = db.collection("campaigns");

    // generate jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // user related API's
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
    app.post("/add-camp", async (req, res) => {
      const data = req.body;
      const result = await campCollection.insertOne(data);
      res.send(result);
    });

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
  console.log(`plantNet is running on port ${port}`);
});
