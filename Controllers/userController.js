const Buyer = require("../Models/buyerModel");
const Seller = require("../Models/sellerModel");
const FarmSeller = require("../Models/farmSellerModel");
const Product = require("../Models/productModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const factory = require("./handlerFactory");
const mongoose = require("mongoose");
const ObjectId = require("mongodb").ObjectID;
let User;
const setUser = (res) => {
  if (res.locals.user == "buyer") User = Buyer;
  else if (res.locals.user == "seller") User = Seller;
  else User = FarmSeller;
};
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  setUser(res);

  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword.",
        400
      )
    );
  }
  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, "name", "email");
  // 3) Update user
  let updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    runValidators: true,
  });
  if (req.body.location) {
    const temp = req.body.location.coordinates[0];
    req.body.location.coordinates[0] = req.body.location.coordinates[1];
    req.body.location.coordinates[1] = temp;

    updatedUser = await User.findByIdAndUpdate(req.user.id, {
      location: req.body.location,
    });
  }

  // Yes, it's a valid ObjectId, proceed with `findById` call.

  res.status(200).json({
    status: "success",
    data: {
      User: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  setUser(res);
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
exports.getUser = factory.getOne(User);

exports.getAllUsers = factory.getAll(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

exports.addToCart = catchAsync(async (req, res, next) => {
  try {
    setUser(res);
    const buyer = await User.findById(req.user.id);
    let cart,
      cartQty,
      flag = 0,
      index;
    if (!buyer.cart) {
      buyer.cart = [];
      buyer.cartQty = [];
    }

    buyer.cart.every((el, i) => {
      if (el == req.params.id) {
        flag = 1;
        index = i;
        return false;
      }
      return true;
    });
    if (flag == 0) {
      cart = [...buyer.cart, req.params.id];
      cartQty = [...buyer.cartQty, req.params.qty];
    } else {
      cartQty = [...buyer.cartQty];
      cartQty[index] += Number(req.params.qty);
      cart = [...buyer.cart];
    }

    const updatedBuyer = await User.findByIdAndUpdate(req.user.id, {
      cart,
      cartQty,
    });
    res.status(200).json({
      status: "success",
      data: {
        User: updatedBuyer,
      },
    });
  } catch (e) {
    console.log(e);
  }
});
exports.updateCart = catchAsync(async (req, res, next) => {
  setUser(res);
  let index;
  const buyer = await User.findById(req.user.id);
  buyer.cart.every((el, i) => {
    if (el == req.params.id) {
      index = i;
      return false;
    }
    return true;
  });
  buyer.cartQty[index] = req.params.qty;
  const cartQty = buyer.cartQty;
  const updatedBuyer = await User.findByIdAndUpdate(req.user.id, {
    cartQty,
  });
  res.status(200).json({
    status: "success",
    data: {
      User: updatedBuyer,
    },
  });
});
exports.rmCart = catchAsync(async (req, res, next) => {
  setUser(res);
  // console.log(req.params.id);
  const buyer = await User.findById(req.user.id);
  for (let i = Number(req.params.id); i < buyer.cart.length - 1; i++) {
    // console.log(buyer.cart[i + 1], buyer.cart[i], i);
    buyer.cart[i] = buyer.cart[i + 1];
    buyer.cartQty[i] = buyer.cartQty[i + 1];
  }
  buyer.cart.pop(buyer.cart.length - 1);
  buyer.cartQty.pop(buyer.cart.length - 1);
  const cart = buyer.cart;
  const cartQty = buyer.cartQty;
  const updatedBuyer = await User.findByIdAndUpdate(req.user.id, {
    cart,
    cartQty,
  });
  res.status(200).json({
    status: "success",
    data: {
      User: updatedBuyer,
    },
  });
});

// /tours-within/:distance/center/:latlng
// /tours-within/233/center/13.058029017820031, 80.27323196844695
exports.getUserWithin = catchAsync(async (req, res, next) => {
  setUser(res);
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(",");

  const radius = distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        "Please provide latitude and longitude in the format lat,lng.",
        400
      )
    );
  }

  const users = await User.find({
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      data: users,
    },
  });
});
