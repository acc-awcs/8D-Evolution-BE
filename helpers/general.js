export const generateCode = () => {
  // Returns a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000);
};
