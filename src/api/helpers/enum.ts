export const enumToArray = (object) => {
  const res = {};
  for (const name in object) {
    if (Object.prototype.hasOwnProperty.call(object, name)) {
      const num = object[name];
      for (const [key, value] of Object.entries(num)) {
        if (!Number.isNaN(Number(key))) {
          continue;
        }
        if (!res[name]) {
          res[name] = [];
        }
        res[name].push({ id: value, name: key });
      }
    }
  }
  return res;
};

const stringIsNumber = (value) => isNaN(Number(value)) === false;

// Turn enum into array
export const contains = (enumme, q: string) =>
  Object.keys(enumme)
    .filter(stringIsNumber)
    .map((key) => enumme[key])
    .filter((f) => {
      if (f.match(new RegExp(q, 'i'))) {
        return f;
      }
    });
