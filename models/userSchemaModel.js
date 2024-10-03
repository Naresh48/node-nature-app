const mongoose = require('mongoose');
//const slugify = require('slugify');
//const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    unique: true,
    trim: true,
  },
  slug: String,
  password: {
    type: String,
    required: [true, 'A user must have password'],
    unique: true,
    trim: true,
    minlength: [5],
    maxlength: [40],
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!',
    },
  },
//////this field change whenever password will change/////////
  passwordChangedAt: Date,
//when password reset functionality run executed//////
  passwordResetToken: String,
  passwordResetExpires: Date,
//////////////////////////////////////////////////////
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true, // Ensure email is unique in the database
    lowercase: true, // Converts the email to lowercase before saving
    validate: {
      validator: function (email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); // Simple regex for email validation
      },
      message: 'Please enter a valid email address',
    },
  },
  role: {
    type: String,
    required: [true],
    message: 'Please enter role of a user like user/admin/guide/lead-guide',
  },
  active: {
    type: Boolean,
    default: true,
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create()////////////////////////
// userSchema.pre('save', function (next) {
//   if (!this._id) {
//     this._id = uuidv4(); // Generate a new unique string for _id if not provided
//   }
//   this.slug = slugify(this.name, { lower: true });
//   next();
// });

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});
///////////////////////////////////////////////////////////////////////

//////query that will return only active user in response//////////////
userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});
///////////////////////////////////////////////////////////////////////

//////////////////////compare user input password with database password////////
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};


////////after password will change, check passwordChangedAt is always ahead of the previous JWT timestamp//////////
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};


///////create password reset token and give the value of passwordResetExpires field/////////////////////////
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema, 'user'); //to select exact match.

module.exports = User;
