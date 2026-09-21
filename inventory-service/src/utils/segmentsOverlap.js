const segmentsOverlap = (firstFrom, firstTo, secondFrom, secondTo) => (
     Number(firstFrom) < Number(secondTo) && Number(firstTo) > Number(secondFrom)
);

module.exports = { segmentsOverlap };
