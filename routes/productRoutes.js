const express = require('express');
//const authController = require('./../controller/authController');
const productControlller = require('./../controller/productController')

const router = express.Router();

//router.use(authController.protect);

router
  .route('/')
  .get(productControlller.getAllProducts)
  .post(
    productControlller.createProduct
  );

router
  .route('/:id')
  .get(productControlller.getProduct)
  .patch(
    //authController.restrictTo('user', 'admin'),
    productControlller.updateProduct
  )
  .delete(
    //authController.restrictTo('user', 'admin'),
    productControlller.deleteProduct
  );

module.exports = router;
