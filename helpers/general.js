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
  // Returns a random 6-digit code
  // return Math.floor(100000 + Math.random() * 900000);
  return createRandomString(6);
};
