import React from 'react';
import ExerciseSession from './ExerciseSession';
import { fetchDueReviews, gradeReview } from '../services/reviewService';

/** The scheduled review: due words, graded into the spaced-repetition schedule. */
export default function ReviewScreen() {
  return <ExerciseSession load={fetchDueReviews} grade={gradeReview} />;
}
