// timezone-hours.js

function generateHours() {
  const hours = [];

  // AM hours
  for (let h = 1; h <= 12; h++) {
    hours.push({
      label: `${h}:xx AM`,
      value: `${h}-AM`
    });
  }

  // PM hours
  for (let h = 1; h <= 12; h++) {
    hours.push({
      label: `${h}:xx PM`,
      value: `${h}-PM`
    });
  }

  return hours;
}

const hourList = generateHours();

module.exports = { hourList };
