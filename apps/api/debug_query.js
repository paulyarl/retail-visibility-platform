const updateFields = [];
const updateValues = [];
let paramIndex = 3;

if (rating !== undefined) {
  updateFields.push('rating = $' + paramIndex++);
  updateValues.push(rating);
}
if (reviewText !== undefined) {
  updateFields.push('review_text = $' + paramIndex++);
  updateValues.push(reviewText);
}

updateFields.push('updated_at = NOW()');
updateValues.push(reviewId);

console.log('Update fields:', updateFields);
console.log('Update values:', updateValues);
console.log('Final paramIndex:', paramIndex);
