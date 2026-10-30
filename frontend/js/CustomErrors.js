console.log("CustomErrors.js");

class InvalidDimensionError extends Error{
  constructor (dimension){
    let message= "The dimension passed is not valid";
    if (dimension< 0){
      message= "The dimension passed must be greather than 0.";
    }
    else if (! Number.isInteger(dimension)){
      message= "The dimension must be an integer number.";
    }
    
    message+= `\nDimension passed: ${dimension}.`;
    super(message);
    this.name= "InvalidDimensionError";
  }
}

class CoordOutOfBoundsError extends Error{
  constructor(coord, width, height, message= `The coord you passed is not valid.\nCoord entered: [${coord[0]}, ${coord[1]}]\nMax x: ${width-1}\nMax y: ${height-1}`){
    super(message);
    this.name= "coordOutOfBoundsError";
  }
}

class EmptyArgumentError extends Error{
  constructor(message= "this function must have at least one argument passed"){
    super(message);
    this.name= "EmptyArgumentError";
  }
}

class OutOfOptionsGroupsError extends Error{
  constructor(message="there are no more options groups to choose from"){
    super(message);
    this.name= "OutOfOptionsGroupsError";
  }
}

class NotImplementedError extends Error{
  constructor(message="This function has not been implemented jet"){
    super(message);
    this.name= "NotImplementedError";
  }
}

class NumberNotInRangeError extends Error{
  constructor(n= null, minValue= null, maxValue= null, message="This number passed is not in the correct range"){
    const minValueSpecified= minValue!== null;
    const maxValueSpecified= maxValue!== null;

    if (minValueSpecified && maxValueSpecified){
      message= `This number must be higher than ${minValue} and lower than ${maxValue}.`;
    }
    else if (minValueSpecified){
      message= `This number must be higher than ${minValue}`;
    }
    else if (maxValueSpecified){
      message= `This number must be lower than ${maxValue}`;
    }

    const numberSpecified= n!== null;
    if (numberSpecified){
      message+= `\nNumber passed: ${n}`;
    }

    super(message);
    this.name= "NumberNotInRangeError";
  }
}

class NumberNotIngerError extends Error{
  constructor(n= null, message="The number must be an integer"){
    const numberSpecified= n!== null;
    if (numberSpecified){
      message+= `\nNumber passed: ${n}`;
    }

    super(message);
    this.name= "NumberNotIngerError";
  }
}

class NumberNotPossibleError extends Error{
  constructor(n= null, possibleNumbers= null, message="The number passed does not belong to the possible ones"){
    if (n!== null){
      message+= `\nNumber passed: ${n}`;
    }

    if (possibleNumbers!== null){
      message+= `\nAccepted numbers: ${Array.from(possibleNumbers)}`;
    }

    super(message);
    this.name= "NumberNotPossibleError";
  }
}

class InvalidMatrixShapeError extends Error{
  constructor(message="The matrix isn't either a square or a matrix"){
    super(message);
    this.name= "InvalidMatrixShapeError";
  }
}