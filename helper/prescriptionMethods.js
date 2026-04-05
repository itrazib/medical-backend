// === helper/calculateAge.js ===

/**
 * Calculates age in years from date of birth
 * @param {string|Date} dob - Date of birth
 * @returns {number} age in years
 */
export const calculateAge = (dob) => {
  if (!dob) return null; // handle empty/null input

  const today = new Date();
  const birthDate = new Date(dob);

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

