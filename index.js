require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 8000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://campflow-8fc76.web.app",
      "https://campflow-8fc76.firebaseapp.com",
    ],
  })
);
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

// email send

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
    const reviewCollection = db.collection("reviews");
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
      const query = { _id: new ObjectId(data.campId) };
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
      const query = { _id: new ObjectId(data?.registrationId) };
      const updateDoc = {
        $set: {
          payment_status: "paid",
        },
      };
      const update = await registrationCollection.updateOne(query, updateDoc);
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

    // *****REVIEWS RELATED API'S*******
    app.post("/review", verifyToken, async (req, res) => {
      const data = req.body;

      const result = await reviewCollection.insertOne(data);
      res.send(result);
    });

    // *********NODEMAILER*******
    app.post("/email", async (req, res) => {
      // console.log(req.body);
      const messageData = req.body;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.USER_EMAIL,
          pass: process.env.USER_PASS,
        },
      });

      // Email options
      const mailOptions = {
        from: `${messageData.email}`,
        to: process.env.USER_EMAIL,
        subject: `New Message from ${messageData.name}`,
        text: `
        Name: ${messageData.name}
        Email: ${messageData.email}
        Message: ${messageData.message}
      `,
      };

      await transporter.sendMail(mailOptions);

      res.send({
        message: "Message received, We will get back to you shortly! ",
      });
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
    // *****DONE:Implement search
    // get all camps data
    app.get("/camps", async (req, res) => {
      const search = req.query.search;
      // console.log(search);
      let query = {};
      if (search) {
        query = {
          $or: [
            {
              campName: { $regex: search, $options: "i" },
            },
            {
              professionalName: { $regex: search, $options: "i" },
            },
            {
              location: { $regex: search, $options: "i" },
            },
          ],
        };
      }
      const result = await campCollection.find(query).toArray();
      res.send(result);
    });

    // get popular camps for homepage
    app.get("/camps/popular", async (req, res) => {
      const sort = {
        count: -1, // for highest participation count
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

    // SEARCH SORT
    // Route to fetch available camps with pagination, search, and sorting
    app.get("/available-camps", async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 6; // Default to 6 items per page
      const skip = (page - 1) * limit; // Calculate documents to skip

      let sortOptions = {};
      // if (sort === "count") {
      //   sortOptions = { count: -1 }; // Sort by most participants
      // } else
      if (sort === "des") {
        sortOptions = { price: -1 }; // Sort by price (high to low)
      } else if (sort === "asc") {
        sortOptions = { price: 1 }; // Sort by price (low to high)
      }

      let query = {};
      if (search) {
        query = {
          $or: [
            { campName: { $regex: search, $options: "i" } },
            { professionalName: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { date: { $regex: search, $options: "i" } },
          ],
        };
      }

      // Count total matching documents
      const total = await campCollection.countDocuments(query);

      // Fetch paginated results
      const camps = await campCollection
        .find(query)
        .sort(sortOptions)
        .skip(skip)

        .limit(limit)
        .toArray();

      // Send response with camps and total count
      res.send({ camps, total });
    });

    //  ********Registration RELATED API*********

    // get all registration data
    app.get("/registrations", verifyToken, verifyAdmin, async (req, res) => {
      const search = req.query.search;
      // console.log(search);
      let query = {};
      if (search) {
        query = {
          $or: [
            { camp_name: { $regex: search, $options: "i" } },
            {
              payment_status: { $regex: search, $options: "i" },
            },
            {
              status: { $regex: search, $options: "i" },
            },
            {
              "participant.name": { $regex: search, $options: "i" },
            },
          ],
        };
      }
      const result = await registrationCollection.find(query).toArray();
      res.send(result);
    });

    // Registration data for logged in user
    app.get("/registration/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const search = req.query.search;

      const allRegistrations = await registrationCollection
        .find({ "participant.email": email })
        .toArray();
      // console.log(search);
      const query = { "participant.email": email };
      if (search) {
        query.$or = [
          {
            camp_name: { $regex: search, $options: "i" },
          },
          {
            payment_status: { $regex: search, $options: "i" },
          },
          {
            status: { $regex: search, $options: "i" },
          },
          {
            "participant.name": { $regex: search, $options: "i" },
          },
        ];
      }

      const myRegistrations = await registrationCollection
        .find(query)
        .toArray();
      res.send({ allRegistrations, myRegistrations });
    });

    // registration data for payment by id
    app.get("/registration/pay/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await registrationCollection.findOne(query);
      res.send(result);
    });

    // get payment history with search
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const search = req.query.search;

      const allPayments = await paymentCollection
        .find({ "participant.email": email })
        .toArray();

      const query = { "participant.email": email };

      if (search) {
        query.$or = [
          {
            camp_name: { $regex: search, $options: "i" },
          },
          {
            payment_status: { $regex: search, $options: "i" },
          },
          {
            status: { $regex: search, $options: "i" },
          },
          {
            "participant.name": { $regex: search, $options: "i" },
          },
        ];
      }

      const paymentHistory = await paymentCollection.find(query).toArray();
      res.send({ allPayments, paymentHistory });
    });

    // *******REVIEWS********
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // ********* User ANALYTICS*********
    app.get("/user-stats/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const registrations = await registrationCollection
        .aggregate([
          {
            $match: { "participant.email": email },
          },
          {
            $group: {
              _id: "$participant.email", //group id email
              totalCamps: { $sum: 1 }, // total registered camps
              // totalSpent: { $sum: "$price" }, // sum of total price in registration by price field
              totalSpent: {
                $sum: {
                  $cond: [
                    {
                      $eq: ["$payment_status", "paid"],
                    },
                    "$price",
                    0,
                  ],
                },
              },

              // statusCount: { $push: "$status" },
              confirmedCount: {
                $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
              },
              pendingCount: {
                $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
              },
              // paymentStatusCount: { $push: "$payment_status" },
              Paid: {
                $sum: {
                  $cond: [{ $eq: ["$payment_status", "paid"] }, 1, 0],
                },
              },
              unpaid: {
                $sum: {
                  $cond: [
                    {
                      $eq: ["$payment_status", "pending"],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray();
      res.send(registrations[0] || {});
    });

    // ********* Admin ANALYTICS*********
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const totalCamps = await campCollection.countDocuments(); // Total campaigns
        const totalUsers = await userCollection.countDocuments(); // Total registered users

        // Total registrations & count of paid/unpaid users
        const totalRegistrations =
          await registrationCollection.countDocuments();
        const paidRegistrations = await registrationCollection.countDocuments({
          payment_status: "paid",
        });
        const unpaidRegistrations = totalRegistrations - paidRegistrations;

        // Total revenue
        const totalRevenueResult = await paymentCollection
          .aggregate([
            { $group: { _id: null, totalRevenue: { $sum: "$price" } } },
          ])
          .toArray();
        const totalRevenue =
          totalRevenueResult.length > 0
            ? totalRevenueResult[0].totalRevenue
            : 0;

        res.json({
          totalCamps,
          totalUsers,
          totalRegistrations,
          paidRegistrations,
          unpaidRegistrations,
          totalRevenue,
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
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

    // update camp data
    app.put("/camp/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const query = { _id: new ObjectId(id) };

      const update = {
        $set: data,
      };

      const options = { upsert: true };
      const result = await campCollection.updateOne(query, update, options);
      res.send(result);
    });

    //  ********Registration RELATED API*********
    // update status in both registration collection and payment collection
    app.patch(
      "/registration/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: { status: "confirmed" } };
        const result = await registrationCollection.updateOne(query, updateDoc);

        // update in payment collection as well
        // console.log(id);
        const filter = {
          registrationId: id,
        };
        const updateStatus = {
          $set: {
            status: "confirmed",
          },
        };

        //
        const paymentConfirm = await paymentCollection.updateOne(
          filter,
          updateStatus
        );

        res.send(result);
      }
    );

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

    // ********CAMP RELATED API'S************
    // delete Camp
    app.delete("/camp/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.deleteOne(query);
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
