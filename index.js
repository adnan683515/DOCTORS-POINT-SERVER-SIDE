const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const PORT = process.env.PORT || 5000;
//stripe
const stripe = Stripe(`${process.env.secretKey}`); // e.g. sk_test_...

//ssl commarz
const SSLCommerzPayment = require('sslcommerz-lts')
const is_live = false //true for live, false for sandbox
const store_id = `${process.env.storeId}`
const store_passwd = `${process.env.storePassOrSecretKey}`

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ for form-urlencoded data



const uri = `mongodb+srv://${process.env.dbName}:${process.env.dbPass}@cluster0.ws0fker.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const db = client.db("doctorsPoint")
        const userCollections = db.collection('users')
        const doctorCollections = db.collection('doctors')
        const appointMentCollactions = db.collection('appointment')

        


        //ssl commarze
        app.get('/init/:id/:user', async (req, res) => {
            const id = req?.params?.id
            const user = req?.params?.user

            const query = { _id: new ObjectId(id) }
            const resultDoctor = await doctorCollections.findOne(query)
            const userInfo = await userCollections.findOne({ email: user })

            const data = {
                total_amount: resultDoctor?.fee,
                currency: 'BDT',
                tran_id: `TRX-${Date.now()}`,
                success_url: 'http://localhost:5000/success',
                fail_url: 'http://localhost:5000/fail',
                cancel_url: 'http://localhost:5000/cancel',
                ipn_url: 'http://localhost:5000/ipn',
                shipping_method: 'Online',
                product_name: resultDoctor?.name || 'Doctor Appointment',
                product_category: resultDoctor?.department || 'General',
                product_profile: 'medical',

                cus_name: userInfo?.name,
                cus_email: userInfo?.email,
                cus_add1: 'Patient House, Dhaka',
                cus_add2: 'N/A',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: userInfo?.phone || '01700000000',
                cus_fax: 'N/A',

                ship_name: userInfo?.name,
                ship_add1: 'Online',
                ship_add2: 'Online',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };


            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                let GatewayPageURL = apiResponse.GatewayPageURL;
                res.send({ url: GatewayPageURL });
            });
        })

        //payment success url 
        app.post('/success', async (req, res) => {

            const successInfo = req?.body
            console.log(successInfo)
            res.redirect('http://localhost:5173/myAppointments');
        });

        //payment systeam using strip 
        app.post('/create-payment-intent', async (req, res) => {
            const { amount } = req.body;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });


        //appointment save data 
        app.post('/appointments',async(req,res)=>{
            const data = req?.body
            const result = await appointMentCollactions.insertOne(data)
            res.send(result)
        })


        //when patient take a appoint then doctor details property totalAppointment increase

        app.patch('/updateDoctorProperty',async (req,res)=>{
            
        })



        //users data save when user create an account by default users status is petient
        app.post('/usersDataSave', async (req, res) => {
            const info = req?.body
            const result = await userCollections.insertOne(info)
            res.send(result)
        })

        //save doctor data when Admin provide doctor information
        app.post('/doctorAdded', async (req, res) => {
            const info = req?.body
            const result = await doctorCollections.insertOne(info)
            res.send(result)
        })

        //get all doctors 
        app.get('/allDoctorsGet', async (req, res) => {
            const result = await doctorCollections.find().toArray()
            res.send(result)
        })


        //filtering doctor using search , radio option and consultation fee
        app.get('/filterDoctor', async (req, res) => {
            const fee = req?.query?.fee
            const chamber = req?.query?.chamber
            const dept = req?.query?.dept
            const degree = req?.query?.degree
            if (fee) {
                const doctors = await doctorCollections.find({
                    fee: { $gte: 100, $lte: parseInt(fee) }
                }).toArray();
                return res.send(doctors)
            }
            else if (chamber) {
                const query = {
                    chamber: { $regex: chamber, $options: 'i' }
                }
                const result = await doctorCollections.find(query).toArray()
                return res.send(result)
            }
            else if (degree) {
                const query = {
                    degree: { $regex: degree, $options: 'i' }

                }
                const result = await doctorCollections.find(query).toArray()
                return res.send(result)
            }
            else {
                const query = { department: dept }
                const result = await doctorCollections.find(query).toArray()
                return res.send(result)
            }
        })

        //doctor details api when user can click on view details
        app.get('/detalsInfo/:id', async (req, res) => {
            const query = { _id: new ObjectId(req?.params?.id) }
            const result = await doctorCollections.findOne(query)
            res.send(result)
        })

        //get single petient 
        app.get('/petient/:email', async (req, res) => {
            const query = { email: req?.params?.email }
            const result = await userCollections.findOne(query)

            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Backend is running!');
});


app.listen(PORT, () => {
    console.log(`Server is live at http://localhost:${PORT}`);
});



