const createRandomString = length => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateCode = () => {
  // Returns a random 6-digit code, uppercase letters included
  return createRandomString(6);
};

export const generateNumericCode = () => {
  // Returns a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000);
};

export const getUniqueCode = async (generator, MongooseObj, key, secondKey) => {
  let codeIsUnique = false;
  // Check to make sure there aren't any other objects with that code out there.
  // If so, generate a new code.
  let code;
  while (!codeIsUnique) {
    code = generator();
    const matchingObjs = await MongooseObj.find({ [key]: code });
    codeIsUnique = matchingObjs.length < 1;
    if (codeIsUnique && secondKey) {
      const secondaryMatchingObjs = await MongooseObj.find({ [secondKey]: code });
      codeIsUnique = secondaryMatchingObjs.length < 1;
    }
  }
  return code;
};

export const generateUniqueCookieId = () => {
  const dateString = Date.now().toString(36);
  const randomness = Math.random().toString(36).substring(2);
  return dateString + randomness;
};
