// const fs = require('fs');

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

// exports.checkID = (req, res, next, val) => {
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }
//   next();
// };

// exports.checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Missing name or price',
//     });
//   }
//   next();
// };

const Tour = require('./../models/tourSchema');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handleFactory');
const multer = require('multer');
const sharp = require('sharp');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single('image') req.file
// upload.array('images', 5) req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/${filename}`);

      req.body.images.push(filename);
    }),
  );

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
// exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.getTour = factory.getOne(Tour);
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  //for stats logic we use aggregate mongoDB operator on tour data
  //and define stages related to that
  //first is match that matching data with condition in all data
  //second group the fields and create new response with new fields like
  //{_id:"easy",
  //  numTours:3} etc..
  //here toUpper or sum or avg is statistical and predefine fn
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  //first of all we use aggregate operator for mongoDB on data
  //unwind means select field with array and array has subfield,
  //now for each subfield it give response attached to that array
  //then match with start date and give only particular year's
  //response data (year wise response)
  //then group is used for new response after above stages
  //in that $month mongoDB date aggregator operator is used
  //for getting month in number from whole date like 0=january
  //and 12=december then how many tours in that month appeare
  //we can show that tour name too with $push field name
  //now simply one more field add to that response is month and
  //give it a value that is id and then remove _id
  //than sort the tours total by decending
  //and finally we can see that in which month more tours
  //are go and their name..here limit is an example that
  //shows that we can get only 12 objects out of all.
  const year = req.params.year * 1; // 2021

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates',
    },
    {
      $addFields: {
        startDateAsDate: { $toDate: '$startDates' },
      },
    }, // beacuse we always ensure that date is in correct formate.
    {
      $match: {
        startDateAsDate: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDateAsDate' },
        numTour: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numTour: -1 },
    },
    // {
    //   $limit: 12,
    // },
  ]);

  res.status(200).json({
    status: 'success',
    results: plan.length,
    data: {
      plan,
    },
  });
});

// /tours-within/:distance/center/:latlng/unit/:unit
// /tours-within/233/center/34.111745,-118.113491/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400,
      ),
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

//This is the distance between the input coordinates (23.013658,72.543945) and the starting location of each tour in kilometers. For example, the tour named Adventure-Nikit8-geo is about 6287.9 kilometers away from the provided coordinates.
// {
// "_id": "66fb7cf1e86c662dac970e53",
//  "name": "Adventure-Nikit8-geo",
//  "distance": 6287.903090683865
//},

//The API helps you find all the tours near a specific location and returns the distance between that location and the start location of each tour. It's useful for scenarios where you need to display the distance to different tour destinations from a user's location.

//The MongoDB aggregation pipeline uses the $geoNear stage to find documents (tours) near the given coordinates. It calculates the distance between the provided coordinates (latlng) and the startLocation (geospatial data) of each tour.

//near: This specifies the point from which distances are calculated. In your case, it's [72.543945, 23.013658] (Ahmedabad).
//spherical: true: This option tells MongoDB to use spherical geometry (i.e., it assumes the Earth is a sphere, which is more accurate for geographic calculations).
exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitutr and longitude in the format lat,lng.',
        400,
      ),
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
        spherical: true,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
