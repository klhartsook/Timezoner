// timezone-hours.js

function generateHours() {
  const hours = [];

  // AM hours
  for (let h = 1; h <= 12; h++) {
    hours.push({
      name: `${h}:xx AM`,
      value: `${h}-AM`
    });
  }

  // PM hours
  for (let h = 1; h <= 12; h++) {
    hours.push({
      name: `${h}:xx PM`,
      value: `${h}-PM`
    });
  }

  return hours;
}

const hourList = generateHours();

module.exports = { hourList };
