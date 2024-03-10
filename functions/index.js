/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const functions = require("firebase-functions");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const fetch = require("node-fetch");
// const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
// const { GeoPoint,Timestamp, FieldValue, Filter,collection,doc,set } = require('firebase-admin/firestore');
const ngeohash = require('ngeohash');
const admin = require('firebase-admin');
admin.initializeApp();

// in your function:


// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
// const { getDatabase,ref, set } = require("firebase-database");



const db = admin.database();


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


exports.sheduledGTFSRTPubSub = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  functions.logger.info("Hello logs!", { structuredData: true });

  const now = new Date();
  const epochSeconds = Math.round(now.getTime() / 1000);


  try {
    const fetchResponse = await fetch("https://otd.delhi.gov.in//api/realtime/VehiclePositions.pb?key=6pjlfBCJdApZBXuDjc4EwpCeTvuhmz73", {
      headers: {
        "x-api-key": "<redacted>",
      },
    });

    if (!fetchResponse.ok) {
      const error = new Error(`${fetchResponse.url}: ${fetchResponse.status} ${fetchResponse.statusText}`);
      error.res = fetchResponse;
      throw error;
    }

    const buffer = await fetchResponse.buffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    const totalBuses = feed.entity.length;

    var countScheduled = 0;
    var countUnder2Min = 0;


    feed.entity.forEach(async (entity) => {
      // if (entity.tripUpdate) {
      // console.log(entity);
      var dataJson = {};
      var geoQueryData = {};

      var time = entity.vehicle.timestamp.toNumber();
      // transit_realtime.TripDescriptor.ScheduleRelationship
      // console.log("time = "+time);
      // console.log("epochSecond = "+epochSeconds);
      // console.log("scheduleRelationship = "+entity.vehicle.trip.scheduleRelationship);
      // if(time+120>=epochSeconds){
      //     countUnder2Min++;
      //     console.log("Under 2 min count = "+countUnder2Min);
      // }
      // if(entity.vehicle.trip.scheduleRelationship === 0){
      //     countScheduled++;
      //     console.log("Scheduled bus count = "+countScheduled)
      // }


      const scheduleRelationship = entity.vehicle.trip.scheduleRelationship;
      if (time + 60 >= epochSeconds && !(scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED ||
        scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.REPLACEMENT)) {
        console.log("schedule relationship = " + entity.vehicle.trip.scheduleRelationship);

        console.log("Scheduled bus");
        countUnder2Min++;
        countScheduled++;

        const geoHash = ngeohash.encode(entity.vehicle.position.latitude, entity.vehicle.position.longitude);

        dataJson.id = entity.id;
        dataJson.g = geoHash;
        // dataJson.routeId = entity.vehicle.trip.routeId;
        dataJson.l = {
          0: entity.vehicle.position.latitude,
          1: entity.vehicle.position.longitude
        };
        dataJson.vehicle = {
          trip: {
            trip_id: entity.vehicle.trip.tripId,
            start_time: entity.vehicle.trip.startTime,
            start_date: entity.vehicle.trip.startDate,
            schedule_relationship: entity.vehicle.trip.scheduleRelationship,
            route_id: entity.vehicle.trip.routeId

          },
          position: {
            // latitude: entity.vehicle.position.latitude,
            // longitude: entity.vehicle.position.longitude,
            latlng: {
              latitude: entity.vehicle.position.latitude,
              longitude: entity.vehicle.position.longitude
            },
            speed: entity.vehicle.position.speed
          },

          timestamp: time,
          vehicle: {
            id: entity.vehicle.vehicle.id,
            label: entity.vehicle.vehicle.label
          }
        }



        //   const res1 = await db.collection('Real time track').doc('Delhi').collection('DIMTS').doc('Buses').collection('All_Running_Buses')

        //   .doc(entity.vehicle.vehicle.id).set(dataJson);

        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        ref.set(dataJson)
          .then(() => {
            // Data saved successfully!
            console.log("Document added successfully");
          })
          .catch((error) => {
            // The write failed...
            console.log("error in writing document" + error);
          });

        // const refToDelete = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids');
        // refToDelete.remove()
        // .then(() => {
        //   // Data saved successfully!
        //   console.log("Document removed successfully");
        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


        // const refToRemove = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery');
        // refToRemove.remove()
        // .then(() => {
        //   // Data saved successfully!
        //   console.log("Document removed successfully");
        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        // // const geoFire = new GeoFire(refForGeoQuery);
        // // geoQueryData={
        // //   "firebase-hq":{
        // //     latitude: dataJson.l.latitude,
        // //     longitude: dataJson.l.longitude
        // //   }
        // // };

        // // geoQueryData.l = {
        // //   0: dataJson.l.latitude,
        // //   1: dataJson.l.longitude 
        // // } 
        // // geoQueryData.g = dataJson.g;
        // // geoQueryData.routeId = dataJson.vehicle.trip.route_id;
        // // geoQueryData.busNumber = dataJson.vehicle.vehicle.id;
        refForGeoQuery.set(dataJson)
          .then(() => {
            // Data saved successfully!
            console.log("GeoData added successfully");
          })
          .catch((error) => {
            // The write failed...
            console.log("error in writing GeoData" + error);
          });


        // set(ref(db, '/Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids' + dataJson.routeId), dataJson)
        // .then(() => {
        //   // Data saved successfully!
        //   console.log("Document added successfully");
        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in writing document"+error);
        // });;

        // countScheduled=countScheduled+1;


      } else {
        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        ref.remove()
          .then(() => {
            // Data saved successfully!
            console.log("Document removed successfully");
          })
          .catch((error) => {
            // The write failed...
            console.log("error in removing GeoData" + error);
          });
        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        refForGeoQuery.remove()
          .then(() => {
            // Data saved successfully!
            console.log("Geodata removed successfully");
          })
          .catch((error) => {
            // The write failed...
            console.log("error in removing GeoData" + error);
          });
        // set(ref(db, '/Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids' + dataJson.routeId), null)
        // .then(() => {
        //   // Data saved successfully!
        //   console.log("Document deleted successfully");
        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in deleting document"+error);
        // });;

      }



      dataJson = {};
      geoQueryData = {};



      // }

    });


    // res.send("Success");
    console.log("Total bus entities number = " + totalBuses);
    console.log("Under 2 min count in end = " + countUnder2Min);
    console.log("Scheduled buses count in end = " + countScheduled);
    console.log("Success");
  } catch (error) {
    console.log("An error occured");
    console.error(error);
    // res.status(500).send("An error occurred.");

  }




});




exports.sheduledGTFSRTPubSubAsiaSouthEastOne = functions.region('asia-southeast1').pubsub.schedule('every 1 minutes').onRun(async (context) => {
  functions.logger.info("Hello logs!", { structuredData: true });

  // const now = new Date();
  // const epochSeconds = Math.round(now.getTime()/1000);

  const now = Date.now();
  const epochSeconds = Math.round(now / 1000);
  console.log("epoch seconds = " + epochSeconds);

  try {
    const fetchResponse = await fetch("https://otd.delhi.gov.in//api/realtime/VehiclePositions.pb?key=6pjlfBCJdApZBXuDjc4EwpCeTvuhmz73", {
      headers: {
        "x-api-key": "<redacted>",
      },
    });

    if (!fetchResponse.ok) {
      const error = new Error(`${fetchResponse.url}: ${fetchResponse.status} ${fetchResponse.statusText}`);
      error.res = fetchResponse;
      throw error;
    }


    const responseString = JSON.stringify(fetchResponse);
    const responseSizeInBytes = Buffer.from(responseString).length;

    console.log(`Egress data size: ${responseSizeInBytes} bytes`);

    const buffer = await fetchResponse.buffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    const totalBuses = feed.entity.length;

    var countScheduled = 0;
    var countUnder2Min = 0;
    var totalDeleteBusCount = 0;
    var totalAddBusCount = 0;


    // const promises = [];
    const updateRef = {};
    const deleteRef = {};

    feed.entity.forEach(async (entity) => {

      var dataJson = {};
      var geoQueryData = {};

      var time = entity.vehicle.timestamp.toNumber();

      //Checks for updated bus location which is atmost 60 sec. old
      const scheduleRelationship = entity.vehicle.trip.scheduleRelationship;
      if (time + 60 >= epochSeconds && !(scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED ||
        scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.REPLACEMENT)) {

        countUnder2Min++;
        countScheduled++;
        totalAddBusCount++;

        const geoHash = ngeohash.encode(entity.vehicle.position.latitude, entity.vehicle.position.longitude);

        dataJson.id = entity.id;
        dataJson.g = geoHash;

        dataJson.l = {
          0: entity.vehicle.position.latitude,
          1: entity.vehicle.position.longitude
        };
        dataJson.vehicle = {
          trip: {
            trip_id: entity.vehicle.trip.tripId,
            start_time: entity.vehicle.trip.startTime,
            start_date: entity.vehicle.trip.startDate,
            schedule_relationship: entity.vehicle.trip.scheduleRelationship,
            route_id: entity.vehicle.trip.routeId

          },
          position: {
            // latitude: entity.vehicle.position.latitude,
            // longitude: entity.vehicle.position.longitude,
            latlng: {
              latitude: entity.vehicle.position.latitude,
              longitude: entity.vehicle.position.longitude
            },
            speed: entity.vehicle.position.speed
          },

          timestamp: time,
          vehicle: {
            id: entity.vehicle.vehicle.id,
            label: entity.vehicle.vehicle.label
          }
        }




        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        updateRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id] = dataJson;

        // promises.push(
        //   ref.set(dataJson).then(() => {

        //     // functions.logger.info('Document added successfully');
        //   })
        // );

        // ref.set(dataJson)
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("Document added successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in writing document"+error);
        // });



        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        updateRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id] = dataJson;

        // promises.push(
        //   refForGeoQuery.set(dataJson).then(() => {
        //     // functions.logger.info('GeoData added successfully');
        //   })
        // );

        // refForGeoQuery.set(dataJson)
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("GeoData added successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in writing GeoData"+error);
        // });




      } else {
        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        deleteRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id] = null;

        // promises.push(
        //   ref.remove().then(() => {
        //     // functions.logger.info('Document removed successfully');
        //   })
        // );

        // ref.remove()
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("Document removed successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


        totalDeleteBusCount++;

        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        deleteRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id] = null;

        // promises.push(
        //   refForGeoQuery.remove().then(() => {
        //     // functions.logger.info('GeoData removed successfully');
        //   })
        // );


        // refForGeoQuery.remove()
        // .then(() =>
        //  {
        //   // Data saved successfully!
        //   // console.log("Geodata removed successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


      }



      dataJson = {};
      geoQueryData = {};



      // }

    });



    db.ref().update(updateRef).then(() => {
      // Data saved successfully!
      console.log("Updated " + totalAddBusCount + " nodes");

    });
    db.ref().update(deleteRef).then(() => {
      // Data saved successfully!
      console.log("deleted " + totalDeleteBusCount + " nodes");

    });

    // res.send("Success");
    console.log("Total bus entities number = " + totalBuses);
    console.log("Under 2 min count in end = " + countUnder2Min);
    console.log("Scheduled buses count in end = " + countScheduled);
    console.log("Total bus Added = " + totalAddBusCount);
    console.log("Total Deleted buses = " + totalDeleteBusCount);
    console.log("Success");
    //  res.send("Success");
    //  return Promise.all(promises);
    return null;
  } catch (error) {
    console.log("An error occured");
    console.error(error);
    // res.status(500).send("An error occurred.");
    return null;

  }




});



exports.deleteOutDatedGTFSRTPubSubAsiaSouthEastOne = functions.region('asia-southeast1').pubsub.schedule('every 5 minutes').onRun(async (context) => {
  functions.logger.info("Hello logs!", { structuredData: true });

  const now = Date.now();
  const epochSeconds = Math.round(now / 1000);
  console.log("epoch milliseconds = " + now);



  //    const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/');
  //    const refToRunningBuses = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/');

  //     var cutoff = epochSeconds - 5 * 60;
  //     console.log("cutoff time = ",cutoff);
  //     var updates = {};
  //     var count = 0;
  //     var oldItemsQuery = ref.orderByChild('vehicle/timestamp').endAt(cutoff);

  //     oldItemsQuery.once('value', function(snapshot) {
  //       // create a map with all children that need to be removed
  //       console.log("Children retrived = ",snapshot.numChildren());
  //       snapshot.forEach(function(child) {
  //         updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/"+child.val().id] = null

  //         // console.log("child key = ",child.key);
  //         count++;
  //         // console.log("child id = ",child.val().id);
  //         // console.log("cutoff time = ",cutoff);
  //         // console.log("child timestamp = ",child.val().vehicle.timestamp);

  //         // console.log("child = ",child.val());
  //         updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id+"/Buses/"+child.val().id] = null;
  //       });

  //       console.log("updates array size = ",updates.length);
  //       console.log("updates array size = "+count);
  //       // execute all updates in one go and return the result to end the function
  //       db.ref().update(updates).then(() =>{
  //         console.log("deleted "+count+" nodes");
  //         console.log("Success");
  //         // return res.sendStatus(200);
  //         return;
  //         }).catch(()=>{
  //           console.log("An error occured");
  //           // return res.send("An error occured");
  //           return;

  //         });

  //     });


  try {

    const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/');
    const refToRunningBuses = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/');

    var cutoff = epochSeconds - 5 * 60;
    console.log("cutoff time = ", cutoff);
    var updates = {};
    var count = 0;
    const snapshot = await ref.orderByChild('vehicle/timestamp').endAt(cutoff).once('value');

    console.log("Number of Retrived childern = " + snapshot.numChildren());



    snapshot.forEach(child => {
      //  updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/"+child.val().id] = null;
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/" + child.val().id] = null
      count++;
      //  updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id+"/Buses/"+child.val().id] = null;
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id + "/Buses/" + child.val().id] = null;
    });

    console.log("updates array size = ", Object.keys(updates).length);
    //  console.log("Updates = ",updates)

    await db.ref().update(updates, (error) => {
      if (error) {
        console.log("Error in update function = " + error.message);
      } else {
        console.log("Success in update function");
      }
    });

    console.log("deleted " + count + " nodes");
    console.log("Success");


    //  return res.send("Success");
    // Return null to indicate succe
    return null;


  } catch (error) {

    console.error("An error occurred:", error);
    throw error; // Throw the error to indicate failure
    //  return res.sendStatus(500);

  }



});




// Testing

exports.httpSheduledGTFSRTPubSubAsiaSouthEastOne = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  functions.logger.info("Hello logs!", { structuredData: true });

  // const now = new Date();
  // const epochSeconds = Math.round(now.getTime()/1000);

  const now = Date.now();
  const epochSeconds = Math.round(now / 1000);
  console.log("epoch seconds = " + epochSeconds);

  try {
    const fetchResponse = await fetch("https://otd.delhi.gov.in//api/realtime/VehiclePositions.pb?key=6pjlfBCJdApZBXuDjc4EwpCeTvuhmz73", {
      headers: {
        "x-api-key": "<redacted>",
      },
    });

    if (!fetchResponse.ok) {
      const error = new Error(`${fetchResponse.url}: ${fetchResponse.status} ${fetchResponse.statusText}`);
      error.res = fetchResponse;
      throw error;
    }


    const responseString = JSON.stringify(fetchResponse);
    const responseSizeInBytes = Buffer.from(responseString).length;

    console.log(`Egress data size: ${responseSizeInBytes} bytes`);

    const buffer = await fetchResponse.buffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    const totalBuses = feed.entity.length;

    var countScheduled = 0;
    var countUnder2Min = 0;
    var totalDeleteBusCount = 0;
    var totalAddBusCount = 0;


    // const promises = [];
    const updateRef = {};
    const deleteRef = {};

    feed.entity.forEach(async (entity) => {

      var dataJson = {};
      var geoQueryData = {};

      var time = entity.vehicle.timestamp.toNumber();

      //Checks for updated bus location which is atmost 60 sec. old
      const scheduleRelationship = entity.vehicle.trip.scheduleRelationship;
      if (time + 60 >= epochSeconds && !(scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.CANCELED ||
        scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripDescriptor.ScheduleRelationship.REPLACEMENT)) {

        countUnder2Min++;
        countScheduled++;
        totalAddBusCount++;

        const geoHash = ngeohash.encode(entity.vehicle.position.latitude, entity.vehicle.position.longitude);

        dataJson.id = entity.id;
        dataJson.g = geoHash;

        dataJson.l = {
          0: entity.vehicle.position.latitude,
          1: entity.vehicle.position.longitude
        };
        dataJson.vehicle = {
          trip: {
            trip_id: entity.vehicle.trip.tripId,
            start_time: entity.vehicle.trip.startTime,
            start_date: entity.vehicle.trip.startDate,
            schedule_relationship: entity.vehicle.trip.scheduleRelationship,
            route_id: entity.vehicle.trip.routeId

          },
          position: {
            // latitude: entity.vehicle.position.latitude,
            // longitude: entity.vehicle.position.longitude,
            latlng: {
              latitude: entity.vehicle.position.latitude,
              longitude: entity.vehicle.position.longitude
            },
            speed: entity.vehicle.position.speed
          },

          timestamp: time,
          vehicle: {
            id: entity.vehicle.vehicle.id,
            label: entity.vehicle.vehicle.label
          }
        }




        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        updateRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id] = dataJson;

        // promises.push(
        //   ref.set(dataJson).then(() => {

        //     // functions.logger.info('Document added successfully');
        //   })
        // );

        // ref.set(dataJson)
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("Document added successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in writing document"+error);
        // });



        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        updateRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id] = dataJson;

        // promises.push(
        //   refForGeoQuery.set(dataJson).then(() => {
        //     // functions.logger.info('GeoData added successfully');
        //   })
        // );

        // refForGeoQuery.set(dataJson)
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("GeoData added successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in writing GeoData"+error);
        // });




      } else {
        const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id);
        deleteRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/' + entity.vehicle.trip.routeId + "/Buses/" + entity.id] = null;

        // promises.push(
        //   ref.remove().then(() => {
        //     // functions.logger.info('Document removed successfully');
        //   })
        // );

        // ref.remove()
        // .then(() => {
        //   // Data saved successfully!
        //   // console.log("Document removed successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


        totalDeleteBusCount++;

        const refForGeoQuery = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id);
        deleteRef['Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/' + entity.id] = null;

        // promises.push(
        //   refForGeoQuery.remove().then(() => {
        //     // functions.logger.info('GeoData removed successfully');
        //   })
        // );


        // refForGeoQuery.remove()
        // .then(() =>
        //  {
        //   // Data saved successfully!
        //   // console.log("Geodata removed successfully");

        // })
        // .catch((error) => {
        //   // The write failed...
        //   console.log("error in removing GeoData"+error);
        // });


      }



      dataJson = {};
      geoQueryData = {};



      // }

    });



    db.ref().update(updateRef).then(() => {
      // Data saved successfully!
      console.log("Updated " + totalAddBusCount + " nodes");

    });
    db.ref().update(deleteRef).then(() => {
      // Data saved successfully!
      console.log("deleted " + totalDeleteBusCount + " nodes");

    });

    // res.send("Success");
    console.log("Total bus entities number = " + totalBuses);
    console.log("Under 2 min count in end = " + countUnder2Min);
    console.log("Scheduled buses count in end = " + countScheduled);
    console.log("Total bus Added = " + totalAddBusCount);
    console.log("Total Deleted buses = " + totalDeleteBusCount);
    console.log("Success");
    //  res.send("Success");
    //  return Promise.all(promises);
    return res.send("Success");
  } catch (error) {
    console.log("An error occured");
    console.error(error);
    // res.status(500).send("An error occurred.");
    return res.sendStatus(500);

  }




});




exports.httpDeleteOutDatedGTFSRTPubSubAsiaSouthEastOne = functions.region('asia-southeast1').https.onRequest(async (req, res) => {
  functions.logger.info("Hello logs!", { structuredData: true });

  const now = Date.now();
  const epochSeconds = Math.round(now / 1000);
  console.log("epoch milliseconds = " + now);

  try {

    const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/');
    const refToRunningBuses = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/');

    var cutoff = epochSeconds - 5 * 60;
    console.log("cutoff time = ", cutoff);
    var updates = {};
    var count = 0;
    // var oldItemsQuery = ref.orderByChild('vehicle/timestamp').endAt(cutoff);

    const snapshot = await ref.orderByChild('vehicle/timestamp').endAt(cutoff).once('value');

    // oldItemsQuery.once('value', function(snapshot) {


    //   console.log("childs retrieved = ",snapshot.numChildren());
    //   snapshot.forEach(function(child) {
    //     updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/"+child.val().id] = null

    //     // console.log("child key = ",child.key);
    //     count++;
    //     // console.log("child id = ",child.val().id);
    //     // console.log("cutoff time = ",cutoff);
    //     console.log("child info = ",{
    //       timestamp: child.val().vehicle.timestamp,
    //       route_id: child.val().vehicle.trip.route_id,
    //       vehical_number: child.val().id
    //     });


    //     // console.log("child = ",child.val());
    //     updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id+"/Buses/"+child.val().id] = null;
    //     console.log("Ref to del in Rote_Ids = "+"Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id+"/Buses/"+child.val().id);
    //   });

    //   console.log("updates array size = ",updates.length);
    //   console.log("updates array size = "+count);


    //   // execute all updates in one go and return the result to end the function
    //   db.ref().update(updates, (error) => {
    //     if (error) {
    //       // The write failed...
    //       console.log("Error occured in update function with message = ",error.message);
    //       console.log("Error occured in update function with stack = ",error.stack);

    //       console.log("Error occured in update function with name = ",error.name);

    //     } else {
    //       // Data saved successfully!
    //       console.log("No error occured in update function");
    //     }
    //   }).then(() =>{
    //     console.log("deleted "+count+" nodes");
    //     return res.sendStatus(200);
    //     }).catch(()=>{
    //       return res.send("An error occured");

    //     });

    // });

    console.log("Number of Retrived childern = " + snapshot.numChildren());



    snapshot.forEach(child => {
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/" + child.val().id] = null;
      count++;
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id + "/Buses/" + child.val().id] = null;
    });

    console.log("updates array size = " + count);
    console.log("Updates = ", updates)

    await db.ref().update(updates);

    console.log("deleted " + count + " nodes");
    console.log("Success");


    return res.send("Success");
    // Return null to indicate succe


  } catch (error) {

    console.error("An error occurred:", error);
    // throw error; // Throw the error to indicate failure
    return res.sendStatus(500);

  }


});


exports.inspectdbCountChildInGeoQueryAndRouteIdBranch = functions.region('asia-southeast1').https.onRequest(async (req, res) => {


  const ref = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/');
  const refToRouteIds = db.ref('Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/');


  var cutoff = epochSeconds - 5 * 60;
  console.log("cutoff time = ", cutoff);
  var updates = {};
  var count = 0;
  var oldItemsQuery = ref.orderByChild('vehicle/timestamp').endAt(cutoff);
  var oldEntriesInGeoQuery = [];
  var oldeEntriesInRouteIds = [];
  var countInGeoQuery = 0;
  var countInRouteIds = 0;

  oldItemsQuery.once('value', function (snapshot) {
    // create a map with all children that need to be removed

    console.log("childs retrieved = ", snapshot.numChildren());
    snapshot.forEach(function (child) {
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/" + child.val().id] = null

      // console.log("child key = ",child.key);
      count++;
      // console.log("child id = ",child.val().id);
      // console.log("cutoff time = ",cutoff);
      console.log("child info = ", {
        timestamp: child.val().vehicle.timestamp,
        route_id: child.val().vehicle.trip.route_id,
        vehical_number: child.val().id
      });

      // console.log("child = ",child.val());
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id + "/Buses/" + child.val().id] = null;
    });

  });


  refToRouteIds.once('value', function (snapshot) {
    // create a map with all children that need to be removed

    console.log("childs in route_ids = ", snapshot.numChildren());
    snapshot.forEach(function (child) {
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/GeoQuery/" + child.val().id] = null

      // console.log("child key = ",child.key);
      count++;
      // console.log("child id = ",child.val().id);
      // console.log("cutoff time = ",cutoff);
      console.log("child info = ", {
        timestamp: child.val().vehicle.timestamp,
        route_id: child.val().vehicle.trip.route_id,
        vehical_number: child.val().id
      });

      // console.log("child = ",child.val());
      updates["Real time track/Delhi/DIMTS/Buses/All_Running_Buses/Route_Ids/" + child.val().vehicle.trip.route_id + "/Buses/" + child.val().id] = null;
    });

  });




})