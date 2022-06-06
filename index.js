const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express()
const port = process.env.PORT || 5000

//middlewere
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.PASS}@cluster0.id9tm.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthoraized access ' })
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'forbiden access' })
    }
    req.decoded = decoded;
    next()
  });
}
async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");
    app.get('/service', async (req, res) => {
      const quary = {};
      const cursor = serviceCollection.find(quary);
      const services = await cursor.toArray();
      res.send(services)
    })

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray()
      res.send(users)
    });
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        const filter = { email: email }

        const updateDoc = {
          $set: { role: 'admin' },
        };
        const resutl = await userCollection.updateOne(filter, updateDoc)
  
        res.send(resutl)
      }
      else {
        return res.status(403).send({ message: 'forbiden access' })
      } 
     
    })
    app.get('/admin/:email', async(req, res) =>{
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin})
    })


    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email }
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const resutl = await userCollection.updateOne(filter, updateDoc, options)
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ resutl, token })
    })
    app.get('/available', async (req, res) => {
      const date = req.query.date;
      // step 1:  get all services
      const services = await serviceCollection.find().toArray()
      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const quary = { date: date }

      const bookings = await bookingCollection.find(quary).toArray()
      // step 3: for each service
      services.forEach(service => {
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(book => book.treatment === service.name)
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const bookedSlots = serviceBookings.map(book => book.slot)
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !bookedSlots.includes(slot))
        //step 7: set available to slots to make it easier 
        service.slots = available;
      })

      res.send(services)
    })

    //   /**
    //   * API Naming Convention
    //   * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
    //   * app.get('/booking/:id') // get a specific booking 
    //   * app.post('/booking') // add a new booking
    //   * app.patch('/booking/:id) //
    //   * app.delete('/booking/:id) //
    //  */
    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const quary = { patient: patient }
        const bookings = await bookingCollection.find(quary).toArray()
        return res.send(bookings)
      }
      else {
        return res.status(403).send({ message: 'forbiden access' })
      }

    })
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, paitent: booking.paitent }
      const exist = await bookingCollection.findOne(query)
      if (exist) {
        return res.send({ success: false, booking: exist })
      }
      const result = await bookingCollection.insertOne(booking)
      return res.send({ success: true, result })
    })


  }
  finally {

  }
}


app.get('/', (req, res) => {
  res.send('Hello form doctor')
})

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`)
})
run().catch(console.dir);