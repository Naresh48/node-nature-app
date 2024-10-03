class APIFeatures {
  constructor(query, queryString) {
    //query is ?fields=name,duration,price or ?duration[gte]=5 or ?sort=price or ?sort=-price,duration ?page=2
    //or ?name='john' etc after the request and its stringify verion is queryString
    //we need stringify version because initially in javascript logical operators are not with $ sign
    //we put manually the $ sign before the logical operators like
    //$gt $gte $lt $lte
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    //first of all we made object from querystring and excluded the other fields from query
    //to filter by only given data fields and then again stringify it and add $ for logical
    //operators and then find according to that query
    const queryObj = { ...this.queryString };

    // Remove quotes from the name field if present
    if (queryObj.name) {
      queryObj.name = queryObj.name.replace(/['"]+/g, '');
    }

    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`); //here g is for all

    this.query = this.query.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    //in query of sort is appear then query adds that one sort field or given multiple sort fields
    //for that we should join that multiple fields with comma and give it to the sort query
    //if sort is not there in the query then by defualt we can sort by createdAt decending
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    //if we want to find data only with specific fields, not all fields then
    //this fn is on action and here __v is including field and by default
    //we can set -__v, that is for excluding field query and given all data fields
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}
module.exports = APIFeatures;
