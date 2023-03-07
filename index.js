const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

//

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.8lhtxek.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//
async function run() {
  try {
    // collections
    const appointmentOptionCollection = client
      .db("dentistPortal")
      .collection("appointmentOptions");
    const bookingsCollection = client.db("dentistPortal").collection("booking");

    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date;
      console.log(date);
      const query = {};
      const cursor = appointmentOptionCollection.find(query);
      const options = await appointmentOptionCollection.find(query).toArray();
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollection
        .find(bookingQuery)
        .toArray();

      //
      // code carefully :D
      options.forEach((option) => {
        const optionBooked = alreadyBooked.filter(
          (book) => book.treatment === option.name
        );
        const bookedSlots = optionBooked.map((book) => book.slot);
        const remainingSlots = option.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        option.slots = remainingSlots;
      });
      res.send(options);
      //
      app.get("/v2/appointmentOptions", async (req, res) => {
        const date = req.query.date;
        const options = await appointmentOptionCollection
          .aggregate([
            {
              $lookup: {
                from: "bookings",
                localField: "name",
                foreignField: "treatment",
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$appointmentDate", date],
                      },
                    },
                  },
                ],
                as: "booked",
              },
            },
            {
              $project: {
                name: 1,
                slots: 1,
                booked: {
                  $map: {
                    input: "$booked",
                    as: "book",
                    in: "$$book.slot",
                  },
                },
              },
            },
            {
              $project: {
                name: 1,
                slots: {
                  $setDifference: ["$slots", "$booked"],
                },
              },
            },
          ])
          .toArray();
        res.send(options);
      });

      /***
       * API Naming Convention
       * app.get('/bookings')
       * app.get('/bookings/:id')
       * app.post('/bookings')
       * app.patch('/bookings/:id')
       * app.delete('/bookings/:id')
       */

      //
      app.post("/bookings", async (req, res) => {
        const booking = req.body;
        console.log(booking);
        const query = {
          appointmentDate: booking.appointmentDate,
          email: booking.email,
        };
        const alreadyBooked = await bookingsCollection.find(query).toArray();
        if (alreadyBooked.length) {
          const message = `You have already booking on ${booking.appointmentDate}`;
          return res.send({ acknowledged: false, message: "" });
        }
        const result = await bookingsCollection.insertOne(booking);
      });
    });
  } finally {
  }
}
run().catch((error) => console.error(error));

//
app.get("/", async (req, res) => {
  res.send("Dentist server is running");
});
app.listen(port, () => {
  console.log(`Dentist server running on ${port}`);
});
